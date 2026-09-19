import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body,{status,headers:corsHeaders})
}

type JsonRecord = Record<string, unknown>
type Listing = {
  id: string
  title: string
  url: string
  imageUrl: string
  endDate: string
  openingBid: number | null
  currentBid: number | null
  nextBid: number | null
  buyNowPrice: number | null
  bidCount: number
  saleTypes: string[]
  currency: string
}

type AlertRow = {
  id: number
  user_id: string
  album_id: number
  max_price: number
  currency: string
  tradera_enabled: boolean
  ebay_enabled: boolean
  fixed_price: boolean
  auction: boolean
  ebay_marketplace_id: string
  album?: {
    title?: string
    cover_url?: string
    artist?: { name?: string } | null
  } | null
} 

let cachedEbayToken = ''
let cachedEbayTokenExpiresAt = 0
const fxCache = new Map<string,{rate:number,savedAt:number}>()
const supportedMarketplaceIds = new Set([
  'EBAY_US','EBAY_AT','EBAY_AU','EBAY_BE','EBAY_CA','EBAY_CH','EBAY_DE',
  'EBAY_ES','EBAY_FR','EBAY_GB','EBAY_HK','EBAY_IE','EBAY_IT','EBAY_MY',
  'EBAY_NL','EBAY_PH','EBAY_PL','EBAY_SG','EBAY_TW'
])

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function firstValue(record: JsonRecord, names: string[]): unknown {
  for (const name of names) if (record[name] !== undefined && record[name] !== null) return record[name]
  return undefined
}

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  const nested = asRecord(value)
  const amount = firstValue(nested,['amount','Amount','value','Value'])
  return amount === undefined ? null : numberValue(amount)
}

function imageValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageValue(item)
      if (found) return found
    }
    return ''
  }
  const image = asRecord(value)
  return textValue(firstValue(image,['url','Url','URL','link','Link','imageUrl','ImageUrl','thumbnailLink','ThumbnailLink']))
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b(the|a|an|and|of|deluxe|remaster(?:ed)?|anniversary|edition)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').trim()
}

function relevantListing(title: string, artist: string, album: string): boolean {
  const haystack=normalizeSearchText(title)
  const artistTerms=normalizeSearchText(artist).split(' ').filter((term)=>term.length>1)
  const albumTerms=normalizeSearchText(album).split(' ').filter((term)=>term.length>1)
  if(!haystack||!albumTerms.length)return true
  const artistHits=artistTerms.filter((term)=>haystack.includes(term)).length
  const albumHits=albumTerms.filter((term)=>haystack.includes(term)).length
  return (!artistTerms.length||artistHits>=Math.max(1,Math.ceil(artistTerms.length*.5))) &&
    albumHits>=Math.max(1,Math.ceil(albumTerms.length*.6))
}

function isVinylLpListing(title: string): boolean {
  const normalized=normalizeSearchText(title)
  const rejected=[
    /\bcd\b/,/\bdvd\b/,/\bvhs\b/,/\bblu ray\b/,/\bcassette\b/,/\bkassett\b/,
    /\bmug\b/,/\bmugg\b/,/\bt shirt\b/,/\bshirt\b/,/\bpin badge\b/,/\bbadge\b/,
    /\bposter\b/,/\bbook\b/,/(?:^|\s)7\s*(?:inch|tum)(?:\s|$)/,/(?:^|\s)7(?:\s|$)/,
    /\bsingel\b/,/\bsingle\b/
  ]
  return !rejected.some((pattern)=>pattern.test(normalized))
}

function isAlbumListing(title: string, artist: string, album: string): boolean {
  const normalized=normalizeSearchText(title)
  const normalizedArtist=normalizeSearchText(artist)
  const normalizedAlbum=normalizeSearchText(album)
  if(normalizedArtist&&normalizedArtist===normalizedAlbum){
    const escaped=normalizedArtist.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')
    const remainder=normalized
      .replace(new RegExp('\\b'+escaped+'\\b'),' ')
      .replace(new RegExp('\\b'+escaped+'\\b'),' ')
      .replace(/\b(?:self titled|debut|album|vinyl|skiva|gatefold|lp|\d+x?lp|(?:180|200)g)\b/g,' ')
      .replace(/\b(?:19|20)\d{2}\b/g,' ')
      .replace(/\b(?:sweden|swedish|sverige|germany|german|canada|canadian|uk|us|usa|eu|press|pressing|first|1st|original|mono|stereo|sealed|new|ny)\b/g,' ')
      .replace(/\s+/g,' ').trim()
    return !remainder
  }
  return true
}

