import { withSupabase } from 'npm:@supabase/server'
import { createClient } from 'npm:@supabase/supabase-js@2'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    try {
      const body = await req.json()
      const query = String(body.query || '').trim()
      const action = String(body.action || 'search')
      const masterId = body.masterId
      const releaseId = body.releaseId
      const artistId = body.artistId
      const artistName = String(body.artistName || '').trim()
      const token = Deno.env.get('DISCOGS_TOKEN')

      if (!token) {
        return Response.json({ error: 'DISCOGS_TOKEN saknas' }, { status: 500 })
      }

      const headers = {
        'Authorization': 'Discogs token=' + token,
        'User-Agent': 'VinylCollection/1.0'
      }

      async function discogsJson(url: string) {
        const response = await fetch(url, { headers })
        if (!response.ok) {
          return {
            response: Response.json(
              { error: 'Discogs HTTP ' + response.status },
              { status: response.status }
            )
          }
        }
        return { data: await response.json() }
      }
      let serviceClient: any = null

      function getServiceClient() {
        if (serviceClient) return serviceClient
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        if (!supabaseUrl || !serviceRoleKey) return null
        serviceClient = createClient(supabaseUrl,serviceRoleKey,{
          auth:{persistSession:false,autoRefreshToken:false}
        })
        return serviceClient
      }


      function cleanArtistName(value: unknown) {
        return String(value || '').replace(/\s*\(\d+\)$/,'').trim()
      }

      function styleLabel(data: any) {
        const styles = Array.isArray(data?.styles) ? data.styles : []
        const genres = Array.isArray(data?.genres) ? data.genres : []
        const values = (styles.length ? styles : genres)
          .map((value: unknown) => String(value || '').trim())
          .filter(Boolean)
        return Array.from(new Set(values)).join(' · ')
      }

      function flattenTracks(tracklist: unknown[]) {
        const rows: any[] = []
        ;(Array.isArray(tracklist) ? tracklist : []).forEach((track: any) => {
          if (track && (track.type_ === 'track' || (!track.type_ && track.title))) rows.push(track)
          if (track && Array.isArray(track.sub_tracks)) {
            track.sub_tracks.forEach((subTrack: any) => {
              if (subTrack && (subTrack.type_ === 'track' || (!subTrack.type_ && subTrack.title))) rows.push(subTrack)
            })
          }
        })
        return rows
      }

      function hasVinylSides(tracklist: unknown[]) {
        return flattenTracks(tracklist).some((track: any) =>
          /^[A-H]\s*\d/i.test(String(track.position || ''))
        )
      }

      function databaseTrackRows(tracklist: unknown[]) {
        return flattenTracks(tracklist).map((track: any) => {
          const match = String(track.position || '').trim().toUpperCase().match(/^([A-H])\s*(\d+)/)
          if (!match) return null
          return {
            disc_side: match[1],
            track_number: Number(match[2]) || null,
            title: String(track.title || '').trim(),
            duration: String(track.duration || '').trim() || null
          }
        }).filter((track: any) => track && track.title)
      }

      async function bestVinylTracklist(id: unknown) {
        const versionsResult = await discogsJson(
          'https://api.discogs.com/masters/' + encodeURIComponent(String(id)) +
          '/versions?format=Vinyl&per_page=50'
        )
        if (versionsResult.response) return []

        const versions = Array.isArray(versionsResult.data?.versions)
          ? versionsResult.data.versions
          : []

        function isVinylVersion(version: Record<string, unknown>) {
          const format = Array.isArray(version.format)
            ? version.format.join(' ').toLowerCase()
            : String(version.format || '').toLowerCase()
          return format.includes('vinyl') || format.includes('lp') ||
            format.includes('12"') || format.includes('10"') || format.includes('7"')
        }

        function score(tracklist: unknown[]) {
          const rows = flattenTracks(tracklist)
          const durationCount = rows.filter((track: any) => String(track.duration || '').trim()).length
          const sidedCount = rows.filter((track: any) => /^[A-H]\s*\d/i.test(String(track.position || ''))).length
          return durationCount * 10000 + sidedCount * 100 + rows.length
        }

        const candidateIds = versions
          .filter(isVinylVersion)
          .map((version: Record<string, unknown>) => String(version.id || version.release_id || '').trim())
          .filter(Boolean)
          .slice(0, 8)

        const candidates = await Promise.all(candidateIds.map(async (candidateId) => {
          const result = await discogsJson(
            'https://api.discogs.com/releases/' + encodeURIComponent(candidateId)
          )
          if (result.response || !result.data) return null
          const tracklist = Array.isArray(result.data.tracklist) ? result.data.tracklist : []
          return { tracklist, score: score(tracklist) }
        }))

        const best = candidates
          .filter(Boolean)
          .sort((left: any, right: any) => right.score - left.score)[0] as any

        return best?.tracklist || []
      }

      function normalizeIdentity(value: unknown) {
        return String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'')
          .toLowerCase()
          .replace(/\b(the|deluxe|edition|remaster(?:ed)?|anniversary|expanded|super|special)\b/g,' ')
          .replace(/[^a-z0-9]+/g,' ')
          .replace(/\s+/g,' ')
          .trim()
      }

      function artistSearchScore(result: any,wanted: string) {
        const title=cleanArtistName(result?.title)
        const normalizedTitle=normalizeIdentity(title)
        const normalizedWanted=normalizeIdentity(wanted)
        if (!normalizedTitle || !normalizedWanted) return -100
        if (normalizedTitle===normalizedWanted) return 100
        if (normalizedTitle.startsWith(normalizedWanted)) return 70
        if (normalizedTitle.includes(normalizedWanted)) return 45
        return 0
      }

      function officialArtistUrl(urls: unknown[]) {
        const values=(Array.isArray(urls)?urls:[])
          .map((value)=>String(value||'').trim())
          .filter((value)=>/^https?:\/\//i.test(value))
        const blocked=/\b(?:discogs|wikipedia|musicbrainz|facebook|instagram|twitter|x\.com|youtube|tiktok|spotify|apple)\b/i
        return values.find((value)=>!blocked.test(value)) || ''
      }

      function identityMatches(left: unknown,right: unknown) {
        const a = normalizeIdentity(left)
        const b = normalizeIdentity(right)
        if (!a || !b) return false
        if (a === b) return true
        return a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))
      }
      async function mapWithConcurrency(items: any[],limit: number,worker: (item:any)=>Promise<any>) {
        const values=Array.isArray(items)?items:[]
        const results:any[]=[]
        let cursor=0

        async function run() {
          while (cursor<values.length) {
            const index=cursor++
            results[index]=await worker(values[index])
          }
        }

        const count=Math.max(1,Math.min(Number(limit)||1,values.length||1))
        await Promise.all(Array.from({length:count},()=>run()))
        return results
      }

      function discogsAlbumSearchScore(item: any,artist: string,title: string,year: unknown) {
        if (!item || String(item.type||'').toLowerCase()!=='master') return -1000
        const wantedTitle=normalizeIdentity(title)
        const wantedArtist=normalizeIdentity(artist)
        const candidate=normalizeIdentity(item.title)
        if (!wantedTitle||!candidate)return -1000

        let score=-1000
        if (candidate===wantedTitle) score=130
        else if (wantedArtist&&candidate===normalizeIdentity(artist+' '+title)) score=125
        else if (candidate.endsWith(' '+wantedTitle)) score=115
        else if (candidate.includes(wantedTitle)) score=80
        if (score<0)return score

        const wantedYear=Number(year)||0
        const candidateYear=Number(item.year)||0
        if (wantedYear&&candidateYear) {
          const delta=Math.abs(wantedYear-candidateYear)
          if (delta>3)return -1000
          score-=delta*8
        }
        return score
      }

      async function resolveVinylMasterByTitle(artist: string,title: string,year: unknown) {
        if (!artist||!title)return null
        const search=await discogsJson(
          'https://api.discogs.com/database/search?type=master&format=Vinyl&artist='+
          encodeURIComponent(artist)+
          '&release_title='+encodeURIComponent(title)+
          '&per_page=10'
        )
        if (search.response)return null

        const best=(Array.isArray(search.data?.results)?search.data.results:[])
          .map((item: any)=>({item,score:discogsAlbumSearchScore(item,artist,title,year)}))
          .filter((entry: any)=>entry.score>=80)
          .sort((left: any,right: any)=>right.score-left.score)[0]

        const master=Number(best?.item?.id)||0
        return master?{
          discogs_master_id:master,
          vinyl_release_id:null
        }:null
      }

      async function verifyDiscogsVinylMasters(
        admin: any,
        artist: string,
        masterIds: number[]
      ) {
        const ids=Array.from(new Set(
          (Array.isArray(masterIds)?masterIds:[])
            .map((value)=>Number(value)||0)
            .filter((value)=>value>0)
        ))
        const vinylIds=new Set<number>()
        if (!ids.length)return {vinylIds,complete:true,checked:0}

        const {data:cachedRows,error:cacheError}=await admin
          .from('discogs_master_vinyl_cache')
          .select('discogs_master_id,has_vinyl,vinyl_release_id,checked_at')
          .in('discogs_master_id',ids)

        if (cacheError) {
          console.warn('Could not read Discogs vinyl master cache',cacheError)
        }

        const now=Date.now()
        const freshIds=new Set<number>()
        ;(Array.isArray(cachedRows)?cachedRows:[]).forEach((row: any)=>{
          const id=Number(row?.discogs_master_id)||0
          const checked=Date.parse(String(row?.checked_at||''))||0
          const positive=row?.has_vinyl===true
          const ttl=positive?180*24*60*60*1000:30*24*60*60*1000
          if (!id||!checked||now-checked>=ttl)return
          freshIds.add(id)
          if (positive)vinylIds.add(id)
        })

        const unknown=ids.filter((id)=>!freshIds.has(id))
        if (!unknown.length)return {vinylIds,complete:true,checked:0}

        // One broad artist+Vinyl search usually resolves almost every candidate
        // in one request. Any candidate absent from that result is verified
        // individually so pagination or unusual artist credits cannot create a
        // false negative.
        const broad=await discogsJson(
          'https://api.discogs.com/database/search?type=master&format=Vinyl&artist='+
          encodeURIComponent(artist)+
          '&per_page=100'
        )
        const broadIds=new Set<number>()
        if (!broad.response) {
          ;(Array.isArray(broad.data?.results)?broad.data.results:[]).forEach((item: any)=>{
            const id=Number(item?.id)||0
            if (id)broadIds.add(id)
          })
        }

        const broadMatches=unknown.filter((id)=>broadIds.has(id))
        if (broadMatches.length) {
          broadMatches.forEach((id)=>vinylIds.add(id))
          const checkedAt=new Date().toISOString()
          const {error:writeError}=await admin
            .from('discogs_master_vinyl_cache')
            .upsert(broadMatches.map((id)=>({
              discogs_master_id:id,
              has_vinyl:true,
              vinyl_release_id:null,
              checked_at:checkedAt
            })),{onConflict:'discogs_master_id'})
          if (writeError)console.warn('Could not cache broad Discogs vinyl matches',writeError)
        }

        const remaining=unknown.filter((id)=>!broadIds.has(id))
        let complete=true
        const checkedRows=(await mapWithConcurrency(remaining,4,async (id: number)=>{
          const result=await discogsJson(
            'https://api.discogs.com/masters/'+encodeURIComponent(String(id))+
            '/versions?format=Vinyl&per_page=1'
          )
          if (result.response) {
            complete=false
            return null
          }
          const versions=Array.isArray(result.data?.versions)?result.data.versions:[]
          const hasVinyl=(Number(result.data?.pagination?.items)||0)>0||versions.length>0
          const releaseId=Number(versions[0]?.id||versions[0]?.release_id)||null
          if (hasVinyl)vinylIds.add(id)
          return {
            discogs_master_id:id,
            has_vinyl:hasVinyl,
            vinyl_release_id:releaseId,
            checked_at:new Date().toISOString()
          }
        })).filter(Boolean)

        if (checkedRows.length) {
          const {error:writeError}=await admin
            .from('discogs_master_vinyl_cache')
            .upsert(checkedRows,{onConflict:'discogs_master_id'})
          if (writeError)console.warn('Could not cache Discogs vinyl verification',writeError)
        }

        return {
          vinylIds,
          complete,
          checked:broadMatches.length+checkedRows.length
        }
      }

      function appleAlbumScore(item: any,artist: string,title: string,year: unknown) {
        if (!item || !identityMatches(item.artistName,artist)) return -1000
        const wantedTitle=normalizeIdentity(title)
        const candidateTitle=normalizeIdentity(item.collectionName)
        if (!wantedTitle || !candidateTitle) return -1000

        let score=-1000
        if (candidateTitle===wantedTitle) score=120
        else if (
          candidateTitle.length>=6 &&
          wantedTitle.length>=6 &&
          (candidateTitle.includes(wantedTitle)||wantedTitle.includes(candidateTitle))
        ) score=75

        if (score<0) return score

        const wantedYear=Number(year)||0
        const candidateYear=Number(String(item.releaseDate||'').slice(0,4))||0
        if (wantedYear&&candidateYear) score-=Math.min(Math.abs(wantedYear-candidateYear),25)
        return score
      }

      function appleArtworkUrl(value: unknown) {
        return String(value||'')
          .replace(/\/\d+x\d+bb\./,'/1200x1200bb.')
          .trim()
      }

      async function appleJson(url: string) {
        try {
          const response=await fetch(url)
          if (!response.ok) {
            console.warn('Apple HTTP',response.status)
            return null
          }
          return await response.json()
        } catch (error) {
          console.warn('Apple request failed',error)
          return null
        }
      }

      async function wikidataStudioAlbums(qid: string) {
        if (!/^Q\d+$/.test(qid)) return []

        const sparql = [
          'SELECT DISTINCT ?album ?albumLabel ?mbid ?discogs ?date WHERE {',
          '  ?album wdt:P175 wd:' + qid + '.',
          '  { ?album wdt:P7937 wd:Q208569. } UNION { ?album wdt:P31 wd:Q208569. }',
          '  OPTIONAL { ?album wdt:P436 ?mbid. }',
          '  OPTIONAL { ?album wdt:P1954 ?discogs. }',
          '  OPTIONAL { ?album wdt:P577 ?date. }',
          '  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }',
          '} ORDER BY ?date'
        ].join('\n')

        try {
          const response = await fetch(
            'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
            {
              headers:{
                'Accept':'application/sparql-results+json',
                'User-Agent':'GroovyShelves/1.0 (https://github.com/Jeffaklumpen/groovy)'
              }
            }
          )
          if (!response.ok) {
            console.warn('Wikidata HTTP',response.status)
            return []
          }

          const data=await response.json()
          const rows=Array.isArray(data?.results?.bindings)?data.results.bindings:[]
          return rows.map((row: any)=>({
            title:String(row?.albumLabel?.value||'').trim(),
            mbid:String(row?.mbid?.value||'').trim(),
            discogs_master_id:Number(row?.discogs?.value)||0,
            year:Number(String(row?.date?.value||'').slice(0,4))||0
          })).filter((row: any)=>row.title||row.mbid||row.discogs_master_id)
        } catch (error) {
          console.warn('Wikidata studio album query failed',error)
          return []
        }
      }

      async function wikidataArtistIdentityByDiscogsId(discogsArtistId: number) {
        if (!discogsArtistId) return {qid:'',wikipedia_title:''}
        const sparql=[
          'PREFIX wdt: <http://www.wikidata.org/prop/direct/>',
          'PREFIX schema: <http://schema.org/>',
          'SELECT DISTINCT ?artist ?article WHERE {',
          '  ?artist wdt:P1953 "'+String(discogsArtistId).replace(/"/g,'')+'".',
          '  OPTIONAL {',
          '    ?article schema:about ?artist;',
          '             schema:isPartOf <https://en.wikipedia.org/>.',
          '  }',
          '} LIMIT 4'
        ].join('\n')

        try {
          const response=await fetch(
            'https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(sparql),
            {
              headers:{
                'Accept':'application/sparql-results+json',
                'User-Agent':'GroovyShelves/1.0 (https://github.com/Jeffaklumpen/groovy)'
              }
            }
          )
          if (!response.ok) return {qid:'',wikipedia_title:''}
          const data=await response.json()
          const rows=Array.isArray(data?.results?.bindings)?data.results.bindings:[]
          const qids=Array.from(new Set(rows.map((row: any)=>{
            const value=String(row?.artist?.value||'')
            const match=value.match(/\/(Q\d+)$/)
            return match?match[1]:''
          }).filter(Boolean)))

          if (qids.length!==1)return {qid:'',wikipedia_title:''}

          const article=rows
            .map((row: any)=>String(row?.article?.value||''))
            .find((value: string)=>/^https:\/\/en\.wikipedia\.org\/wiki\//i.test(value))||''
          let wikipediaTitle=''
          if (article) {
            try {
              wikipediaTitle=decodeURIComponent(
                new URL(article).pathname.replace(/^\/wiki\//,'').replace(/_/g,' ')
              ).trim()
            } catch (_error) {}
          }

          return {qid:String(qids[0]),wikipedia_title:wikipediaTitle}
        } catch (error) {
          console.warn('Could not resolve Wikidata artist by Discogs ID',error)
          return {qid:'',wikipedia_title:''}
        }
      }

      async function wikidataArtistQidByDiscogsId(discogsArtistId: number) {
        const identity=await wikidataArtistIdentityByDiscogsId(discogsArtistId)
        return identity.qid
      }

      async function wikidataEnglishWikipediaTitle(qid: string) {
        if (!/^Q\d+$/.test(qid)) return ''
        try {
          const response=await fetch(
            'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=enwiki&ids='+
            encodeURIComponent(qid),
            {headers:{'User-Agent':'GroovyShelves/1.0 (https://github.com/Jeffaklumpen/groovy)'}}
          )
          if (!response.ok) return ''
          const data=await response.json()
          return String(data?.entities?.[qid]?.sitelinks?.enwiki?.title||'').trim()
        } catch (error) {
          console.warn('Could not resolve English Wikipedia sitelink',error)
          return ''
        }
      }

      async function wikipediaParse(pageTitle: string,prop: string,section?: string) {
        if (!pageTitle) return null
        const params=new URLSearchParams({
          action:'parse',
          format:'json',
          formatversion:'2',
          page:pageTitle,
          prop,
          redirects:'1'
        })
        if (section) params.set('section',section)
        try {
          const response=await fetch(
            'https://en.wikipedia.org/w/api.php?'+params.toString(),
            {headers:{'User-Agent':'GroovyShelves/1.0 (https://github.com/Jeffaklumpen/groovy)'}}
          )
          if (!response.ok) return null
          return await response.json()
        } catch (error) {
          console.warn('Wikipedia parse request failed',error)
          return null
        }
      }

      function wikipediaLinkTitles(data: any) {
        return (Array.isArray(data?.parse?.links)?data.parse.links:[])
          .filter((link: any)=>Number(link?.ns)===0)
          .map((link: any)=>String(link?.title||'').trim())
          .filter(Boolean)
      }

      function wikipediaText(value: unknown) {
        return String(value||'')
          .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,' ')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
          .replace(/<br\s*\/?>/gi,' ')
          .replace(/<[^>]+>/g,' ')
          .replace(/&nbsp;|&#160;/gi,' ')
          .replace(/&amp;/gi,'&')
          .replace(/&quot;/gi,'"')
          .replace(/&#39;|&apos;/gi,"'")
          .replace(/&ndash;/gi,'–')
          .replace(/&mdash;/gi,'—')
          .replace(/&#(\d+);/g,(_match,code)=>String.fromCodePoint(Number(code)||32))
          .replace(/&#x([0-9a-f]+);/gi,(_match,code)=>String.fromCodePoint(parseInt(code,16)||32))
          .replace(/\s+/g,' ')
          .trim()
      }

      function wikipediaArticleTitleFromCell(cellHtml: string) {
        const links=Array.from(String(cellHtml||'').matchAll(
          /<a\b[^>]*href=["']\/wiki\/([^"'#?]+)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi
        ))
        const target=String(links[0]?.[1]||'').trim()
        if (!target) return ''
        try {
          return decodeURIComponent(target.replace(/_/g,' ')).trim()
        } catch (_error) {
          return target.replace(/_/g,' ').trim()
        }
      }

      function wikipediaDisplayTitle(value: unknown) {
        return wikipediaText(value)
          .replace(/\s*\([^)]*\)\s*$/,'')
          .trim()
      }

      function wikipediaTopLevelListItems(html: string,allLists=false) {
        const source=String(html||'')
        if (!source)return []

        const items:string[]=[]
        const tagPattern=/<\/?(?:ul|li)\b[^>]*>/gi
        let ulDepth=0
        let currentParts:string[]|null=null
        let lastIndex=0
        let outerListsSeen=0
        let match:RegExpExecArray|null

        while ((match=tagPattern.exec(source))) {
          const tag=String(match[0]||'')
          const index=Number(match.index)||0

          if (currentParts && ulDepth===1 && index>lastIndex) {
            currentParts.push(source.slice(lastIndex,index))
          }

          const closing=/^<\//.test(tag)
          const isUl=/^<\/?ul\b/i.test(tag)
          const isLi=/^<\/?li\b/i.test(tag)

          if (isUl) {
            if (closing) {
              if (ulDepth===1) {
                ulDepth=0
                outerListsSeen+=1
                if (!allLists && outerListsSeen>=1) break
              } else if (ulDepth>1) {
                ulDepth-=1
              }
            } else {
              ulDepth+=1
            }
          } else if (isLi) {
            if (!closing && ulDepth===1 && !currentParts) {
              currentParts=[]
            } else if (closing && ulDepth===1 && currentParts) {
              const item=currentParts.join('').trim()
              if (item)items.push(item)
              currentParts=null
            }
          }

          lastIndex=tagPattern.lastIndex
        }

        return items
      }

      function wikipediaStudioAlbumsFromHtml(data: any,options: any={}) {
        const html=String(data?.parse?.text||'')
        if (!html) return []

        const albums:any[]=[]
        const seen=new Set<string>()

        function addAlbum(container: string,index: number) {
          const articleTitle=wikipediaArticleTitleFromCell(container)
          const link=String(container||'').match(
            /<a\b[^>]*href=["']\/wiki\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i
          )
          const linkedLabel=link?wikipediaText(link[1]):''
          const fullLabel=wikipediaText(container)
            .replace(/\s*\[[^\]]+\]\s*$/,'')
            .replace(/\s+Released\s*:\s*.*$/i,'')
            .trim()
          const title=wikipediaDisplayTitle(linkedLabel||fullLabel||articleTitle)
          if (!title || /^(title|album|studio albums?)$/i.test(title)) return

          // Main-article core catalogues occasionally include an explicitly
          // labelled compilation after the studio/core list (The Beatles'
          // Past Masters is a good example). Do not promote that into Main Discography.
          const containerText=wikipediaText(container)
          if (
            /\bcompilation\b|\bEP\b|\bre-record(?:ed|ing)\b|\blive\b/i.test(containerText) ||
            /\bgreatest hits\b|\bbest of\b/i.test(title)
          ) return

          const released=String(container||'').match(
            /Released\s*:[\s\S]{0,240}?\b((?:19|20)\d{2})\b/i
          )
          const parentheticalYear=String(container||'').match(
            /\([^)]*\b((?:19|20)\d{2})\b[^)]*\)/
          )
          const inlineYears=Array.from(
            String(container||'').matchAll(/\b((?:19|20)\d{2})\b/g)
          )
          const inlineYear=inlineYears.length
            ?inlineYears[inlineYears.length-1]
            :null
          const year=released
            ?Number(released[1])||null
            :(parentheticalYear
              ?Number(parentheticalYear[1])||null
              :(inlineYear?Number(inlineYear[1])||null:null))
          const identity=normalizeIdentity(articleTitle||title)+'|'+String(year||index+1)
          if (!identity || seen.has(identity)) return
          seen.add(identity)

          albums.push({
            title,
            article_title:articleTitle,
            year
          })
        }

        const tables=(html.match(/<table\b[\s\S]*?<\/table>/gi)||[])
          .filter((table: string)=>/\bwikitable\b/i.test(table))

        tables.forEach((table: string)=>{
          const rows=table.match(/<tr\b[\s\S]*?<\/tr>/gi)||[]
          rows.forEach((row: string,index: number)=>{
            if (!/Released\s*:/i.test(row)) return

            const cells=Array.from(
              row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)
            ).map((match: any)=>String(match?.[1]||''))

            const header=row.match(
              /<th\b[^>]*scope=["']row["'][^>]*>([\s\S]*?)<\/th>/i
            )
            let firstCell=header?.[1] || cells[0] || ''

            // Some discography tables use the first row-header cell for the
            // release year and keep the actual album in the next "Album details"
            // cell (Europe is one example). Never turn that year into the title.
            if (/^(?:19|20)\d{2}$/.test(wikipediaText(firstCell))) {
              const albumCell=cells.find((cell: string)=>{
                const label=wikipediaText(cell)
                if (!label || /^(?:19|20)\d{2}$/.test(label)) return false
                return /Released\s*:/i.test(cell) ||
                  /<a\b[^>]*href=["']\/wiki\//i.test(cell)
              })
              if (albumCell) firstCell=albumCell
            }

            if (!firstCell) return

            const released=row.match(
              /Released\s*:[\s\S]{0,240}?\b((?:19|20)\d{2})\b/i
            )
            const combined=firstCell+
              (released?'<span>Released: '+released[1]+'</span>':'')
            addAlbum(combined,index)
          })
        })

        if (albums.length) return albums

        // Regex cannot safely split nested <ul> blocks: an inner recording
        // list would terminate the outer works list early. Read only direct
        // children of each outer list and deliberately discard nested cast /
        // alternate-recording lists.
        const listItems=wikipediaTopLevelListItems(
          html,
          Boolean(options?.allLists)
        )
        listItems.forEach((item: string,index: number)=>addAlbum(item,index))

        return albums
      }

      function rankWikipediaCoreWorksSection(item: any) {
        const normalized=normalizeIdentity(item?.line)
        if (normalized==='musicals and show recordings') return 160
        if (normalized==='musicals and recordings') return 155
        if (normalized==='musicals') return 150
        if (normalized==='show recordings') return 145
        if (normalized==='cast recordings') return 140
        return 0
      }

      function wikipediaChildSections(sections: any[],parent: any) {
        if (!Array.isArray(sections)||!parent)return []
        const parentIndex=sections.indexOf(parent)
        if (parentIndex<0)return []
        const parentLevel=Number(parent?.level)||2
        const children:any[]=[]
        for (let index=parentIndex+1;index<sections.length;index++) {
          const section=sections[index]
          const level=Number(section?.level)||6
          if (level<=parentLevel)break
          children.push(section)
        }
        return children
      }

      function wikipediaInlineCoreWorksHtml(html: string) {
        const source=String(html||'')
        if (!source)return ''

        const gap='(?:\\s|<[^>]*>)*'
        const starts=[
          new RegExp('Musicals'+gap+'and'+gap+'show'+gap+'recordings','i'),
          new RegExp('Musicals'+gap+'and'+gap+'recordings','i'),
          new RegExp('Cast'+gap+'recordings','i'),
          new RegExp('Show'+gap+'recordings','i')
        ]

        let start=-1
        for (const pattern of starts) {
          const match=pattern.exec(source)
          if (!match)continue
          start=Number(match.index)||0
          break
        }
        if (start<0)return ''

        const tail=source.slice(start)
        const ends=[
          new RegExp('Other'+gap+'albums?','i'),
          new RegExp('Compilation'+gap+'albums?','i'),
          new RegExp('Live'+gap+'albums?','i')
        ]
        let end=tail.length
        for (const pattern of ends) {
          const match=pattern.exec(tail)
          if (!match||Number(match.index)<=0)continue
          end=Math.min(end,Number(match.index))
        }
        return tail.slice(0,end)
      }

      function rankWikipediaStudioSection(item: any) {
        const label=String(item?.line||'').trim()
        const normalized=normalizeIdentity(label)
        // Dedicated discography pages may put solo/core releases and band-side
        // projects under one broad "Studio albums" parent. Prefer an explicit
        // Primary studio albums subsection so projects "as a member of" another
        // group are not promoted into the artist's Main Discography.
        if (normalized==='primary studio albums') return 140
        if (normalized==='standardised studio albums'||normalized==='standardized studio albums') return 130
        if (/primary studio albums$/i.test(label)) return 125
        if (/studio albums$/i.test(label)&&/original/i.test(label)) return 120
        if (normalized==='studio albums') return 110
        if (/studio albums$/i.test(label)) return 90
        return 0
      }

      function wikipediaSectionHtml(data: any,section: any) {
        const html=String(data?.parse?.text||'')
        if (!html||!section)return ''

        const wantedAnchor=String(section?.anchor||'').trim()
        const wantedLine=normalizeIdentity(section?.line)
        const wantedLevel=Math.max(1,Math.min(6,Number(section?.level)||2))
        const headings=Array.from(html.matchAll(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi))
        let heading:any=null

        for (const candidate of headings) {
          const markup=String(candidate?.[0]||'')
          const level=Number(candidate?.[1])||0
          if (level!==wantedLevel)continue

          const anchorMatch=markup.match(/\bid=["']([^"']+)["']/i)
          const anchor=String(anchorMatch?.[1]||'')
          if (
            (wantedAnchor&&anchor===wantedAnchor) ||
            (!wantedAnchor&&normalizeIdentity(wikipediaText(markup))===wantedLine)
          ) {
            heading=candidate
            break
          }
        }

        if (!heading && wantedLine) {
          heading=headings.find((candidate: any)=>
            normalizeIdentity(wikipediaText(candidate?.[0]))===wantedLine
          )||null
        }
        if (!heading)return ''

        const start=Number(heading.index||0)+String(heading[0]||'').length
        let end=html.length
        for (const candidate of headings) {
          if (Number(candidate.index||0)<=start)continue
          const level=Number(candidate?.[1])||6
          if (level<=wantedLevel) {
            end=Number(candidate.index||html.length)
            break
          }
        }
        return html.slice(start,end)
      }

      async function wikipediaDiscographyCandidates(
        qid: string,
        artistName: string,
        knownArtistPage?: string
      ) {
        const artistPage=String(knownArtistPage||'').trim()||
          await wikidataEnglishWikipediaTitle(qid)
        if (!artistPage) {
          return {artistPage:'',discographyPage:'',studioAlbums:[]}
        }

        // One parse request gives us sections, links and full HTML together.
        // This avoids the old sections -> links -> section text request chain.
        const artistData=await wikipediaParse(artistPage,'sections|links|text')
        const artistSections=Array.isArray(artistData?.parse?.sections)
          ?artistData.parse.sections
          :[]
        const discographySection=artistSections.find((item: any)=>
          normalizeIdentity(item?.line)==='discography'
        )

        // Composer / musical-theatre pages can expose their canonical catalogue
        // as a dedicated works subsection instead of "Studio albums". Prefer that
        // isolated subsection and allow all of its list columns, while still
        // avoiding the many individual cast/live recordings on dedicated pages.
        if (discographySection) {
          const worksSection=wikipediaChildSections(artistSections,discographySection)
            .map((item: any)=>({item,score:rankWikipediaCoreWorksSection(item)}))
            .filter((entry: any)=>entry.score>0)
            .sort((left: any,right: any)=>right.score-left.score)[0]?.item

          if (worksSection) {
            const worksHtml=wikipediaSectionHtml(artistData,worksSection)
            const worksAlbums=wikipediaStudioAlbumsFromHtml(
              {parse:{text:worksHtml}},
              {allLists:true}
            )
            if (worksAlbums.length>=2) {
              return {
                artistPage,
                discographyPage:'',
                studioAlbums:worksAlbums,
                strategy:'main_article_works'
              }
            }
          }

          // Some pages (Andrew Lloyd Webber is a real example) render the
          // canonical works label as ordinary text rather than a MediaWiki
          // subsection. Isolate that labelled block before "Other albums" and
          // allow all of its list columns only inside that bounded slice.
          const mainDiscographyHtml=wikipediaSectionHtml(artistData,discographySection)
          const inlineWorksHtml=wikipediaInlineCoreWorksHtml(mainDiscographyHtml)
          if (inlineWorksHtml) {
            const inlineWorksAlbums=wikipediaStudioAlbumsFromHtml(
              {parse:{text:inlineWorksHtml}},
              {allLists:true}
            )
            if (inlineWorksAlbums.length>=2) {
              return {
                artistPage,
                discographyPage:'',
                studioAlbums:inlineWorksAlbums,
                strategy:'main_article_inline_works'
              }
            }
          }

          // Fast path: many artist main articles already contain a compact,
          // curated core/studio discography. Parse that first and avoid following
          // the much heavier dedicated discography page unless it is actually needed.
          const studioMarker=mainDiscographyHtml.search(/Studio\s+albums?/i)
          const mainDiscographyAlbums=wikipediaStudioAlbumsFromHtml({
            parse:{text:studioMarker>=0
              ?mainDiscographyHtml.slice(studioMarker)
              :mainDiscographyHtml}
          })
          if (mainDiscographyAlbums.length>=2) {
            return {
              artistPage,
              discographyPage:'',
              studioAlbums:mainDiscographyAlbums,
              strategy:'main_article'
            }
          }
        }

        let discographyPage=''
        if (discographySection) {
          const artistKey=normalizeIdentity(artistName)
          discographyPage=wikipediaLinkTitles(artistData).find((title: string)=>{
            const normalized=normalizeIdentity(title)
            return /discography/i.test(title) &&
              (!artistKey||normalized.includes(artistKey))
          })||''
        }

        const catalogPage=discographyPage||artistPage
        const catalogData=discographyPage
          ?await wikipediaParse(discographyPage,'sections|links|text')
          :artistData
        const sections=Array.isArray(catalogData?.parse?.sections)
          ?catalogData.parse.sections
          :[]
        const studioSection=sections
          .map((item: any)=>({item,score:rankWikipediaStudioSection(item)}))
          .filter((entry: any)=>entry.score>0)
          .sort((left: any,right: any)=>right.score-left.score)[0]?.item

        if (studioSection) {
          const studioHtml=wikipediaSectionHtml(catalogData,studioSection)
          const studioAlbums=wikipediaStudioAlbumsFromHtml({
            parse:{text:studioHtml}
          })
          if (studioAlbums.length) {
            return {artistPage,discographyPage,studioAlbums}
          }
        }

        // Smaller artist pages often keep "Studio albums" as plain text inside
        // the main Discography section instead of a real subsection heading.
        if (!discographyPage && discographySection) {
          const html=wikipediaSectionHtml(artistData,discographySection)
          const marker=html.search(/Studio\s+albums?/i)
          if (marker>=0) {
            const studioAlbums=wikipediaStudioAlbumsFromHtml({
              parse:{text:html.slice(marker)}
            })
            if (studioAlbums.length) {
              return {artistPage,discographyPage:'',studioAlbums}
            }
          }
        }

        return {artistPage,discographyPage,studioAlbums:[]}
      }

      function wikipediaTitleKey(value: unknown) {
        return normalizeIdentity(String(value||'').replace(/\s*\([^)]*\)\s*$/,''))
      }

      function wikipediaAlbumKeys(value: unknown,artistName: string) {
        const keys=new Set<string>()
        const key=wikipediaTitleKey(value)
        if (key) keys.add(key)

        const artistKey=normalizeIdentity(artistName)
        if (key && artistKey && key.startsWith(artistKey+' ')) {
          const withoutArtist=key.slice(artistKey.length+1).trim()
          if (withoutArtist) keys.add(withoutArtist)
        }

        return Array.from(keys)
      }


      async function wikidataReleaseIdentifiersByArticleTitles(titles: string[]) {
        const unique=Array.from(new Set(
          (Array.isArray(titles)?titles:[])
            .map((value)=>String(value||'').trim())
            .filter(Boolean)
        )).slice(0,50)

        if (!unique.length) return new Map<string,any>()

        const params=new URLSearchParams({
          action:'wbgetentities',
          format:'json',
          sites:'enwiki',
          titles:unique.join('|'),
          props:'claims|sitelinks'
        })

        try {
          const response=await fetch(
            'https://www.wikidata.org/w/api.php?'+params.toString(),
            {headers:{'User-Agent':'GroovyShelves/1.0 (https://github.com/Jeffaklumpen/groovy)'}}
          )
          if (!response.ok) return new Map<string,any>()

          const data=await response.json()
          const entities=data?.entities&&typeof data.entities==='object'
            ?Object.values(data.entities)
            :[]
          const result=new Map<string,any>()

          function claimValue(entity: any,property: string) {
            const claims=Array.isArray(entity?.claims?.[property])
              ?entity.claims[property]
              :[]
            for (const claim of claims) {
              const value=claim?.mainsnak?.datavalue?.value
              if (value!==undefined && value!==null && String(value).trim()) {
                return String(value).trim()
              }
            }
            return ''
          }

          entities.forEach((entity: any)=>{
            const title=String(entity?.sitelinks?.enwiki?.title||'').trim()
            if (!title) return

            const mbid=claimValue(entity,'P436')
            const master=Number(claimValue(entity,'P1954'))||null
            if (!mbid && !master) return

            result.set(normalizeIdentity(title),{
              mbid:mbid||null,
              discogs_master_id:master
            })
          })

          return result
        } catch (error) {
          console.warn('Could not enrich unmatched albums from Wikidata',error)
          return new Map<string,any>()
        }
      }

      async function verifiedAppleAlbum(
        urlValue: unknown,
        identities: Array<{ artist: string, title: string }>
      ) {
        const input = String(urlValue || '').trim()
        if (!input) return null
        let parsed: URL
        try { parsed = new URL(input) } catch (_error) { return null }
        if (!/(^|\.)apple\.com$/i.test(parsed.hostname)) return null
        const idMatch =
          parsed.pathname.match(/\/id(\d+)(?:\/|$)/i) ||
          parsed.pathname.match(/\/(\d+)(?:\/)?$/)
        const collectionId = idMatch?.[1] || ''
        if (!collectionId) return null

        const response = await fetch(
          'https://itunes.apple.com/lookup?id=' + encodeURIComponent(collectionId) +
          '&country=SE'
        )
        if (!response.ok) return null
        const payload = await response.json()
        const candidates = Array.isArray(identities)
          ? identities.filter((identity) => identity && identity.artist && identity.title)
          : []

        const album = (Array.isArray(payload?.results) ? payload.results : []).find((item: any) => {
          if (!item || !item.collectionId || !item.artworkUrl100) return false

          const artistMatches = candidates.some((identity) =>
            identityMatches(item.artistName,identity.artist)
          )
          const titleMatches = candidates.some((identity) =>
            identityMatches(item.collectionName,identity.title)
          )

          return artistMatches && titleMatches
        })

        if (!album) {
          console.warn('Apple album identity verification failed',{
            collectionId:collectionId,
            identities:candidates
          })
          return null
        }

        return {
          collectionId: Number(album.collectionId) || null,
          collectionUrl: String(album.collectionViewUrl || input),
          artworkUrl: String(album.artworkUrl100)
            .replace(/\/\d+x\d+bb\./,'/1200x1200bb.')
        }
      }

      if (action === 'saveAlbum') {
        const destination = String(body.destination || '').trim().toLowerCase()
        const saveMasterId = String(masterId || '').trim()
        if (!/^\d{1,20}$/.test(saveMasterId)) {
          return Response.json({ error: 'Invalid master ID' }, { status: 400 })
        }
        if (destination !== 'collection' && destination !== 'wishlist') {
          return Response.json({ error: 'Invalid destination' }, { status: 400 })
        }

        const masterResult = await discogsJson(
          'https://api.discogs.com/masters/' + encodeURIComponent(saveMasterId)
        )
        if (masterResult.response) return masterResult.response
        const master = masterResult.data || {}
        const artist = cleanArtistName(master.artists?.[0]?.name)
        const title = String(master.title || '').trim()
        if (!artist || !title) {
          return Response.json({ error: 'Discogs master is missing identity data' }, { status: 502 })
        }

        let tracklist = Array.isArray(master.tracklist) ? master.tracklist : []
        if (!hasVinylSides(tracklist)) {
          const vinylTracklist = await bestVinylTracklist(saveMasterId)
          if (vinylTracklist.length) tracklist = vinylTracklist
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const authHeader = req.headers.get('Authorization') || ''
        if (!supabaseUrl || !anonKey || !serviceRoleKey || !authHeader) {
          return Response.json({ error: 'Supabase save configuration is incomplete' }, { status: 500 })
        }

        const userClient = createClient(supabaseUrl,anonKey,{
          global:{headers:{Authorization:authHeader}},
          auth:{persistSession:false,autoRefreshToken:false}
        })
        const { data:userData,error:userError } = await userClient.auth.getUser()
        if (userError || !userData.user) {
          return Response.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const admin = createClient(supabaseUrl,serviceRoleKey,{
          auth:{persistSession:false,autoRefreshToken:false}
        })

        const identities=[{artist,title}]
        const { data:catalogIdentity,error:catalogIdentityError } = await admin
          .from('musicbrainz_catalog')
          .select('artist_name,album_title')
          .eq('discogs_master_id',Number(saveMasterId))
          .maybeSingle()

        if (catalogIdentityError) {
          console.warn('Could not load MusicBrainz identity for Apple verification',catalogIdentityError)
        } else if (catalogIdentity?.artist_name && catalogIdentity?.album_title) {
          identities.push({
            artist:String(catalogIdentity.artist_name).trim(),
            title:String(catalogIdentity.album_title).trim()
          })
        }

        const { data:cachedApple,error:cachedAppleError } = await admin
          .from('apple_artwork_cache')
          .select('apple_collection_id,apple_collection_url,artwork_url')
          .eq('discogs_master_id',Number(saveMasterId))
          .maybeSingle()
        if (cachedAppleError) {
          console.warn('Could not load Apple artwork cache for verified save',cachedAppleError)
        }

        const verifiedApple = cachedApple
          ?{
            collectionId:Number(cachedApple.apple_collection_id)||null,
            collectionUrl:String(cachedApple.apple_collection_url||''),
            artworkUrl:String(cachedApple.artwork_url||'')
          }
          :await verifiedAppleAlbum(body.appleCollectionUrl,identities)

        const discogsCover = String(master.images?.[0]?.uri || master.images?.[0]?.uri150 || '').trim()
        const coverUrl = verifiedApple?.artworkUrl || discogsCover || null
        const coverSource = verifiedApple?.artworkUrl ? 'apple' : (discogsCover ? 'discogs' : null)
        const appleUrl = verifiedApple?.collectionUrl || null
        const { data:saveResult,error:saveError } = await admin.rpc(
          'save_album_to_library_verified',
          {
            p_user_id:userData.user.id,
            p_destination:destination,
            p_discogs_master_id:saveMasterId,
            p_artist_name:artist,
            p_album_title:title,
            p_release_year:Number(master.year) || null,
            p_genre:styleLabel(master) || null,
            p_cover_url:coverUrl,
            p_cover_source:coverSource,
            p_apple_collection_url:appleUrl,
            p_tracks:databaseTrackRows(tracklist)
          }
        )
        if (saveError) {
          console.error('Verified album save failed',saveError)
          return Response.json({ error: 'Could not save album' }, { status: 500 })
        }

        const discogsArtistId=Number(master.artists?.[0]?.id) || null
        if (discogsArtistId) {
          const { error:artistIdentityError } = await admin
            .from('artists')
            .update({discogs_artist_id:discogsArtistId})
            .eq('name',artist)
            .is('discogs_artist_id',null)
          if (artistIdentityError) {
            console.warn('Could not persist Discogs artist identity',artistIdentityError)
          }
        }

        if (verifiedApple && !cachedApple) {
          const { error:cacheError } = await admin.from('apple_artwork_cache').upsert({
            discogs_master_id:Number(saveMasterId),
            artist_name:artist,
            album_title:title,
            release_year:Number(master.year) || null,
            apple_collection_id:verifiedApple.collectionId,
            apple_collection_url:verifiedApple.collectionUrl,
            artwork_url:verifiedApple.artworkUrl,
            matched_at:new Date().toISOString(),
            updated_at:new Date().toISOString()
          },{onConflict:'discogs_master_id'})
          if (cacheError) console.warn('Could not update verified Apple artwork cache',cacheError)
        }

        return Response.json(saveResult)
      }

      if (action === 'search') {
        if (!query) return Response.json({ results: [], artists: [] })

        const [masterResult,artistResult] = await Promise.all([
          discogsJson(
            'https://api.discogs.com/database/search?q=' +
            encodeURIComponent(query) + '&type=master&per_page=50'
          ),
          discogsJson(
            'https://api.discogs.com/database/search?q=' +
            encodeURIComponent(query) + '&type=artist&per_page=8'
          )
        ])

        if (masterResult.response) return masterResult.response

        const artistResults = artistResult.response
          ? []
          : (Array.isArray(artistResult.data?.results) ? artistResult.data.results : [])

        const seenArtistNames=new Set<string>()
        const artists = artistResults
          .map((item: any)=>({
            id:Number(item?.id)||null,
            name:cleanArtistName(item?.title),
            score:artistSearchScore(item,query)
          }))
          .filter((item: any)=>item.id && item.name && item.score>0)
          .sort((left: any,right: any)=>right.score-left.score || left.name.localeCompare(right.name))
          .filter((item: any)=>{
            const key=normalizeIdentity(item.name)
            if (!key || seenArtistNames.has(key)) return false
            seenArtistNames.add(key)
            return true
          })
          .slice(0,3)
          .map(({id,name}: any)=>({id,name}))

        return Response.json({
          ...(masterResult.data || {}),
          artists
        })
      }

      if (action === 'resolveArtist') {
        const resolvedArtistName=cleanArtistName(artistName)
        if (!resolvedArtistName) {
          return Response.json({ error:'Artist name is required' },{status:400})
        }

        const admin=getServiceClient()
        let localArtist:any=null

        if (admin) {
          const { data:local,error:localError } = await admin
            .from('artists')
            .select('id,name,discogs_artist_id')
            .ilike('name',resolvedArtistName)
            .maybeSingle()

          if (localError) {
            console.warn('Could not inspect local artist identity',localError)
          } else {
            localArtist=local||null
            if (localArtist?.discogs_artist_id) {
              return Response.json({
                id:Number(localArtist.discogs_artist_id),
                name:cleanArtistName(localArtist.name)||resolvedArtistName,
                cached:true
              })
            }
          }
        }

        const searchResult=await discogsJson(
          'https://api.discogs.com/database/search?q='+
          encodeURIComponent(resolvedArtistName)+
          '&type=artist&per_page=8'
        )
        if (searchResult.response) return searchResult.response

        const candidates=(Array.isArray(searchResult.data?.results)?searchResult.data.results:[])
          .map((item: any)=>({
            id:Number(item?.id)||0,
            name:cleanArtistName(item?.title),
            score:artistSearchScore(item,resolvedArtistName)
          }))
          .filter((item: any)=>item.id&&item.score>0)
          .sort((left: any,right: any)=>right.score-left.score)

        const resolved=candidates[0]
        if (!resolved || resolved.score<70) {
          return Response.json({ error:'Artist could not be resolved' },{status:404})
        }

        if (admin && localArtist?.id) {
          const { error:updateError } = await admin
            .from('artists')
            .update({discogs_artist_id:resolved.id})
            .eq('id',localArtist.id)
            .is('discogs_artist_id',null)
          if (updateError) {
            console.warn('Could not persist resolved Discogs artist identity',updateError)
          }
        }

        return Response.json({
          id:resolved.id,
          name:resolved.name||resolvedArtistName,
          cached:false
        })
      }

      if (action === 'cacheArtistArtwork') {
        const resolvedArtistId=Number(artistId)||0
        const resolvedArtistName=cleanArtistName(artistName)
        if (!resolvedArtistId || !resolvedArtistName) {
          return Response.json({ error: 'Artist ID and name are required' }, { status: 400 })
        }

        const admin=getServiceClient()
        if (!admin) {
          return Response.json({ error: 'Artwork cache configuration is incomplete' }, { status: 500 })
        }

        // Apple artwork follows the already verified shared Main Discography cache.
        // This keeps the warm-up small and means every later user reads the same
        // persisted album membership and artwork URLs directly from Postgres.
        const { data:discographyRows,error:discographyError } = await admin
          .from('artist_discography_cache')
          .select('source_key,discogs_master_id,album_title,first_release_year,position,apple_collection_id,apple_collection_url,artwork_url')
          .eq('discogs_artist_id',resolvedArtistId)
          .order('position',{ascending:true})
          .limit(60)

        if (discographyError) {
          console.warn('Could not load verified artist discography for Apple cache',discographyError)
          return Response.json({ error:'Could not load verified discography' },{status:500})
        }

        const rawRows=Array.isArray(discographyRows)?discographyRows:[]
        const seenMasters=new Set<string>()
        const catalog=rawRows
          .filter((row: any)=>Number(row?.discogs_master_id)||0)
          .map((row: any)=>({
            source_key:String(row?.source_key||''),
            discogs_master_id:row.discogs_master_id,
            artist_name:resolvedArtistName,
            album_title:row.album_title,
            first_release_year:row.first_release_year,
            position:row.position
          }))
          .filter((row: any)=>{
            const key=String(row?.discogs_master_id||'')
            if (!key||seenMasters.has(key)) return false
            seenMasters.add(key)
            return true
          })

        const directArtworkRows=rawRows.filter((row: any)=>!(Number(row?.discogs_master_id)||0))
        const directArtworkCached=directArtworkRows.filter((row: any)=>
          String(row?.artwork_url||'').trim() &&
          String(row?.apple_collection_url||'').trim()
        )
        const directArtworkMissing=directArtworkRows.filter((row: any)=>
          !String(row?.artwork_url||'').trim() ||
          !String(row?.apple_collection_url||'').trim()
        )

        const masterIds=catalog
          .map((row: any)=>Number(row.discogs_master_id)||0)
          .filter(Boolean)

        let existingRows:any[]=[]
        let existingError:any=null
        if (masterIds.length) {
          const existingResult=await admin
            .from('apple_artwork_cache')
            .select('discogs_master_id,apple_collection_id,apple_collection_url,artwork_url')
            .in('discogs_master_id',masterIds)
          existingRows=Array.isArray(existingResult.data)?existingResult.data:[]
          existingError=existingResult.error
        }

        if (existingError) {
          console.warn('Could not inspect Apple artwork cache',existingError)
          return Response.json({ error: 'Could not inspect artwork cache' }, { status: 500 })
        }

        // A single Apple collection must not be reused for two different albums
        // in the same Main Discography. Self-titled artists can otherwise cause
        // distinct Discogs masters to receive the same cover.
        const collectionOwners=new Map<string,string[]>()
        ;(Array.isArray(existingRows)?existingRows:[]).forEach((row: any)=>{
          const collectionId=String(row?.apple_collection_id||'')
          const master=String(row?.discogs_master_id||'')
          if (!collectionId||!master) return
          if (!collectionOwners.has(collectionId))collectionOwners.set(collectionId,[])
          collectionOwners.get(collectionId)!.push(master)
        })

        const duplicateMasterIds=new Set<string>()
        collectionOwners.forEach((masters: string[])=>{
          if (masters.length<2)return
          masters.forEach((master)=>duplicateMasterIds.add(master))
        })

        if (duplicateMasterIds.size) {
          const duplicateRows=(Array.isArray(existingRows)?existingRows:[])
            .filter((row: any)=>duplicateMasterIds.has(String(row?.discogs_master_id||'')))

          const { error:duplicateDeleteError } = await admin
            .from('apple_artwork_cache')
            .delete()
            .in('discogs_master_id',Array.from(duplicateMasterIds).map(Number))
          if (duplicateDeleteError) {
            console.warn('Could not clear duplicate Apple album matches',duplicateDeleteError)
          } else {
            // Do not let a stale Apple URL stored on albums keep showing after
            // the shared cache rejected that duplicate match.
            await Promise.all(duplicateRows.map(async (row: any)=>{
              const master=String(row?.discogs_master_id||'')
              const appleUrl=String(row?.apple_collection_url||'')
              if (!master||!appleUrl)return
              const { error:albumClearError } = await admin
                .from('albums')
                .update({cover_url:null,apple_collection_url:null})
                .eq('discogs_master_id',master)
                .eq('apple_collection_url',appleUrl)
              if (albumClearError) {
                console.warn('Could not clear stale duplicate Apple album data',albumClearError)
              }
            }))
          }
        }

        const existingIds=new Set(
          (Array.isArray(existingRows)?existingRows:[])
            .map((row: any)=>String(row.discogs_master_id||''))
            .filter((master: string)=>master&&!duplicateMasterIds.has(master))
        )
        const usedAppleCollectionIds=new Set(
          (Array.isArray(existingRows)?existingRows:[])
            .filter((row: any)=>!duplicateMasterIds.has(String(row?.discogs_master_id||'')))
            .map((row: any)=>String(row?.apple_collection_id||''))
            .concat(directArtworkCached.map((row: any)=>String(row?.apple_collection_id||'')))
            .filter(Boolean)
        )

        const missing=catalog.filter((row: any)=>!existingIds.has(String(row.discogs_master_id||'')))
        const totalEligible=catalog.length+directArtworkRows.length
        const cachedBefore=existingIds.size+directArtworkCached.length
        const now=new Date().toISOString()

        if (!missing.length && !directArtworkMissing.length) {
          await admin.from('artist_profile_cache').update({
            artwork_checked_at:now,
            artwork_eligible_count:totalEligible,
            artwork_cached_count:cachedBefore,
            updated_at:now
          }).eq('discogs_artist_id',resolvedArtistId)

          return Response.json({
            eligible:totalEligible,
            cached_total:cachedBefore,
            cached_added:0,
            complete:true
          })
        }

        const { data:cacheState } = await admin
          .from('artist_profile_cache')
          .select('artwork_checked_at,artwork_eligible_count,artwork_cached_count')
          .eq('discogs_artist_id',resolvedArtistId)
          .maybeSingle()

        const checkedAt=cacheState?.artwork_checked_at
          ?Date.parse(String(cacheState.artwork_checked_at))
          :0
        const recentlyChecked=checkedAt && Date.now()-checkedAt < 7*24*60*60*1000

        if (
          recentlyChecked &&
          Number(cacheState?.artwork_eligible_count||0)===totalEligible &&
          Number(cacheState?.artwork_cached_count||0)===cachedBefore
        ) {
          return Response.json({
            eligible:totalEligible,
            cached_total:cachedBefore,
            cached_added:0,
            complete:cachedBefore===totalEligible,
            deferred:true
          })
        }

        const artistSearch=await appleJson(
          'https://itunes.apple.com/search?term='+
          encodeURIComponent(resolvedArtistName)+
          '&entity=musicArtist&limit=20&country=SE'
        )

        const artistCandidate=(Array.isArray(artistSearch?.results)?artistSearch.results:[])
          .filter((item: any)=>item&&item.artistId)
          .map((item: any)=>({
            item,
            score:normalizeIdentity(item.artistName)===normalizeIdentity(resolvedArtistName)
              ?100
              :(identityMatches(item.artistName,resolvedArtistName)?60:0)
          }))
          .sort((left: any,right: any)=>right.score-left.score)[0]

        if (!artistCandidate || artistCandidate.score<=0) {
          await admin.from('artist_profile_cache').update({
            artwork_checked_at:now,
            artwork_eligible_count:totalEligible,
            artwork_cached_count:cachedBefore,
            updated_at:now
          }).eq('discogs_artist_id',resolvedArtistId)

          return Response.json({
            eligible:totalEligible,
            cached_total:cachedBefore,
            cached_added:0,
            complete:false
          })
        }

        const appleCatalog=await appleJson(
          'https://itunes.apple.com/lookup?id='+
          encodeURIComponent(String(artistCandidate.item.artistId))+
          '&entity=album&limit=200&country=SE'
        )
        const appleAlbums=(Array.isArray(appleCatalog?.results)?appleCatalog.results:[])
          .filter((item: any)=>item&&item.collectionId&&item.collectionName)

        const matches:any[]=[]
        missing.forEach((row: any)=>{
          const best=appleAlbums
            .filter((item: any)=>!usedAppleCollectionIds.has(String(item.collectionId||'')))
            .map((item: any)=>({
              item,
              score:appleAlbumScore(
                item,
                String(row.artist_name||resolvedArtistName),
                String(row.album_title||''),
                row.first_release_year
              )
            }))
            .filter((candidate: any)=>candidate.score>=60)
            .sort((left: any,right: any)=>right.score-left.score)[0]

          if (!best) return

          const collectionUrl=String(best.item.collectionViewUrl||'').trim()
          const artworkUrl=appleArtworkUrl(best.item.artworkUrl100)
          if (!/^https:\/\/(?:music|itunes)\.apple\.com\//i.test(collectionUrl)) return
          if (!/^https:\/\/[^/]*mzstatic\.com\//i.test(artworkUrl)) return

          usedAppleCollectionIds.add(String(best.item.collectionId||''))
          matches.push({
            discogs_master_id:Number(row.discogs_master_id),
            artist_name:String(row.artist_name||resolvedArtistName).trim(),
            album_title:String(row.album_title||'').trim(),
            release_year:Number(row.first_release_year)||null,
            apple_collection_id:Number(best.item.collectionId)||null,
            apple_collection_url:collectionUrl,
            artwork_url:artworkUrl,
            matched_at:now,
            updated_at:now
          })
        })

        const directMatches:any[]=[]
        directArtworkMissing.forEach((row: any)=>{
          const best=appleAlbums
            .filter((item: any)=>!usedAppleCollectionIds.has(String(item.collectionId||'')))
            .map((item: any)=>({
              item,
              score:appleAlbumScore(
                item,
                resolvedArtistName,
                String(row.album_title||''),
                row.first_release_year
              )
            }))
            .filter((candidate: any)=>candidate.score>=60)
            .sort((left: any,right: any)=>right.score-left.score)[0]

          if (!best) return

          const collectionUrl=String(best.item.collectionViewUrl||'').trim()
          const artworkUrl=appleArtworkUrl(best.item.artworkUrl100)
          if (!/^https:\/\/(?:music|itunes)\.apple\.com\//i.test(collectionUrl)) return
          if (!/^https:\/\/[^/]*mzstatic\.com\//i.test(artworkUrl)) return

          usedAppleCollectionIds.add(String(best.item.collectionId||''))
          directMatches.push({
            source_key:String(row.source_key||''),
            apple_collection_id:Number(best.item.collectionId)||null,
            apple_collection_url:collectionUrl,
            artwork_url:artworkUrl
          })
        })

        if (matches.length) {
          const { error:upsertError } = await admin
            .from('apple_artwork_cache')
            .upsert(matches,{onConflict:'discogs_master_id'})
          if (upsertError) {
            console.warn('Could not persist artist Apple artwork cache',upsertError)
            return Response.json({ error: 'Could not persist artwork cache' }, { status: 500 })
          }

          await Promise.all(matches.map(async (match: any)=>{
            const { error:updateError } = await admin
              .from('albums')
              .update({
                cover_url:match.artwork_url,
                apple_collection_url:match.apple_collection_url
              })
              .eq('discogs_master_id',String(match.discogs_master_id))
            if (updateError) console.warn('Could not upgrade cached album artwork',updateError)
          }))
        }

        if (directMatches.length) {
          await Promise.all(directMatches.map(async (match: any)=>{
            const { error:updateError }=await admin
              .from('artist_discography_cache')
              .update({
                apple_collection_id:match.apple_collection_id,
                apple_collection_url:match.apple_collection_url,
                artwork_url:match.artwork_url
              })
              .eq('discogs_artist_id',resolvedArtistId)
              .eq('source_key',match.source_key)
            if (updateError) {
              console.warn('Could not persist direct artist artwork fallback',updateError)
            }
          }))
        }

        const cachedTotal=Math.min(
          totalEligible,
          cachedBefore+matches.length+directMatches.length
        )
        await admin.from('artist_profile_cache').update({
          artwork_checked_at:now,
          artwork_eligible_count:totalEligible,
          artwork_cached_count:cachedTotal,
          updated_at:now
        }).eq('discogs_artist_id',resolvedArtistId)

        return Response.json({
          eligible:totalEligible,
          cached_total:cachedTotal,
          cached_added:matches.length+directMatches.length,
          complete:cachedTotal===totalEligible
        })
      }

      if (action === 'verifyArtistDiscography') {
        const resolvedArtistId=Number(artistId)||0
        const resolvedArtistName=cleanArtistName(artistName)

        if (!resolvedArtistId || !resolvedArtistName) {
          return Response.json({ error:'Artist ID and name are required' },{status:400})
        }

        const admin=getServiceClient()
        if (!admin) {
          return Response.json({ error:'Discography cache configuration is incomplete' },{status:500})
        }

        // Shared discography writes are anchored to the trusted Discogs artist ID.
        // Wikipedia proposes the curated core catalogue; Discogs then verifies
        // that each persisted Main Discography entry has an actual Vinyl master.
        // The persisted cache is intentionally checked before any external lookup:
        // once one user has verified an artist, later users can render it immediately.
        const [profileStateResult,localArtistResult]=await Promise.all([
          admin
            .from('artist_profile_cache')
            .select('wikidata_id,discography_checked_at,discography_source,discography_count')
            .eq('discogs_artist_id',resolvedArtistId)
            .maybeSingle(),
          admin
            .from('artists')
            .select('name')
            .eq('discogs_artist_id',resolvedArtistId)
            .maybeSingle()
        ])

        const { data:profileState,error:profileStateError }=profileStateResult
        if (profileStateError) {
          console.warn('Could not read discography verification state',profileStateError)
        }

        if (localArtistResult.error) {
          console.warn('Could not read canonical Groovy artist identity',localArtistResult.error)
        }
        const canonicalArtistName=cleanArtistName(localArtistResult.data?.name)||
          resolvedArtistName

        const checkedAt=profileState?.discography_checked_at
          ?Date.parse(String(profileState.discography_checked_at))
          :0
        const cachedSource=String(profileState?.discography_source||'')
        const cachedCount=Number(profileState?.discography_count)||0
        const cachedWikidataId=String(profileState?.wikidata_id||'').trim()
        const cacheTtl=cachedSource==='fallback'
          ?24*60*60*1000
          :30*24*60*60*1000

        if (checkedAt && Date.now()-checkedAt<cacheTtl) {
          if (cachedSource==='vinyl' && cachedCount>0) {
            return Response.json({
              verified:true,
              cached:true,
              count:cachedCount,
              changed:false,
              source:'vinyl',
              wikidata_id:cachedWikidataId
            })
          }

          if (cachedSource==='fallback') {
            return Response.json({
              verified:false,
              cached:true,
              count:cachedCount,
              changed:false,
              source:'fallback',
              wikidata_id:cachedWikidataId
            })
          }
        }

        // Reuse the stable Wikidata identity when it is already known. Only the
        // first uncached verification needs the comparatively slow SPARQL lookup.
        let resolvedWikidataId=cachedWikidataId
        let resolvedWikipediaTitle=''
        if (!resolvedWikidataId) {
          const resolvedIdentity=await wikidataArtistIdentityByDiscogsId(resolvedArtistId)
          resolvedWikidataId=String(resolvedIdentity?.qid||'')
          resolvedWikipediaTitle=String(resolvedIdentity?.wikipedia_title||'')
        }

        if (!resolvedWikidataId) {
          // Never throw away a previously verified shared discography because an
          // upstream identity service is temporarily unavailable.
          if (cachedSource==='wikipedia' && cachedCount>0) {
            return Response.json({
              verified:true,
              cached:true,
              stale:true,
              changed:false,
              count:cachedCount,
              source:'wikipedia',
              reason:'wikidata_identity_unavailable',
              wikidata_id:''
            })
          }

          const now=new Date().toISOString()
          await admin.from('artist_profile_cache').upsert({
            discogs_artist_id:resolvedArtistId,
            artist_name:canonicalArtistName,
            wikidata_id:null,
            discography_checked_at:now,
            discography_source:'fallback',
            discography_count:0,
            updated_at:now
          },{onConflict:'discogs_artist_id'})
          return Response.json({
            verified:false,
            changed:false,
            count:0,
            source:'fallback',
            reason:'wikidata_identity_missing'
          })
        }

        const wikipedia=await wikipediaDiscographyCandidates(
          resolvedWikidataId,
          canonicalArtistName,
          resolvedWikipediaTitle
        )
        const wikipediaAlbums=Array.isArray(wikipedia.studioAlbums)
          ?wikipedia.studioAlbums
          :[]

        if (!wikipediaAlbums.length) {
          // Preserve an older verified Wikipedia cache on transient upstream failure.
          // Do not refresh checked_at so the next visit retries Wikipedia.
          if (
            cachedSource==='wikipedia' &&
            Number(profileState?.discography_count||0)>0
          ) {
            return Response.json({
              verified:true,
              cached:true,
              stale:true,
              changed:false,
              count:Number(profileState?.discography_count)||0,
              source:'wikipedia',
              reason:'wikipedia_studio_discography_unavailable',
              wikidata_id:resolvedWikidataId
            })
          }

          const now=new Date().toISOString()
          await admin.from('artist_profile_cache').upsert({
            discogs_artist_id:resolvedArtistId,
            artist_name:canonicalArtistName,
            wikidata_id:resolvedWikidataId,
            discography_checked_at:now,
            discography_source:'fallback',
            discography_count:0,
            updated_at:now
          },{onConflict:'discogs_artist_id'})

          return Response.json({
            verified:false,
            changed:false,
            count:0,
            source:'fallback',
            reason:'wikipedia_studio_discography_missing',
            wikidata_id:resolvedWikidataId
          })
        }

        // Wikipedia already owns membership. Enrichment should stay local and
        // must not add another network dependency to the first artist visit.
        const catalogResult=await admin
          .from('musicbrainz_catalog')
          .select('mbid,discogs_master_id,album_title,first_release_year,secondary_types,match_type')
          .ilike('artist_name',canonicalArtistName)
          .limit(1000)

        const { data:catalogRows,error:catalogError } = catalogResult
        if (catalogError) {
          console.warn('Could not load local artist catalog for discography enrichment',catalogError)
        }

        const catalog=Array.isArray(catalogRows)?catalogRows:[]
        const byMbid=new Map<string,any>()
        const byMaster=new Map<string,any>()
        const byTitle=new Map<string,any[]>()
        const usedCatalogIdentities=new Set<string>()

        function catalogIdentity(row: any) {
          return String(row?.mbid||row?.discogs_master_id||'')
        }

        catalog.forEach((row: any)=>{
          const mbid=String(row?.mbid||'').toLowerCase()
          const master=String(row?.discogs_master_id||'')
          if (mbid) byMbid.set(mbid,row)
          if (master) byMaster.set(master,row)
          if (row?.match_type!=='direct' && row?.match_type!=='artist_title') return

          wikipediaAlbumKeys(row?.album_title,canonicalArtistName).forEach((key: string)=>{
            if (!byTitle.has(key)) byTitle.set(key,[])
            byTitle.get(key)!.push(row)
          })
        })

        function bestCatalogTitleMatch(album: any) {
          const candidates:any[]=[]
          const seen=new Set<string>()
          const keys=wikipediaAlbumKeys(
            album?.article_title||album?.title,
            canonicalArtistName
          ).concat(wikipediaAlbumKeys(album?.title,canonicalArtistName))

          function addCandidate(row: any) {
            const identity=String(row?.mbid||row?.discogs_master_id||'')
            if (!identity||seen.has(identity)) return
            seen.add(identity)
            candidates.push(row)
          }

          keys.forEach((key: string)=>{
            ;(byTitle.get(key)||[]).forEach(addCandidate)
          })

          const wantedYear=Number(album?.year)||0

          // Wikipedia often uses a shortened display title while MusicBrainz
          // keeps a subtitle (for example "Tales of Mystery and Imagination"
          // vs "...: Edgar Allan Poe"). If exact normalized keys found nothing,
          // allow a contained-title match only for direct catalog rows with the
          // same release year and no compilation/live/remix secondary type.
          if (!candidates.length) {
            const wantedTitles=keys.filter((key: string)=>key.length>=8)
            catalog.forEach((row: any)=>{
              if (row?.match_type!=='direct') return
              const secondary=String(row?.secondary_types||'').toLowerCase()
              if (/compilation|live|remix|dj-mix|mixtape/.test(secondary)) return

              const rowYear=Number(row?.first_release_year)||0
              if (wantedYear&&rowYear&&Math.abs(wantedYear-rowYear)>1) return

              const rowKey=normalizeIdentity(row?.album_title)
              const titleMatches=wantedTitles.some((wanted: string)=>
                rowKey===wanted ||
                (rowKey.length>=8&&wanted.length>=8&&
                  (rowKey.includes(wanted)||wanted.includes(rowKey)))
              )
              if (titleMatches)addCandidate(row)
            })
          }

          const best=candidates
            .map((row: any)=>{
              const secondary=String(row?.secondary_types||'').toLowerCase()
              const rowYear=Number(row?.first_release_year)||0
              const rowKey=normalizeIdentity(row?.album_title)
              const exactTitle=keys.includes(rowKey)
              let score=exactTitle?120:70
              if (wantedYear&&rowYear===wantedYear) score+=80
              else if (wantedYear&&rowYear) {
                score-=Math.min(Math.abs(wantedYear-rowYear)*20,80)
              }
              if (!secondary) score+=20
              else if (secondary==='soundtrack') score+=15
              if (/compilation|live|remix|dj-mix|mixtape/.test(secondary)) score-=100
              return {row,score}
            })
            .sort((left: any,right: any)=>right.score-left.score)[0]

          // An exact title alone is not enough. A distant compilation/reissue
          // must not override a Wikipedia-owned core album just because no better
          // same-artist row exists locally (ABBA's 1973 Ring Ring is a real case).
          return best&&best.score>=60?best.row:null
        }

        async function uniqueGlobalCatalogMatch(album: any) {
          const title=wikipediaDisplayTitle(album?.title||album?.article_title)
          const year=Number(album?.year)||0
          if (!title||!year)return null

          const result=await admin
            .from('musicbrainz_catalog')
            .select('mbid,discogs_master_id,artist_name,album_title,first_release_year,secondary_types,match_type')
            .eq('match_type','direct')
            .eq('first_release_year',year)
            .ilike('album_title',title)
            .limit(3)

          if (result.error) {
            console.warn('Could not resolve cross-credit catalog album',result.error)
            return null
          }

          const rows=(Array.isArray(result.data)?result.data:[])
            .filter((row: any)=>{
              const secondary=String(row?.secondary_types||'').toLowerCase()
              return !/compilation|live|remix|dj-mix|mixtape|demo|interview/.test(secondary)
            })

          return rows.length===1?rows[0]:null
        }

        function sameYearRemainder(album: any) {
          const year=Number(album?.year)||0
          if (!year)return null

          const rows=catalog.filter((row: any)=>{
            if (row?.match_type!=='direct')return false
            if (Number(row?.first_release_year)!==year)return false
            if (usedCatalogIdentities.has(catalogIdentity(row)))return false
            const secondary=String(row?.secondary_types||'').toLowerCase()
            return !/compilation|live|remix|dj-mix|mixtape|demo|interview/.test(secondary)
          })

          return rows.length===1?rows[0]:null
        }

        const prelim=wikipediaAlbums.map((album: any,index: number)=>{
          const title=wikipediaDisplayTitle(album?.title||album?.article_title)
          if (!title)return null
          const local=bestCatalogTitleMatch(album)
          if (local)usedCatalogIdentities.add(catalogIdentity(local))
          return {album,index,title,local}
        }).filter(Boolean)

        // A title alias can still be resolved safely when it is the only unused
        // direct album for that artist/year after the obvious matches are taken.
        prelim.forEach((entry: any)=>{
          if (entry.local)return
          const local=sameYearRemainder(entry.album)
          if (!local)return
          entry.local=local
          usedCatalogIdentities.add(catalogIdentity(local))
        })

        // Artist credits sometimes change while the discography remains continuous
        // (ELO -> Jeff Lynne's ELO). For remaining rows, accept a global catalog
        // match only when title + year has exactly one direct non-secondary result.
        await Promise.all(prelim.map(async (entry: any)=>{
          if (entry.local)return
          entry.local=await uniqueGlobalCatalogMatch(entry.album)
        }))

        const unresolved=prelim.filter((entry: any)=>!entry.local)
        if (unresolved.length) {
          const identifiers=await wikidataReleaseIdentifiersByArticleTitles(
            unresolved.map((entry: any)=>
              String(entry.album?.article_title||entry.title||'').trim()
            )
          )

          unresolved.forEach((entry: any)=>{
            const keys=[
              normalizeIdentity(entry.album?.article_title),
              normalizeIdentity(entry.title)
            ].filter(Boolean)
            const match=keys
              .map((key: string)=>identifiers.get(key))
              .find(Boolean)
            if (!match) return

            entry.local={
              mbid:match.mbid||null,
              discogs_master_id:match.discogs_master_id||null,
              first_release_year:Number(entry.album?.year)||null
            }
          })
        }

        const mainDiscographyEntries=prelim.filter((entry: any)=>{
          const secondary=String(entry.local?.secondary_types||'').toLowerCase()
          if (/compilation|live|remix|dj-mix|mixtape|demo|interview/.test(secondary)) {
            return false
          }
          const title=normalizeIdentity(entry.title)
          if (/\bgreatest hits\b|\bbest of\b/.test(title)) return false
          return true
        })

        const unresolvedMasters=mainDiscographyEntries.filter((entry: any)=>
          !Number(entry.local?.discogs_master_id)
        )
        await mapWithConcurrency(unresolvedMasters,4,async (entry: any)=>{
          const resolved=await resolveVinylMasterByTitle(
            canonicalArtistName,
            entry.title,
            entry.album?.year
          )
          if (!resolved)return
          entry.local={
            ...(entry.local||{}),
            discogs_master_id:resolved.discogs_master_id
          }
        })

        const vinylCheck=await verifyDiscogsVinylMasters(
          admin,
          canonicalArtistName,
          mainDiscographyEntries
            .map((entry: any)=>Number(entry.local?.discogs_master_id)||0)
            .filter(Boolean)
        )

        if (!vinylCheck.complete && cachedSource==='vinyl' && cachedCount>0) {
          return Response.json({
            verified:true,
            cached:true,
            stale:true,
            changed:false,
            count:cachedCount,
            source:'vinyl',
            reason:'discogs_vinyl_verification_incomplete',
            wikidata_id:resolvedWikidataId
          })
        }

        const vinylDiscographyEntries=mainDiscographyEntries.filter((entry: any)=>{
          const master=Number(entry.local?.discogs_master_id)||0
          return master>0 && vinylCheck.vinylIds.has(master)
        })

        const now=new Date().toISOString()
        const sourcePage=wikipedia.discographyPage||wikipedia.artistPage||''
        const matched=vinylDiscographyEntries.map((entry: any,position: number)=>{
          const album=entry.album
          const index=entry.index
          const title=entry.title
          const local=entry.local

          const mbid=String(local?.mbid||'').trim()||null
          const master=Number(local?.discogs_master_id)||null
          const year=Number(album?.year||local?.first_release_year)||null

          const articleTitle=String(album?.article_title||'').trim()
          const sourceIdentity=normalizeIdentity(articleTitle||title)
          const sourceKey='wikipedia:'+
            (sourceIdentity||normalizeIdentity(title))+
            '|'+String(Number(album?.year)||index+1)

          return {
            discogs_artist_id:resolvedArtistId,
            source_key:sourceKey,
            position:position+1,
            source_page:sourcePage||null,
            mbid,
            discogs_master_id:master,
            album_title:title,
            first_release_year:year,
            source:'wikipedia_vinyl',
            verified_at:now
          }
        })

        const { data:existingRows,error:existingError } = await admin
          .from('artist_discography_cache')
          .select('source_key,position,mbid,discogs_master_id,album_title,first_release_year,source')
          .eq('discogs_artist_id',resolvedArtistId)

        if (existingError) {
          console.warn('Could not inspect verified artist discography',existingError)
        }

        function rowIdentity(row: any) {
          return [
            String(row?.source_key||''),
            String(row?.position||0),
            String(row?.mbid||''),
            String(row?.discogs_master_id||''),
            String(row?.album_title||''),
            String(row?.first_release_year||''),
            String(row?.source||'')
          ].join('|')
        }

        const existingSet=new Set(
          (Array.isArray(existingRows)?existingRows:[]).map(rowIdentity)
        )
        const nextSet=new Set(matched.map(rowIdentity))
        const changed=existingSet.size!==nextSet.size ||
          Array.from(nextSet).some((value)=>!existingSet.has(value))

        if (changed) {
          const { error:deleteError } = await admin
            .from('artist_discography_cache')
            .delete()
            .eq('discogs_artist_id',resolvedArtistId)
          if (deleteError) {
            console.warn('Could not replace verified artist discography',deleteError)
            return Response.json({error:'Could not replace verified discography'},{status:500})
          }

          const { error:insertError } = await admin
            .from('artist_discography_cache')
            .insert(matched)
          if (insertError) {
            console.warn('Could not persist verified artist discography',insertError)
            return Response.json({error:'Could not persist verified discography'},{status:500})
          }
        }

        await admin.from('artist_profile_cache').upsert({
          discogs_artist_id:resolvedArtistId,
          artist_name:canonicalArtistName,
          wikidata_id:resolvedWikidataId,
          discography_checked_at:now,
          discography_source:'vinyl',
          discography_count:matched.length,
          updated_at:now
        },{onConflict:'discogs_artist_id'})

        return Response.json({
          verified:true,
          changed,
          count:matched.length,
          source:'vinyl',
          enriched_count:matched.filter((row: any)=>
            row&& (row.mbid||row.discogs_master_id)
          ).length,
          wikipedia_count:wikipediaAlbums.length,
          vinyl_count:matched.length,
          strategy:String(wikipedia?.strategy||'discography_page'),
          wikidata_id:resolvedWikidataId
        })
      }

      if (action === 'artistProfile') {
        let resolvedArtistId=Number(artistId)||0

        if (!resolvedArtistId && artistName) {
          const searchResult=await discogsJson(
            'https://api.discogs.com/database/search?q=' +
            encodeURIComponent(artistName) + '&type=artist&per_page=8'
          )
          if (searchResult.response) return searchResult.response

          const candidates=(Array.isArray(searchResult.data?.results)?searchResult.data.results:[])
            .map((item: any)=>({
              id:Number(item?.id)||0,
              name:cleanArtistName(item?.title),
              score:artistSearchScore(item,artistName)
            }))
            .filter((item: any)=>item.id && item.score>0)
            .sort((left: any,right: any)=>right.score-left.score)

          resolvedArtistId=candidates[0]?.id||0
        }

        if (!resolvedArtistId) {
          return Response.json({ error: 'Artist could not be resolved' }, { status: 404 })
        }

        const admin=getServiceClient()
        if (admin) {
          const { data:cachedProfile,error:cachedProfileError } = await admin
            .from('artist_profile_cache')
            .select('discogs_artist_id,artist_name,current_members,past_members,genres,official_url,fetched_at')
            .eq('discogs_artist_id',resolvedArtistId)
            .maybeSingle()

          if (cachedProfileError) {
            console.warn('Could not load artist profile cache',cachedProfileError)
          } else if (
            cachedProfile &&
            cachedProfile.fetched_at &&
            Date.now()-Date.parse(String(cachedProfile.fetched_at)) < 30*24*60*60*1000
          ) {
            return Response.json({
              id:Number(cachedProfile.discogs_artist_id),
              name:String(cachedProfile.artist_name||artistName),
              real_name:'',
              current_members:Array.isArray(cachedProfile.current_members)?cachedProfile.current_members:[],
              past_members:Array.isArray(cachedProfile.past_members)?cachedProfile.past_members:[],
              genres:Array.isArray(cachedProfile.genres)?cachedProfile.genres:[],
              official_url:String(cachedProfile.official_url||''),
              cached:true
            })
          }
        }

        const artistResult=await discogsJson(
          'https://api.discogs.com/artists/' + encodeURIComponent(String(resolvedArtistId))
        )
        if (artistResult.response) return artistResult.response

        const artist=artistResult.data || {}
        const members=Array.isArray(artist.members)?artist.members:[]
        const currentMembers=members
          .filter((member: any)=>member && member.active!==false)
          .map((member: any)=>({id:Number(member.id)||null,name:cleanArtistName(member.name)}))
          .filter((member: any)=>member.name)
        const pastMembers=members
          .filter((member: any)=>member && member.active===false)
          .map((member: any)=>({id:Number(member.id)||null,name:cleanArtistName(member.name)}))
          .filter((member: any)=>member.name)

        const resolvedName=cleanArtistName(artist.name)||artistName
        const officialUrl=officialArtistUrl(artist.urls)

        // Do not block a first artist visit on a second Discogs search just
        // to infer genres from up to 30 masters. The artist page already gets
        // its genre chips from the local get_artist_overview read model.
        const genres:string[]=[]

        if (admin && resolvedName) {
          const { error:artistIdentityError } = await admin
            .from('artists')
            .update({discogs_artist_id:resolvedArtistId})
            .ilike('name',resolvedName)
            .is('discogs_artist_id',null)
          if (artistIdentityError) {
            console.warn('Could not link existing Groovy artist to Discogs',artistIdentityError)
          }

          const now=new Date().toISOString()
          const { error:profileCacheError } = await admin
            .from('artist_profile_cache')
            .upsert({
              discogs_artist_id:resolvedArtistId,
              artist_name:resolvedName,
              current_members:currentMembers,
              past_members:pastMembers,
              genres:genres,
              official_url:officialUrl||null,
              fetched_at:now,
              updated_at:now
            },{onConflict:'discogs_artist_id'})
          if (profileCacheError) {
            console.warn('Could not persist artist profile cache',profileCacheError)
          }
        }

        return Response.json({
          id:resolvedArtistId,
          name:resolvedName,
          real_name:String(artist.realname||'').trim(),
          current_members:currentMembers,
          past_members:pastMembers,
          genres:genres,
          official_url:officialUrl
        })
      }

      if (action === 'master') {
        if (!masterId) return Response.json({ error: 'Master ID saknas' }, { status: 400 })
        const result = await discogsJson(
          'https://api.discogs.com/masters/' + encodeURIComponent(masterId)
        )
        return result.response || Response.json(result.data)
      }

      if (action === 'release') {
        if (!releaseId) return Response.json({ error: 'Release ID saknas' }, { status: 400 })
        const result = await discogsJson(
          'https://api.discogs.com/releases/' + encodeURIComponent(releaseId)
        )
        return result.response || Response.json(result.data)
      }

      if (action === 'versions') {
        if (!masterId) return Response.json({ error: 'Master ID saknas' }, { status: 400 })

        const page = Math.max(1, Math.min(100, Number(body.page) || 1))
        const params = new URLSearchParams({
          format: 'Vinyl',
          per_page: '100',
          page: String(page)
        })

        const optionalFilters = [
          ['country', body.country],
          ['released', body.released],
          ['label', body.label]
        ]

        optionalFilters.forEach(([name, value]) => {
          const cleanValue = String(value || '').trim()
          if (cleanValue) params.set(String(name), cleanValue)
        })

        const result = await discogsJson(
          'https://api.discogs.com/masters/' + encodeURIComponent(masterId) +
          '/versions?' + params.toString()
        )
        return result.response || Response.json(result.data)
      }

      if (action === 'vinylRelease') {
        if (!masterId) return Response.json({ error: 'Master ID saknas' }, { status: 400 })

        const versionsResult = await discogsJson(
          'https://api.discogs.com/masters/' + encodeURIComponent(masterId) +
          '/versions?format=Vinyl&per_page=50'
        )
        if (versionsResult.response) return versionsResult.response

        const versions = Array.isArray(versionsResult.data?.versions)
          ? versionsResult.data.versions
          : []

        if (!versions.length) return Response.json({ release: null, tracklist: [] })

        function isVinylVersion(version: Record<string, unknown>) {
          const format = Array.isArray(version.format)
            ? version.format.join(' ').toLowerCase()
            : String(version.format || '').toLowerCase()
          return format.includes('vinyl') || format.includes('lp') ||
            format.includes('12"') || format.includes('10"') || format.includes('7"')
        }

        function flattenTracklist(tracklist: unknown[]) {
          const rows: Record<string, unknown>[] = []
          ;(Array.isArray(tracklist) ? tracklist : []).forEach((track: any) => {
            if (track && (track.type_ === 'track' || (!track.type_ && track.title))) rows.push(track)
            if (track && Array.isArray(track.sub_tracks)) {
              track.sub_tracks.forEach((subTrack: any) => {
                if (subTrack && (subTrack.type_ === 'track' || (!subTrack.type_ && subTrack.title))) {
                  rows.push(subTrack)
                }
              })
            }
          })
          return rows
        }

        function tracklistScore(tracklist: unknown[]) {
          const rows = flattenTracklist(tracklist)
          const durationCount = rows.filter((track: any) => String(track.duration || '').trim()).length
          const sidedCount = rows.filter((track: any) => /^[A-H]\s*\d/i.test(String(track.position || ''))).length
          return durationCount * 10000 + sidedCount * 100 + rows.length
        }

        const candidateIds = versions
          .filter(isVinylVersion)
          .map((version: Record<string, unknown>) => String(version.id || version.release_id || '').trim())
          .filter(Boolean)
          .slice(0, 8)

        if (!candidateIds.length) return Response.json({ release: null, tracklist: [] })

        const candidateResults = await Promise.all(candidateIds.map(async (candidateId) => {
          const result = await discogsJson(
            'https://api.discogs.com/releases/' + encodeURIComponent(candidateId)
          )
          if (result.response || !result.data) return null
          const tracklist = Array.isArray(result.data.tracklist) ? result.data.tracklist : []
          return {
            release: result.data,
            tracklist,
            score: tracklistScore(tracklist)
          }
        }))

        const best = candidateResults
          .filter(Boolean)
          .sort((a: any, b: any) => b.score - a.score)[0] || null

        if (!best) return Response.json({ release: null, tracklist: [] })

        return Response.json({
          release: best.release,
          tracklist: best.tracklist
        })
      }

      return Response.json({ error: 'Okänd action' }, { status: 400 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Kunde inte kontakta Discogs' }, { status: 500 })
    }
  })
}
