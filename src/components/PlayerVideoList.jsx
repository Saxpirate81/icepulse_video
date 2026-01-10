import { useState, useEffect, useRef } from 'react'
import { useIndividual } from '../context/IndividualContext'
import { useAuth } from '../context/AuthContext'
import { Video, Play, Calendar, Clock, Loader, AlertCircle, RefreshCw } from 'lucide-react'
import SynchronizedVideoPlayer from './SynchronizedVideoPlayer'

function PlayerVideoList() {
  const { getPlayerVideos } = useIndividual()
  const { user } = useAuth()
  const [videos, setVideos] = useState([])
  const [isLoading, setIsLoading] = useState(false) // Start as false - lazy load
  const [hasLoaded, setHasLoaded] = useState(false) // Track if we've tried loading
  const [error, setError] = useState(null)
  const [selectedVideoId, setSelectedVideoId] = useState(null)
  const abortControllerRef = useRef(null)

  const loadVideos = async () => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    console.log('📹 PlayerVideoList: Starting to load videos', { hasGetPlayerVideos: !!getPlayerVideos, userRole: user?.role })
    setIsLoading(true)
    setError(null)
    setHasLoaded(true)

    try {
      if (!getPlayerVideos) {
        throw new Error('Video loading function not available')
      }
      
      // Add a small delay to prevent rapid successive calls
      await new Promise(resolve => setTimeout(resolve, 300))
      
      if (signal.aborted) return
      
      const videoList = await getPlayerVideos()
      
      if (signal.aborted) return
      
      console.log('📹 PlayerVideoList: Received videos', { count: videoList?.length })
      setVideos(videoList || [])
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('📹 PlayerVideoList: Request cancelled')
        return
      }
      console.error('❌ PlayerVideoList: Error loading videos:', err)
      setError('Failed to load videos. The database may be overloaded. Please try again in a moment.')
    } finally {
      if (!signal.aborted) {
        setIsLoading(false)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const selectedVideo = videos.find(v => v.id === selectedVideoId)

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatTime = (seconds) => {
    if (!seconds) return 'Unknown duration'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">My Videos</h1>
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <Loader className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
            <p className="text-gray-400">Loading videos...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">My Videos</h1>
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (selectedVideo) {
    // Transform game object to match SynchronizedVideoPlayer's expected format
    const game = selectedVideo.game ? {
      ...selectedVideo.game,
      gameDate: selectedVideo.game.game_date,
      gameTime: selectedVideo.game.game_time,
    } : null

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <button
            onClick={() => setSelectedVideoId(null)}
            className="mb-4 text-blue-400 hover:text-blue-300 flex items-center gap-2"
          >
            ← Back to Videos
          </button>
          <SynchronizedVideoPlayer
            videos={[selectedVideo]}
            game={game}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">My Videos</h1>
          {!isLoading && (
            <button
              onClick={loadVideos}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{hasLoaded ? 'Reload Videos' : 'Load Videos'}</span>
            </button>
          )}
        </div>

        {!hasLoaded && !isLoading ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 text-lg mb-4">Click "Load Videos" to view your videos</p>
            <button
              onClick={loadVideos}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Load Videos
            </button>
          </div>
        ) : videos.length === 0 && !isLoading ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 text-lg">No videos available</p>
            <p className="text-gray-500 text-sm mt-2">
              Videos from your team games will appear here once they're recorded and processed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video) => {
              const game = video.game
              const team = game?.team
              const season = game?.season
              const thumbnailUrl = video.thumbnail_url

              return (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideoId(video.id)}
                  className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-900">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-12 h-12 text-gray-600" />
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                      <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Duration badge */}
                    {video.duration_seconds && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-xs">
                        {formatTime(video.duration_seconds)}
                      </div>
                    )}
                  </div>

                  {/* Video info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-2 line-clamp-2">
                      {game?.opponent ? `vs ${game.opponent}` : 'Game Video'}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-400">
                      {game?.game_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(game.game_date)}</span>
                        </div>
                      )}
                      {team?.name && (
                        <div className="flex items-center gap-2">
                          <span>{team.name}</span>
                          {season?.name && <span className="text-gray-600">•</span>}
                          {season?.name && <span>{season.name}</span>}
                        </div>
                      )}
                      {video.recording_start_timestamp && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(video.recording_start_timestamp)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerVideoList
