import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { Building2, Plus, Trash2, X, UserPlus } from 'lucide-react'
import InviteButton from './InviteButton'
import Dropdown from './Dropdown'

function ParentManagement() {
  const { organization, addParent, updateParent, deleteParent, connectParentToPlayer, sendParentInvite, resendParentInvite, checkStreamingPermission, updateStreamingPermission, findProfileByEmail } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingParent, setEditingParent] = useState(null)
  const [parentName, setParentName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([])
  const [canStreamLive, setCanStreamLive] = useState(false)
  const [isLoadingPermission, setIsLoadingPermission] = useState(false)

  const playerOptions = organization?.players?.map(player => ({
    value: player.id,
    label: player.fullName || player.name
  })) || []

  const handleAdd = () => {
    if (parentName.trim() && parentEmail.trim()) {
      const newParent = addParent({
        name: parentName.trim(),
        email: parentEmail.trim(),
        playerConnections: []
      })
      
      // Connect to selected players
      selectedPlayerIds.forEach(playerId => {
        connectParentToPlayer(newParent.id, playerId)
      })
      
      setParentName('')
      setParentEmail('')
      setSelectedPlayerIds([])
      setShowAddModal(false)
    }
  }

  const handleEdit = async (parent) => {
    setEditingParent(parent)
    setParentName(parent.name)
    setParentEmail(parent.email)
    setSelectedPlayerIds(parent.playerConnections || [])
    
    // Try to find profileId if not present but email exists
    let profileIdToUse = parent.profileId
    if (!profileIdToUse && parent.email && findProfileByEmail) {
      const foundProfileId = await findProfileByEmail(parent.email)
      if (foundProfileId) {
        profileIdToUse = foundProfileId
        setEditingParent({ ...parent, profileId: foundProfileId })
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
    // Try to get profileId - either from parent or by looking up email
    let profileIdToUse = editingParent?.profileId
    
    if (!profileIdToUse && editingParent?.email && findProfileByEmail) {
      profileIdToUse = await findProfileByEmail(editingParent.email)
      if (profileIdToUse) {
        setEditingParent({ ...editingParent, profileId: profileIdToUse })
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

  const handleUpdate = () => {
    if (parentName.trim() && parentEmail.trim() && editingParent) {
      updateParent(editingParent.id, {
        name: parentName.trim(),
        email: parentEmail.trim()
      })
      
      // Update player connections
      const currentConnections = editingParent.playerConnections || []
      const toAdd = selectedPlayerIds.filter(id => !currentConnections.includes(id))
      const toRemove = currentConnections.filter(id => !selectedPlayerIds.includes(id))
      
      toAdd.forEach(playerId => connectParentToPlayer(editingParent.id, playerId))
      // Note: In a real app, you'd need a remove connection function
      
      setParentName('')
      setParentEmail('')
      setSelectedPlayerIds([])
      setEditingParent(null)
      setShowAddModal(false)
    }
  }

  const handleDelete = (parentId) => {
    if (confirm('Are you sure you want to remove this parent?')) {
      deleteParent(parentId)
    }
  }

  const handleCancel = () => {
    setParentName('')
    setParentEmail('')
    setSelectedPlayerIds([])
    setEditingParent(null)
    setShowAddModal(false)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Parents</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Parent</span>
        </button>
      </div>

      {/* Parents List */}
      <div className="space-y-3">
        {organization?.parents?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No parents added yet</p>
        ) : (
          organization?.parents?.map((parent) => {
            const connectedPlayers = organization.players?.filter(p => 
              parent.playerConnections?.includes(p.id)
            ) || []
            
            return (
              <div
                key={parent.id}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => handleEdit(parent)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{parent.name}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{parent.email}</p>
                    {connectedPlayers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-gray-500 text-sm mb-1">Connected to:</p>
                        <div className="flex flex-wrap gap-2">
                          {connectedPlayers.map(player => (
                            <span
                              key={player.id}
                              className="text-xs bg-blue-900 bg-opacity-50 text-blue-300 px-2 py-1 rounded"
                            >
                              {player.fullName || player.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <InviteButton
                      onSendInvite={() => sendParentInvite(parent.id)}
                      onResendInvite={() => resendParentInvite(parent.id)}
                      inviteSent={parent.inviteSent}
                      inviteDate={parent.inviteDate}
                      email={parent.email}
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
                {editingParent ? 'Edit Parent' : 'Add Parent'}
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
                <label className="block text-gray-300 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter parent's full name"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="parent@example.com"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Email aliases (e.g., name+1@example.com) are supported.</p>
              </div>

              {/* Streaming Permission - Show for all when editing */}
              {editingParent && (
                <div className="border-t border-gray-700 pt-4">
                  <label className="block text-gray-300 mb-2">Streaming Access</label>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={canStreamLive}
                      onChange={(e) => handleStreamingPermissionChange(e.target.checked)}
                      disabled={isLoadingPermission || (!editingParent?.profileId && !editingParent?.email)}
                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <label 
                        className={`cursor-pointer ${(!editingParent?.profileId && !editingParent?.email) ? 'text-gray-500 cursor-not-allowed' : 'text-white'}`}
                        onClick={() => {
                          if (!isLoadingPermission && (editingParent?.profileId || editingParent?.email)) {
                            handleStreamingPermissionChange(!canStreamLive)
                          }
                        }}
                      >
                        Allow Live Streaming
                      </label>
                      <p className="text-xs text-gray-400 mt-1">
                        {editingParent?.profileId || editingParent?.email 
                          ? 'Enable this user to stream live video. If disabled while streaming, active streams will be stopped.'
                          : 'User must have an email address to enable streaming. Profile will be looked up by email when they sign up.'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Profile ID: {editingParent.profileId || 'Not found (will lookup by email)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {playerOptions.length > 0 && (
                <div>
                  <label className="block text-gray-300 mb-2">Connect to Players</label>
                  <Dropdown
                    options={playerOptions}
                    value={selectedPlayerIds}
                    onChange={(newValues) => {
                      // Ensure we're only setting the actual selected values, not all options
                      if (Array.isArray(newValues)) {
                        setSelectedPlayerIds(newValues)
                      } else {
                        setSelectedPlayerIds([])
                      }
                    }}
                    placeholder="Select players..."
                    multiple={true}
                    showAllOption={true}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Parents can connect to their children/players to view their videos and stats
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-4">
                {/* Delete button - only show when editing existing parent */}
                {editingParent && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this parent? This action cannot be undone.')) {
                        handleDelete(editingParent.id)
                        handleCancel()
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Parent</span>
                  </button>
                )}
                {!editingParent && <div></div>} {/* Spacer when no delete button */}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingParent ? handleUpdate : handleAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    {editingParent ? 'Update' : 'Add'}
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

export default ParentManagement
