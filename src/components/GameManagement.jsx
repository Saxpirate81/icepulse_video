import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { Calendar, Plus, Trash2, X, Clock, Users, Trophy, Edit2 } from 'lucide-react'
import Dropdown from './Dropdown'
import LocationSearch from './LocationSearch'

function GameManagement() {
  const { organization, addGame, updateGame, deleteGame } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [gameDate, setGameDate] = useState('')
  const [gameTime, setGameTime] = useState('')
  const [opponent, setOpponent] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const isNew = !editingGame

  // Reset form when opening/closing modal
  const resetForm = () => {
    setSelectedTeamId(null)
    setSelectedSeasonId(null)
    setGameDate('')
    setGameTime('')
    setOpponent('')
    setLocation('')
    setNotes('')
    setEditingGame(null)
  }

  const handleAdd = () => {
    if (selectedTeamId && selectedSeasonId && gameDate && gameTime && opponent.trim()) {
      addGame({
        teamId: selectedTeamId,
        seasonId: selectedSeasonId,
        gameDate,
        gameTime,
        opponent: opponent.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null
      })
      resetForm()
      setShowAddModal(false)
    }
  }

  const handleEdit = (game) => {
    setEditingGame(game)
    setSelectedTeamId(game.teamId)
    setSelectedSeasonId(game.seasonId)
    setGameDate(game.gameDate || '')
    setGameTime(game.gameTime || '')
    setOpponent(game.opponent || '')
    setLocation(game.location || '')
    setNotes(game.notes || '')
    setShowAddModal(true)
  }

  const handleUpdate = () => {
    if (selectedTeamId && selectedSeasonId && gameDate && gameTime && opponent.trim() && editingGame) {
      updateGame(editingGame.id, {
        teamId: selectedTeamId,
        seasonId: selectedSeasonId,
        gameDate,
        gameTime,
        opponent: opponent.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null
      })
      resetForm()
      setShowAddModal(false)
    }
  }

  const handleDelete = (gameId) => {
    if (confirm('Are you sure you want to delete this game?')) {
      deleteGame(gameId)
    }
  }

  const handleCancel = () => {
    resetForm()
    setShowAddModal(false)
  }

  const teamOptions = organization?.teams?.map(team => ({
    value: team.id,
    label: team.name
  })) || []

  const seasonOptions = organization?.seasons?.map(season => ({
    value: season.id,
    label: `${season.name} (${season.type || 'season'})`
  })) || []

  // Group games by date for better display
  const gamesByDate = (organization?.games || []).reduce((acc, game) => {
    const date = game.gameDate || 'No Date'
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(game)
    return acc
  }, {})

  // Sort dates
  const sortedDates = Object.keys(gamesByDate).sort((a, b) => {
    if (a === 'No Date') return 1
    if (b === 'No Date') return -1
    return new Date(a) - new Date(b)
  })

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString || dateString === 'No Date') return 'No Date'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return ''
    try {
      const [hours, minutes] = timeString.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return timeString
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Game Schedule</h2>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowAddModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Game</span>
        </button>
      </div>

      {/* Games List */}
      {organization?.games?.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No games scheduled yet</p>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date} className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3 text-blue-400">
                {formatDate(date)}
              </h3>
              <div className="space-y-3">
                {gamesByDate[date]
                  .sort((a, b) => {
                    // Sort by time within each date
                    if (!a.gameTime) return 1
                    if (!b.gameTime) return -1
                    return a.gameTime.localeCompare(b.gameTime)
                  })
                  .map((game) => {
                    const team = organization.teams?.find(t => t.id === game.teamId)
                    const season = organization.seasons?.find(s => s.id === game.seasonId)
                    return (
                      <div
                        key={game.id}
                        className="bg-gray-600 rounded-lg p-4 hover:bg-gray-500 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-white font-medium">
                                  {formatTime(game.gameTime)}
                                </span>
                              </div>
                              <span className="text-gray-400">•</span>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-300">{team?.name || 'Unknown Team'}</span>
                              </div>
                              <span className="text-gray-400">•</span>
                              <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-300">{season?.name || 'Unknown Season'}</span>
                              </div>
                            </div>
                            <div className="text-lg font-semibold text-white mb-1">
                              vs. {game.opponent}
                            </div>
                            {game.location && (
                              <div className="text-sm text-gray-400 mb-1">
                                📍 {game.location}
                              </div>
                            )}
                            {game.notes && (
                              <div className="text-sm text-gray-400 mt-2">
                                {game.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleEdit(game)}
                              className="p-2 text-blue-400 hover:bg-blue-900 hover:bg-opacity-30 rounded transition-colors"
                              title="Edit game"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(game.id)}
                              className="p-2 text-red-400 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors"
                              title="Delete game"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {isNew ? 'Add Game' : 'Edit Game'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Team *</label>
                <Dropdown
                  options={teamOptions}
                  value={selectedTeamId || ''}
                  onChange={setSelectedTeamId}
                  placeholder="Select team..."
                  multiple={false}
                  showAllOption={false}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Season/Tournament *</label>
                <Dropdown
                  options={seasonOptions}
                  value={selectedSeasonId || ''}
                  onChange={setSelectedSeasonId}
                  placeholder="Select season/tournament..."
                  multiple={false}
                  showAllOption={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-2">Date *</label>
                  <input
                    type="date"
                    value={gameDate}
                    onChange={(e) => setGameDate(e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Time *</label>
                  <input
                    type="time"
                    value={gameTime}
                    onChange={(e) => setGameTime(e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Opponent *</label>
                <input
                  type="text"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter opponent name"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Location</label>
                <LocationSearch
                  value={location}
                  onChange={(value) => setLocation(value)}
                  placeholder="Search for rink or location (optional)"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any additional notes (optional)"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-gray-700">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={isNew ? handleAdd : handleUpdate}
                  disabled={!selectedTeamId || !selectedSeasonId || !gameDate || !gameTime || !opponent.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {isNew ? 'Add Game' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameManagement
