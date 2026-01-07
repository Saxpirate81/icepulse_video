import { useState, useEffect } from 'react'
import { useIndividual } from '../context/IndividualContext'
import { X, Plus, Edit2, Trash2 } from 'lucide-react'
import Dropdown from './Dropdown'

function CoachAssignmentModal({ coach, onClose, onDelete }) {
  const { coaches, teams, seasons, addCoach, updateCoach, addCoachAssignment, updateCoachAssignment, deleteCoachAssignment } = useIndividual()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [selectedSeasonIds, setSelectedSeasonIds] = useState([])

  const isNew = !coach

  useEffect(() => {
    if (coach) {
      setFullName(coach.fullName || coach.name || '')
      setEmail(coach.email || '')
      // Pre-populate assignments if editing
      const teamIds = coach.assignments?.map(a => a.teamId).filter(Boolean) || []
      const seasonIds = coach.assignments?.map(a => a.seasonId).filter(Boolean) || []
      setSelectedTeamIds(teamIds)
      setSelectedSeasonIds(seasonIds)
    } else {
      setFullName('')
      setEmail('')
      setSelectedTeamIds([])
      setSelectedSeasonIds([])
    }
  }, [coach])

  const handleSave = async () => {
    if (!fullName.trim()) return

    if (isNew) {
      const newCoach = await addCoach({
        fullName: fullName.trim(),
        name: fullName.trim().split(' ')[0],
        email: email.trim() || null,
        assignments: []
      })
      if (!newCoach) {
        alert('Failed to add coach. Please try again.')
        return
      }
      // Add assignments if any selected
      if (selectedTeamIds.length > 0 && selectedSeasonIds.length > 0) {
        for (const teamId of selectedTeamIds) {
          for (const seasonId of selectedSeasonIds) {
            await addCoachAssignment(newCoach.id, {
              teamId,
              seasonId,
              teamName: teams.find(t => t.id === teamId)?.name || '',
              seasonName: seasons.find(s => s.id === seasonId)?.name || ''
            })
          }
        }
      }
      onClose()
    } else {
      updateCoach(coach.id, {
        fullName: fullName.trim(),
        name: fullName.trim().split(' ')[0],
        email: email.trim() || null
      })
      onClose()
    }
  }

  const handleAddAssignment = async () => {
    if (selectedTeamIds.length > 0 && selectedSeasonIds.length > 0 && coach) {
      for (const teamId of selectedTeamIds) {
        for (const seasonId of selectedSeasonIds) {
          const existing = coach.assignments?.find(
            a => a.teamId === teamId && a.seasonId === seasonId
          )
          if (!existing) {
            await addCoachAssignment(coach.id, {
              teamId,
              seasonId,
              teamName: teams.find(t => t.id === teamId)?.name || '',
              seasonName: seasons.find(s => s.id === seasonId)?.name || ''
            })
          }
        }
      }
      setSelectedTeamIds([])
      setSelectedSeasonIds([])
      setShowAddForm(false)
    }
  }

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment)
    setSelectedTeamIds([assignment.teamId].filter(Boolean))
    setSelectedSeasonIds([assignment.seasonId].filter(Boolean))
    setShowAddForm(true)
  }

  const handleUpdateAssignment = async () => {
    if (selectedTeamIds.length > 0 && selectedSeasonIds.length > 0 && editingAssignment && coach) {
      await updateCoachAssignment(coach.id, editingAssignment.id, {
        teamId: selectedTeamIds[0],
        seasonId: selectedSeasonIds[0],
        teamName: teams.find(t => t.id === selectedTeamIds[0])?.name || '',
        seasonName: seasons.find(s => s.id === selectedSeasonIds[0])?.name || ''
      })
      setSelectedTeamIds([])
      setSelectedSeasonIds([])
      setEditingAssignment(null)
      setShowAddForm(false)
    }
  }

  const handleDeleteAssignment = (assignmentId) => {
    if (confirm('Are you sure you want to delete this assignment?') && coach) {
      deleteCoachAssignment(coach.id, assignmentId)
    }
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
            <h2 className="text-2xl font-bold">{isNew ? 'Add Coach' : (coach.fullName || coach.name)}</h2>
            <p className="text-gray-400 text-sm mt-1">Manage coach information and team assignments</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Coach Info */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter coach's full name"
              required
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
              placeholder="coach@example.com"
            />
            <p className="text-xs text-gray-400 mt-1">Email aliases (e.g., name+1@example.com) are supported.</p>
          </div>
        </div>

        {/* Team Assignments */}
        {!isNew && (
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

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingAssignment(null)
                      setSelectedTeamIds([])
                      setSelectedSeasonIds([])
                    }}
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
              {coach.assignments?.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">No assignments yet</p>
              ) : (
                coach.assignments?.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {assignment.teamName || 'Team'}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className="text-gray-300">{assignment.seasonName || 'Season'}</span>
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

        {/* Initial Assignment for New Coach */}
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
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          {/* Delete button - only show when editing existing coach */}
          {!isNew && onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this coach? This action cannot be undone.')) {
                  onDelete()
                }
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Coach</span>
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
              {isNew ? 'Add Coach' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CoachAssignmentModal
