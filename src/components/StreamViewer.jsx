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
          // Update live status if we have chunks
          if (data.length > 0 && !isLive) {
            setIsLive(true)
            console.log('🔴 Stream is now LIVE!')
          }
          
          // Only update chunks and play if we have new chunks
          const hasNewChunks = data.length > chunks.length || 
            chunks.length === 0 || 
            data.some((chunk, idx) => chunk.id !== chunks[idx]?.id)
          
          if (hasNewChunks) {
            setChunks(data)
            playChunks(data)
          }
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

    const video = videoRef.current

    // Play chunks sequentially starting from current index
    const playNextChunk = async (index) => {
      if (index >= chunkList.length) {
        // Reached the end of available chunks - wait for more
        console.log('⏸️ Reached end of available chunks, waiting for more...')
        return
      }

      const chunk = chunkList[index]
      if (!chunk.video_url) {
        // Skip invalid chunks
        playNextChunk(index + 1)
        return
      }

      try {
        // Get public URL from Supabase Storage
        const { data } = supabase.storage
          .from('videos')
          .getPublicUrl(chunk.video_url.replace(/^videos\//, ''))

        if (data?.publicUrl) {
          console.log(`▶️ Playing chunk ${index + 1}/${chunkList.length}`)
          
          // Set video source
          video.src = data.publicUrl
          video.load()
          
          // Wait for video to be ready, then play
          const playPromise = video.play()
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log(`✅ Chunk ${index + 1} playing`)
                currentChunkIndex.current = index + 1
              })
              .catch(err => {
                console.warn('Play failed:', err)
                // Try next chunk if current one fails
                setTimeout(() => playNextChunk(index + 1), 500)
              })
          }

          // When this chunk ends, move to the next one
          const onEnded = () => {
            video.removeEventListener('ended', onEnded)
            console.log(`⏭️ Chunk ${index + 1} ended, moving to next`)
            // Small delay before next chunk for smoother transition
            setTimeout(() => {
              playNextChunk(index + 1)
            }, 200)
          }

          video.addEventListener('ended', onEnded, { once: true })

          // Fallback: if video doesn't end naturally after reasonable time, move on
          const fallbackTimeout = setTimeout(() => {
            video.removeEventListener('ended', onEnded)
            if (index + 1 < chunkList.length) {
              console.log(`⏱️ Chunk ${index + 1} timeout, moving to next`)
              playNextChunk(index + 1)
            }
          }, 15000) // 15 second max per chunk

          // Clear timeout if video ends naturally
          video.addEventListener('ended', () => clearTimeout(fallbackTimeout), { once: true })
        }
      } catch (err) {
        console.error('Error playing chunk:', err)
        // Try next chunk on error
        setTimeout(() => playNextChunk(index + 1), 500)
      }
    }

    // Only start playing if we have new chunks to play
    if (currentChunkIndex.current < chunkList.length) {
      const startIndex = currentChunkIndex.current
      console.log(`🎬 Starting playback from chunk ${startIndex + 1}`)
      playNextChunk(startIndex)
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
          preload="auto"
          crossOrigin="anonymous"
        />
        {chunks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 to-black">
            <div className="text-center px-4">
              <div className="relative mb-6">
                <Wifi className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-gray-700 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-gray-700 border-t-gray-500 rounded-full animate-spin"></div>
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 via-green-300 to-green-400 bg-clip-text text-transparent mb-2">
                Going Live Soon...
              </h2>
              <p className="text-gray-400 text-sm sm:text-base">The broadcast will begin in just a moment</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StreamViewer
