import { useState, useEffect } from 'react'
import { useOrg } from '../context/OrgContext'
import { useAuth } from '../context/AuthContext'
import { USE_MOCK } from '../lib/supabase-mock'
import { canEditOrganization } from '../utils/permissions'
import { Calendar, Video, Loader, Play, Trash2 } from 'lucide-react'
import Dropdown from './Dropdown'
import SynchronizedVideoPlayer from './SynchronizedVideoPlayer'

/**
 * GameVideoViewer Component
 * Allows selecting a game and viewing all synchronized video recordings
 */
function GameVideoViewer() {
  const { organization, getGameVideos, deleteVideoRecording } = useOrg()
  const { user } = useAuth()
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [videos, setVideos] = useState([])
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [error, setError] = useState(null)
  const [selectedVideoId, setSelectedVideoId] = useState(null)
  const [deletingVideoId, setDeletingVideoId] = useState(null)

  // Get selected game
  const selectedGame = organization?.games?.find(g => g.id === selectedGameId)

  // Load videos for selected game
  useEffect(() => {
    if (!selectedGameId) {
      setVideos([])
      setSelectedVideoId(null)
      return
    }

    const loadVideos = async () => {
      setIsLoadingVideos(true)
      setError(null)

      try {
        if (USE_MOCK) {
          // Mock mode: return empty or mock videos
          await new Promise(resolve => setTimeout(resolve, 500))
          setVideos([])
          setIsLoadingVideos(false)
          return
        }

        // Use getGameVideos from OrgContext (handles database query)
        console.log('🎥 Loading videos for game:', selectedGameId)
        const gameVideos = await getGameVideos(selectedGameId)
        console.log('🎥 Videos loaded:', {
          count: gameVideos?.length || 0,
          videos: gameVideos,
          gameId: selectedGameId
        })
        setVideos(gameVideos || [])
      } catch (err) {
        console.error('Error loading videos:', err)
        if (err?.code === 'PGRST205' || String(err?.message || '').includes('icepulse_video_recordings')) {
          setError('Video table is not set up yet. Run `supabase/add_video_recordings_table.sql` (or `supabase/complete_setup_all_tables.sql`) in Supabase SQL Editor, then refresh.')
        } else if (err?.message?.includes('timeout') || err?.message?.includes('Query timeout') || err?.code === '57014') {
          setError('Query timeout: The database query is taking too long. This is likely due to missing indexes. Please run `supabase/fix_video_recordings_performance.sql` in your Supabase SQL Editor to add performance indexes, then refresh this page.')
        } else {
          setError(`Failed to load videos: ${err?.message || 'Unknown error'}`)
        }
        setVideos([])
      } finally {
        setIsLoadingVideos(false)
      }
    }

    loadVideos()
  }, [selectedGameId, getGameVideos])
  const getEventLabel = (video) => {
    const desc = (video?.description || '').toLowerCase()
    if (desc.startsWith('practice')) return 'Practice'
    if (desc.startsWith('skills')) return 'Skills'
    if (video?.recording_type === 'full_game') return 'Game'
    return 'Event'
  }

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return ''
    const s = Math.max(0, Math.floor(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }

  const handleDeleteVideo = async (videoId, e) => {
    e.stopPropagation() // Prevent video selection when clicking delete
    
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return
    }

    setDeletingVideoId(videoId)
    try {
      const result = await deleteVideoRecording(videoId)
      if (result.success) {
        // Remove video from local state
        setVideos(videos.filter(v => v.id !== videoId))
        // If deleted video was selected, clear selection
        if (selectedVideoId === videoId) {
          setSelectedVideoId(null)
        }
      } else {
        alert(result.message || 'Failed to delete video')
      }
    } catch (err) {
      console.error('Error deleting video:', err)
      alert('An error occurred while deleting the video')
    } finally {
      setDeletingVideoId(null)
    }
  }

  // Check if user can delete videos (organization, coach, or video owner)
  const canDeleteVideo = (video) => {
    if (!user) return false
    // Organization and coaches can delete any video
    if (canEditOrganization(user)) return true
    // Users can delete their own videos
    if (video.user?.id === user.id) return true
    return false
  }

  // Format game for display
  const formatGameLabel = (game) => {
    if (!game) return ''
    const date = game.gameDate ? new Date(game.gameDate) : null
    const dateStr = date
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'No Date'
    const time = game.gameTime
      ? (() => {
          const [hours, minutes] = game.gameTime.split(':')
          const hour = parseInt(hours)
          const ampm = hour >= 12 ? 'PM' : 'AM'
          const displayHour = hour % 12 || 12
          return `${displayHour}:${minutes} ${ampm}`
        })()
      : ''
    const team = organization?.teams?.find(t => t.id === game.teamId)
    return `${dateStr} ${time} - ${team?.name || 'Unknown'} vs ${game.opponent}`
  }

  const gameOptions = (organization?.games || [])
    .sort((a, b) => {
      // Sort by date, then time
      const dateA = a.gameDate || ''
      const dateB = b.gameDate || ''
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return (a.gameTime || '').localeCompare(b.gameTime || '')
    })
    .map(game => ({
      value: game.id,
      label: formatGameLabel(game)
    }))

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Video className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold">Event Videos</h2>
      </div>

      {/* Game Selection */}
      <div className="mb-6">
        <label className="block text-gray-300 mb-2">Select Game</label>
        <Dropdown
          options={gameOptions}
          value={selectedGameId || ''}
          onChange={setSelectedGameId}
          placeholder="Choose a game to view videos..."
          multiple={false}
          showAllOption={false}
          icon={<Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        />
      </div>

      {/* Video List / Player */}
      {selectedGameId && (
        <div className="mt-6">
          {isLoadingVideos ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading videos...</span>
            </div>
          ) : error ? (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 text-center">
              <p className="text-red-400 font-semibold mb-2">Error Loading Videos</p>
              <p className="text-red-300 text-sm">{error}</p>
              {error.includes('timeout') && (
                <div className="mt-4 text-left text-sm text-red-200 bg-red-950 bg-opacity-50 p-3 rounded">
                  <p className="font-semibold mb-2">Database appears to be locked or overloaded:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Wait 5-10 minutes for Supabase to recover</li>
                    <li>Check Supabase Dashboard for active queries</li>
                    <li>Try refreshing this page in a few minutes</li>
                    <li>If the issue persists, contact Supabase support</li>
                  </ul>
                </div>
              )}
            </div>
          ) : videos.length === 0 ? (
            <div className="bg-gray-700 rounded-lg p-8 text-center">
              <Video className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">No completed videos found for this event</p>
              <p className="text-gray-500 text-sm mt-2">
                This could mean:
              </p>
              <ul className="text-gray-500 text-sm mt-2 text-left max-w-md mx-auto space-y-1">
                <li>• No videos have been recorded for this game yet</li>
                <li>• Videos are still uploading or processing</li>
                <li>• Videos failed to upload</li>
              </ul>
              <p className="text-gray-500 text-sm mt-4">
                Check the Recorder tab to record videos, or run the diagnostic query in Supabase to check video statuses.
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Game ID: {selectedGameId}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Thumbnails */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((v) => {
                  const isActive = selectedVideoId ? selectedVideoId === v.id : false
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVideoId(v.id)}
                      className={`text-left rounded-lg border transition-colors overflow-hidden relative group ${
                        isActive ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'
                      } bg-gray-900`}
                    >
                      <div className="relative aspect-video bg-black">
                        {v.thumbnail_url ? (
                          <img
                            src={v.thumbnail_url}
                            alt="Video thumbnail"
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            <Video className="w-10 h-10" />
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded bg-black bg-opacity-60 text-white">
                            {getEventLabel(v)}
                          </span>
                          {v.duration_seconds ? (
                            <span className="text-xs px-2 py-1 rounded bg-black bg-opacity-60 text-white">
                              {formatDuration(v.duration_seconds)}
                            </span>
                          ) : null}
                        </div>
                        <div className="absolute bottom-2 right-2 flex items-center gap-2">
                          {canDeleteVideo(v) && (
                            <button
                              onClick={(e) => handleDeleteVideo(v.id, e)}
                              disabled={deletingVideoId === v.id}
                              className="text-white bg-red-600 hover:bg-red-700 bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete video"
                            >
                              {deletingVideoId === v.id ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <div className="text-white bg-black bg-opacity-60 rounded-full p-2">
                            <Play className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="text-sm font-semibold text-white truncate">
                          {v.userName || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {(v.description || 'Full recording')}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Player */}
              <SynchronizedVideoPlayer
                videos={selectedVideoId ? videos.filter(v => v.id === selectedVideoId) : videos}
                game={selectedGame}
              />
            </div>
          )}
        </div>
      )}

      {!selectedGameId && (
        <div className="bg-gray-700 rounded-lg p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">Select an event to view videos</p>
        </div>
      )}
    </div>
  )
}

export default GameVideoViewer
