import { withSupabase } from 'npm:@supabase/server'

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

        const selectedVersion = versions.find((version: Record<string, unknown>) => {
          const format = Array.isArray(version.format)
            ? version.format.join(' ').toLowerCase()
            : String(version.format || '').toLowerCase()
          return format.includes('vinyl') || format.includes('lp') ||
            format.includes('12"') || format.includes('10"') || format.includes('7"')
        }) || versions[0]

        const selectedReleaseId = selectedVersion.id || selectedVersion.release_id
        if (!selectedReleaseId) return Response.json({ release: null, tracklist: [] })

        const releaseResult = await discogsJson(
          'https://api.discogs.com/releases/' + encodeURIComponent(selectedReleaseId)
        )
        if (releaseResult.response) return releaseResult.response

        return Response.json({
          release: releaseResult.data,
          tracklist: Array.isArray(releaseResult.data?.tracklist)
            ? releaseResult.data.tracklist
            : []
        })
      }

      return Response.json({ error: 'Okänd action' }, { status: 400 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: 'Kunde inte kontakta Discogs' }, { status: 500 })
    }
  })
}
