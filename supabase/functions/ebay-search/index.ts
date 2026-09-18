import { withSupabase } from 'npm:@supabase/server'

type JsonRecord = Record<string, unknown>

let cachedToken = ''
let cachedTokenExpiresAt = 0

const supportedMarketplaceIds = new Set([
  'EBAY_US','EBAY_AT','EBAY_AU','EBAY_BE','EBAY_CA','EBAY_CH','EBAY_DE',
  'EBAY_ES','EBAY_FR','EBAY_GB','EBAY_HK','EBAY_IE','EBAY_IT','EBAY_MY',
  'EBAY_NL','EBAY_PH','EBAY_PL','EBAY_SG','EBAY_TW'
])

function resolveMarketplaceId(requested: unknown, configured: string): string {
  const requestedId = textValue(requested).toUpperCase()
  if (supportedMarketplaceIds.has(requestedId)) return requestedId

  const configuredId = textValue(configured).toUpperCase()
  if (supportedMarketplaceIds.has(configuredId)) return configuredId

  return 'EBAY_US'
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function numberValue(value: unknown): number | null {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(the|a|an|and|of|deluxe|remaster(?:ed)?|anniversary|edition)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function relevantListing(title: string, artist: string, album: string): boolean {
  const haystack = normalizeSearchText(title)
  const artistTerms = normalizeSearchText(artist).split(' ').filter((term) => term.length > 1)
  const albumTerms = normalizeSearchText(album).split(' ').filter((term) => term.length > 1)
  if (!haystack || !albumTerms.length) return true

  const artistHits = artistTerms.filter((term) => haystack.includes(term)).length
  const albumHits = albumTerms.filter((term) => haystack.includes(term)).length
  return (!artistTerms.length || artistHits >= Math.max(1, Math.ceil(artistTerms.length * .5))) &&
    albumHits >= Math.max(1, Math.ceil(albumTerms.length * .6))
}

function isVinylLpListing(title: string): boolean {
  const normalized = normalizeSearchText(title)
  const rejected = [
    /\bcd\b/, /\bdvd\b/, /\bvhs\b/, /\bblu ray\b/, /\bcassette\b/,
    /\bkassett\b/, /\bmug\b/, /\bmugg\b/, /\bt shirt\b/, /\bshirt\b/,
    /\bpin badge\b/, /\bbadge\b/, /\bposter\b/, /\bbook\b/,
    /(?:^|\s)7\s*(?:inch|tum)(?:\s|$)/, /(?:^|\s)7(?:\s|$)/,
    /\bsingel\b/, /\bsingle\b/
  ]
  return !rejected.some((pattern) => pattern.test(normalized))
}

function isAlbumListing(title: string, artist: string, album: string): boolean {
  const normalized = normalizeSearchText(title)
  const normalizedArtist = normalizeSearchText(artist)
  const normalizedAlbum = normalizeSearchText(album)

  if (normalizedArtist && normalizedArtist === normalizedAlbum) {
    const escaped = normalizedArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const remainder = normalized
      .replace(new RegExp('\\b' + escaped + '\\b'), ' ')
      .replace(new RegExp('\\b' + escaped + '\\b'), ' ')
      .replace(/\b(?:self titled|debut|album|vinyl|gatefold|lp|\d+x?lp|(?:180|200)g)\b/g, ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
      .replace(/\b(?:germany|german|canada|canadian|uk|us|usa|eu|press|pressing|first|1st|original|mono|stereo|sealed|new)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return !remainder
  }

  return true
}

async function getApplicationToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) return cachedToken

  const credentials = btoa(clientId + ':' + clientSecret)
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
  })

  if (!response.ok) {
    console.error('eBay token failed', response.status, (await response.text()).slice(0, 300))
    throw new Error('Could not authenticate with eBay.')
  }

  const payload = asRecord(await response.json())
  cachedToken = textValue(payload.access_token)
  cachedTokenExpiresAt = Date.now() + Math.max(60, numberValue(payload.expires_in) || 7200) * 1000
  if (!cachedToken) throw new Error('eBay returned no access token.')
  return cachedToken
}

function normalizeListing(value: unknown) {
  const item = asRecord(value)
  const image = asRecord(item.image)
  const price = asRecord(item.price)
  const currentBid = asRecord(item.currentBidPrice)
  const thumbnails = Array.isArray(item.thumbnailImages) ? item.thumbnailImages : []
  const thumbnail = asRecord(thumbnails[0])

  return {
    id: textValue(item.itemId),
    title: textValue(item.title),
    url: textValue(item.itemWebUrl),
    imageUrl: textValue(image.imageUrl) || textValue(thumbnail.imageUrl),
    endDate: textValue(item.itemEndDate),
    openingBid: null,
    currentBid: numberValue(currentBid.value),
    nextBid: null,
    buyNowPrice: numberValue(price.value),
    bidCount: numberValue(item.bidCount) || 0,
    currency: textValue(price.currency) || textValue(currentBid.currency) || 'EUR'
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    try {
      const body = await req.json()
      const artist = textValue(body.artist).slice(0, 100)
      const album = textValue(body.album).slice(0, 140)
      const clientId = Deno.env.get('EBAY_CLIENT_ID') || ''
      const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET') || ''
      const marketplaceId = resolveMarketplaceId(body.marketplaceId, Deno.env.get('EBAY_MARKETPLACE_ID') || '')

      if (!artist || !album) {
        return Response.json({ error: 'Artist and album are required.' }, { status: 400 })
      }
      if (!clientId || !clientSecret) {
        return Response.json({ error: 'eBay is not configured.' }, { status: 503 })
      }

      const token = await getApplicationToken(clientId, clientSecret)
      const params = new URLSearchParams({
        q: artist + ' ' + album + ' vinyl LP',
        limit: '100'
      })
      const response = await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?' + params.toString(), {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId
        }
      })

      if (!response.ok) {
        const details = (await response.text()).slice(0, 300)
        console.error('eBay search failed', response.status, details)
        return Response.json(
          { error: 'eBay search failed.', status: response.status },
          { status: response.status === 429 ? 429 : 502 }
        )
      }

      const payload = asRecord(await response.json())
      const items = Array.isArray(payload.itemSummaries) ? payload.itemSummaries : []
      const now = Date.now()
      const listings = items
        .map(normalizeListing)
        .filter((listing) => listing.id && listing.url)
        .filter((listing) => !listing.endDate || new Date(listing.endDate).getTime() > now)
        .filter((listing) => relevantListing(listing.title, artist, album))
        .filter((listing) => isVinylLpListing(listing.title))
        .filter((listing) => isAlbumListing(listing.title, artist, album))
        .filter((listing, index, all) => all.findIndex((candidate) => candidate.id === listing.id) === index)
        .slice(0, 60)

      return Response.json(
        { listings, count: listings.length, marketplaceId },
        { headers: { 'Cache-Control': 'private, max-age=120' } }
      )
    } catch (error) {
      console.error('Unexpected eBay error', error)
      return Response.json({ error: 'Could not search eBay.' }, { status: 500 })
    }
  })
}
