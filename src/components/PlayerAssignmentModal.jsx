import { useState, useEffect, useRef } from 'react'
import { useIndividual } from '../context/IndividualContext'
import { X, Plus, Edit2, Trash2, User, Camera, Image as ImageIcon } from 'lucide-react'
import Dropdown from './Dropdown'

function PlayerAssignmentModal({ player, onClose, onDelete }) {
  const { players, teams, seasons, addPlayer, updatePlayer, addTeamAssignment, updateTeamAssignment, deleteTeamAssignment } = useIndividual()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [selectedSeasonIds, setSelectedSeasonIds] = useState([])
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [position, setPosition] = useState('') // Example of extensible field
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const isNew = !player

  // Get the latest player data from context (refreshed after assignments are added/updated)
  const currentPlayer = isNew ? null : players.find(p => p.id === player.id) || player

  useEffect(() => {
    if (currentPlayer) {
      setFullName(currentPlayer.fullName || currentPlayer.name || '')
      setEmail(currentPlayer.email || '')
      setAvatar(currentPlayer.avatar || null)
      setAvatarPreview(currentPlayer.avatar || null)
    } else {
      setFullName('')
      setEmail('')
      setAvatar(null)
      setAvatarPreview(null)
    }
  }, [currentPlayer])

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result
        setAvatar(base64String)
        setAvatarPreview(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleTakePhoto = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click()
    }
  }

  const handleChooseFromLibrary = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleRemoveAvatar = () => {
    setAvatar(null)
    setAvatarPreview(null)
  }

  const handleSave = async () => {
    if (!fullName.trim()) return

    if (isNew) {
      const newPlayer = await addPlayer({
        fullName: fullName.trim(),
        name: fullName.trim().split(' ')[0],
        email: email.trim() || null,
        avatar: avatar || null,
        teamAssignments: []
      })
      if (!newPlayer) {
        alert('Failed to add player. Please try again.')
        return
      }
      // Add assignments if any selected
      if (selectedTeamIds.length > 0 && selectedSeasonIds.length > 0) {
        for (const teamId of selectedTeamIds) {
          for (const seasonId of selectedSeasonIds) {
            await addTeamAssignment(newPlayer.id, {
              teamId,
              seasonId,
              teamName: teams.find(t => t.id === teamId)?.name || '',
              seasonName: seasons.find(s => s.id === seasonId)?.name || '',
              jerseyNumber: jerseyNumber || null,
              position: position || null,
            })
          }
        }
      }
      onClose()
    } else {
      if (currentPlayer) {
        updatePlayer(currentPlayer.id, { 
          fullName: fullName.trim(),
          email: email.trim() || null,
          avatar: avatar || null
        })
      }
      onClose()
    }
  }

  const handleAddAssignment = async () => {
    if (selectedTeamIds.length > 0 && selectedSeasonIds.length > 0 && currentPlayer) {
      for (const teamId of selectedTeamIds) {
        for (const seasonId of selectedSeasonIds) {
          await addTeamAssignment(currentPlayer.id, {
            teamId,
            seasonId,
            teamName: teams.find(t => t.id === teamId)?.name || '',
            seasonName: seasons.find(s => s.id === seasonId)?.name || '',
            jerseyNumber: jerseyNumber || null,
            position: position || null,
          })
        }
      }
      // Wait a moment for the context to refresh
      await new Promise(resolve => setTimeout(resolve, 100))
      setSelectedTeamIds([])
      setSelectedSeasonIds([])
      setJerseyNumber('')
      setPosition('')
      setShowAddForm(false)
    }
  }

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment)
    setSelectedTeamIds([assignment.teamId].filter(Boolean))
    setSelectedSeasonIds([assignment.seasonId].filter(Boolean))
    setJerseyNumber(assignment.jerseyNumber || '')
    setPosition(assignment.position || '')
    setShowAddForm(true)
  }

  const handleUpdateAssignment = async () => {
    if (selectedTeamIds.length > 0 && selectedSeasonIds.length > 0 && editingAssignment && currentPlayer) {
      await updateTeamAssignment(currentPlayer.id, editingAssignment.id, {
        teamId: selectedTeamIds[0],
        seasonId: selectedSeasonIds[0],
        teamName: teams.find(t => t.id === selectedTeamIds[0])?.name || '',
        seasonName: seasons.find(s => s.id === selectedSeasonIds[0])?.name || '',
        jerseyNumber: jerseyNumber || null,
        position: position || null,
      })
      // Wait a moment for the context to refresh
      await new Promise(resolve => setTimeout(resolve, 100))
      setSelectedTeamIds([])
      setSelectedSeasonIds([])
      setJerseyNumber('')
      setPosition('')
      setEditingAssignment(null)
      setShowAddForm(false)
    }
  }

  const handleDeleteAssignment = async (assignmentId) => {
    if (confirm('Are you sure you want to delete this assignment?') && currentPlayer) {
      await deleteTeamAssignment(currentPlayer.id, assignmentId)
      // Wait a moment for the context to refresh
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const handleCancel = () => {
    setSelectedTeamIds([])
    setSelectedSeasonIds([])
    setJerseyNumber('')
    setPosition('')
    setEditingAssignment(null)
    setShowAddForm(false)
  }

  const teamOptions = teams.map(team => ({
    value: team.id,
    label: team.name
  }))

  const seasonOptions = seasons.map(season => ({
    value: season.id,
    label: `${season.name} (${season.type || 'season'})`
  }))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{isNew ? 'Add Player' : (currentPlayer?.fullName || currentPlayer?.name || player?.fullName || player?.name)}</h2>
            <p className="text-gray-400 text-sm mt-1">Manage player information and team assignments</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Player Info */}
        <div className="mb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Player avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-gray-400" />
                )}
              </div>
              {!isNew && (
                <div className="mt-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseFromLibrary}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Library</span>
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* Name and Email Fields */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-gray-300 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter player's full name"
                  required
                  disabled={!isNew}
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter player's email (optional)"
                />
                <p className="text-xs text-gray-400 mt-1">Used for sending invites and notifications. Email aliases (e.g., name+1@example.com) are supported.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Initial Assignment for New Player */}
        {isNew && (teamOptions.length > 0 || seasonOptions.length > 0) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Initial Team Assignments (Optional)</h3>
            {teamOptions.length > 0 && (
              <div className="mb-3">
                <label className="block text-gray-300 mb-2">Teams</label>
                <Dropdown
                  options={teamOptions}
                  value={selectedTeamIds}
                  onChange={setSelectedTeamIds}
                  placeholder="Select teams..."
                  multiple={true}
                  showAllOption={true}
                />
              </div>
            )}
            {seasonOptions.length > 0 && (
              <div className="mb-3">
                <label className="block text-gray-300 mb-2">Seasons/Tournaments</label>
                <Dropdown
                  options={seasonOptions}
                  value={selectedSeasonIds}
                  onChange={setSelectedSeasonIds}
                  placeholder="Select seasons/tournaments..."
                  multiple={true}
                  showAllOption={true}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-300 mb-2">Jersey Number</label>
                <input
                  type="number"
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jersey #"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Position</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Position (optional)"
                />
              </div>
            </div>
          </div>
        )}

        {/* Avatar for New Players */}
        {isNew && (
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">Player Photo (Optional)</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Player avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleChooseFromLibrary}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Choose from Library</span>
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Team Assignments for Existing Player */}
        {!isNew && currentPlayer && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Team Assignments</h3>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Assignment</span>
                </button>
              )}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="bg-gray-700 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm">Teams *</label>
                  <Dropdown
                    options={teamOptions}
                    value={selectedTeamIds}
                    onChange={setSelectedTeamIds}
                    placeholder="Select teams..."
                    multiple={true}
                    showAllOption={true}
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm">Seasons/Tournaments *</label>
                  <Dropdown
                    options={seasonOptions}
                    value={selectedSeasonIds}
                    onChange={setSelectedSeasonIds}
                    placeholder="Select seasons/tournaments..."
                    multiple={true}
                    showAllOption={true}
                  />
                </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm">Jersey Number</label>
                  <input
                    type="number"
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value)}
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Jersey #"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm">Position</label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Position (optional)"
                  />
                </div>
              </div>

              {/* Future: Add more fields here as needed */}
              {/* Example:
              <div>
                <label className="block text-gray-300 mb-1 text-sm">Additional Field</label>
                <input
                  type="text"
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Additional data"
                />
              </div>
              */}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-semibold rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingAssignment ? handleUpdateAssignment : handleAddAssignment}
                  disabled={selectedTeamIds.length === 0 || selectedSeasonIds.length === 0}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
                >
                  {editingAssignment ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {/* Assignments List */}
          <div className="space-y-2">
            {currentPlayer.teamAssignments?.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">No assignments yet</p>
            ) : (
              currentPlayer.teamAssignments?.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {assignment.teamName}
                      </span>
                      <span className="text-gray-400">-</span>
                      <span className="text-gray-300">{assignment.seasonName}</span>
                      {assignment.jerseyNumber && (
                        <span className="text-blue-400 ml-2">#{assignment.jerseyNumber}</span>
                      )}
                      {assignment.position && (
                        <span className="text-gray-400 text-sm ml-2">({assignment.position})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditAssignment(assignment)}
                      className="p-1.5 text-blue-400 hover:bg-blue-900 hover:bg-opacity-30 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      className="p-1.5 text-red-400 hover:bg-red-900 hover:bg-opacity-30 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          {/* Delete button - only show when editing existing player */}
          {!isNew && onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this player? This action cannot be undone.')) {
                  onDelete()
                }
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Player</span>
            </button>
          )}
          {isNew && <div></div>} {/* Spacer when no delete button */}
          
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!fullName.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isNew ? 'Add Player' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayerAssignmentModal
