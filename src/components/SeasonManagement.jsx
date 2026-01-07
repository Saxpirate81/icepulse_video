import { useState } from 'react'
import { useOrg } from '../context/OrgContext'
import { Calendar, Plus, Trash2, X } from 'lucide-react'

function SeasonManagement() {
  const { organization, addSeason, updateSeason, deleteSeason } = useOrg()
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSeason, setEditingSeason] = useState(null)
  const [seasonName, setSeasonName] = useState('')
  const [seasonType, setSeasonType] = useState('season') // 'season' or 'tournament'

  const handleAdd = () => {
    if (seasonName.trim()) {
      addSeason({ name: seasonName.trim(), type: seasonType })
      setSeasonName('')
      setSeasonType('season')
      setShowAddModal(false)
    }
  }

  const handleEdit = (season) => {
    setEditingSeason(season)
    setSeasonName(season.name)
    setSeasonType(season.type || 'season')
    setShowAddModal(true)
  }

  const handleUpdate = () => {
    if (seasonName.trim() && editingSeason) {
      updateSeason(editingSeason.id, { name: seasonName.trim(), type: seasonType })
      setSeasonName('')
      setSeasonType('season')
      setEditingSeason(null)
      setShowAddModal(false)
    }
  }

  const handleDelete = (seasonId) => {
    if (confirm('Are you sure you want to delete this season/tournament?')) {
      deleteSeason(seasonId)
    }
  }

  const handleCancel = () => {
    setSeasonName('')
    setSeasonType('season')
    setEditingSeason(null)
    setShowAddModal(false)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Seasons / Tournaments</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Season/Tournament</span>
        </button>
      </div>

      {/* Seasons List */}
      <div className="space-y-3">
        {organization?.seasons?.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No seasons/tournaments added yet</p>
        ) : (
          organization?.seasons?.map((season) => (
            <div
              key={season.id}
              className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
              onClick={() => handleEdit(season)}
            >
              <div>
                <span className="text-white font-medium">{season.name}</span>
                <span className="ml-2 text-xs text-gray-400 capitalize">({season.type || 'season'})</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {editingSeason ? 'Edit Season/Tournament' : 'Add Season/Tournament'}
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
                <label className="block text-gray-300 mb-2">Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSeasonType('season')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      seasonType === 'season'
                        ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                        : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                    }`}
                  >
                    Season
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeasonType('tournament')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      seasonType === 'tournament'
                        ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                        : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                    }`}
                  >
                    Tournament
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter ${seasonType} name`}
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-700 mt-4">
                {/* Delete button - only show when editing existing season */}
                {editingSeason && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this season/tournament? This action cannot be undone.')) {
                        handleDelete(editingSeason.id)
                        handleCancel()
                      }
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Season/Tournament</span>
                  </button>
                )}
                {!editingSeason && <div></div>} {/* Spacer when no delete button */}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingSeason ? handleUpdate : handleAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    {editingSeason ? 'Update' : 'Add'}
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

export default SeasonManagement
