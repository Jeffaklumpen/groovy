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
            title: String(track.title || '').trim()
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

      function identityMatches(left: unknown,right: unknown) {
        const a = normalizeIdentity(left)
        const b = normalizeIdentity(right)
        if (!a || !b) return false
        if (a === b) return true
        return a.length >= 6 && b.length >= 6 && (a.includes(b) || b.includes(a))
      }

      async function verifiedAppleAlbum(urlValue: unknown,artist: string,title: string) {
        const input = String(urlValue || '').trim()
        if (!input) return null
        let parsed: URL
        try { parsed = new URL(input) } catch (_error) { return null }
        if (!/(^|\.)apple\.com$/i.test(parsed.hostname)) return null
        const idMatch = parsed.pathname.match(/\/id(\d+)/i)
        if (!idMatch) return null

        const response = await fetch(
          'https://itunes.apple.com/lookup?id=' + encodeURIComponent(idMatch[1]) +
          '&entity=album&country=SE'
        )
        if (!response.ok) return null
        const payload = await response.json()
        const album = (Array.isArray(payload?.results) ? payload.results : []).find((item: any) =>
          item && item.collectionId &&
          identityMatches(item.artistName,artist) &&
          identityMatches(item.collectionName,title)
        )
        if (!album?.artworkUrl100) return null

        return {
          collectionId: Number(album.collectionId) || null,
          collectionUrl: String(album.collectionViewUrl || input),
          artworkUrl: String(album.artworkUrl100)
            .replace(/\/\d+x\d+bb\./,'/1000x1000bb.')
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

        const verifiedApple = await verifiedAppleAlbum(body.appleCollectionUrl,artist,title)
        const discogsCover = String(master.images?.[0]?.uri || master.images?.[0]?.uri150 || '').trim()
        const coverUrl = verifiedApple?.artworkUrl || discogsCover || null
        const coverSource = verifiedApple ? 'apple' : (discogsCover ? 'discogs' : null)
        const appleUrl = verifiedApple?.collectionUrl || null

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

        if (verifiedApple) {
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
        if (!query) return Response.json({ results: [] })
        const result = await discogsJson(
          'https://api.discogs.com/database/search?q=' +
          encodeURIComponent(query) + '&type=master&per_page=50'
        )
        return result.response || Response.json(result.data)
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