function traderaItemScore(value: unknown): number {
  const item=asRecord(value)
  let score=0
  if(firstValue(item,['id','Id','itemId','ItemId'])!==undefined)score++
  if(firstValue(item,['shortDescription','ShortDescription','title','Title']))score++
  if(firstValue(item,['itemLink','ItemLink','url','Url']))score++
  if(firstValue(item,['endDate','EndDate','thumbnailLink','ThumbnailLink']))score++
  return score
}

function findListingArray(value: unknown,depth=0): unknown[] {
  if(depth>6)return []
  if(Array.isArray(value)){
    if(value.length&&value.some((item)=>traderaItemScore(item)>=2))return value
    let best:unknown[]=[]
    for(const item of value){
      const candidate=findListingArray(item,depth+1)
      if(candidate.length>best.length)best=candidate
    }
    return best
  }
  const record=asRecord(value)
  for(const key of ['items','Items','searchItems','SearchItems','itemList','ItemList','results','Results']){
    const candidate=findListingArray(record[key],depth+1)
    if(candidate.length)return candidate
  }
  let best:unknown[]=[]
  for(const child of Object.values(record)){
    const candidate=findListingArray(child,depth+1)
    if(candidate.length>best.length)best=candidate
  }
  return best
}

function traderaListingUrl(item: JsonRecord,id:string,title:string): string {
  const supplied=textValue(firstValue(item,['itemLink','ItemLink','itemUrl','ItemUrl','url','Url']))
  if(supplied)return supplied
  const categoryValue=firstValue(item,['categoryId','CategoryId'])
  const category=asRecord(firstValue(item,['category','Category']))
  const categoryId=textValue(categoryValue??firstValue(category,['id','Id','categoryId','CategoryId']))
  if(!id||!categoryId)return ''
  const slug=normalizeSearchText(title).replace(/\s+/g,'-').slice(0,90)
  return 'https://www.tradera.com/item/'+categoryId+'/'+id+(slug?'/'+slug:'')
}

function normalizeTradera(value:unknown):Listing {
  const item=asRecord(value)
  const id=textValue(firstValue(item,['id','Id','itemId','ItemId']))
  const title=textValue(firstValue(item,['shortDescription','ShortDescription','title','Title','name','Name']))
  const openingBid=numberValue(firstValue(item,['openingBid','OpeningBid']))
  const currentBid=numberValue(firstValue(item,['maxBid','MaxBid','currentBid','CurrentBid']))
  const nextBid=numberValue(firstValue(item,['nextBid','NextBid']))
  const buyNowPrice=numberValue(firstValue(item,['buyItNowPrice','BuyItNowPrice']))
  const bidCount=numberValue(firstValue(item,['totalBids','TotalBids']))||0
  const saleTypes:string[]=[]
  if(buyNowPrice&&buyNowPrice>0)saleTypes.push('fixed')
  if((openingBid&&openingBid>0)||(currentBid&&currentBid>0)||(nextBid&&nextBid>0)||bidCount>0)saleTypes.push('auction')
  return {
    id,title,url:traderaListingUrl(item,id,title),
    imageUrl:imageValue(firstValue(item,['detailedImageLinks','DetailedImageLinks','imageLinks','ImageLinks','thumbnailLink','ThumbnailLink','imageUrl','ImageUrl'])),
    endDate:textValue(firstValue(item,['endDate','EndDate'])),openingBid,currentBid,nextBid,buyNowPrice,bidCount,saleTypes,
    currency:textValue(firstValue(item,['currency','Currency']))||'SEK'
  }
}

