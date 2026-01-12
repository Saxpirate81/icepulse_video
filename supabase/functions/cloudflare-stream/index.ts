import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, userId, metadata, gameId } = await req.json()

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Cloudflare credentials not configured on server')
    }

    // 1. GET DIRECT UPLOAD URL (For saving videos - VOD)
    if (action === 'get-upload-url') {
      const uploadMetadata = {
        name: metadata?.name || `Video ${new Date().toISOString()}`,
        requiresignedurls: true,
        meta: {
          userId: userId,
          gameId: metadata?.gameId,
          orgId: metadata?.orgId
        }
      }

      // Convert metadata to base64 string as required by TUS/Cloudflare
      // Format: key value,key2 value2 (values base64 encoded)
      const uploadMetadataStr = Object.entries(uploadMetadata)
        .map(([key, value]) => {
          const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
          return `${key} ${btoa(valStr)}`
        })
        .join(',')

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Tus-Resumable': '1.0.0',
            'Upload-Length': `${metadata.size}`,
            'Upload-Metadata': uploadMetadataStr,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Cloudflare Error:', errorText)
        throw new Error(`Cloudflare Error: ${response.statusText}`)
      }

      // TUS returns the upload URL in the 'Location' header
      const uploadUrl = response.headers.get('Location')

      if (!uploadUrl) {
        throw new Error('Cloudflare did not return an upload URL')
      }

      // Extract UID from URL
      // Format: https://upload.videodelivery.net/tus/{uid}?tusv2=true
      const uid = uploadUrl.split('/tus/')[1]?.split('?')[0]

      return new Response(
        JSON.stringify({ uploadUrl, uid }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. CREATE LIVE INPUT (For streaming)
    if (action === 'create-live-input') {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meta: {
              name: `Live Stream - ${new Date().toISOString()}`,
              userId: userId,
              gameId: gameId
            },
            recording: { 
              mode: 'automatic', // Auto-record to VOD
              requireSignedURLs: false, // Set to true if you want private videos
              allowedOrigins: ['*'] // Restrict if needed
            } 
          }),
        }
      )

      const data = await response.json()

      if (!data.success) {
        console.error('Cloudflare Live Input Error:', JSON.stringify(data.errors))
        throw new Error(`Cloudflare Error: ${data.errors[0]?.message}`)
      }

      const result = data.result
      
      return new Response(
        JSON.stringify({
          liveInputId: result.uid,
          rtmpsKey: result.rtmps.streamKey,
          rtmpsUrl: result.rtmps.url,
          whipUrl: result.webRTC.url, // For browser broadcasting
          playbackUrl: result.webRTC.playback.url // Low latency playback
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
