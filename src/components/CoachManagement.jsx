import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { UserCheck, Plus, Trash2, X, Mail } from 'lucide-react'
import InviteButton from './InviteButton'
import Dropdown from './Dropdown'

function CoachManagement() {
  const { organization, addCoach, updateCoach, deleteCoach, sendCoachInvite, resendCoachInvite, assignCoachToTeam, checkStreamingPermission, updateStreamingPermission, findProfileByEmail } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCoach, setEditingCoach] = useState(null)
  const [coachName, setCoachName] = useState('')
  const [coachEmail, setCoachEmail] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState(null)
  const [isExistingUser, setIsExistingUser] = useState(false)
  const [existingCoaches, setExistingCoaches] = useState([]) // TODO: Fetch from API
  const [canStreamLive, setCanStreamLive] = useState(false)
  const [isLoadingPermission, setIsLoadingPermission] = useState(false)

  const handleAdd = async () => {
    if (coachName.trim() && coachEmail.trim()) {
      const newCoach = await addCoach({
        name: coachName.trim(),
        email: coachEmail.trim(),
        isExistingUser,
        assignments: []
      })
      // If team/season selected, assign immediately
      if (newCoach && selectedTeamId && selectedSeasonId) {
        await assignCoachToTeam(newCoach.id, selectedTeamId, selectedSeasonId)
      }
      setCoachName('')
      setCoachEmail('')
      setSelectedTeamId(null)
      setSelectedSeasonId(null)
      setIsExistingUser(false)
      setShowAddModal(false)
    }
  }

  const handleEdit = async (coach) => {
    setEditingCoach(coach)
    setCoachName(coach.name)
    setCoachEmail(coach.email)
    setSelectedTeamId(null) // Reset for new assignment
    setSelectedSeasonId(null) // Reset for new assignment
    setIsExistingUser(coach.isExistingUser || false)
    
    // Try to find profileId if not present but email exists
    let profileIdToUse = coach.profileId
    if (!profileIdToUse && coach.email && findProfileByEmail) {
      const foundProfileId = await findProfileByEmail(coach.email)
      if (foundProfileId) {
        profileIdToUse = foundProfileId
        setEditingCoach({ ...coach, profileId: foundProfileId })
      }
    }
    
    // Load streaming permission if we have a profile_id
    if (profileIdToUse && checkStreamingPermission) {
      setIsLoadingPermission(true)
      try {
        const hasPermission = await checkStreamingPermission(profileIdToUse)
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
    // Try to get profileId - either from coach or by looking up email
    let profileIdToUse = editingCoach?.profileId
    
    if (!profileIdToUse && editingCoach?.email && findProfileByEmail) {
      profileIdToUse = await findProfileByEmail(editingCoach.email)
      if (profileIdToUse) {
        setEditingCoach({ ...editingCoach, profileId: profileIdToUse })
      }
    }
    
    if (!profileIdToUse || !updateStreamingPermission) {
      alert('Cannot enable streaming: User must have signed up first (profile not found)')
      return
    }

    setIsLoadingPermission(true)
    try {
      const result = await updateStreamingPermission(profileIdToUse, enabled)
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

  const handleUpdate = async () => {
    if (coachName.trim() && coachEmail.trim() && editingCoach) {
      // Update coach name and email
      await updateCoach(editingCoach.id, {
        name: coachName.trim(),
        email: coachEmail.trim(),
        isExistingUser
      })
      
      // If team/season selected, add or update assignment
      if (selectedTeamId && selectedSeasonId) {
        await assignCoachToTeam(editingCoach.id, selectedTeamId, selectedSeasonId)
      }
      
      setCoachName('')
      setCoachEmail('')
      setSelectedTeamId(null)
      setSelectedSeasonId(null)
      setIsExistingUser(false)
      setEditingCoach(null)
      setShowAddModal(false)
    }
  }

  const handleDelete = (coachId) => {
    if (confirm('Are you sure you want to remove this coach?')) {
      deleteCoach(coachId)
    }
  }

  const handleCancel = () => {
    setCoachName('')
    setCoachEmail('')
    setSelectedTeamId(null)
    setSelectedSeasonId(null)
    setIsExistingUser(false)
    setEditingCoach(null)
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
          <UserCheck className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Coaches</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Coach</span>
        </button>
      </div>

      {/* Coaches List */}
      <div className="space-y-3">
        {organization?.coaches?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No coaches added yet</p>
        ) : (
          organization?.coaches?.map((coach) => {
            const assignedTeam = organization.teams?.find(t => t.id === coach.teamId)
            return (
              <div
                key={coach.id}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => handleEdit(coach)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{coach.name}</span>
                      {coach.isExistingUser && (
                        <span className="text-xs bg-green-900 bg-opacity-50 text-green-400 px-2 py-0.5 rounded">
                          Existing User
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{coach.email}</p>
                    {coach.assignments && coach.assignments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {coach.assignments.map((assignment, idx) => (
                          <div key={assignment.id || idx} className="text-sm text-gray-400">
                            {assignment.teamName || 'Team'} - {assignment.seasonName || 'Season'}
                          </div>
                        ))}
                      </div>
                    )}
                    {(!coach.assignments || coach.assignments.length === 0) && assignedTeam && (
                      <p className="text-gray-500 text-sm mt-1">Team: {assignedTeam.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <InviteButton
                      onSendInvite={() => sendCoachInvite(coach.id)}
                      onResendInvite={() => resendCoachInvite(coach.id)}
                      inviteSent={coach.inviteSent}
                      inviteDate={coach.inviteDate}
                      email={coach.email}
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
                {editingCoach ? 'Edit Coach' : 'Add Coach'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {editingCoach ? (
                <>
                  <div>
                    <label className="block text-gray-300 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter coach's full name"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={coachEmail}
                      onChange={(e) => setCoachEmail(e.target.value)}
                      pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="coach@example.com"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">Email aliases (e.g., name+1@example.com) are supported.</p>
                  </div>
                  {/* Streaming Permission */}
                  <div className="border-t border-gray-700 pt-4">
                    <label className="block text-gray-300 mb-2">Streaming Access</label>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={canStreamLive}
                        onChange={(e) => handleStreamingPermissionChange(e.target.checked)}
                        disabled={isLoadingPermission || (!editingCoach?.profileId && !editingCoach?.email)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <label 
                          className={`cursor-pointer ${(!editingCoach?.profileId && !editingCoach?.email) ? 'text-gray-500 cursor-not-allowed' : 'text-white'}`}
                          onClick={() => {
                            if (!isLoadingPermission && (editingCoach?.profileId || editingCoach?.email)) {
                              handleStreamingPermissionChange(!canStreamLive)
                            }
                          }}
                        >
                          Allow Live Streaming
                        </label>
                        <p className="text-xs text-gray-400 mt-1">
                          {editingCoach?.profileId || editingCoach?.email 
                            ? 'Enable this user to stream live video. If disabled while streaming, active streams will be stopped.'
                            : 'User must have an email address to enable streaming. Profile will be looked up by email when they sign up.'}
                        </p>
                        {editingCoach && (
                          <p className="text-xs text-gray-500 mt-1">
                            Profile ID: {editingCoach.profileId || 'Not found (will lookup by email)'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Show existing assignments for editing */}
                  {editingCoach.assignments && editingCoach.assignments.length > 0 && (
                    <div>
                      <label className="block text-gray-300 mb-2">Current Team Assignments</label>
                      <div className="space-y-2">
                        {editingCoach.assignments.map((assignment, idx) => (
                          <div key={assignment.id || idx} className="bg-gray-700 rounded p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-white font-medium">{assignment.teamName || 'Team'}</span>
                                <span className="text-gray-400 ml-2">- {assignment.seasonName || 'Season'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
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
                      <div>
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
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-300 mb-2">Coach Type</label>
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
                        Existing User
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
                        New Coach
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
                      <label className="block text-gray-300 mb-2">Select Existing Coach</label>
                      <Dropdown
                        options={existingCoaches.map(coach => ({
                          value: coach.id,
                          label: `${coach.name} (${coach.email})`
                        }))}
                        value={null}
                        onChange={(coachId) => {
                          const coach = existingCoaches.find(c => c.id === coachId)
                          if (coach) {
                            setCoachName(coach.name)
                            setCoachEmail(coach.email)
                          }
                        }}
                        placeholder="Search and select coach..."
                        multiple={false}
                        showAllOption={false}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-gray-300 mb-2">Full Name *</label>
                        <input
                          type="text"
                          value={coachName}
                          onChange={(e) => setCoachName(e.target.value)}
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter coach's full name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">Email *</label>
                        <input
                          type="email"
                          value={coachEmail}
                          onChange={(e) => setCoachEmail(e.target.value)}
                          pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                          className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="coach@example.com"
                          required
                        />
                        <p className="text-xs text-gray-400 mt-1">Email aliases (e.g., name+1@example.com) are supported.</p>
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
                </>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-4">
                {/* Delete button - only show when editing existing coach */}
                {editingCoach && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this coach? This action cannot be undone.')) {
                        handleDelete(editingCoach.id)
                        handleCancel()
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Coach</span>
                  </button>
                )}
                {!editingCoach && <div></div>} {/* Spacer when no delete button */}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingCoach ? handleUpdate : handleAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    {editingCoach ? 'Update' : 'Add'}
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

export default CoachManagement
