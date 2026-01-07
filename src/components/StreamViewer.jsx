import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wifi, WifiOff } from 'lucide-react'

function StreamViewer({ streamId }) {
  const [isLive, setIsLive] = useState(false)
  const [streamInfo, setStreamInfo] = useState(null)
  const [error, setError] = useState(null)
  const [chunks, setChunks] = useState([])
  const videoRef = useRef(null)
  const currentChunkIndex = useRef(0)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    // Load stream metadata
    const loadStreamInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('icepulse_streams')
          .select(`
            *,
            icepulse_games (
              *,
              icepulse_teams (name),
              icepulse_organizations (name)
            )
          `)
          .eq('id', streamId)
          .single()

        if (error) {
          console.error('Stream load error:', error)
          // If stream doesn't exist, still allow viewing (might be starting soon)
          setStreamInfo({ id: streamId, is_active: false })
          setIsLive(false)
          return
        }
        
        setStreamInfo(data)
        setIsLive(data.is_active || false)
      } catch (err) {
        console.error('Error loading stream info:', err)
        // Don't show error, allow page to load and poll for chunks
        setStreamInfo({ id: streamId, is_active: false })
        setIsLive(false)
      }
    }

    if (streamId) {
      loadStreamInfo()
      
      // Poll for stream status updates
      const statusInterval = setInterval(() => {
        loadStreamInfo()
      }, 5000)
      
      return () => {
        clearInterval(statusInterval)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
      }
    }
  }, [streamId])

  useEffect(() => {
    // Poll for new chunks every 3 seconds
    const pollForChunks = async () => {
      if (!streamId) return

      try {
        const { data, error } = await supabase
          .from('icepulse_stream_chunks')
          .select('*')
          .eq('stream_id', streamId)
          .order('chunk_index', { ascending: true })

        if (error) {
          // Table might not exist yet, that's okay
          console.warn('Error polling chunks (might not be set up yet):', error)
          return
        }

        if (data && data.length > 0) {
          setChunks(data)
          // Update live status if we have chunks
          if (data.length > 0 && !isLive) {
            setIsLive(true)
          }
          playChunks(data)
        }
      } catch (err) {
        console.error('Error polling chunks:', err)
      }
    }

    // Poll regardless of isLive status (to detect when stream starts)
    pollIntervalRef.current = setInterval(pollForChunks, 3000)
    pollForChunks() // Initial load

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [streamId, isLive])

  const playChunks = async (chunkList) => {
    if (!videoRef.current || chunkList.length === 0) return

    // Play chunks sequentially
    const playNextChunk = async (index) => {
      if (index >= chunkList.length) {
        // Wait for new chunks
        return
      }

      const chunk = chunkList[index]
      if (chunk.video_url) {
        try {
          // Get public URL from Supabase Storage
          const { data } = supabase.storage
            .from('videos')
            .getPublicUrl(chunk.video_url.replace('videos/', ''))

          if (data?.publicUrl) {
            const video = videoRef.current
            const source = document.createElement('source')
            source.src = data.publicUrl
            source.type = 'video/webm'

            // Clear existing sources
            while (video.firstChild) {
              video.removeChild(video.firstChild)
            }
            video.appendChild(source)
            
            video.load()
            video.play().catch(err => console.warn('Play failed:', err))

            // Wait for chunk duration or move to next
            setTimeout(() => {
              playNextChunk(index + 1)
            }, 10000) // 10 second chunks
          }
        } catch (err) {
          console.error('Error playing chunk:', err)
        }
      }
    }

    // Start from current index
    if (currentChunkIndex.current < chunkList.length) {
      playNextChunk(currentChunkIndex.current)
      currentChunkIndex.current = chunkList.length
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <WifiOff className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <p className="text-xl">{error}</p>
        </div>
      </div>
    )
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white overflow-hidden">
      {/* Contemporary Header with Live Indicator */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/95 via-black/80 to-transparent backdrop-blur-sm p-3 sm:p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold truncate bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              {team?.name || 'Team'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {organization?.name && (
                <span className="text-xs sm:text-sm text-gray-400 truncate">
                  {organization.name}
                </span>
              )}
              {organization?.name && opponent && <span className="text-gray-600">•</span>}
              <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">
                vs {opponent}
              </span>
            </div>
          </div>
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-green-500/20 border border-green-500/50 backdrop-blur-sm flex-shrink-0">
              <div className="relative">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                <div className="absolute inset-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-green-400 font-bold text-xs sm:text-sm tracking-wider">LIVE</span>
            </div>
          )}
          {!isLive && (
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gray-800/50 border border-gray-700/50 backdrop-blur-sm flex-shrink-0">
              <WifiOff className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
              <span className="text-gray-500 font-semibold text-xs sm:text-sm tracking-wider">OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Player - Full Screen */}
      <div className="w-full h-screen bg-black flex items-center justify-center pt-16 sm:pt-20">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted={false}
          controls
          controlsList="nodownload"
        />
        {chunks.length === 0 && !isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 to-black">
            <div className="text-center px-4">
              <div className="relative mb-6">
                <Wifi className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-gray-700 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-gray-700 border-t-gray-500 rounded-full animate-spin"></div>
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-300 mb-2">Waiting for Stream</h2>
              <p className="text-gray-500 text-sm sm:text-base">The broadcast will begin shortly...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StreamViewer
