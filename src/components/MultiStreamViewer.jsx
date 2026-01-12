import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wifi, WifiOff, ArrowLeft, Calendar, Dumbbell, Sparkles } from 'lucide-react'
import StreamViewer from './StreamViewer'

// Preview component for grid view - minimal, muted video
function StreamPreview({ streamId }) {
  const videoRef = useRef(null)
  
  useEffect(() => {
    let cancelled = false
    
    // Setup WebRTC for preview (same as StreamViewer but minimal)
    const setupPreview = async () => {
      if (cancelled) return
      
      // Load stream info to get playback URL
      const { data } = await supabase
        .from('icepulse_streams')
        .select('cloudflare_live_input_id')
        .eq('id', streamId)
        .single()
      
      if (!data?.cloudflare_live_input_id || cancelled) return
      
      // Get WebRTC playback URL from Cloudflare
      const CF_ACCOUNT_ID = "8ddadc04f6a8c0fd32db2fae084995dc"
      const CF_API_TOKEN = "ZgCaabkk8VGTVH6ZVuIJLgXEPbN2426yM-vtY-uT"
      
      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs/${data.cloudflare_live_input_id}`,
          {
            headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
          }
        )
        
        if (cfResponse.ok && !cancelled) {
          const cfData = await cfResponse.json()
          const webRTCPlaybackUrl = cfData?.result?.webRTCPlayback?.url
          
          if (webRTCPlaybackUrl && videoRef.current && !cancelled) {
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            })
            
            pc.ontrack = (event) => {
              if (videoRef.current && !cancelled) {
                videoRef.current.srcObject = event.streams[0]
                videoRef.current.play().catch(() => {})
              }
            }
            
            const offer = await pc.createOffer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true
            })
            await pc.setLocalDescription(offer)
            
            const response = await fetch(webRTCPlaybackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/sdp' },
              body: offer.sdp
            })
            
            if (response.ok && !cancelled) {
              const answerSdp = await response.text()
              await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
              if (videoRef.current) {
                videoRef.current._webrtcPc = pc
              }
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Preview setup failed:', e)
        }
      }
    }
    
    setupPreview()
    
    return () => {
      cancelled = true
      if (videoRef.current?._webrtcPc) {
        videoRef.current._webrtcPc.close()
        videoRef.current._webrtcPc = null
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [streamId])
  
  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      playsInline
      muted
      autoPlay
      style={{ transform: 'scaleX(-1)' }}
    />
  )
}

function MultiStreamViewer({ organizationId, organizationName }) {
  const [streams, setStreams] = useState([])
  const [selectedStreamId, setSelectedStreamId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resolvedOrgId, setResolvedOrgId] = useState(organizationId)

  // Resolve organization name to ID if needed
  useEffect(() => {
    const resolveOrgId = async () => {
      if (organizationId) {
        setResolvedOrgId(organizationId)
        return
      }
      
      if (organizationName) {
        // Look up organization by name
        const { data, error } = await supabase
          .from('icepulse_organizations')
          .select('id')
          .eq('name', organizationName)
          .maybeSingle()
        
        if (data && !error) {
          setResolvedOrgId(data.id)
        } else {
          setResolvedOrgId(null)
        }
      } else {
        setResolvedOrgId(null)
      }
    }
    
    resolveOrgId()
  }, [organizationId, organizationName])

  useEffect(() => {
    const loadStreams = async () => {
      try {
        // Fetch all active streams
        const { data, error } = await supabase
          .from('icepulse_streams')
          .select(`
            *,
            icepulse_games (
              *,
              icepulse_teams (name),
              icepulse_organizations (id, name, header_image_url)
            )
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading streams:', error)
          return
        }

        // Filter by organization if resolvedOrgId is provided
        const filteredStreams = resolvedOrgId
          ? data.filter(stream => {
              const game = stream.icepulse_games
              const org = Array.isArray(game?.icepulse_organizations) 
                ? game.icepulse_organizations[0] 
                : game?.icepulse_organizations
              return org?.id === resolvedOrgId
            })
          : data

        setStreams(filteredStreams || [])
      } catch (err) {
        console.error('Error loading streams:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (organizationName && !resolvedOrgId) {
      // Wait for org ID to be resolved
      return
    }

    loadStreams()

    // Poll for new streams every 5 seconds
    const interval = setInterval(loadStreams, 5000)
    return () => clearInterval(interval)
  }, [resolvedOrgId, organizationName])

  // If a stream is selected, show full screen viewer
  if (selectedStreamId) {
    return (
      <div className="h-screen flex flex-col bg-black">
        <div className="flex-shrink-0 p-4 bg-black/80 border-b border-gray-800">
          <button
            onClick={() => setSelectedStreamId(null)}
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to All Streams</span>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <StreamViewer streamId={selectedStreamId} />
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading streams...</p>
        </div>
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <WifiOff className="w-20 h-20 mx-auto mb-4 text-gray-600" />
          <h2 className="text-2xl font-bold mb-2">No Live Streams</h2>
          <p className="text-gray-400">There are currently no active streams.</p>
        </div>
      </div>
    )
  }

  // Format event label
  const formatEventLabel = (game) => {
    if (!game) return 'Unknown Event'
    const team = Array.isArray(game.icepulse_teams) ? game.icepulse_teams[0] : game.icepulse_teams
    const eventType = game.event_type || 'game'
    const opponent = game.opponent || ''
    
    if (eventType === 'game') {
      return opponent ? `${team?.name || 'Team'} vs ${opponent}` : `${team?.name || 'Team'} Game`
    } else if (eventType === 'practice') {
      return `${team?.name || 'Team'} • Practice`
    } else if (eventType === 'skills') {
      return `${team?.name || 'Team'} • Skills`
    }
    return `${team?.name || 'Team'} Event`
  }

  // Format date/time
  const formatDateTime = (game) => {
    if (!game) return ''
    const date = game.gameDate ? new Date(game.gameDate).toLocaleDateString() : ''
    const time = game.gameTime || ''
    return time ? `${date} @ ${time}` : date
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-gray-800 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Live Streams</h1>
          <p className="text-gray-400 text-sm">{streams.length} active stream{streams.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Grid of Streams */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {streams.map((stream) => {
            const game = stream.icepulse_games
            const team = Array.isArray(game?.icepulse_teams) ? game.icepulse_teams[0] : game?.icepulse_teams
            const organization = Array.isArray(game?.icepulse_organizations) 
              ? game.icepulse_organizations[0] 
              : game?.icepulse_organizations
            const eventType = game?.event_type || 'game'
            
            return (
              <div
                key={stream.id}
                onClick={() => setSelectedStreamId(stream.id)}
                className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-blue-500 transition-all cursor-pointer group"
              >
                {/* Video Preview - Muted, using StreamPreview component */}
                <div className="relative aspect-video bg-black overflow-hidden">
                  <StreamPreview streamId={stream.id} />
                  <div className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 bg-green-500/90 rounded-full backdrop-blur-sm z-10">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                  {/* Event Type Icon */}
                  <div className="absolute top-2 left-2">
                    <div className={`p-2 rounded-lg backdrop-blur-sm ${
                      eventType === 'game' ? 'bg-blue-900/80' :
                      eventType === 'practice' ? 'bg-purple-900/80' :
                      'bg-emerald-900/80'
                    }`}>
                      {eventType === 'game' ? (
                        <Calendar className="w-4 h-4 text-blue-300" />
                      ) : eventType === 'practice' ? (
                        <Dumbbell className="w-4 h-4 text-purple-300" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-emerald-300" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Stream Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-white mb-1 truncate">
                    {formatEventLabel(game)}
                  </h3>
                  {team && (
                    <p className="text-xs text-gray-400 mb-1 truncate">
                      {team.name}
                    </p>
                  )}
                  {game && (
                    <p className="text-xs text-gray-500 truncate">
                      {formatDateTime(game)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MultiStreamViewer
