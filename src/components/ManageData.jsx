import React, { useState } from 'react'
import { useIndividual } from '../context/IndividualContext'
import { Users, UserCheck, Calendar, Users as TeamsIcon, Plus, User } from 'lucide-react'
import PlayerAssignmentModal from './PlayerAssignmentModal'
import CoachAssignmentModal from './CoachAssignmentModal'
import SeasonModal from './SeasonModal'
import TeamModal from './TeamModal'

function ManageData() {
  const { players, coaches, seasons, teams, addPlayer, addCoach, addSeason, addTeam, deletePlayer, deleteCoach, deleteSeason, deleteTeam } = useIndividual()
  const [activeSection, setActiveSection] = useState('players')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const sections = [
    { id: 'players', label: 'Players', icon: Users },
    { id: 'coaches', label: 'Coaches', icon: UserCheck },
    { id: 'seasons', label: 'Seasons/Tournaments', icon: Calendar },
    { id: 'teams', label: 'Teams', icon: TeamsIcon },
  ]

  const handleItemClick = (item) => {
    setSelectedItem(item)
    setShowModal(true)
  }

  const handleAddClick = () => {
    setSelectedItem(null)
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedItem(null)
  }

  const handleCloseAddModal = () => {
    setShowAddModal(false)
    setSelectedItem(null)
  }

  const handleDelete = (itemId, deleteFn) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteFn(itemId)
    }
  }

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      addPlayer({
        fullName: newPlayerName.trim(),
        name: newPlayerName.trim().split(' ')[0]
      })
      setNewPlayerName('')
      setShowAddPlayerModal(false)
    }
  }

  const handleEditPlayer = (player) => {
    setSelectedPlayer(player)
    setShowPlayerModal(true)
  }

  const handleDeletePlayer = (playerId) => {
    if (confirm('Are you sure you want to delete this player?')) {
      deletePlayer(playerId)
    }
  }

  const renderList = () => {
    if (activeSection === 'players') {
      return (
        <div className="space-y-3">
          {players.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No players added yet</p>
          ) : (
            players.map((player) => {
              const assignments = player.teamAssignments || []
              return (
                <div
                  key={player.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                  onClick={() => handleItemClick(player)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gray-600 border-2 border-gray-500 flex items-center justify-center overflow-hidden">
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.fullName || player.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white font-semibold text-lg">
                            {player.fullName || player.name}
                          </span>
                        </div>
                        {player.email && (
                          <p className="text-gray-400 text-sm mb-2">{player.email}</p>
                        )}
                        {assignments.length > 0 ? (
                          <div className="space-y-2 mt-3">
                            {assignments.map((assignment) => (
                              <div
                                key={assignment.id}
                                className="bg-gray-600 rounded p-2 text-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-white font-medium">
                                      {assignment.teamName || 'Team'}
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                      - {assignment.seasonName || 'Season'}
                                    </span>
                                    {assignment.jerseyNumber && (
                                      <span className="text-blue-400 ml-2">
                                        #{assignment.jerseyNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No team assignments yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )
    }
    
    if (activeSection === 'coaches') {
      return (
        <div className="space-y-3">
          {coaches.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No coaches added yet</p>
          ) : (
            coaches.map((coach) => {
              const assignments = coach.assignments || []
              return (
                <div
                  key={coach.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                  onClick={() => handleItemClick(coach)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold text-lg">
                          {coach.fullName || coach.name}
                        </span>
                      </div>
                      {coach.email && (
                        <p className="text-gray-400 text-sm mb-2">{coach.email}</p>
                      )}
                      {assignments.length > 0 ? (
                        <div className="space-y-2 mt-3">
                          {assignments.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="bg-gray-600 rounded p-2 text-sm"
                            >
                              <span className="text-white font-medium">
                                {assignment.teamName || 'Team'}
                              </span>
                              <span className="text-gray-400 ml-2">
                                - {assignment.seasonName || 'Season'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No team assignments yet</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )
    }
    
    if (activeSection === 'seasons') {
      return (
        <div className="space-y-3">
          {seasons.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No seasons/tournaments added yet</p>
          ) : (
            seasons.map((season) => (
              <div
                key={season.id}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => handleItemClick(season)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold text-lg">
                        {season.name}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">
                        ({season.type || 'season'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )
    }
    
    if (activeSection === 'teams') {
      return (
        <div className="space-y-3">
          {teams.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No teams added yet</p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => handleItemClick(team)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold text-lg">
                        {team.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )
    }
    
    return null
  }

  const getSectionIcon = () => {
    const section = sections.find(s => s.id === activeSection)
    return section ? section.icon : Users
  }

  const getSectionLabel = () => {
    const section = sections.find(s => s.id === activeSection)
    return section ? section.label : 'Items'
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Manage Data</h1>
              <p className="text-gray-400">Manage your players, coaches, seasons, and teams</p>
            </div>
            <button
              onClick={handleAddClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add {getSectionLabel().split('/')[0]}</span>
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                    activeSection === section.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            {React.createElement(getSectionIcon(), { className: "w-6 h-6 text-blue-400" })}
            <h2 className="text-2xl font-bold">{getSectionLabel()}</h2>
          </div>

          {renderList()}
        </div>
      </div>

      {/* Modals */}
      {showModal && selectedItem && (
        <>
          {activeSection === 'players' && (
            <PlayerAssignmentModal
              player={selectedItem}
              onClose={handleCloseModal}
              onDelete={() => {
                handleDelete(selectedItem.id, deletePlayer)
                handleCloseModal()
              }}
            />
          )}
          {activeSection === 'coaches' && (
            <CoachAssignmentModal
              coach={selectedItem}
              onClose={handleCloseModal}
              onDelete={() => {
                handleDelete(selectedItem.id, deleteCoach)
                handleCloseModal()
              }}
            />
          )}
          {activeSection === 'seasons' && (
            <SeasonModal
              season={selectedItem}
              onClose={handleCloseModal}
              onDelete={() => {
                handleDelete(selectedItem.id, deleteSeason)
                handleCloseModal()
              }}
            />
          )}
          {activeSection === 'teams' && (
            <TeamModal
              team={selectedItem}
              onClose={handleCloseModal}
              onDelete={() => {
                handleDelete(selectedItem.id, deleteTeam)
                handleCloseModal()
              }}
            />
          )}
        </>
      )}

      {showAddModal && (
        <>
          {activeSection === 'players' && (
            <PlayerAssignmentModal
              player={null}
              onClose={handleCloseAddModal}
            />
          )}
          {activeSection === 'coaches' && (
            <CoachAssignmentModal
              coach={null}
              onClose={handleCloseAddModal}
            />
          )}
          {activeSection === 'seasons' && (
            <SeasonModal
              season={null}
              onClose={handleCloseAddModal}
            />
          )}
          {activeSection === 'teams' && (
            <TeamModal
              team={null}
              onClose={handleCloseAddModal}
            />
          )}
        </>
      )}
    </div>
  )
}

export default ManageData
