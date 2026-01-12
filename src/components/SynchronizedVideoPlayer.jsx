import { useState, useRef, useEffect } from 'react'
import { Play, Pause, User } from 'lucide-react'

/**
 * SynchronizedVideoPlayer Component
 * Displays multiple videos stacked vertically, synchronized by timestamps
 * - Global play/pause controls all videos
 * - Click a video to prioritize it (blue border)
 * - Shows game date/time and username overlay
 */
function SynchronizedVideoPlayer({ videos, game }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedVideoId, setSelectedVideoId] = useState(null)
  const videoRefs = useRef({})
  const syncIntervalRef = useRef(null)

  // Format game date and time
  const formatGameDateTime = () => {
    if (!game) return ''
    const date = game.gameDate ? new Date(game.gameDate) : null
    const time = game.gameTime || ''
    
    let dateStr = ''
    if (date) {
      dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
    
    if (time) {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${dateStr} ${displayHour}:${minutes} ${ampm}`
    }
    
    return dateStr
  }

  // Calculate time offset for each video based on recording_start_timestamp
  const getVideoTimeOffset = (video) => {
    if (!video.recording_start_timestamp || !game) return 0
    
    // Get game start time (combine game_date and game_time)
    const gameDateTime = game.gameDate && game.gameTime
      ? new Date(`${game.gameDate}T${game.gameTime}`)
      : null
    
    if (!gameDateTime) return 0
    
    const recordingStart = new Date(video.recording_start_timestamp)
    const offsetMs = recordingStart.getTime() - gameDateTime.getTime()
    return offsetMs / 1000 // Convert to seconds
  }

  // Sync all videos to the same playback time
  const syncVideos = () => {
    if (videos.length === 0) return
    
    // Use the first video (or selected video) as the master
    const masterVideoId = selectedVideoId || videos[0].id
    const masterVideo = videoRefs.current[masterVideoId]
    
    if (!masterVideo || masterVideo.readyState < 2) return
    
    const masterCurrentTime = masterVideo.currentTime
    const masterOffset = getVideoTimeOffset(videos.find(v => v.id === masterVideoId))
    
    // Sync all other videos
    videos.forEach(video => {
      const videoElement = videoRefs.current[video.id]
      if (!videoElement || video.id === masterVideoId) return
      
      const videoOffset = getVideoTimeOffset(video)
      const targetTime = masterCurrentTime + (masterOffset - videoOffset)
      
      // Only update if difference is significant (avoid jitter)
      if (Math.abs(videoElement.currentTime - targetTime) > 0.1) {
        videoElement.currentTime = Math.max(0, targetTime)
      }
    })
  }

  // Handle play/pause
  const togglePlayPause = () => {
    const newPlayingState = !isPlaying
    
    videos.forEach(video => {
      const videoElement = videoRefs.current[video.id]
      if (!videoElement) return
      
      if (newPlayingState) {
        videoElement.play().catch(err => {
          console.warn('Error playing video:', err)
        })
      } else {
        videoElement.pause()
      }
    })
    
    setIsPlaying(newPlayingState)
  }

  // Handle video selection (prioritize)
  const handleVideoClick = (videoId) => {
    setSelectedVideoId(videoId === selectedVideoId ? null : videoId)
  }

  // Sync videos periodically while playing
  useEffect(() => {
    if (isPlaying && videos.length > 1) {
      syncIntervalRef.current = setInterval(syncVideos, 100) // Sync every 100ms
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [isPlaying, videos, selectedVideoId])

  // Handle video events
  useEffect(() => {
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      // If master video ends, pause all
      setIsPlaying(false)
    }

    Object.values(videoRefs.current).forEach(video => {
      if (video) {
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)
        video.addEventListener('ended', handleEnded)
      }
    })

    return () => {
      Object.values(videoRefs.current).forEach(video => {
        if (video) {
          video.removeEventListener('play', handlePlay)
          video.removeEventListener('pause', handlePause)
          video.removeEventListener('ended', handleEnded)
        }
      })
    }
  }, [videos])

  if (!videos || videos.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No videos available for this game</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 min-h-screen p-4">
      {/* Global Play/Pause Overlay */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <button
          onClick={togglePlayPause}
          className="flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors shadow-lg backdrop-blur-sm border border-blue-400"
        >
          {isPlaying ? (
            <>
              <Pause className="w-6 h-6" />
              <span>Pause All</span>
            </>
          ) : (
            <>
              <Play className="w-6 h-6" />
              <span>Play All</span>
            </>
          )}
        </button>
      </div>

      {/* Videos Stack - Vertical Scrolling */}
      <div className="max-w-4xl mx-auto space-y-4 pb-24">
        {videos.map((video, index) => {
          const isSelected = selectedVideoId === video.id
          const userName = video.userName || video.user?.name || 'Unknown User'
          
          return (
            <div
              key={video.id}
              className={`relative bg-black rounded-lg overflow-hidden transition-all ${
                isSelected
                  ? 'ring-4 ring-blue-500 shadow-2xl'
                  : 'ring-2 ring-gray-700'
              }`}
              onClick={() => handleVideoClick(video.id)}
            >
              {/* Video Element */}
              <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={(el) => {
                    if (el) videoRefs.current[video.id] = el
                  }}
                  src={video.video_url?.replace(/\?tusv2=true/, '')}
                  className="w-full h-full object-contain"
                  playsInline
                  preload="metadata"
                  controls
                  crossOrigin="anonymous"
                  style={{ transform: 'scaleX(-1)' }}
                />
                
                {/* Overlay with Game Date/Time and Username */}
                <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
                  <div className="bg-black bg-opacity-70 px-3 py-2 rounded-lg backdrop-blur-sm">
                    <p className="text-white text-xs font-medium">
                      {formatGameDateTime()}
                    </p>
                  </div>
                  <div className="bg-black bg-opacity-70 px-3 py-2 rounded-lg backdrop-blur-sm flex items-center gap-2">
                    <User className="w-3 h-3 text-blue-400" />
                    <p className="text-white text-xs font-medium">
                      {userName}
                    </p>
                  </div>
                </div>

                {/* Click to Prioritize Hint */}
                {!isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-all pointer-events-none">
                    <p className="text-white text-sm font-medium opacity-0 hover:opacity-100 transition-opacity">
                      Click to prioritize this view
                    </p>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 pointer-events-none">
                <p className="text-white text-sm font-medium">
                  View {index + 1} {isSelected && '(Prioritized)'}
                </p>
                {video.description && (
                  <p className="text-gray-400 text-xs mt-1">
                    {video.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SynchronizedVideoPlayer
