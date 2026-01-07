import { useState, useEffect } from 'react'
import { useIndividual } from '../context/IndividualContext'
import { X, Trash2 } from 'lucide-react'

function SeasonModal({ season, onClose, onDelete }) {
  const { addSeason, updateSeason } = useIndividual()
  const [name, setName] = useState('')
  const [type, setType] = useState('season')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Future: Add more fields as needed

  const isNew = !season

  useEffect(() => {
    if (season) {
      setName(season.name || '')
      setType(season.type || 'season')
      setStartDate(season.startDate || '')
      setEndDate(season.endDate || '')
    } else {
      setName('')
      setType('season')
      setStartDate('')
      setEndDate('')
    }
  }, [season])

  const handleSave = () => {
    if (!name.trim()) return

    const seasonData = {
      name: name.trim(),
      type,
      startDate: startDate || null,
      endDate: endDate || null,
      // Future: Add more fields here
    }

    if (isNew) {
      addSeason(seasonData)
    } else {
      updateSeason(season.id, seasonData)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{isNew ? 'Add Season/Tournament' : season.name}</h2>
            <p className="text-gray-400 text-sm mt-1">Manage season/tournament information</p>
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
            <label className="block text-gray-300 mb-2">Type *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('season')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  type === 'season'
                    ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                }`}
              >
                Season
              </button>
              <button
                type="button"
                onClick={() => setType('tournament')}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  type === 'tournament'
                    ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                }`}
              >
                Tournament
              </button>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Enter ${type} name`}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Future: Add more fields here as needed */}
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-700">
          {/* Delete button - only show when editing existing season */}
          {!isNew && onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this season/tournament? This action cannot be undone.')) {
                  onDelete()
                }
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Season/Tournament</span>
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
              {isNew ? 'Add Season/Tournament' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeasonModal
