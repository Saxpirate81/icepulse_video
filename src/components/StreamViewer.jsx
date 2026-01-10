import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wifi, WifiOff } from 'lucide-react'

function StreamViewer({ streamId }) {
  const [isLive, setIsLive] = useState(false)
  const [streamInfo, setStreamInfo] = useState(null)
  const [error, setError] = useState(null)
  const [chunks, setChunks] = useState([])
  const [isWaitingForChunks, setIsWaitingForChunks] = useState(false)
  const videoRef = useRef(null)
  const currentChunkIndex = useRef(0)
  const pollIntervalRef = useRef(null)
  const hasStartedPlaying = useRef(false)
  const failedChunks = useRef(new Set()) // Track chunks that have failed
  const chunkRetryCount = useRef(new Map()) // Track retry attempts per chunk
  const nextChunkPreloadRef = useRef(null) // Preload next chunk for seamless transition
  const waitingCheckIntervalRef = useRef(null) // Interval to check for new chunks when waiting
  const chunksRef = useRef([]) // Ref to track latest chunks for closures
  const nextVideoElementRef = useRef(null) // Preloaded next video element for seamless switching
  const isTransitioningRef = useRef(false) // Prevent overlapping transitions
  const BUFFER_CHUNKS = 2 // Wait for 2 chunks before starting (14+ second buffer)
  const MAX_RETRIES_PER_CHUNK = 2 // Max retries before giving up on a chunk

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
    // Poll for new chunks more frequently for smoother updates
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
          
          // Check if we have new chunks (by comparing chunk_index)
          const hasNewChunks = data.length > chunks.length || 
            (chunks.length > 0 && data[data.length - 1]?.chunk_index > chunks[chunks.length - 1]?.chunk_index)
          
          // Update chunks if we have new ones
          if (hasNewChunks) {
            setChunks(data)
            chunksRef.current = data // Update ref for closures
          }
          
          // Only start playing if we have enough chunks buffered OR already started
          const enoughChunks = data.length >= BUFFER_CHUNKS || hasStartedPlaying.current
          
          if (enoughChunks && !hasStartedPlaying.current) {
            console.log(`📦 Buffer ready: ${data.length} chunks available, starting playback...`)
            hasStartedPlaying.current = true
            chunksRef.current = data // Set ref before starting playback
            playChunks(data)
          } else if (hasStartedPlaying.current && hasNewChunks) {
            // New chunks arrived - update the chunks list
            // playNextChunk will automatically pick up new chunks from ref
            console.log(`📥 New chunks detected (${data.length} total), continuing playback...`)
            setChunks(data) // Update state
            chunksRef.current = data // Update ref for closures
          } else if (!hasStartedPlaying.current) {
            console.log(`⏳ Buffering: ${data.length}/${BUFFER_CHUNKS} chunks (need ${BUFFER_CHUNKS} to start)`)
          }
        }
      } catch (err) {
        console.error('Error polling chunks:', err)
      }
    }

    // Poll more frequently for smoother streaming (every 1 second)
    pollIntervalRef.current = setInterval(pollForChunks, 1000)
    pollForChunks() // Initial load

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (waitingCheckIntervalRef.current) {
        clearInterval(waitingCheckIntervalRef.current)
      }
    }
  }, [streamId, isLive, chunks.length])

  const playChunks = async (chunkList) => {
    if (!videoRef.current || chunkList.length === 0) return

    const video = videoRef.current

    // Preload next chunk for seamless transition
    const preloadNextChunk = async (index, currentChunks) => {
      if (index >= currentChunks.length) return null

      const nextChunk = currentChunks[index]
      if (!nextChunk?.video_url) return null

      try {
        let filePath = nextChunk.video_url
        if (filePath.startsWith('videos/')) {
          filePath = filePath.replace(/^videos\//, '')
        }
        
        const { data } = supabase.storage
          .from('videos')
          .getPublicUrl(filePath)

        if (data?.publicUrl) {
          // Clean up previous preload video element
          if (nextVideoElementRef.current) {
            nextVideoElementRef.current.src = ''
            nextVideoElementRef.current.load()
            nextVideoElementRef.current = null
          }
          
          // Create and preload the next video element for seamless switching
          const preloadVideo = document.createElement('video')
          preloadVideo.preload = 'auto'
          preloadVideo.muted = true
          preloadVideo.playsInline = true
          preloadVideo.crossOrigin = 'anonymous'
          
          // Set up preload video to buffer fully
          preloadVideo.addEventListener('canplaythrough', () => {
            console.log(`✅ Next chunk ${index + 1} preloaded and ready`)
          }, { once: true })
          
          preloadVideo.src = data.publicUrl
          preloadVideo.load()
          
          // Start loading immediately (don't wait for user interaction)
          try {
            await preloadVideo.play().catch(() => {
              // Play might fail (autoplay restrictions), but that's okay
              // The important part is that we've loaded the video
            })
            preloadVideo.pause()
            preloadVideo.currentTime = 0
          } catch (err) {
            // Silent fail - preloading is best effort
          }
          
          nextVideoElementRef.current = preloadVideo
          nextChunkPreloadRef.current = data.publicUrl
          return data.publicUrl
        }
      } catch (err) {
        console.warn('Error preloading chunk:', err)
      }
      return null
    }

    // Play chunks sequentially starting from current index
    // Use a function that checks current chunks state, not just the initial list
    const playNextChunk = async (index) => {
      // Get current chunks from ref (always up-to-date)
      const currentChunks = chunksRef.current.length > 0 ? chunksRef.current : chunkList
      
      if (index >= currentChunks.length) {
        // Reached the end of available chunks - show waiting message
        console.log(`⏸️ Reached end (chunk ${index + 1}), waiting for more... (have ${currentChunks.length} chunks)`)
        setIsWaitingForChunks(true)
        
        // Clear any existing waiting check interval
        if (waitingCheckIntervalRef.current) {
          clearInterval(waitingCheckIntervalRef.current)
        }
        
        // Check for new chunks every 500ms
        waitingCheckIntervalRef.current = setInterval(() => {
          const latestChunks = chunksRef.current.length > 0 ? chunksRef.current : chunkList
          if (latestChunks.length > index) {
            clearInterval(waitingCheckIntervalRef.current)
            waitingCheckIntervalRef.current = null
            setIsWaitingForChunks(false)
            console.log(`📥 New chunks arrived! Continuing from chunk ${index + 1}`)
            playNextChunk(index)
          }
        }, 500)
        
        // Stop checking after 5 minutes (stream likely ended)
        setTimeout(() => {
          if (waitingCheckIntervalRef.current) {
            clearInterval(waitingCheckIntervalRef.current)
            waitingCheckIntervalRef.current = null
          }
        }, 300000)
        
        return
      }
      
      // If we were waiting and now have chunks, hide waiting message
      if (isWaitingForChunks) {
        setIsWaitingForChunks(false)
        if (waitingCheckIntervalRef.current) {
          clearInterval(waitingCheckIntervalRef.current)
          waitingCheckIntervalRef.current = null
        }
      }

      const chunk = currentChunks[index]
      if (!chunk.video_url) {
        // Skip invalid chunks - immediate transition, no delay
        playNextChunk(index + 1)
        return
      }

      // Skip chunks that have failed too many times
      const chunkKey = `${chunk.id || chunk.chunk_index || index}`
      const retryCount = chunkRetryCount.current.get(chunkKey) || 0
      if (retryCount >= MAX_RETRIES_PER_CHUNK) {
        console.warn(`⏭️ Skipping chunk ${index + 1} - failed ${retryCount} times`)
        failedChunks.current.add(chunkKey)
        // Immediate transition - no delay
        playNextChunk(index + 1)
        return
      }

      try {
        // Get public URL from Supabase Storage
        // Handle both cases: path with or without 'videos/' prefix
        let filePath = chunk.video_url
        if (filePath.startsWith('videos/')) {
          filePath = filePath.replace(/^videos\//, '')
        }
        
        const { data } = supabase.storage
          .from('videos')
          .getPublicUrl(filePath)

        if (!data?.publicUrl) {
          console.error(`❌ No public URL for chunk ${index + 1}:`, chunk.video_url)
          // Retry after short delay
          setTimeout(() => playNextChunk(index + 1), 500)
          return
        }

        // Note: We'll verify chunk accessibility during video load below
        // If it fails, the error handler will retry

        console.log(`▶️ Playing chunk ${index + 1}/${currentChunks.length}`)
        
        // Preload next chunk EARLY for seamless transition (at 50% progress)
        // This gives us more time to buffer the next chunk
        let nextChunkPreloaded = false
        const preloadNextChunkEarly = () => {
          if (!nextChunkPreloaded && index + 1 < currentChunks.length) {
            nextChunkPreloaded = true
            preloadNextChunk(index + 1, currentChunks)
          }
        }
        
        // Clear any previous error handlers
        video.onerror = null
        
        // Set up error handler BEFORE setting src
        let hasErrored = false
        const errorHandler = (err) => {
          if (hasErrored) return
          hasErrored = true
          
          // Increment retry count for this chunk
          const retryCount = (chunkRetryCount.current.get(chunkKey) || 0) + 1
          chunkRetryCount.current.set(chunkKey, retryCount)
          
          const videoError = video.error
          const errorCode = videoError?.code || 'unknown'
          const errorMessage = videoError?.message || 'Unknown error'
          
          // MediaError codes: 1=MEDIA_ERR_ABORTED, 2=MEDIA_ERR_NETWORK, 3=MEDIA_ERR_DECODE, 4=MEDIA_ERR_SRC_NOT_SUPPORTED
          const errorCodeNames = {
            1: 'MEDIA_ERR_ABORTED',
            2: 'MEDIA_ERR_NETWORK', 
            3: 'MEDIA_ERR_DECODE',
            4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
          }
          
          console.error(`❌ Video error for chunk ${index + 1} (attempt ${retryCount}/${MAX_RETRIES_PER_CHUNK}):`, {
            error: err,
            url: data.publicUrl,
            path: chunk.video_url,
            errorCode: `${errorCode} (${errorCodeNames[errorCode] || 'unknown'})`,
            errorMessage,
            readyState: video.readyState,
            networkState: video.networkState
          })
          
          video.removeEventListener('error', errorHandler)
          
          // If we've retried too many times, skip to next chunk
          if (retryCount >= MAX_RETRIES_PER_CHUNK) {
            console.warn(`⏭️ Giving up on chunk ${index + 1} after ${retryCount} failures`)
            failedChunks.current.add(chunkKey)
            // Immediate transition - no delay
            playNextChunk(index + 1)
          } else {
            // Retry this chunk after a short delay (wait for upload to complete)
            console.log(`🔄 Retrying chunk ${index + 1} in 1.5 seconds...`)
            setTimeout(() => {
              playNextChunk(index)
            }, 1500)
          }
        }
        
        video.addEventListener('error', errorHandler, { once: true })
        
        // Set video source
        video.src = data.publicUrl
        
        // Wait for video to be ready to play through (fully buffered)
        const canPlay = new Promise((resolve, reject) => {
          const cleanup = () => {
            video.removeEventListener('canplaythrough', onCanPlayThrough)
            video.removeEventListener('canplay', onCanPlay)
            video.removeEventListener('loadeddata', onLoadedData)
            video.removeEventListener('error', onError)
          }
          
          // Prefer canplaythrough for better buffering
          const onCanPlayThrough = () => {
            cleanup()
            resolve()
          }
          
          const onCanPlay = () => {
            // If canplaythrough doesn't fire, canplay is acceptable
            if (!video.readyState || video.readyState < 3) {
              // Wait a bit more for buffering
              setTimeout(() => {
                if (video.readyState >= 3) {
                  cleanup()
                  resolve()
                }
              }, 500)
            } else {
              cleanup()
              resolve()
            }
          }
          
          const onLoadedData = () => {
            // Fallback if canplay doesn't fire
            setTimeout(() => {
              cleanup()
              resolve()
            }, 100)
          }
          
          const onError = (err) => {
            cleanup()
            reject(err)
          }
          
          video.addEventListener('canplaythrough', onCanPlayThrough, { once: true })
          video.addEventListener('canplay', onCanPlay, { once: true })
          video.addEventListener('loadeddata', onLoadedData, { once: true })
          video.addEventListener('error', onError, { once: true })
          video.load()
          
          // Optimized timeout - reduced for faster transitions
          setTimeout(() => {
            cleanup()
            // If video loaded but events didn't fire, proceed anyway
            if (video.readyState >= 2) {
              resolve()
            } else {
              reject(new Error('Video load timeout'))
            }
          }, 5000) // 5 seconds - balanced for chunk uploads
        })
        
        try {
          await canPlay
        } catch (loadErr) {
          // Increment retry count
          const retryCount = (chunkRetryCount.current.get(chunkKey) || 0) + 1
          chunkRetryCount.current.set(chunkKey, retryCount)
          
          console.error(`❌ Failed to load chunk ${index + 1} (attempt ${retryCount}/${MAX_RETRIES_PER_CHUNK}):`, loadErr)
          video.removeEventListener('error', errorHandler)
          
          // If we've retried too many times, skip to next chunk
          if (retryCount >= MAX_RETRIES_PER_CHUNK) {
            console.warn(`⏭️ Giving up on chunk ${index + 1} after ${retryCount} load failures`)
            failedChunks.current.add(chunkKey)
            // Immediate transition - no delay
            playNextChunk(index + 1)
          } else {
            // Retry after waiting (chunk might still be uploading)
            console.log(`🔄 Retrying chunk ${index + 1} load in 1.5 seconds...`)
            setTimeout(() => {
              playNextChunk(index)
            }, 1500)
          }
          return
        }
        
        // Remove error handler if we got here (video loaded successfully)
        video.removeEventListener('error', errorHandler)
        
        // Preload next chunk immediately after current one is ready
        if (index + 1 < currentChunks.length) {
          preloadNextChunkEarly()
        }
        
        // Play immediately when ready
        try {
          await video.play()
          console.log(`✅ Chunk ${index + 1} playing`)
          currentChunkIndex.current = index + 1
          setIsWaitingForChunks(false) // Hide waiting message when playing
        } catch (playErr) {
          console.warn(`⚠️ Play failed for chunk ${index + 1}:`, playErr)
          // Try next chunk immediately if current one fails
          playNextChunk(index + 1)
          return
        }

        // Monitor when chunk is about to end for seamless transition
        // Start preloading earlier (at 50% instead of 90%) for smoother transitions
        const onTimeUpdate = () => {
          if (video.duration && video.currentTime > 0) {
            const progress = video.currentTime / video.duration
            
            // Preload at 50% for better buffering
            if (progress > 0.5 && !nextChunkPreloaded && index + 1 < currentChunks.length) {
              preloadNextChunkEarly()
            }
            
            // At 95%, ensure next chunk is fully ready
            if (progress > 0.95 && index + 1 < currentChunks.length) {
              // Next chunk should already be preloaded, but double-check
              if (nextVideoElementRef.current) {
                const nextVideo = nextVideoElementRef.current
                if (nextVideo.readyState >= 3) {
                  // Next video is ready - prepare for seamless switch
                  nextVideo.currentTime = 0
                }
              }
            }
          }
        }
        
        video.addEventListener('timeupdate', onTimeUpdate)

        // When this chunk ends, IMMEDIATELY switch to next (ZERO delay)
        const onEnded = () => {
          if (isTransitioningRef.current) return // Prevent overlapping transitions
          isTransitioningRef.current = true
          
          clearTimeout(fallbackTimeout)
          video.removeEventListener('ended', onEnded)
          video.removeEventListener('timeupdate', onTimeUpdate)
          
          // Instant transition - no delay for seamless playback
          console.log(`⏭️ Chunk ${index + 1} ended, seamlessly moving to next`)
          
          // Use preloaded video element if available for instant switch
          if (nextVideoElementRef.current && nextVideoElementRef.current.readyState >= 3) {
            const nextVideo = nextVideoElementRef.current
            // This could be used for even more seamless transitions
            // but the current approach works well too
          }
          
          // Immediately play next chunk
          setTimeout(() => {
            isTransitioningRef.current = false
            playNextChunk(index + 1)
          }, 0) // Zero delay - execute on next tick
        }

        video.addEventListener('ended', onEnded, { once: true })

        // Fallback: if video doesn't end naturally, move on
        // Use actual video duration if available, with minimal buffer
        const estimatedDuration = video.duration && video.duration > 0 
          ? (video.duration * 1000) + 100 // Add only 100ms buffer for faster transitions
          : 10100 // Default 10.1 seconds for 10-second segments
          
        const fallbackTimeout = setTimeout(() => {
          if (!isTransitioningRef.current) {
            video.removeEventListener('ended', onEnded)
            video.removeEventListener('timeupdate', onTimeUpdate)
            console.log(`⏱️ Chunk ${index + 1} timeout (${Math.round(estimatedDuration/1000)}s), moving to next`)
            playNextChunk(index + 1)
          }
        }, estimatedDuration)

        // Clear timeout if video ends naturally
        video.addEventListener('ended', () => {
          clearTimeout(fallbackTimeout)
          isTransitioningRef.current = false
        }, { once: true })
      } catch (err) {
        console.error(`❌ Error playing chunk ${index + 1}:`, err)
        // Try next chunk immediately on error - no delay
        playNextChunk(index + 1)
      }
    }

    // Start playing from current index (or 0 if just starting)
    const startIndex = currentChunkIndex.current
    if (startIndex < chunkList.length) {
      console.log(`🎬 Starting playback from chunk ${startIndex + 1} of ${chunkList.length}`)
      playNextChunk(startIndex)
    } else {
      // Start from beginning if we haven't started yet
      console.log(`🎬 Starting playback from beginning (chunk 1 of ${chunkList.length})`)
      currentChunkIndex.current = 0
      playNextChunk(0)
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
      <div className="w-full h-screen bg-black flex items-center justify-center pt-16 sm:pt-20 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted={true}
          controls
          controlsList="nodownload"
          preload="auto"
          crossOrigin="anonymous"
          disablePictureInPicture
          disableRemotePlayback
        />
        
        {/* "Stream will continue shortly..." overlay */}
        {isWaitingForChunks && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center px-4">
              <div className="relative mb-6">
                <Wifi className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-gray-600 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 border-2 border-gray-700 border-t-gray-500 rounded-full animate-spin"></div>
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Stream will continue shortly...
              </h2>
              <p className="text-gray-400 text-sm sm:text-base">
                Waiting for next segment
              </p>
            </div>
          </div>
        )}
        {(!hasStartedPlaying.current || chunks.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-950 to-black">
            <div className="text-center px-4">
              <div className="relative mb-6">
                <Wifi className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-gray-700 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-gray-700 border-t-gray-500 rounded-full animate-spin"></div>
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 via-green-300 to-green-400 bg-clip-text text-transparent mb-2">
                {chunks.length === 0 
                  ? 'Going Live Soon...' 
                  : `Buffering... (${chunks.length}/${BUFFER_CHUNKS})`}
              </h2>
              <p className="text-gray-400 text-sm sm:text-base">
                {chunks.length === 0 
                  ? 'The broadcast will begin in just a moment'
                  : `Getting ready for smooth playback (${Math.max(0, BUFFER_CHUNKS - chunks.length)} more needed)`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StreamViewer