async function searchTradera(artist:string,album:string):Promise<Listing[]> {
  const appId=Deno.env.get('TRADERA_APP_ID')||''
  const appKey=Deno.env.get('TRADERA_APP_KEY')||''
  if(!appId||!appKey)throw new Error('Tradera is not configured')
  const params=new URLSearchParams({query:artist+' '+album,categoryId:'2108',pageNumber:'0'})
  const response=await fetch('https://api.tradera.com/v4/search?'+params.toString(),{
    headers:{Accept:'application/json','X-App-Id':appId,'X-App-Key':appKey}
  })
  if(!response.ok)throw new Error('Tradera search failed: '+response.status)
  const payload=await response.json()
  const now=Date.now()
  return findListingArray(payload).map(normalizeTradera)
    .filter((listing)=>listing.id||listing.url)
    .filter((listing)=>!listing.endDate||new Date(listing.endDate).getTime()>now)
    .filter((listing)=>relevantListing(listing.title,artist,album))
    .filter((listing)=>isVinylLpListing(listing.title))
    .filter((listing)=>isAlbumListing(listing.title,artist,album))
    .filter((listing,index,all)=>all.findIndex((candidate)=>(candidate.id||candidate.url)===(listing.id||listing.url))===index)
    .slice(0,60)
}

async function getEbayToken():Promise<string> {
  if(cachedEbayToken&&Date.now()<cachedEbayTokenExpiresAt-60_000)return cachedEbayToken
  const clientId=Deno.env.get('EBAY_CLIENT_ID')||''
  const clientSecret=Deno.env.get('EBAY_CLIENT_SECRET')||''
  if(!clientId||!clientSecret)throw new Error('eBay is not configured')
  const response=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{
    method:'POST',
    headers:{Authorization:'Basic '+btoa(clientId+':'+clientSecret),'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
  })
  if(!response.ok)throw new Error('eBay token failed: '+response.status)
  const payload=asRecord(await response.json())
  cachedEbayToken=textValue(payload.access_token)
  cachedEbayTokenExpiresAt=Date.now()+Math.max(60,numberValue(payload.expires_in)||7200)*1000
  if(!cachedEbayToken)throw new Error('eBay returned no token')
  return cachedEbayToken
}

function normalizeEbay(value:unknown):Listing {
  const item=asRecord(value)
  const image=asRecord(item.image)
  const thumbnails=Array.isArray(item.thumbnailImages)?item.thumbnailImages:[]
  const thumbnail=asRecord(thumbnails[0])
  const price=asRecord(item.price)
  const currentBidValue=asRecord(item.currentBidPrice)
  const buyingOptions=Array.isArray(item.buyingOptions)?item.buyingOptions.map((option)=>textValue(option).toUpperCase()).filter(Boolean):[]
  const isAuction=buyingOptions.includes('AUCTION')
  const isFixed=buyingOptions.includes('FIXED_PRICE')||(!isAuction&&numberValue(price.value)!==null)
  const saleTypes:string[]=[]
  if(isFixed)saleTypes.push('fixed')
  if(isAuction)saleTypes.push('auction')
  return {
    id:textValue(item.itemId),title:textValue(item.title),url:textValue(item.itemWebUrl),
    imageUrl:textValue(image.imageUrl)||textValue(thumbnail.imageUrl),endDate:textValue(item.itemEndDate),
    openingBid:null,currentBid:isAuction?(numberValue(currentBidValue.value)??numberValue(price.value)):null,nextBid:null,
    buyNowPrice:isFixed?numberValue(price.value):null,bidCount:numberValue(item.bidCount)||0,saleTypes,
    currency:textValue(price.currency)||textValue(currentBidValue.currency)||'EUR'
  }
}

async function searchEbay(artist:string,album:string,marketplaceId:string):Promise<Listing[]> {
  const token=await getEbayToken()
  const marketplace=supportedMarketplaceIds.has(marketplaceId)?marketplaceId:'EBAY_US'
  const params=new URLSearchParams({q:artist+' '+album+' vinyl LP',limit:'100'})
  const response=await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?'+params.toString(),{
    headers:{Authorization:'Bearer '+token,Accept:'application/json','X-EBAY-C-MARKETPLACE-ID':marketplace}
  })
  if(!response.ok)throw new Error('eBay search failed: '+response.status)
  const payload=asRecord(await response.json())
  const items=Array.isArray(payload.itemSummaries)?payload.itemSummaries:[]
  const now=Date.now()
  return items.map(normalizeEbay)
    .filter((listing)=>listing.id&&listing.url)
    .filter((listing)=>!listing.endDate||new Date(listing.endDate).getTime()>now)
    .filter((listing)=>relevantListing(listing.title,artist,album))
    .filter((listing)=>isVinylLpListing(listing.title))
    .filter((listing)=>isAlbumListing(listing.title,artist,album))
    .filter((listing,index,all)=>all.findIndex((candidate)=>candidate.id===listing.id)===index)
    .slice(0,60)
}

