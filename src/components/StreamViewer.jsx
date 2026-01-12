import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wifi, WifiOff, Play } from 'lucide-react'
import Hls from 'hls.js'

function StreamViewer({ streamId, isPreview = false }) {
  const [isLive, setIsLive] = useState(false)
  const [streamInfo, setStreamInfo] = useState(null)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    // Load stream metadata
    const loadStreamInfo = async () => {
      try {
        // Try to find by UUID first
        let query = supabase
          .from('icepulse_streams')
          .select(`
            *,
            icepulse_games (
              *,
              icepulse_teams (name),
              icepulse_organizations (name, header_image_url)
            )
          `)
        
        // Check if streamId is a valid UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(streamId)
        
        if (isUuid) {
          query = query.eq('id', streamId)
        } else {
          // Assume it's a Cloudflare UID
          query = query.eq('cloudflare_live_input_id', streamId)
        }

        const { data, error } = await query.single()

        if (error) {
          console.error('Stream load error:', error)
          // If stream doesn't exist, still allow viewing (might be starting soon)
          if (!cancelled) {
            setStreamInfo({ id: streamId, is_active: false })
            setIsLive(false)
          }
          return
        }
        
        console.log('✅ Loaded Stream Info:', data)
        
        // If this stream is NOT active, check if there is a newer active stream for the same game
        if (!data.is_active && data.game_id && !cancelled) {
          console.log('🔍 Stream is inactive, checking for newer active stream for game:', data.game_id)
          const { data: activeStream } = await supabase
            .from('icepulse_streams')
            .select('id')
            .eq('game_id', data.game_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (activeStream && activeStream.id !== streamId) {
            console.log('🔄 Found newer active stream, redirecting:', activeStream.id)
            window.location.href = `/stream/${activeStream.id}`
            return
          }
        }

        if (!cancelled) {
          setStreamInfo(data)
          setIsLive(data.is_active || false)
        }
      } catch (err) {
        console.error('Error loading stream info:', err)
        if (!cancelled) {
          setStreamInfo({ id: streamId, is_active: false })
          setIsLive(false)
        }
      }
    }

    if (streamId) {
      console.log('🔍 StreamViewer mounted with ID:', streamId)
      loadStreamInfo()
      
      // Poll for stream status updates (e.g. if it goes live)
      const statusInterval = setInterval(() => {
        loadStreamInfo()
      }, 5000)
      
      return () => {
        cancelled = true
        clearInterval(statusInterval)
      }
    }
  }, [streamId])

  const pollingStartedRef = useRef(null)

  // Initialize HLS Player (skip for preview mode)
  useEffect(() => {
    if (isPreview) return // Skip setup for preview mode
    
    let cancelled = false
    
    const currentPlaybackUrl = streamInfo?.cloudflare_playback_url
    if (!currentPlaybackUrl || pollingStartedRef.current === currentPlaybackUrl) return
    
    pollingStartedRef.current = currentPlaybackUrl
    console.log('🎬 [VIEWER] Starting setup for URL:', currentPlaybackUrl)

    // Setup WebRTC playback for live streams (WHEP protocol)
    const setupWebRTCPlayback = async (videoElement, playbackUrl, retryCount = 0) => {
      if (cancelled) return
      
      try {
        console.log('🎥 [VIEWER] Setting up WebRTC playback:', playbackUrl, retryCount > 0 ? `(retry ${retryCount})` : '')
        
        // Create RTCPeerConnection for receiving
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        })
        
        // Handle incoming stream
        pc.ontrack = (event) => {
          console.log('✅ [VIEWER] Received WebRTC track:', event.track.kind)
          if (event.track.kind === 'video' || event.track.kind === 'audio') {
            videoElement.srcObject = event.streams[0]
            videoElement.play().catch(e => console.warn('Autoplay failed:', e))
            setIsLive(true)
            setError(null)
          }
        }
        
        pc.oniceconnectionstatechange = () => {
          console.log('🔌 [VIEWER] ICE connection state:', pc.iceConnectionState)
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            console.warn('⚠️ [VIEWER] WebRTC connection failed/disconnected')
          }
        }
        
        // Create offer
        const offer = await pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: true
        })
        await pc.setLocalDescription(offer)
        
        // Send offer to Cloudflare WHEP endpoint
        const response = await fetch(playbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        })
        
        if (!response.ok) {
          // 409 means stream is not ready yet (no publisher connected or not receiving data)
          // Don't show error, just set waiting state and retry
          if (response.status === 409) {
            console.log(`⏳ [VIEWER] Stream not ready yet (409) - no publisher connected. Retry ${retryCount + 1}/30...`)
            setIsLive(false)
            setError(null) // Clear any previous errors
            // Retry with exponential backoff: 2s, 3s, 5s, then 5s intervals (max 30 retries = ~2.5 minutes)
            const delay = retryCount < 3 ? [2000, 3000, 5000][retryCount] : 5000
            if (retryCount < 30 && !cancelled) {
              setTimeout(() => {
                if (videoElement && !cancelled) {
                  setupWebRTCPlayback(videoElement, playbackUrl, retryCount + 1)
                }
              }, delay)
            } else if (retryCount >= 30) {
              console.log('⏳ [VIEWER] Max retries reached (30), stream may not be broadcasting yet. Waiting for broadcaster to start...')
            }
            return
          }
          throw new Error(`WHEP request failed: ${response.status} ${response.statusText}`)
        }
        
        const answerSdp = await response.text()
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp
        })
        
        console.log('✅ [VIEWER] WebRTC playback connection established')
        
        // Store PC reference for cleanup
        videoElement._webrtcPc = pc
        
      } catch (error) {
        console.error('❌ [VIEWER] WebRTC playback setup failed:', error)
        // For errors, show waiting message instead of error
        setIsLive(false)
        setError(null)
        // Retry after a delay (max 20 retries = 100 seconds to allow more time for stream to start)
        if (retryCount < 20 && !cancelled) {
          console.log('⏳ [VIEWER] Will retry connection...')
          setTimeout(() => {
            if (videoElement && !cancelled) {
              setupWebRTCPlayback(videoElement, playbackUrl, retryCount + 1)
            }
          }, 5000)
        } else if (retryCount >= 20) {
          console.log('⏳ [VIEWER] Max retries reached, stream may not be broadcasting yet')
        }
      }
    }

    const setup = async () => {
      const video = videoRef.current
      if (!video) return

      // Build list of candidate URLs to poll
      const candidateUrls = []
      
      // 1. Prioritize the exact playback URL from the database
      if (streamInfo.cloudflare_playback_url) {
        candidateUrls.push(streamInfo.cloudflare_playback_url)
      }
      
      // 2. Add variants of the playback URL if we have one
      if (streamInfo.cloudflare_playback_url) {
        const url = streamInfo.cloudflare_playback_url
        if (!url.includes('mode=live')) {
          candidateUrls.push(url.includes('?') ? `${url}&mode=live` : `${url}?mode=live`)
        }
      }

      // 3. Fallback candidates using the liveInputId (less reliable but good to have)
      const liveInputId = streamInfo.cloudflare_live_input_id?.trim()
      if (liveInputId) {
        candidateUrls.push(`https://customer-iwica243j9k9zbs3.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`)
        candidateUrls.push(`https://videodelivery.net/${liveInputId}/manifest/video.m3u8`)
      }

      // 4. Query Cloudflare API to get the actual current playback URL (if liveInputId exists)
      if (liveInputId) {
        try {
          const CF_ACCOUNT_ID = "8ddadc04f6a8c0fd32db2fae084995dc"
          const CF_API_TOKEN = "ZgCaabkk8VGTVH6ZVuIJLgXEPbN2426yM-vtY-uT"
          
          const cfResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs/${liveInputId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          )
          
          if (cfResponse.ok) {
            const cfData = await cfResponse.json()
            if (cfData?.success && cfData?.result) {
              const liveInput = cfData.result
              
              // Log full details for debugging
              console.log('☁️ [VIEWER] Cloudflare Live Input Full Response:', JSON.stringify(liveInput, null, 2))
              
              const webRTCPlaybackUrl = liveInput.webRTCPlayback?.url
              const hlsPlaybackUrl = liveInput.hlsPlayback?.url
              const streamStatus = liveInput.status?.current?.state
              
              console.log('☁️ [VIEWER] Cloudflare Live Input Status:', {
                uid: liveInput.uid,
                status: streamStatus,
                hasWebRTCPlayback: !!webRTCPlaybackUrl,
                hasHLSPlayback: !!hlsPlaybackUrl,
                webRTCPlaybackUrl: webRTCPlaybackUrl,
                hlsPlaybackUrl: hlsPlaybackUrl
              })
              
              // Check if stream has an active publisher (someone is broadcasting)
              // Cloudflare status can be: 'connected' (publisher connected), 'disconnected', or null (no publisher yet)
              const hasActivePublisher = streamStatus === 'connected'
              
              // For LIVE streams: Always try WebRTC playback if URL is available (HLS not available during live)
              // WebRTC will retry on 409 errors until publisher connects
              // For VOD streams: Use HLS playback
              if (webRTCPlaybackUrl) {
                // Always try WebRTC for live streams (will retry on 409 if no publisher yet)
                if (hasActivePublisher) {
                  console.log('✅ [VIEWER] Stream has active publisher - Using WebRTC playback:', webRTCPlaybackUrl)
                } else {
                  console.log('⏳ [VIEWER] No active publisher yet, trying WebRTC (will retry on 409):', webRTCPlaybackUrl)
                }
                setupWebRTCPlayback(video, webRTCPlaybackUrl, 0)
                return // Exit early, don't poll for HLS
              } else if (hlsPlaybackUrl) {
                // No WebRTC but HLS available - might be VOD
                candidateUrls.unshift(hlsPlaybackUrl)
                console.log('✅ [VIEWER] Using HLS playback (VOD):', hlsPlaybackUrl)
              } else {
                console.warn('⚠️ [VIEWER] Cloudflare API did not return a playback URL. Status:', streamStatus)
              }
            } else {
              console.warn('⚠️ [VIEWER] Cloudflare API response was not successful:', cfData)
            }
          } else {
            const errorText = await cfResponse.text()
            console.warn('⚠️ [VIEWER] Cloudflare API request failed:', cfResponse.status, errorText)
          }
        } catch (e) {
          console.warn('⚠️ [VIEWER] Could not query Cloudflare API:', e.message)
        }
      }

      const uniqueCandidates = [...new Set(candidateUrls.filter(Boolean))]
      console.log('🎬 [VIEWER] Polling candidates:', uniqueCandidates)

      if (uniqueCandidates.length === 0) {
        console.warn('⚠️ [VIEWER] No playback URLs or IDs found; cannot poll.')
        return
      }

      // Poll the manifest until ready (avoid 204 empty responses). Try all candidates.
      const waitForManifest = async () => {
        const maxAttempts = 120 // up to ~240s (2s intervals) - increased for Cloudflare's live manifest generation
        console.log(`📡 [VIEWER] Starting manifest polling for ${uniqueCandidates.length} URLs (max 240s)...`)
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) return null

          for (const url of uniqueCandidates) {
            try {
              // Use a shorter timeout for the fetch itself
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 5000)
              
              // Add cache buster
              const fetchUrl = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`
              
              const res = await fetch(fetchUrl, { 
                method: 'GET', 
                mode: 'cors',
                signal: controller.signal
              })
              clearTimeout(timeoutId)
              
              if (res.ok && res.status !== 204) {
                console.log(`✅ [VIEWER] Manifest READY (Status ${res.status}) at:`, url)
                return url
              }
              
              // Log more frequently for first 30 attempts to track progress
              if (attempt <= 30 && attempt % 3 === 0) {
                console.log(`📡 [VIEWER] Polling attempt ${attempt}/${maxAttempts}: ${res.status} for ${url.substring(0, 50)}...`)
              } else if (attempt % 10 === 0) {
                console.log(`📡 [VIEWER] Polling attempt ${attempt}/${maxAttempts}: ${res.status} for ${url.substring(0, 50)}...`)
              }
              
              // If still getting 204 after 60 attempts, warn that it's taking longer than expected
              if (attempt === 60 && res.status === 204) {
                console.warn('⚠️ [VIEWER] Still receiving 204 after 2 minutes. This is longer than expected. Check Cloudflare dashboard to verify stream is receiving data.')
              }
            } catch (e) {
              // Only log errors every 10 attempts to reduce noise
              if (attempt % 10 === 0) {
                console.warn(`⚠️ [VIEWER] Fetch error at ${url.substring(0, 50)}...:`, e.message)
              }
            }
          }
          await new Promise(r => setTimeout(r, 2000))
        }
        return null
      }

      const readyUrl = await waitForManifest()
      if (!readyUrl) {
        console.warn('⚠️ Manifest not ready after extended polling')
        setError('Stream manifest is not ready yet. Please try again shortly.')
        return
      }

      // Check for native HLS support (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = readyUrl
        video.play().catch(e => console.warn('Autoplay failed:', e))
      }
      // Check for HLS.js support (Chrome, Firefox, etc.)
      else if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy()
        }

        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        })

        hls.loadSource(readyUrl)
        hls.attachMedia(video)
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS Manifest Parsed, playing...')
          video.play().catch(e => console.warn('Autoplay failed:', e))
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('HLS Network error, recovering...', data)
                hls.startLoad()
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('HLS Media error, recovering...', data)
                hls.recoverMediaError()
                break
              default:
                console.error('HLS Fatal error:', data)
                hls.destroy()
                break
            }
          } else {
            console.warn('HLS non-fatal error:', data)
          }
        })

        hlsRef.current = hls
      } else {
        setError('This browser does not support HLS playback.')
      }
    }

    setup()

    return () => {
      cancelled = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      // Clean up WebRTC connection if it exists
      if (videoRef.current?._webrtcPc) {
        videoRef.current._webrtcPc.close()
        videoRef.current._webrtcPc = null
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [streamInfo?.cloudflare_playback_url, isPreview])

  // Don't show error screen - show waiting UI instead
  // Errors are handled gracefully with retries

  if (!streamInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading stream...</p>
        </div>
      </div>
    )
  }

  const game = streamInfo?.icepulse_games
  const team = Array.isArray(game?.icepulse_teams) ? game.icepulse_teams[0] : game?.icepulse_teams
  const organization = Array.isArray(game?.icepulse_organizations) ? game.icepulse_organizations[0] : game?.icepulse_organizations
  const opponent = game?.opponent || 'TBA'
  const eventType = game?.event_type || 'game'
  
  // Format the event display based on type
  const getEventDisplay = () => {
    if (eventType === 'game') {
      return opponent ? `vs ${opponent}` : 'vs TBA'
    } else if (eventType === 'practice') {
      return 'Practice'
    } else if (eventType === 'skills') {
      return 'Skills'
    }
    return opponent ? `vs ${opponent}` : 'vs TBA'
  }
  
  const eventDisplay = getEventDisplay()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white overflow-hidden">
      {/* Contemporary Header with Live Indicator */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-sm p-3 sm:p-4">
        {/* Header Image */}
        {organization?.header_image_url && (
          <div className="mb-3 -mx-3 sm:-mx-4">
            <img
              src={organization.header_image_url}
              alt="Organization header"
              className="w-full h-auto max-h-24 sm:max-h-32 object-contain"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Team Logo - Note: logo_url column needs to be added to icepulse_teams table first */}
            {/* {team?.logo_url && (
              <img
                src={team.logo_url}
                alt={team.name || 'Team logo'}
                className="object-contain flex-shrink-0"
                style={{ 
                  height: 'calc(1.5rem + 0.75rem + 0.125rem)',
                  maxHeight: 'calc(1.5rem + 0.75rem + 0.125rem)',
                  width: 'auto'
                }}
              />
            )} */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold truncate bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              {team?.name || 'IcePulse Stream'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {organization?.name && (
                <span className="text-xs sm:text-sm text-gray-400 truncate">
                  {organization.name}
                </span>
              )}
                {organization?.name && eventDisplay && <span className="text-gray-600">•</span>}
              <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">
                  {eventType === 'game' ? eventDisplay : `• ${eventDisplay}`}
              </span>
              </div>
            </div>
          </div>
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-green-500/20 border border-green-500/50 backdrop-blur-sm flex-shrink-0">
              <div className="relative">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                <div className="absolute inset-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-green-400 font-bold text-xs sm:text-sm tracking-wider">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gray-800/50 border border-gray-700/50 backdrop-blur-sm flex-shrink-0">
              <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
              <span className="text-gray-500 font-semibold text-xs sm:text-sm tracking-wider">OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Player - Full Screen */}
      <div className="w-full h-screen bg-black flex items-center justify-center pt-16 sm:pt-20 relative">
        {/* Video container - flip video content but keep controls normal using wrapper approach */}
        <div className="w-full h-full relative" style={{ transform: 'scaleX(-1)' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          muted={true}
          controls
          controlsList="nodownload"
          preload="auto"
          crossOrigin="anonymous"
            style={{ transform: 'scaleX(-1)' }} // Double flip: container flips everything, video flips back so controls are normal
        />
        </div>
        
        {/* Waiting / Offline Overlay - Show when stream is not live */}
        {!isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center px-4">
              <div className="relative mb-6">
                <Wifi className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-gray-700 animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400 bg-clip-text text-transparent mb-2">
                Video will start streaming momentarily...
              </h2>
              <p className="text-gray-400 text-sm sm:text-base">
                Waiting for broadcast signal
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StreamViewer