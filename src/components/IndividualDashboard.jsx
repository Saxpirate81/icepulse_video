import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Video, BarChart3, Film } from 'lucide-react'
import VideoRecorder from './VideoRecorder'
import PlayerVideoList from './PlayerVideoList'

function IndividualDashboard() {
  const { user } = useAuth()
  const isPlayer = user?.role === 'player'
  const isParent = user?.role === 'parent'
  const isGameRecorder = user?.role === 'game_recorder'
  
  // Default view based on role
  const defaultView = isGameRecorder ? 'recorder' : 'stats'
  const [activeView, setActiveView] = useState(defaultView)

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4">
            {!isGameRecorder && (
              <button
                onClick={() => setActiveView('stats')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeView === 'stats'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span>{isPlayer || isParent ? 'My Stats' : 'Stats'}</span>
              </button>
            )}
            {(isPlayer || isParent) && (
              <button
                onClick={() => setActiveView('videos')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeView === 'videos'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Film className="w-5 h-5" />
                <span>Videos</span>
              </button>
            )}
            <button
              onClick={() => setActiveView('recorder')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeView === 'recorder'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Video className="w-5 h-5" />
              <span>{isGameRecorder ? 'Record Game' : 'Recorder'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeView === 'stats' && (
          <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold mb-4">
                {isPlayer ? 'My Stats' : isParent ? 'Player Stats' : 'Stats'}
              </h1>
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">Stats and team information coming soon</p>
                <p className="text-gray-500 text-sm mt-2">
                  This page will display your performance metrics, team statistics, and more
                </p>
              </div>
            </div>
          </div>
        )}
        {activeView === 'videos' && <PlayerVideoList />}
        {activeView === 'recorder' && <VideoRecorder />}
      </div>
    </div>
  )
}

export default IndividualDashboard
