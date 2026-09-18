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
      const wikidataId = String(body.wikidataId || '').trim()
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

        const { data:catalogRows,error:catalogError } = await admin
          .from('musicbrainz_catalog')
          .select('discogs_master_id,artist_name,album_title,first_release_year,secondary_types,match_type')
          .ilike('artist_name',resolvedArtistName)
          .not('discogs_master_id','is',null)
          .limit(200)

        if (catalogError) {
          console.warn('Could not load artist discography for Apple cache',catalogError)
          return Response.json({ error: 'Could not load artist discography' }, { status: 500 })
        }

        const seenMasters=new Set<string>()
        const catalog=(Array.isArray(catalogRows)?catalogRows:[])
          .filter((row: any)=>{
            const secondary=String(row?.secondary_types||'').trim()
            const title=String(row?.album_title||'').toLowerCase()
            return (!secondary||secondary==='Soundtrack') &&
              !title.includes('film soundtrack') &&
              !title.includes('motion picture soundtrack')
          })
          .sort((left: any,right: any)=>{
            const directLeft=left?.match_type==='direct'?0:1
            const directRight=right?.match_type==='direct'?0:1
            return directLeft-directRight
          })
          .filter((row: any)=>{
            const key=String(row?.discogs_master_id||'')
            if (!key || seenMasters.has(key)) return false
            seenMasters.add(key)
            return true
          })
          .slice(0,60)

        const masterIds=catalog
          .map((row: any)=>Number(row.discogs_master_id)||0)
          .filter(Boolean)

        if (!masterIds.length) {
          return Response.json({eligible:0,cached_total:0,cached_added:0,complete:true})
        }

        const { data:existingRows,error:existingError } = await admin
          .from('apple_artwork_cache')
          .select('discogs_master_id')
          .in('discogs_master_id',masterIds)

        if (existingError) {
          console.warn('Could not inspect Apple artwork cache',existingError)
          return Response.json({ error: 'Could not inspect artwork cache' }, { status: 500 })
        }

        const existingIds=new Set(
          (Array.isArray(existingRows)?existingRows:[])
            .map((row: any)=>String(row.discogs_master_id||''))
            .filter(Boolean)
        )

        const missing=catalog.filter((row: any)=>!existingIds.has(String(row.discogs_master_id||'')))
        const now=new Date().toISOString()

        if (!missing.length) {
          await admin.from('artist_profile_cache').update({
            artwork_checked_at:now,
            artwork_eligible_count:catalog.length,
            artwork_cached_count:catalog.length,
            updated_at:now
          }).eq('discogs_artist_id',resolvedArtistId)

          return Response.json({
            eligible:catalog.length,
            cached_total:catalog.length,
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
          Number(cacheState?.artwork_eligible_count||0)===catalog.length &&
          Number(cacheState?.artwork_cached_count||0)===existingIds.size
        ) {
          return Response.json({
            eligible:catalog.length,
            cached_total:existingIds.size,
            cached_added:0,
            complete:existingIds.size===catalog.length,
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
            artwork_eligible_count:catalog.length,
            artwork_cached_count:existingIds.size,
            updated_at:now
          }).eq('discogs_artist_id',resolvedArtistId)

          return Response.json({
            eligible:catalog.length,
            cached_total:existingIds.size,
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

        const cachedTotal=Math.min(catalog.length,existingIds.size+matches.length)
        await admin.from('artist_profile_cache').update({
          artwork_checked_at:now,
          artwork_eligible_count:catalog.length,
          artwork_cached_count:cachedTotal,
          updated_at:now
        }).eq('discogs_artist_id',resolvedArtistId)

        return Response.json({
          eligible:catalog.length,
          cached_total:cachedTotal,
          cached_added:matches.length,
          complete:cachedTotal===catalog.length
        })
      }

      if (action === 'verifyArtistDiscography') {
        const resolvedArtistId=Number(artistId)||0
        const resolvedArtistName=cleanArtistName(artistName)
        const resolvedWikidataId=/^Q\d+$/.test(wikidataId)?wikidataId:''

        if (!resolvedArtistId || !resolvedArtistName || !resolvedWikidataId) {
          return Response.json({ error:'Artist ID, name and Wikidata ID are required' },{status:400})
        }

        const admin=getServiceClient()
        if (!admin) {
          return Response.json({ error:'Discography cache configuration is incomplete' },{status:500})
        }

        const { data:profileState,error:profileStateError } = await admin
          .from('artist_profile_cache')
          .select('wikidata_id,discography_checked_at,discography_source,discography_count')
          .eq('discogs_artist_id',resolvedArtistId)
          .maybeSingle()

        if (profileStateError) {
          console.warn('Could not read discography verification state',profileStateError)
        }

        const checkedAt=profileState?.discography_checked_at
          ?Date.parse(String(profileState.discography_checked_at))
          :0
        if (
          checkedAt &&
          Date.now()-checkedAt<30*24*60*60*1000 &&
          String(profileState?.wikidata_id||'')===resolvedWikidataId
        ) {
          return Response.json({
            verified:profileState?.discography_source==='wikidata',
            cached:true,
            count:Number(profileState?.discography_count)||0,
            changed:false
          })
        }

        const studioAlbums=await wikidataStudioAlbums(resolvedWikidataId)
        const { data:catalogRows,error:catalogError } = await admin
          .from('musicbrainz_catalog')
          .select('mbid,discogs_master_id,artist_name,album_title,first_release_year,secondary_types,match_type')
          .ilike('artist_name',resolvedArtistName)
          .limit(1000)

        if (catalogError) {
          console.warn('Could not load MusicBrainz catalog for discography verification',catalogError)
          return Response.json({error:'Could not load local artist catalog'},{status:500})
        }

        const catalog=Array.isArray(catalogRows)?catalogRows:[]
        const byMbid=new Map<string,any>()
        const byMaster=new Map<string,any>()
        const byTitle=new Map<string,any[]>()

        catalog.forEach((row: any)=>{
          const mbid=String(row?.mbid||'').toLowerCase()
          const master=String(row?.discogs_master_id||'')
          const titleKey=normalizeIdentity(row?.album_title)
          if (mbid) byMbid.set(mbid,row)
          if (master) byMaster.set(master,row)
          if (titleKey) {
            if (!byTitle.has(titleKey)) byTitle.set(titleKey,[])
            byTitle.get(titleKey)!.push(row)
          }
        })

        const matched:any[]=[]
        const seenMbids=new Set<string>()

        studioAlbums.forEach((album: any)=>{
          let row:any=null
          if (album.mbid) row=byMbid.get(String(album.mbid).toLowerCase())||null
          if (!row&&album.discogs_master_id) row=byMaster.get(String(album.discogs_master_id))||null

          if (!row&&album.title) {
            const candidates=byTitle.get(normalizeIdentity(album.title))||[]
            row=candidates
              .filter((candidate: any)=>candidate?.match_type==='direct')
              .sort((left: any,right: any)=>{
                const wantedYear=Number(album.year)||0
                const leftYear=Number(left?.first_release_year)||0
                const rightYear=Number(right?.first_release_year)||0
                const leftDiff=wantedYear&&leftYear?Math.abs(wantedYear-leftYear):99
                const rightDiff=wantedYear&&rightYear?Math.abs(wantedYear-rightYear):99
                return leftDiff-rightDiff
              })[0]||null
          }

          if (!row) return
          const mbid=String(row.mbid||'').toLowerCase()
          if (!mbid||seenMbids.has(mbid)) return
          seenMbids.add(mbid)

          matched.push({
            discogs_artist_id:resolvedArtistId,
            mbid:String(row.mbid),
            discogs_master_id:Number(row.discogs_master_id),
            album_title:String(row.album_title||album.title||'').trim(),
            first_release_year:Number(row.first_release_year)||null,
            source:'wikidata',
            verified_at:new Date().toISOString()
          })
        })

        const baselineKeys=new Set(
          catalog
            .filter((row: any)=>{
              const secondary=String(row?.secondary_types||'').trim()
              const title=String(row?.album_title||'').toLowerCase()
              return row?.match_type==='direct' &&
                (!secondary||secondary==='Soundtrack') &&
                !title.includes('film soundtrack') &&
                !title.includes('motion picture soundtrack')
            })
            .map((row: any)=>String(row.mbid||''))
            .filter(Boolean)
        )

        const wikidataCoverage=studioAlbums.length
          ?matched.length/studioAlbums.length
          :0
        const baselineCoverage=baselineKeys.size
          ?matched.length/baselineKeys.size
          :(matched.length?1:0)

        const verified=matched.length>0 &&
          wikidataCoverage>=0.55 &&
          (baselineKeys.size<=2||baselineCoverage>=0.55)

        const now=new Date().toISOString()

        if (!verified) {
          await admin.from('artist_profile_cache').upsert({
            discogs_artist_id:resolvedArtistId,
            artist_name:resolvedArtistName,
            wikidata_id:resolvedWikidataId,
            discography_checked_at:now,
            discography_source:'fallback',
            discography_count:matched.length,
            updated_at:now
          },{onConflict:'discogs_artist_id'})

          return Response.json({
            verified:false,
            changed:false,
            count:matched.length,
            wikidata_count:studioAlbums.length,
            baseline_count:baselineKeys.size,
            wikidata_coverage:wikidataCoverage,
            baseline_coverage:baselineCoverage
          })
        }

        const { data:existingRows,error:existingError } = await admin
          .from('artist_discography_cache')
          .select('mbid')
          .eq('discogs_artist_id',resolvedArtistId)

        if (existingError) {
          console.warn('Could not inspect verified artist discography',existingError)
        }

        const existingSet=new Set(
          (Array.isArray(existingRows)?existingRows:[])
            .map((row: any)=>String(row.mbid||'').toLowerCase())
            .filter(Boolean)
        )
        const nextSet=new Set(matched.map((row: any)=>String(row.mbid||'').toLowerCase()))
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
          artist_name:resolvedArtistName,
          wikidata_id:resolvedWikidataId,
          discography_checked_at:now,
          discography_source:'wikidata',
          discography_count:matched.length,
          updated_at:now
        },{onConflict:'discogs_artist_id'})

        return Response.json({
          verified:true,
          changed,
          count:matched.length,
          wikidata_count:studioAlbums.length,
          baseline_count:baselineKeys.size,
          wikidata_coverage:wikidataCoverage,
          baseline_coverage:baselineCoverage
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

        const genreResult=resolvedName
          ?await discogsJson(
            'https://api.discogs.com/database/search?artist=' +
            encodeURIComponent(resolvedName) + '&type=master&per_page=30'
          )
          :{data:{results:[]}}

        const genreCounts=new Map<string,number>()
        if (!genreResult.response) {
          const masters=Array.isArray(genreResult.data?.results)?genreResult.data.results:[]
          masters.forEach((master: any)=>{
            const values=[
              ...(Array.isArray(master?.style)?master.style:[]),
              ...(Array.isArray(master?.genre)?master.genre:[])
            ]
            values.forEach((value: unknown)=>{
              const label=String(value||'').trim()
              if (!label) return
              genreCounts.set(label,(genreCounts.get(label)||0)+1)
            })
          })
        }
        const genres=Array.from(genreCounts.entries())
          .sort((left,right)=>right[1]-left[1] || left[0].localeCompare(right[0]))
          .slice(0,4)
          .map((entry)=>entry[0])

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
