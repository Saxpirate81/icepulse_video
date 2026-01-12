import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { Users, Plus, Trash2, X } from 'lucide-react'

function TeamManagement() {
  const { organization, addTeam, updateTeam, deleteTeam } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [teamName, setTeamName] = useState('')

  const handleAdd = () => {
    if (teamName.trim()) {
      addTeam({ name: teamName.trim() })
      setTeamName('')
      setShowAddModal(false)
    }
  }

  const handleEdit = (team) => {
    setEditingTeam(team)
    setTeamName(team.name)
    setShowAddModal(true)
  }

  const handleUpdate = () => {
    if (teamName.trim() && editingTeam) {
      updateTeam(editingTeam.id, { name: teamName.trim() })
      setTeamName('')
      setEditingTeam(null)
      setShowAddModal(false)
    }
  }

  const handleDelete = (teamId) => {
    if (confirm('Are you sure you want to delete this team?')) {
      deleteTeam(teamId)
    }
  }

  const handleCancel = () => {
    setTeamName('')
    setEditingTeam(null)
    setShowAddModal(false)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Teams</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Team</span>
        </button>
      </div>

      {/* Teams List */}
      <div className="max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-320px)] overflow-y-auto scrollable-container">
        <div className="space-y-3 pr-2">
          {organization?.teams?.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No teams added yet</p>
          ) : (
            organization?.teams?.map((team) => (
            <div
              key={team.id}
              className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
              onClick={() => handleEdit(team)}
            >
              <span className="text-white font-medium">{team.name}</span>
            </div>
          ))
        )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editingTeam ? 'Edit Team' : 'Add Team'}
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
                <label className="block text-gray-300 mb-2">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter team name"
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-4">
                {/* Delete button - only show when editing existing team */}
                {editingTeam && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
                        handleDelete(editingTeam.id)
                        handleCancel()
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Team</span>
                  </button>
                )}
                {!editingTeam && <div></div>} {/* Spacer when no delete button */}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingTeam ? handleUpdate : handleAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    {editingTeam ? 'Update' : 'Add'}
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

export default TeamManagement
