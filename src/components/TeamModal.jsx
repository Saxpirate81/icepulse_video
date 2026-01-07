import { useState, useEffect } from 'react'
import { useIndividual } from '../context/IndividualContext'
import { X, Trash2 } from 'lucide-react'

function TeamModal({ team, onClose, onDelete }) {
  const { addTeam, updateTeam } = useIndividual()
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [division, setDivision] = useState('')
  // Future: Add more fields as needed

  const isNew = !team

  useEffect(() => {
    if (team) {
      setName(team.name || '')
      setLevel(team.level || '')
      setDivision(team.division || '')
    } else {
      setName('')
      setLevel('')
      setDivision('')
    }
  }, [team])

  const handleSave = () => {
    if (!name.trim()) return

    const teamData = {
      name: name.trim(),
      level: level || null,
      division: division || null,
      // Future: Add more fields here
    }

    if (isNew) {
      addTeam(teamData)
    } else {
      updateTeam(team.id, teamData)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{isNew ? 'Add Team' : team.name}</h2>
            <p className="text-gray-400 text-sm mt-1">Manage team information</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Team Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter team name"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Level</label>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., U10, U12, U14"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Division</label>
            <input
              type="text"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., A, B, C"
            />
          </div>

          {/* Future: Add more fields here as needed */}
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-700">
          {/* Delete button - only show when editing existing team */}
          {!isNew && onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
                  onDelete()
                }
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Team</span>
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
              disabled={!name.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isNew ? 'Add Team' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamModal
