import { withSupabase } from 'npm:@supabase/server'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function firstValue(record: JsonRecord, names: string[]): unknown {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null) return record[name]
  }
  return undefined
}

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }

  const nested = asRecord(value)
  const amount = firstValue(nested, ['amount', 'Amount', 'value', 'Value'])
  return amount === undefined ? null : numericValue(amount)
}

function imageValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const image of value) {
      const found = imageValue(image)
      if (found) return found
    }
    return ''
  }

  const image = asRecord(value)
  return textValue(firstValue(image, [
    'url', 'Url', 'URL', 'link', 'Link', 'imageUrl', 'ImageUrl',
    'thumbnailLink', 'ThumbnailLink'
  ]))
}

function itemScore(value: unknown): number {
  const item = asRecord(value)
  let score = 0
  if (firstValue(item, ['id', 'Id', 'itemId', 'ItemId']) !== undefined) score++
  if (firstValue(item, ['shortDescription', 'ShortDescription', 'title', 'Title'])) score++
  if (firstValue(item, ['itemLink', 'ItemLink', 'url', 'Url'])) score++
  if (firstValue(item, ['endDate', 'EndDate', 'thumbnailLink', 'ThumbnailLink'])) score++
  return score
}

function findListingArray(value: unknown, depth = 0): unknown[] {
  if (depth > 6) return []
  if (Array.isArray(value)) {
    if (value.length && value.some((item) => itemScore(item) >= 2)) return value

    let best: unknown[] = []
    for (const item of value) {
      const candidate = findListingArray(item, depth + 1)
      if (candidate.length > best.length) best = candidate
    }
    return best
  }

  const record = asRecord(value)
  const preferred = [
    'items', 'Items', 'searchItems', 'SearchItems', 'itemList', 'ItemList',
    'results', 'Results'
  ]

  for (const key of preferred) {
    const candidate = findListingArray(record[key], depth + 1)
    if (candidate.length) return candidate
  }

  let best: unknown[] = []
  for (const child of Object.values(record)) {
    const candidate = findListingArray(child, depth + 1)
    if (candidate.length > best.length) best = candidate
  }
  return best
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
  const artistMatch = !artistTerms.length || artistHits >= Math.max(1, Math.ceil(artistTerms.length * .5))
  const albumMatch = albumHits >= Math.max(1, Math.ceil(albumTerms.length * .6))
  return artistMatch && albumMatch
}

function isVinylListing(title: string): boolean {
  const normalized = normalizeSearchText(title)
  const nonVinylTerms = [
    /\bcd\b/, /\bdvd\b/, /\bvhs\b/, /\bblu ray\b/, /\bcassette\b/,
    /\bkassett\b/, /\bmugg\b/, /\bt shirt\b/, /\bshirt\b/, /\bpin badge\b/,
    /\bbadge\b/, /\bposter\b/, /\baffisch\b/, /\btablature\b/, /\bfilm cell\b/
  ]
  const singleTerms = [
    /(?:^|\s)7\s*(?:inch|tum)(?:\s|$)/,
    /(?:^|\s)7(?:\s|$)/,
    /\bsingel\b/,
    /\bsingle\b/
  ]
  return !nonVinylTerms.some((pattern) => pattern.test(normalized)) &&
    !singleTerms.some((pattern) => pattern.test(normalized))
}

function isAlbumListing(title: string, artist: string, album: string): boolean {
  const normalized = normalizeSearchText(title)
  const normalizedArtist = normalizeSearchText(artist)
  const normalizedAlbum = normalizeSearchText(album)

  // A self-titled album cannot be validated by counting shared words: an
  // artist-only search would otherwise accept every LP by that artist.
  if (normalizedArtist && normalizedArtist === normalizedAlbum) {
    let remainder = normalized
      .replace(new RegExp('\\b' + normalizedArtist.replace(/\s+/g, '\\s+') + '\\b'), ' ')
      .replace(new RegExp('\\b' + normalizedAlbum.replace(/\s+/g, '\\s+') + '\\b'), ' ')
      .replace(/\b(?:self titled|debut|album|vinyl|skiva|gatefold|lp|\d+x?lp|(?:180|200)g)\b/g, ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
      .replace(/\b(?:sweden|swedish|sverige|germany|german|canada|canadian|uk|us|usa|eu|press|pressing|first|1st|original|mono|stereo|sealed|new|ny)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return !remainder
  }

  const albumFormat = /\b(?:\d+x?)?lp\b|\bvinyl\b|\balbum\b|\bskiva\b|\bgatefold\b|\b(?:180|200)g\b/
  if (albumFormat.test(normalized)) return true

  const identityTerms = normalizeSearchText(artist + ' ' + album)
    .split(' ')
    .filter((term) => term.length > 1)
    .sort((left, right) => right.length - left.length)
  let remainder = normalized
  for (const term of identityTerms) {
    remainder = remainder.replace(new RegExp('\\b' + term + '\\b', 'g'), ' ')
  }
  remainder = remainder
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:sweden|swedish|sverige|germany|german|canada|canadian|uk|us|usa|eu|press|pressing|first|1st|original|mono|stereo|sealed|new|ny)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return !remainder || remainder.split(' ').length <= 2
}

function listingUrl(item: JsonRecord, id: string, title: string): string {
  const suppliedUrl = textValue(firstValue(item, [
    'itemLink', 'ItemLink', 'itemUrl', 'ItemUrl', 'url', 'Url'
  ]))
  if (suppliedUrl) return suppliedUrl

  const categoryValue = firstValue(item, ['categoryId', 'CategoryId'])
  const category = asRecord(firstValue(item, ['category', 'Category']))
  const categoryId = textValue(
    categoryValue ?? firstValue(category, ['id', 'Id', 'categoryId', 'CategoryId'])
  )
  if (!id || !categoryId) return ''

  const slug = normalizeSearchText(title).replace(/\s+/g, '-').slice(0, 90)
  return 'https://www.tradera.com/item/' + categoryId + '/' + id + (slug ? '/' + slug : '')
}

function normalizeListing(value: unknown) {
  const item = asRecord(value)
  const id = textValue(firstValue(item, ['id', 'Id', 'itemId', 'ItemId']))
  const title = textValue(firstValue(item, [
    'shortDescription', 'ShortDescription', 'title', 'Title', 'name', 'Name'
  ]))
  const endDate = textValue(firstValue(item, ['endDate', 'EndDate']))
  const imageUrl = imageValue(firstValue(item, [
    'detailedImageLinks', 'DetailedImageLinks', 'imageLinks', 'ImageLinks',
    'thumbnailLink', 'ThumbnailLink', 'imageUrl', 'ImageUrl'
  ]))

  return {
    id,
    title,
    url: listingUrl(item, id, title),
    imageUrl,
    endDate,
    openingBid: numericValue(firstValue(item, ['openingBid', 'OpeningBid'])),
    currentBid: numericValue(firstValue(item, ['maxBid', 'MaxBid', 'currentBid', 'CurrentBid'])),
    nextBid: numericValue(firstValue(item, ['nextBid', 'NextBid'])),
    buyNowPrice: numericValue(firstValue(item, ['buyItNowPrice', 'BuyItNowPrice'])),
    bidCount: numericValue(firstValue(item, ['totalBids', 'TotalBids'])) || 0,
    currency: textValue(firstValue(item, ['currency', 'Currency'])) || 'SEK'
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    try {
      const body = await req.json()
      const artist = textValue(body.artist).slice(0, 100)
      const album = textValue(body.album).slice(0, 140)
      const appId = Deno.env.get('TRADERA_APP_ID')
      const appKey = Deno.env.get('TRADERA_APP_KEY')

      if (!artist || !album) {
        return Response.json({ error: 'Artist and album are required.' }, { status: 400 })
      }
      if (!appId || !appKey) {
        return Response.json({ error: 'Tradera is not configured.' }, { status: 503 })
      }

      const params = new URLSearchParams({
        query: artist + ' ' + album,
        // 2108 is Tradera's Vinyl category and includes its genre subcategories.
        categoryId: '2108',
        pageNumber: '0'
      })
      const response = await fetch('https://api.tradera.com/v4/search?' + params.toString(), {
        headers: {
          'Accept': 'application/json',
          'X-App-Id': appId,
          'X-App-Key': appKey
        }
      })

      if (!response.ok) {
        const details = (await response.text()).slice(0, 300)
        console.error('Tradera search failed', response.status, details)
        return Response.json(
          { error: 'Tradera search failed.', status: response.status },
          { status: response.status === 429 ? 429 : 502 }
        )
      }

      const payload = await response.json()
      const now = Date.now()
      const listings = findListingArray(payload)
        .map(normalizeListing)
        .filter((listing) => listing.id || listing.url)
        .filter((listing) => !listing.endDate || new Date(listing.endDate).getTime() > now)
        .filter((listing) => relevantListing(listing.title, artist, album))
        .filter((listing) => isVinylListing(listing.title))
        .filter((listing) => isAlbumListing(listing.title, artist, album))
        .filter((listing, index, all) => {
          const key = listing.id || listing.url
          return all.findIndex((candidate) => (candidate.id || candidate.url) === key) === index
        })
        .slice(0, 60)

      return Response.json(
        { listings, count: listings.length },
        { headers: { 'Cache-Control': 'private, max-age=120' } }
      )
    } catch (error) {
      console.error('Unexpected Tradera error', error)
      return Response.json({ error: 'Could not search Tradera.' }, { status: 500 })
    }
  })
}
