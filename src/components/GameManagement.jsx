import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { Calendar, Plus, Trash2, X, Clock, Users, Trophy, Edit2, Sparkles, Dumbbell } from 'lucide-react'
import Dropdown from './Dropdown'
import LocationSearch from './LocationSearch'

function GameManagement() {
  const { organization, addGame, updateGame, deleteGame } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  const [eventType, setEventType] = useState('game') // 'game' | 'practice' | 'skills'
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [gameDate, setGameDate] = useState('')
  const [gameTime, setGameTime] = useState('')
  const [opponent, setOpponent] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  
  // Filter states
  const [timeFilter, setTimeFilter] = useState('upcoming') // 'upcoming' | 'past'
  const [filterTeamId, setFilterTeamId] = useState(null)
  const [filterSeasonId, setFilterSeasonId] = useState(null)

  const isNew = !editingGame

  // Reset form when opening/closing modal
  const resetForm = () => {
    setEventType('game')
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
    // For games, opponent is required. For practice/skills, it's optional
    const requiresOpponent = eventType === 'game'
    if (selectedTeamId && selectedSeasonId && gameDate && gameTime && (!requiresOpponent || opponent.trim())) {
      addGame({
        teamId: selectedTeamId,
        seasonId: selectedSeasonId,
        gameDate,
        gameTime,
        opponent: opponent.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        eventType: eventType
      })
      resetForm()
      setShowAddModal(false)
    }
  }

  const handleEdit = (game) => {
    setEditingGame(game)
    setEventType(game.eventType || 'game')
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
    const requiresOpponent = eventType === 'game'
    if (selectedTeamId && selectedSeasonId && gameDate && gameTime && (!requiresOpponent || opponent.trim()) && editingGame) {
      updateGame(editingGame.id, {
        teamId: selectedTeamId,
        seasonId: selectedSeasonId,
        gameDate,
        gameTime,
        opponent: opponent.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        eventType: eventType
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

  // Get all games and filter them
  const allGames = organization?.games || []
  
  // Get unique teams and seasons from saved events
  const teamsWithEvents = [...new Set(allGames.map(g => g.teamId).filter(Boolean))]
  const seasonsWithEvents = [...new Set(allGames.map(g => g.seasonId).filter(Boolean))]
  
  // Filter teams/seasons based on selected filter
  let availableTeams = teamsWithEvents
  let availableSeasons = seasonsWithEvents
  
  // If a team is selected, only show seasons that have events with that team
  if (filterTeamId) {
    availableSeasons = [...new Set(
      allGames
        .filter(g => g.teamId === filterTeamId)
        .map(g => g.seasonId)
        .filter(Boolean)
    )]
  }
  
  // If a season is selected, only show teams that have events in that season
  if (filterSeasonId) {
    availableTeams = [...new Set(
      allGames
        .filter(g => g.seasonId === filterSeasonId)
        .map(g => g.teamId)
        .filter(Boolean)
    )]
  }
  
  // Build filter dropdown options
  const filterTeamOptions = availableTeams
    .map(teamId => organization?.teams?.find(t => t.id === teamId))
    .filter(Boolean)
    .map(team => ({
      value: team.id,
      label: team.name
    }))
  
  const filterSeasonOptions = availableSeasons
    .map(seasonId => organization?.seasons?.find(s => s.id === seasonId))
    .filter(Boolean)
    .map(season => ({
      value: season.id,
      label: `${season.name} (${season.type || 'season'})`
    }))

  // Filter games by time (upcoming/past), team, and season
  // Get today's date in local timezone (Eastern time for New Hampshire)
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()
  
  const filteredGames = allGames.filter(game => {
    // Time filter
    if (game.gameDate) {
      // Parse the game date string (format: YYYY-MM-DD)
      const gameDateParts = game.gameDate.split('-')
      if (gameDateParts.length === 3) {
        const gameYear = parseInt(gameDateParts[0], 10)
        const gameMonth = parseInt(gameDateParts[1], 10) - 1 // Month is 0-indexed
        const gameDay = parseInt(gameDateParts[2], 10)
        
        // Create date objects for comparison (in local timezone)
        const gameDateObj = new Date(gameYear, gameMonth, gameDay)
        const todayDateObj = new Date(todayYear, todayMonth, todayDate)
        
        // Compare dates: if game date is today or in the future, it's upcoming
        const isPast = gameDateObj < todayDateObj
        
        if (timeFilter === 'upcoming' && isPast) return false
        if (timeFilter === 'past' && !isPast) return false
      } else {
        // Invalid date format - treat as past
        if (timeFilter === 'upcoming') return false
      }
    } else {
      // Games without dates go to past
      if (timeFilter === 'upcoming') return false
    }
    
    // Team filter
    if (filterTeamId && game.teamId !== filterTeamId) return false
    
    // Season filter
    if (filterSeasonId && game.seasonId !== filterSeasonId) return false
    
    return true
  })

  // Group filtered games by date for better display
  const gamesByDate = filteredGames.reduce((acc, game) => {
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold">Event Schedule</h2>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Event</span>
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Upcoming/Past buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setTimeFilter('upcoming')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                timeFilter === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setTimeFilter('past')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                timeFilter === 'past'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Past
            </button>
          </div>
          
          {/* Team and Season filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {filterTeamOptions.length > 0 && (
              <div className="w-full sm:w-48">
                <Dropdown
                  options={[
                    { value: '', label: 'All Teams' },
                    ...filterTeamOptions
                  ]}
                  value={filterTeamId || ''}
                  onChange={(val) => {
                    setFilterTeamId(val || null)
                    // Clear season filter if it's no longer valid
                    if (val && filterSeasonId) {
                      const validSeasons = allGames
                        .filter(g => g.teamId === val)
                        .map(g => g.seasonId)
                        .filter(Boolean)
                      if (!validSeasons.includes(filterSeasonId)) {
                        setFilterSeasonId(null)
                      }
                    }
                  }}
                  placeholder="Filter by Team..."
                  multiple={false}
                  showAllOption={false}
                />
              </div>
            )}
            
            {filterSeasonOptions.length > 0 && (
              <div className="w-full sm:w-48">
                <Dropdown
                  options={[
                    { value: '', label: 'All Seasons' },
                    ...filterSeasonOptions
                  ]}
                  value={filterSeasonId || ''}
                  onChange={(val) => {
                    setFilterSeasonId(val || null)
                    // Clear team filter if it's no longer valid
                    if (val && filterTeamId) {
                      const validTeams = allGames
                        .filter(g => g.seasonId === val)
                        .map(g => g.teamId)
                        .filter(Boolean)
                      if (!validTeams.includes(filterTeamId)) {
                        setFilterTeamId(null)
                      }
                    }
                  }}
                  placeholder="Filter by Season..."
                  multiple={false}
                  showAllOption={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-320px)] overflow-y-auto scrollable-container">
        {organization?.games?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No games scheduled yet</p>
        ) : (
          <div className="space-y-6 pr-2">
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
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              {/* Event Type Logo/Icon */}
                              <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
                                game.eventType === 'game' 
                                  ? 'bg-blue-900 bg-opacity-30'
                                  : game.eventType === 'practice'
                                  ? 'bg-purple-900 bg-opacity-30'
                                  : 'bg-emerald-900 bg-opacity-30'
                              }`}>
                                {game.eventType === 'game' ? (
                                  <Calendar className="w-6 h-6 text-blue-400" />
                                ) : game.eventType === 'practice' ? (
                                  <Dumbbell className="w-6 h-6 text-purple-400" />
                                ) : (
                                  <Sparkles className="w-6 h-6 text-emerald-400" />
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-white font-medium">
                                  {formatTime(game.gameTime)}
                                </span>
                              </div>
                              <span className="text-gray-400">•</span>
                              {game.eventType && game.eventType !== 'game' && (
                                <>
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    game.eventType === 'practice' 
                                      ? 'bg-purple-900 bg-opacity-50 text-purple-300'
                                      : 'bg-emerald-900 bg-opacity-50 text-emerald-300'
                                  }`}>
                                    {game.eventType === 'practice' ? 'Practice' : 'Skills'}
                                  </span>
                                  <span className="text-gray-400">•</span>
                                </>
                              )}
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
                            {game.opponent && (
                              <div className="text-lg font-semibold text-white mb-1">
                                vs. {game.opponent}
                              </div>
                            )}
                            {!game.opponent && game.eventType && game.eventType !== 'game' && (
                              <div className="text-lg font-semibold text-white mb-1">
                                {game.eventType === 'practice' ? 'Practice Session' : 'Skills Session'}
                              </div>
                            )}
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
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {isNew ? 'Add Event' : 'Edit Event'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Event Type Selector */}
              <div>
                <label className="block text-gray-300 mb-2">Event Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setEventType('game')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      eventType === 'game'
                        ? 'border-blue-700 bg-blue-900 bg-opacity-20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-300" />
                      <span className="font-semibold">Game</span>
                    </div>
                    <p className="text-xs text-gray-400">Scheduled game with opponent</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventType('practice')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      eventType === 'practice'
                        ? 'border-purple-700 bg-purple-900 bg-opacity-20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Dumbbell className="w-4 h-4 text-purple-300" />
                      <span className="font-semibold">Practice</span>
                    </div>
                    <p className="text-xs text-gray-400">Practice session for team</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventType('skills')}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      eventType === 'skills'
                        ? 'border-emerald-700 bg-emerald-900 bg-opacity-20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span className="font-semibold">Skills</span>
                    </div>
                    <p className="text-xs text-gray-400">Skills/drills session</p>
                  </button>
                </div>
              </div>

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
                <label className="block text-gray-300 mb-2">
                  Opponent {eventType === 'game' ? '*' : ''}
                </label>
                <input
                  type="text"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={eventType === 'game' ? 'Enter opponent name' : 'Enter opponent name (optional)'}
                  required={eventType === 'game'}
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
                  disabled={!selectedTeamId || !selectedSeasonId || !gameDate || !gameTime || (eventType === 'game' && !opponent.trim())}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {isNew ? 'Add Event' : 'Save Changes'}
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
