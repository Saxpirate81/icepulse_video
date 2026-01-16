import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID')
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getAuthHeader = () => {
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    throw new Error('Mux credentials not configured on server')
  }
  const creds = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`)
  return `Basic ${creds}`
}

const muxFetch = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`https://api.mux.com${path}`, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.errors?.[0]?.message ||
      data?.message ||
      response.statusText
    const details = Object.keys(data || {}).length ? ` | ${JSON.stringify(data)}` : ''
    throw new Error(`Mux Error: ${message}${details}`)
  }

  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, userId, gameId, contentType, uploadId } = await req.json()

    if (action === 'get-upload-url') {
      const upload = await muxFetch('/video/v1/uploads', {
        method: 'POST',
        body: JSON.stringify({
          cors_origin: '*',
          new_asset_settings: {
            playback_policy: ['public'],
            passthrough: JSON.stringify({ userId, gameId, contentType }),
          },
        }),
      })

      return new Response(
        JSON.stringify({
          uploadUrl: upload?.data?.url,
          uploadId: upload?.data?.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get-upload-asset') {
      if (!uploadId) {
        throw new Error('Missing uploadId')
      }

      const upload = await muxFetch(`/video/v1/uploads/${uploadId}`)
      const assetId = upload?.data?.asset_id || null

      if (!assetId) {
        return new Response(
          JSON.stringify({ status: 'processing' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const asset = await muxFetch(`/video/v1/assets/${assetId}`)
      const playbackId = asset?.data?.playback_ids?.[0]?.id || null
      const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null
      const thumbnailUrl = playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null

      return new Response(
        JSON.stringify({
          assetId,
          playbackId,
          playbackUrl,
          thumbnailUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create-live-input') {
      const stream = await muxFetch('/video/v1/live-streams', {
        method: 'POST',
        body: JSON.stringify({
          passthrough: JSON.stringify({ userId, gameId }),
          playback_policy: ['public'],
          latency_mode: 'low',
          new_asset_settings: {
            playback_policy: ['public'],
          },
        }),
      })

      const liveStreamId = stream?.data?.id || null
      const streamKey = stream?.data?.stream_key || ''
      const playbackId = stream?.data?.playback_ids?.[0]?.id || null
      const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : ''
      const rtmpUrl = stream?.data?.rtmp?.url || ''
      const derivedRtmpsUrl = rtmpUrl
        ? rtmpUrl
            .replace(/^rtmp:/i, 'rtmps:')
            .replace(':1935', ':443')
            .replace(':5222', ':443')
        : ''
      // Mux live ingest RTMPS base URL (static); keep as fallback.
      const rtmpsUrl = derivedRtmpsUrl || 'rtmps://global-live.mux.com:443/app'

      return new Response(
        JSON.stringify({
          liveStreamId,
          streamKey,
          playbackUrl,
          rtmpsUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