async function fxRate(from:string,to:string):Promise<number> {
  from=from.toUpperCase();to=to.toUpperCase()
  if(from===to)return 1
  const key=from+'-'+to
  const cached=fxCache.get(key)
  if(cached&&Date.now()-cached.savedAt<12*60*60*1000)return cached.rate
  const response=await fetch('https://api.frankfurter.dev/v2/rate/'+encodeURIComponent(from.toLowerCase())+'/'+encodeURIComponent(to.toLowerCase()),{
    headers:{Accept:'application/json'}
  })
  if(!response.ok)throw new Error('FX rate unavailable: '+response.status)
  const data=asRecord(await response.json())
  const rate=Number(data.rate)
  if(!Number.isFinite(rate)||rate<=0)throw new Error('Invalid FX rate')
  fxCache.set(key,{rate,savedAt:Date.now()})
  return rate
}

async function matchingRows(alert:AlertRow,listings:Listing[],marketplace:string){
  const matches:JsonRecord[]=[]
  for(const listing of listings){
    const candidates:{saleType:string,amount:number|null}[]=[]
    if(alert.fixed_price&&listing.saleTypes.includes('fixed'))candidates.push({saleType:'fixed',amount:listing.buyNowPrice})
    if(alert.auction&&listing.saleTypes.includes('auction'))candidates.push({saleType:'auction',amount:listing.nextBid||listing.currentBid||listing.openingBid})

    const qualifying:{saleType:string,amount:number,converted:number}[]=[]
    for(const candidate of candidates){
      const amount=Number(candidate.amount||0)
      if(!Number.isFinite(amount)||amount<=0)continue
      try{
        const rate=await fxRate(listing.currency,alert.currency)
        const converted=amount*rate
        if(converted<Number(alert.max_price))qualifying.push({saleType:candidate.saleType,amount,converted})
      }catch(error){
        if(listing.currency.toUpperCase()===alert.currency.toUpperCase()&&amount<Number(alert.max_price)){
          qualifying.push({saleType:candidate.saleType,amount,converted:amount})
        }
      }
    }

    if(!qualifying.length)continue
    const best=qualifying.sort((left,right)=>left.converted-right.converted)[0]
    matches.push({
      marketplace,
      listing_id:listing.id||listing.url,
      listing_title:listing.title,
      listing_url:listing.url,
      sale_type:best.saleType,
      original_price:Math.round(best.amount*100)/100,
      original_currency:listing.currency,
      matched_price:Math.round(best.converted*100)/100
    })
  }
  return matches
}

async function marketplaceState(alert:AlertRow,listings:Listing[]){
  let count=0
  let lowest:number|null=null
  let lowestListingUrl=''

  for(const listing of listings){
    const amounts:number[]=[]
    if(alert.fixed_price&&listing.saleTypes.includes('fixed')&&Number(listing.buyNowPrice)>0){
      amounts.push(Number(listing.buyNowPrice))
    }
    if(alert.auction&&listing.saleTypes.includes('auction')){
      const auctionAmount=Number(listing.nextBid||listing.currentBid||listing.openingBid||0)
      if(auctionAmount>0)amounts.push(auctionAmount)
    }
    if(!amounts.length)continue

    let best:number|null=null
    for(const amount of amounts){
      try{
        const rate=await fxRate(listing.currency,alert.currency)
        const converted=amount*rate
        if(Number.isFinite(converted)&&converted>0&&(best===null||converted<best))best=converted
      }catch(error){
        if(listing.currency.toUpperCase()===alert.currency.toUpperCase()&&(best===null||amount<best))best=amount
      }
    }

    if(best===null)continue
    count++
    if(lowest===null||best<lowest){
      lowest=best
      lowestListingUrl=listing.url||''
    }
  }

  return {
    listing_count:count,
    listing_count_capped:count>0&&listings.length>=60,
    lowest_price:lowest===null?null:Math.round(lowest*100)/100,
    lowest_listing_url:lowestListingUrl||null,
    currency:alert.currency,
    checked_at:new Date().toISOString()
  }
}

async function saveMarketplaceState(db:ReturnType<typeof createClient>,alert:AlertRow,marketplace:string,listings:Listing[]){
  const state=await marketplaceState(alert,listings)
  const result=await db.from('marketplace_alert_market_state').upsert({
    alert_id:alert.id,
    marketplace,
    listing_count:state.listing_count,
    listing_count_capped:state.listing_count_capped,
    lowest_price:state.lowest_price,
    lowest_listing_url:state.lowest_listing_url,
    currency:state.currency,
    checked_at:state.checked_at
  },{onConflict:'alert_id,marketplace'})
  if(result.error)throw result.error
}




type NativePushDeviceRow = {
  id: number
  device_token: string
  failure_count: number
}

type FirebaseServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

const pushPreferenceCache = new Map<string,Promise<boolean>>()
const nativePushDeviceCache = new Map<string,Promise<NativePushDeviceRow[]>>()
let firebaseAccessTokenValue=''
let firebaseAccessTokenExpiresAt=0

function base64UrlBytes(bytes:Uint8Array):string{
  let binary=''
  for(let index=0;index<bytes.length;index++)binary+=String.fromCharCode(bytes[index])
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

function base64UrlText(value:string):string{
  return base64UrlBytes(new TextEncoder().encode(value))
}

function serviceAccountConfig():FirebaseServiceAccount{
  const raw=Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||''
  if(!raw)throw new Error('Firebase service account is not configured')
  const parsed=JSON.parse(raw) as FirebaseServiceAccount
  if(!parsed.project_id||!parsed.client_email||!parsed.private_key){
    throw new Error('Firebase service account is incomplete')
  }
  return parsed
}

async function firebaseAccessToken():Promise<{token:string,projectId:string}>{
  const config=serviceAccountConfig()
  if(firebaseAccessTokenValue&&Date.now()<firebaseAccessTokenExpiresAt-60_000){
    return {token:firebaseAccessTokenValue,projectId:config.project_id}
  }

  const now=Math.floor(Date.now()/1000)
  const header=base64UrlText(JSON.stringify({alg:'RS256',typ:'JWT'}))
  const claims=base64UrlText(JSON.stringify({
    iss:config.client_email,
    scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:config.token_uri||'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3600
  }))
  const unsigned=header+'.'+claims
  const cleanPem=config.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g,'')
    .replace(/-----END PRIVATE KEY-----/g,'')
    .replace(/\s+/g,'')
  const keyBytes=Uint8Array.from(atob(cleanPem),(char)=>char.charCodeAt(0))
  const key=await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},
    false,
    ['sign']
  )
  const signature=new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  ))
  const assertion=unsigned+'.'+base64UrlBytes(signature)
  const response=await fetch(config.token_uri||'https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  })
  if(!response.ok)throw new Error('Firebase OAuth failed: '+response.status)
  const payload=asRecord(await response.json())
  const token=textValue(payload.access_token)
  const expiresIn=Math.max(300,numberValue(payload.expires_in)||3600)
  if(!token)throw new Error('Firebase OAuth returned no access token')
  firebaseAccessTokenValue=token
  firebaseAccessTokenExpiresAt=Date.now()+expiresIn*1000
  return {token,projectId:config.project_id}
}

async function priceAlertPushEnabled(db:ReturnType<typeof createClient>,userId:string):Promise<boolean>{
  if(!pushPreferenceCache.has(userId)){
    pushPreferenceCache.set(userId,(async()=>{
      const result=await db.from('notification_preferences')
        .select('push_enabled')
        .eq('user_id',userId)
        .eq('notification_type','price_alert')
        .maybeSingle()
      if(result.error)throw result.error
      return !result.data||result.data.push_enabled!==false
    })())
  }
  return await pushPreferenceCache.get(userId)!
}

async function nativePushDevicesForUser(
  db:ReturnType<typeof createClient>,
  userId:string
):Promise<NativePushDeviceRow[]>{
  if(!nativePushDeviceCache.has(userId)){
    nativePushDeviceCache.set(userId,(async()=>{
      const result=await db.from('native_push_devices')
        .select('id,device_token,failure_count')
        .eq('user_id',userId)
        .eq('platform','android')
        .eq('provider','fcm')
        .eq('active',true)
      if(result.error)throw result.error
      return (result.data||[]) as NativePushDeviceRow[]
    })())
  }
  return await nativePushDeviceCache.get(userId)!
}

async function latestPriceAlertMatch(db:ReturnType<typeof createClient>,alertId:number){
  const result=await db.from('marketplace_alert_matches')
    .select('marketplace,listing_url,sale_type,matched_price,alert_currency,first_seen_at')
    .eq('alert_id',alertId)
    .order('first_seen_at',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(result.error)throw result.error
  return result.data||null
}

async function sendFcmToDevice(
  db:ReturnType<typeof createClient>,
  device:NativePushDeviceRow,
  access:{token:string,projectId:string},
  data:Record<string,string>
){
  const response=await fetch(
    'https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(access.projectId)+'/messages:send',
    {
      method:'POST',
      headers:{
        Authorization:'Bearer '+access.token,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        message:{
          token:device.device_token,
          data,
          android:{
            priority:'high',
            ttl:'21600s'
          }
        }
      })
    }
  )

  const responseText=await response.text()
  const now=new Date().toISOString()
  if(response.ok){
    await db.from('native_push_devices').update({
      last_success_at:now,
      failure_count:0,
      updated_at:now,
      active:true
    }).eq('id',device.id)
    return
  }

  if(response.status===404||response.status===410||/UNREGISTERED|registration-token-not-registered/i.test(responseText)){
    await db.from('native_push_devices').delete().eq('id',device.id)
    return
  }

  await db.from('native_push_devices').update({
    failure_count:Math.min(100,Number(device.failure_count||0)+1),
    updated_at:now
  }).eq('id',device.id)

  throw new Error('FCM delivery failed: '+response.status)
}

