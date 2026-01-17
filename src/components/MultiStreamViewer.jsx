import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wifi, WifiOff, ArrowLeft, Calendar, Dumbbell, Sparkles } from 'lucide-react'
import Hls from 'hls.js'
import StreamViewer from './StreamViewer'

// Preview component for grid view - minimal, muted video
function StreamPreview({ streamId }) {
  const videoRef = useRef(null)
  const [isLive, setIsLive] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const DEBUG_PREVIEW = true
  const logPreview = (...args) => {
    if (DEBUG_PREVIEW) {
      console.log('🧩 [StreamPreview]', ...args)
    }
  }
  
  useEffect(() => {
    let cancelled = false
    
    // Setup HLS preview (Mux-compatible)
    const setupPreview = async () => {
      if (cancelled) return
      
      logPreview('Loading preview', { streamId })
      const { data } = await supabase
        .from('icepulse_streams')
        .select('cloudflare_playback_url')
        .eq('id', streamId)
        .maybeSingle()
      
      const playbackUrl = data?.cloudflare_playback_url
      logPreview('Preview playback URL', { streamId, playbackUrl })
      if (!playbackUrl || cancelled) {
        setIsChecking(false)
        setIsLive(false)
        return
      }
      
      const probePlaybackUrl = async (url) => {
        if (!url) return false
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)
          const fetchUrl = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`
          const res = await fetch(fetchUrl, { method: 'GET', mode: 'cors', signal: controller.signal })
          clearTimeout(timeoutId)
          if (!res.ok) return false
          const text = await res.text()
          if (!text || !text.includes('#EXTM3U')) return false
          return !text.includes('#EXT-X-ENDLIST')
        } catch (e) {
          return false
        }
      }
      
      try {
        setIsChecking(true)
        const isStreamLive = await probePlaybackUrl(playbackUrl)
        if (cancelled) return
        setIsLive(isStreamLive)
        setIsChecking(false)
        logPreview('Preview probe result', { streamId, isStreamLive })
        if (!isStreamLive) return

        const video = videoRef.current
        if (!video || cancelled) return

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playbackUrl
          video.play().catch(() => {})
          logPreview('Preview native HLS playing', { streamId })
          return
        }

        if (Hls.isSupported()) {
          const hls = new Hls({ lowLatencyMode: true })
          hls.loadSource(playbackUrl)
          hls.attachMedia(video)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {})
            logPreview('Preview HLS manifest parsed', { streamId })
          })
          video._hls = hls
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Preview setup failed:', e)
          logPreview('Preview setup failed', { streamId, message: e?.message })
        }
      }
    }
    
    setupPreview()
    
    return () => {
      cancelled = true
      setIsChecking(false)
      if (videoRef.current?._hls) {
        videoRef.current._hls.destroy()
        videoRef.current._hls = null
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [streamId])
  
  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ transform: 'scaleX(-1)' }}
      />
      {!isLive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs sm:text-sm font-semibold">
          {isChecking ? 'Checking stream…' : 'Waiting for broadcast'}
        </div>
      )}
    </div>
  )
}

function MultiStreamViewer({ organizationId, organizationName, gameId }) {
  const [streams, setStreams] = useState([])
  const [selectedStreamId, setSelectedStreamId] = useState(null)
  const [selectedStream, setSelectedStream] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [resolvedOrgId, setResolvedOrgId] = useState(organizationId)
  const [showIntro, setShowIntro] = useState(true)
  const DEBUG_MULTI = true
  const logMulti = (...args) => {
    if (DEBUG_MULTI) {
      console.log('🧭 [MultiStreamViewer]', ...args)
    }
  }

  // Resolve organization name to ID if needed
  useEffect(() => {
    const resolveOrgId = async () => {
      if (organizationId) {
        setResolvedOrgId(organizationId)
        logMulti('Resolved org ID from prop', { organizationId })
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
          logMulti('Resolved org ID from name', { organizationName, orgId: data.id })
        } else {
          setResolvedOrgId(null)
          logMulti('Failed to resolve org ID', { organizationName, error })
        }
      } else {
        setResolvedOrgId(null)
      }
    }
    
    resolveOrgId()
  }, [organizationId, organizationName])

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const loadStreams = async () => {
      try {
        logMulti('Loading streams', { resolvedOrgId, gameId })
        const probePlaybackUrl = async (url) => {
          if (!url) return false
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 4000)
            const fetchUrl = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`
            const res = await fetch(fetchUrl, { method: 'GET', mode: 'cors', signal: controller.signal })
            clearTimeout(timeoutId)
            if (!res.ok) return false
            const text = await res.text()
            if (!text || !text.includes('#EXTM3U')) return false
            // Live manifests should NOT contain an ENDLIST tag.
            return !text.includes('#EXT-X-ENDLIST')
          } catch (e) {
            return false
          }
        }

        // Fetch all active streams
        let query = supabase
          .from('icepulse_streams')
          .select(`
            *,
            icepulse_games (
              *,
              icepulse_teams (name),
              icepulse_organizations (id, name, header_image_url)
            )
          `)
          .order('created_at', { ascending: false })
        
        if (gameId) {
          query = query.eq('game_id', gameId)
        }

        const { data, error } = await query

        if (error) {
          console.error('Error loading streams:', error)
          logMulti('Stream query error', { message: error?.message })
          return
        }

        const liveFlags = await Promise.all(
          (data || []).map(async (stream) => {
            const isManifestLive = await probePlaybackUrl(stream?.cloudflare_playback_url)
            if (isManifestLive) return true
            if (!stream?.is_active) return false
            const createdAt = stream?.created_at ? new Date(stream.created_at) : null
            const ageMs = createdAt && !Number.isNaN(createdAt.getTime()) ? Date.now() - createdAt.getTime() : null
            // Grace window for active streams that are warming up
            return typeof ageMs === 'number' && ageMs < 2 * 60 * 1000
          })
        )

        // Only show streams that are actually live or within warm-up window
        const liveOnly = (data || []).filter((stream, idx) => liveFlags[idx])

        // Filter by organization if resolvedOrgId is provided
        const filteredStreams = resolvedOrgId
          ? liveOnly.filter(stream => {
              const game = stream.icepulse_games
              const org = Array.isArray(game?.icepulse_organizations) 
                ? game.icepulse_organizations[0] 
                : game?.icepulse_organizations
              return org?.id === resolvedOrgId
            })
          : liveOnly

        setStreams(filteredStreams || [])
        logMulti('Streams loaded', {
          total: data?.length || 0,
          liveOnly: liveOnly.length,
          filtered: filteredStreams?.length || 0
        })
      } catch (err) {
        console.error('Error loading streams:', err)
        logMulti('Load streams error', { message: err?.message })
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
  }, [resolvedOrgId, organizationName, gameId])

  // If a stream is selected, show full screen viewer
  if (selectedStreamId) {
    return (
      <div className="h-[100dvh] flex flex-col bg-black min-h-0">
        <div className="flex-shrink-0 p-4 bg-black/80 border-b border-gray-800">
          <button
            onClick={() => setSelectedStreamId(null)}
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to All Streams</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <StreamViewer
            streamId={selectedStreamId}
            isEmbedded
            streamInfoOverride={selectedStream}
            playbackUrlOverride={selectedStream?.cloudflare_playback_url}
          />
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

  if (showIntro) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center transition-opacity duration-500">
        <div className="text-center">
          <div className="logo-flash-container">
            <img
              src="/Logo.png"
              alt="IcePulse Logo"
              className="logo-flash mx-auto object-contain"
              onError={(e) => {
                if (e.target.src.includes('Logo.png')) {
                  e.target.src = '/logo.png'
                  return
                }
                e.target.style.display = 'none'
              }}
            />
            <div className="hidden text-6xl font-bold text-blue-400">
              IcePulse
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/60 backdrop-blur-lg border-b border-gray-800/70">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/Logo.png"
                alt="IcePulse Logo"
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0"
                onError={(e) => {
                  if (e.target.src.includes('Logo.png')) {
                    e.target.src = '/logo.png'
                    return
                  }
                  e.target.style.display = 'none'
                }}
              />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Live Streams</h1>
                <p className="text-gray-400 text-sm">0 active streams</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center text-white px-4 py-10">
          <div className="text-center">
            <WifiOff className="w-20 h-20 mx-auto mb-4 text-gray-600" />
            <h2 className="text-2xl font-bold mb-2">No Live Streams</h2>
            <p className="text-gray-400">There are currently no active streams.</p>
          </div>
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

  const formatStartTime = (stream) => {
    const createdAt = stream?.created_at ? new Date(stream.created_at) : null
    if (!createdAt || Number.isNaN(createdAt.getTime())) return ''
    return `Started ${createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/60 backdrop-blur-lg border-b border-gray-800/70">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/Logo.png"
              alt="IcePulse Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0"
              onError={(e) => {
                if (e.target.src.includes('Logo.png')) {
                  e.target.src = '/logo.png'
                  return
                }
                e.target.style.display = 'none'
              }}
            />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Live Streams</h1>
              <p className="text-gray-400 text-sm">
                {streams.length} active stream{streams.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400">
            Live Now
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          </div>
        </div>
      </div>

      {/* Grid of Streams */}
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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
                onClick={() => {
                  logMulti('Stream selected', {
                    streamId: stream.id,
                    playbackUrl: stream.cloudflare_playback_url
                  })
                  setSelectedStreamId(stream.id)
                  setSelectedStream(stream)
                }}
                className="bg-gray-900/70 rounded-2xl overflow-hidden border border-gray-800/60 hover:border-blue-500/70 transition-all cursor-pointer group shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm"
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
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-1 truncate text-sm sm:text-base">
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
                  {stream.created_at && (
                    <p className="text-xs text-gray-500 truncate mt-1">
                      {formatStartTime(stream)}
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
