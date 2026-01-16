import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MUX_WEBHOOK_SECRET = Deno.env.get('MUX_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const parseMuxSignature = (header: string | null) => {
  if (!header) return null
  const parts = header.split(',').map((p) => p.trim())
  const values: Record<string, string> = {}
  for (const part of parts) {
    const [k, v] = part.split('=')
    if (k && v) values[k] = v
  }
  return values
}

const verifyMuxSignature = async (rawBody: string, signatureHeader: string | null) => {
  if (!MUX_WEBHOOK_SECRET) return true
  const parsed = parseMuxSignature(signatureHeader)
  if (!parsed?.t || !parsed?.v1) return false

  const signedPayload = `${parsed.t}.${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MUX_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const hex = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return crypto.timingSafeEqual?.(new TextEncoder().encode(hex), new TextEncoder().encode(parsed.v1)) ?? hex === parsed.v1
}

const supabaseRequest = async (path: string, options: RequestInit) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role key not configured on server')
  }
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase error: ${res.status} ${text}`)
  }
  return res
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    const isValid = await verifyMuxSignature(rawBody, req.headers.get('mux-signature'))
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.parse(rawBody)
    const eventType = payload?.type
    const data = payload?.data || {}

    if (eventType === 'video.asset.ready' && data?.live_stream_id) {
      const playbackId = data?.playback_ids?.[0]?.id || null
      const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null
      const thumbnailUrl = playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null

      await supabaseRequest(`icepulse_video_recordings?cloudflare_uid=eq.${data.live_stream_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          video_url: playbackUrl,
          thumbnail_url: thumbnailUrl,
          upload_status: 'completed',
          cloudflare_status: 'ready',
          recording_end_timestamp: new Date().toISOString(),
        }),
      })

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (eventType === 'video.asset.live_stream_completed' && data?.live_stream_id) {
      await supabaseRequest(`icepulse_streams?cloudflare_live_input_id=eq.${data.live_stream_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (eventType === 'video.asset.errored' && data?.live_stream_id) {
      await supabaseRequest(`icepulse_video_recordings?cloudflare_uid=eq.${data.live_stream_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          upload_status: 'failed',
          processing_error: data?.errors?.[0]?.message || 'Mux asset error',
        }),
      })
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (
      (eventType === 'video.live_stream.active' ||
        eventType === 'video.live_stream.idle' ||
        eventType === 'video.live_stream.disconnected' ||
        eventType === 'video.live_stream.disabled') &&
      data?.id
    ) {
      const shouldBeActive = eventType === 'video.live_stream.active'
      await supabaseRequest(`icepulse_streams?cloudflare_live_input_id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: shouldBeActive,
        }),
      })
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