async function sendPriceAlertNativePush(
  db:ReturnType<typeof createClient>,
  alert:AlertRow,
  newCount:number
){
  if(newCount<=0)return
  if(!(await priceAlertPushEnabled(db,alert.user_id)))return

  const devices=await nativePushDevicesForUser(db,alert.user_id)
  if(!devices.length)return

  const access=await firebaseAccessToken()
  const latest=await latestPriceAlertMatch(db,alert.id)
  const album=textValue(alert.album?.title)||'Record'
  const marketplace=textValue(latest?.marketplace)
  const matchedPrice=Number(latest?.matched_price||0)
  const alertCurrency=textValue(latest?.alert_currency)||alert.currency
  const saleType=textValue(latest?.sale_type)==='auction'?'Auction':'Fixed price'
  const body=newCount===1&&marketplace&&matchedPrice>0
    ?marketplace+': '+matchedPrice.toLocaleString('en-US',{maximumFractionDigits:2})+' '+alertCurrency+' · '+saleType
    :newCount+' new listings under '+Number(alert.max_price).toLocaleString('en-US',{maximumFractionDigits:2})+' '+alert.currency

  const data={
    type:'price_alert',
    title:'Groovy · Price Alert · '+album,
    body,
    tag:'price-alert-'+alert.id,
    url:'https://groovyshelves.com/price-alerts',
    listingUrl:textValue(latest?.listing_url),
    alertId:String(alert.id)
  }

  await Promise.allSettled(devices.map(async(device)=>{
    try{
      await sendFcmToDevice(db,device,access,data)
    }catch(error){
      console.warn('Native FCM delivery failed',error)
    }
  }))
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return jsonResponse({error:'Method not allowed'},405)

  const supabaseUrl=Deno.env.get('SUPABASE_URL')||''
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
  if(!supabaseUrl||!serviceRole)return jsonResponse({error:'Server is not configured'},500)
  const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})

  let body:JsonRecord={}
  try{body=asRecord(await req.json())}catch(error){}
  const requestedAlertId=Math.max(0,Math.trunc(Number(firstValue(body,['alert_id','alertId'])||0)))
  let requestUserId=''

  if(requestedAlertId){
    const authorization=req.headers.get('authorization')||req.headers.get('Authorization')||''
    const token=authorization.replace(/^Bearer\s+/i,'').trim()
    if(!token)return jsonResponse({error:'Authentication required'},401)
    const authResult=await db.auth.getUser(token)
    const user=authResult.data&&authResult.data.user
    if(authResult.error||!user)return jsonResponse({error:'Authentication required'},401)
    requestUserId=user.id
  }

  if(!requestedAlertId){
    const claim=await db.rpc('claim_marketplace_alert_scan',{p_min_interval_minutes:55})
    if(claim.error){
      console.error('Could not claim marketplace alert scan',claim.error)
      return jsonResponse({error:'Could not start scan'},500)
    }
    if(!claim.data)return jsonResponse({ok:true,skipped:true,reason:'recent_scan'})
  }

  let processed=0
  let newMatches=0
  const traderaCache=new Map<string,Promise<Listing[]>>()
  const ebayCache=new Map<string,Promise<Listing[]>>()

  try{
    let alertQuery=db.from('marketplace_alerts')
      .select('id,user_id,album_id,max_price,currency,tradera_enabled,ebay_enabled,fixed_price,auction,ebay_marketplace_id,album:albums!inner(title,cover_url,artist:artists(name))')
      .eq('active',true)
    if(requestedAlertId){
      alertQuery=alertQuery.eq('id',requestedAlertId).eq('user_id',requestUserId)
    }
    const alertResult=await alertQuery
      .order('last_checked_at',{ascending:true,nullsFirst:true})
      .limit(requestedAlertId?1:500)
    if(alertResult.error)throw alertResult.error
    if(requestedAlertId&&!(alertResult.data||[]).length){
      return jsonResponse({error:'Price alert not found'},404)
    }

    for(const raw of alertResult.data||[]){
      const alert=raw as unknown as AlertRow
      const artist=textValue(alert.album?.artist?.name)
      const album=textValue(alert.album?.title)
      if(!artist||!album){
        await db.rpc('record_marketplace_alert_scan',{p_alert_id:alert.id,p_matches:[],p_error:'Album metadata unavailable'})
        continue
      }

      const matches:JsonRecord[]=[]
      const errors:string[]=[]
      const albumKey=normalizeSearchText(artist)+'|'+normalizeSearchText(album)

      if(alert.tradera_enabled){
        try{
          if(!traderaCache.has(albumKey))traderaCache.set(albumKey,searchTradera(artist,album))
          const traderaListings=await traderaCache.get(albumKey)!
          matches.push(...await matchingRows(alert,traderaListings,'Tradera'))
          await saveMarketplaceState(db,alert,'Tradera',traderaListings)
        }catch(error){
          errors.push('Tradera: '+(error instanceof Error?error.message:String(error)))
        }
      }else{
        await db.from('marketplace_alert_market_state').delete().eq('alert_id',alert.id).eq('marketplace','Tradera')
      }

      if(alert.ebay_enabled){
        try{
          const market=supportedMarketplaceIds.has(alert.ebay_marketplace_id)?alert.ebay_marketplace_id:'EBAY_US'
          const key=albumKey+'|'+market
          if(!ebayCache.has(key))ebayCache.set(key,searchEbay(artist,album,market))
          const ebayListings=await ebayCache.get(key)!
          matches.push(...await matchingRows(alert,ebayListings,'eBay'))
          await saveMarketplaceState(db,alert,'eBay',ebayListings)
        }catch(error){
          errors.push('eBay: '+(error instanceof Error?error.message:String(error)))
        }
      }else{
        await db.from('marketplace_alert_market_state').delete().eq('alert_id',alert.id).eq('marketplace','eBay')
      }

      const recorded=await db.rpc('record_marketplace_alert_scan',{
        p_alert_id:alert.id,
        p_matches:matches,
        p_error:errors.join(' | ')||null
      })
      if(recorded.error)throw recorded.error
      const inserted=Number(recorded.data||0)
      processed++
      newMatches+=inserted
      if(inserted>0){
        try{
          await sendPriceAlertNativePush(db,alert,inserted)
        }catch(error){
          console.warn('Could not send native Price Alert notification',error)
        }
      }
    }

    if(!requestedAlertId)await db.rpc('finish_marketplace_alert_scan',{p_error:null})
    return jsonResponse({ok:true,processed,newMatches,alertId:requestedAlertId||null})
  }catch(error){
    const finalError=error instanceof Error?error.message:String(error)
    console.error('Marketplace alert scan failed',error)
    if(!requestedAlertId)await db.rpc('finish_marketplace_alert_scan',{p_error:finalError})
    return jsonResponse({error:'Marketplace alert scan failed'},500)
  }
})
