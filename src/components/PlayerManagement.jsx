import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { UserPlus, Plus, Trash2, X } from 'lucide-react'
import InviteButton from './InviteButton'
import Dropdown from './Dropdown'

function PlayerManagement() {
  const { organization, addPlayer, updatePlayer, deletePlayer, assignPlayerToTeam, sendPlayerInvite, resendPlayerInvite, checkStreamingPermission, updateStreamingPermission } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [isExistingUser, setIsExistingUser] = useState(false)
  const [existingPlayers, setExistingPlayers] = useState([]) // TODO: Fetch from API - all app users who are players
  const [canStreamLive, setCanStreamLive] = useState(false)
  const [isLoadingPermission, setIsLoadingPermission] = useState(false)

  // Get existing players from organization or from all app users (TODO: fetch from API)
  const orgPlayers = organization?.players || []
  const playerOptions = existingPlayers.length > 0 
    ? existingPlayers.map(player => ({
        value: player.id,
        label: `${player.fullName || player.name}${player.email ? ` (${player.email})` : ''}`
      }))
    : orgPlayers.map(player => ({
        value: player.id,
        label: player.fullName || player.name
      }))

  const handleAdd = async () => {
    if (isExistingUser) {
      // Assign existing players to team
      if (selectedPlayerIds.length > 0 && selectedTeamId && selectedSeasonId) {
        for (const playerId of selectedPlayerIds) {
          await assignPlayerToTeam(playerId, selectedTeamId, selectedSeasonId, jerseyNumber || null)
        }
        setSelectedPlayerIds([])
        setSelectedTeamId(null)
        setSelectedSeasonId(null)
        setJerseyNumber('')
        setIsExistingUser(false)
        setShowAddModal(false)
      }
    } else {
      // Add new player
      if (playerName.trim()) {
        const newPlayer = await addPlayer({
          fullName: playerName.trim(),
          name: playerName.trim().split(' ')[0], // First name
          email: playerEmail.trim() || null,
          inviteSent: false,
          inviteDate: null,
          isExistingUser: false
        })
        // If team/season selected, assign immediately
        if (newPlayer && selectedTeamId && selectedSeasonId) {
          await assignPlayerToTeam(newPlayer.id, selectedTeamId, selectedSeasonId, jerseyNumber || null)
        }
        setPlayerName('')
        setSelectedTeamId(null)
        setSelectedSeasonId(null)
        setJerseyNumber('')
        setIsExistingUser(false)
        setShowAddModal(false)
      }
    }
  }

  const handleEdit = async (player) => {
    // Get the latest player data from organization context
    const latestPlayer = organization?.players?.find(p => p.id === player.id) || player
    setEditingPlayer(latestPlayer)
    setPlayerName(latestPlayer.fullName || latestPlayer.name)
    setPlayerEmail(latestPlayer.email || '')
    setIsExistingUser(latestPlayer.isExistingUser || false)
    
    // Load streaming permission if player has a profile_id
    if (latestPlayer.profileId && checkStreamingPermission) {
      setIsLoadingPermission(true)
      try {
        const hasPermission = await checkStreamingPermission(latestPlayer.profileId)
        setCanStreamLive(hasPermission)
      } catch (error) {
        console.error('Error loading streaming permission:', error)
        setCanStreamLive(false)
      } finally {
        setIsLoadingPermission(false)
      }
    } else {
      setCanStreamLive(false)
    }
    
    setShowAddModal(true)
  }

  const handleStreamingPermissionChange = async (enabled) => {
    if (!currentEditingPlayer?.profileId || !updateStreamingPermission) {
      return
    }

    setIsLoadingPermission(true)
    try {
      const result = await updateStreamingPermission(currentEditingPlayer.profileId, enabled)
      if (result.success) {
        setCanStreamLive(enabled)
      } else {
        alert(result.message || 'Failed to update streaming permission')
      }
    } catch (error) {
      console.error('Error updating streaming permission:', error)
      alert('Failed to update streaming permission')
    } finally {
      setIsLoadingPermission(false)
    }
  }

  // Get the latest player data when editing (refreshed after assignments are added/updated)
  const currentEditingPlayer = editingPlayer 
    ? (organization?.players?.find(p => p.id === editingPlayer.id) || editingPlayer)
    : null

  const handleUpdate = async () => {
    if (playerName.trim() && currentEditingPlayer) {
      // Update player name and email
      await updatePlayer(currentEditingPlayer.id, { 
        fullName: playerName.trim(),
        email: playerEmail.trim() || null,
        isExistingUser
      })
      
      // If team/season/jersey selected, add or update assignment
      // This preserves historical assignments - we add a new one or update existing
      if (selectedTeamId && selectedSeasonId) {
        await assignPlayerToTeam(currentEditingPlayer.id, selectedTeamId, selectedSeasonId, jerseyNumber || null)
        // Wait a moment for the context to refresh
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      setPlayerName('')
      setSelectedTeamId(null)
      setSelectedSeasonId(null)
      setJerseyNumber('')
      setEditingPlayer(null)
      setIsExistingUser(false)
      setShowAddModal(false)
    }
  }

  const handleDelete = (playerId) => {
    if (confirm('Are you sure you want to remove this player?')) {
      deletePlayer(playerId)
    }
  }

  const handleCancel = () => {
    setPlayerName('')
    setPlayerEmail('')
    setSelectedPlayerIds([])
    setSelectedTeamId(null)
    setSelectedSeasonId(null)
    setJerseyNumber('')
    setIsExistingUser(false)
    setEditingPlayer(null)
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

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Players</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add/Assign Players</span>
        </button>
      </div>

      {/* Players List */}
      <div className="space-y-3">
        {organization?.players?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No players added yet</p>
        ) : (
          organization?.players?.map((player) => {
            const assignments = player.teamAssignments || []
            return (
              <div
                key={player.id}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => handleEdit(player)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{player.fullName || player.name}</span>
                      {player.isExistingUser && (
                        <span className="text-xs bg-green-900 bg-opacity-50 text-green-400 px-2 py-0.5 rounded">
                          Existing User
                        </span>
                      )}
                    </div>
                    {player.email && (
                      <p className="text-gray-400 text-sm mb-2">{player.email}</p>
                    )}
                    {assignments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {assignments.map((assignment, idx) => {
                          const team = organization.teams?.find(t => t.id === assignment.teamId)
                          const season = organization.seasons?.find(s => s.id === assignment.seasonId)
                          return (
                            <div key={idx} className="text-sm text-gray-400">
                              {team?.name} - {season?.name} {assignment.jerseyNumber && `(#${assignment.jerseyNumber})`}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <InviteButton
                      onSendInvite={() => sendPlayerInvite(player.id)}
                      onResendInvite={() => resendPlayerInvite(player.id)}
                      inviteSent={player.inviteSent}
                      inviteDate={player.inviteDate}
                      email={player.email}
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {currentEditingPlayer ? 'Edit Player' : 'Add/Assign Players'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {currentEditingPlayer ? (
                <>
                  <div>
                    <label className="block text-gray-300 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter player's full name"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={playerEmail}
                      onChange={(e) => setPlayerEmail(e.target.value)}
                      pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter player's email (optional)"
                    />
                    <p className="text-xs text-gray-400 mt-1">Used for sending invites and notifications. Email aliases (e.g., name+1@example.com) are supported.</p>
                  </div>
                  {/* Streaming Permission - Only show if player has profile_id (is existing user) */}
                  {currentEditingPlayer?.profileId && (
                    <div className="border-t border-gray-700 pt-4">
                      <label className="block text-gray-300 mb-2">Streaming Access</label>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={canStreamLive}
                          onChange={(e) => handleStreamingPermissionChange(e.target.checked)}
                          disabled={isLoadingPermission}
                          className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <label className="text-white cursor-pointer" onClick={() => !isLoadingPermission && handleStreamingPermissionChange(!canStreamLive)}>
                            Allow Live Streaming
                          </label>
                          <p className="text-xs text-gray-400 mt-1">
                            Enable this user to stream live video. If disabled while streaming, active streams will be stopped.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Show existing team assignments for editing */}
                  {currentEditingPlayer.teamAssignments && currentEditingPlayer.teamAssignments.length > 0 && (
                    <div>
                      <label className="block text-gray-300 mb-2">Current Team Assignments</label>
                      <div className="space-y-2">
                        {currentEditingPlayer.teamAssignments.map((assignment, idx) => {
                          const team = organization.teams?.find(t => t.id === assignment.teamId)
                          const season = organization.seasons?.find(s => s.id === assignment.seasonId)
                          return (
                            <div key={idx} className="bg-gray-700 rounded p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <span className="text-white font-medium">{team?.name || 'Team'}</span>
                                  <span className="text-gray-400 ml-2">- {season?.name || 'Season'}</span>
                                  {assignment.jerseyNumber && (
                                    <span className="text-blue-400 ml-2">#{assignment.jerseyNumber}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    // Edit this specific assignment
                                    setSelectedTeamId(assignment.teamId)
                                    setSelectedSeasonId(assignment.seasonId)
                                    setJerseyNumber(assignment.jerseyNumber || '')
                                  }}
                                  className="text-blue-400 hover:text-blue-300 text-sm"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* Add new assignment */}
                  <div className="border-t border-gray-700 pt-4">
                    <label className="block text-gray-300 mb-2">Add New Team Assignment</label>
                    {teamOptions.length > 0 && (
                      <div className="mb-3">
                        <label className="block text-gray-300 mb-2 text-sm">Team</label>
                        <Dropdown
                          options={teamOptions}
                          value={selectedTeamId || ''}
                          onChange={setSelectedTeamId}
                          placeholder="Select team..."
                          multiple={false}
                          showAllOption={false}
                        />
                      </div>
                    )}
                    {seasonOptions.length > 0 && (
                      <div className="mb-3">
                        <label className="block text-gray-300 mb-2 text-sm">Season/Tournament</label>
                        <Dropdown
                          options={seasonOptions}
                          value={selectedSeasonId || ''}
                          onChange={setSelectedSeasonId}
                          placeholder="Select season/tournament..."
                          multiple={false}
                          showAllOption={false}
                        />
                      </div>
                    )}
                    {(selectedTeamId || selectedSeasonId) && (
                      <div>
                        <label className="block text-gray-300 mb-2 text-sm">Jersey Number</label>
                        <input
                          type="number"
                          value={jerseyNumber}
                          onChange={(e) => setJerseyNumber(e.target.value)}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter jersey number"
                          min="0"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-300 mb-2">Player Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsExistingUser(true)}
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          isExistingUser
                            ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                        }`}
                      >
                        Existing Player
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsExistingUser(false)}
                        className={`p-3 rounded-lg border-2 transition-colors ${
                          !isExistingUser
                            ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                        }`}
                      >
                        New Player
                      </button>
                    </div>
                    {isExistingUser && (
                      <p className="text-xs text-gray-400 mt-2">
                        Select from existing app users and assign to team
                      </p>
                    )}
                  </div>

                  {isExistingUser ? (
                    <div>
                      <label className="block text-gray-300 mb-2">Select Existing Players</label>
                      <Dropdown
                        options={playerOptions}
                        value={selectedPlayerIds}
                        onChange={setSelectedPlayerIds}
                        placeholder="Search and select players..."
                        multiple={true}
                        showAllOption={true}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-gray-300 mb-2">Full Name *</label>
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter player's full name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">Email</label>
                        <input
                          type="email"
                          value={playerEmail}
                          onChange={(e) => setPlayerEmail(e.target.value)}
                          pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter player's email (optional)"
                        />
                        <p className="text-xs text-gray-400 mt-1">Email aliases (e.g., name+1@example.com) are supported.</p>
                        <p className="text-xs text-gray-400 mt-1">Used for sending invites and notifications</p>
                      </div>
                    </>
                  )}

                  {teamOptions.length > 0 && (
                    <div>
                      <label className="block text-gray-300 mb-2">Assign to Team (Optional)</label>
                      <Dropdown
                        options={teamOptions}
                        value={selectedTeamId || ''}
                        onChange={setSelectedTeamId}
                        placeholder="Select team..."
                        multiple={false}
                        showAllOption={false}
                      />
                    </div>
                  )}

                  {seasonOptions.length > 0 && (
                    <div>
                      <label className="block text-gray-300 mb-2">Season/Tournament (Optional)</label>
                      <Dropdown
                        options={seasonOptions}
                        value={selectedSeasonId || ''}
                        onChange={setSelectedSeasonId}
                        placeholder="Select season/tournament..."
                        multiple={false}
                        showAllOption={false}
                      />
                    </div>
                  )}

                  {selectedTeamId && selectedSeasonId && (
                    <div>
                      <label className="block text-gray-300 mb-2">Jersey Number (Optional)</label>
                      <input
                        type="number"
                        value={jerseyNumber}
                        onChange={(e) => setJerseyNumber(e.target.value)}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter jersey number"
                        min="0"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Jersey number is specific to this team and season combination
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-4">
                {/* Delete button - only show when editing existing player */}
                {currentEditingPlayer && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this player? This action cannot be undone.')) {
                        handleDelete(currentEditingPlayer.id)
                        handleCancel()
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Player</span>
                  </button>
                )}
                {!currentEditingPlayer && <div></div>} {/* Spacer when no delete button */}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                  onClick={currentEditingPlayer ? handleUpdate : handleAdd}
                  disabled={
                    currentEditingPlayer 
                      ? !playerName.trim() 
                      : isExistingUser 
                        ? (selectedPlayerIds.length === 0 || !selectedTeamId || !selectedSeasonId)
                        : !playerName.trim()
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {currentEditingPlayer ? 'Update' : isExistingUser ? 'Assign to Team' : 'Add Player'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayerManagement
