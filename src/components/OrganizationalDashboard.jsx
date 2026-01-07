import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOrg } from '../context/OrgContext'
import { hasPermission } from '../utils/permissions'
import { Building2, Users, Calendar, UserCheck, UserPlus, Settings, ChevronDown, CalendarDays, Video } from 'lucide-react'
import OrgSetup from './OrgSetup'
import TeamManagement from './TeamManagement'
import SeasonManagement from './SeasonManagement'
import CoachManagement from './CoachManagement'
import PlayerManagement from './PlayerManagement'
import ParentManagement from './ParentManagement'
import GameManagement from './GameManagement'
import GameVideoViewer from './GameVideoViewer'
import VideoRecorder from './VideoRecorder'
import Dropdown from './Dropdown'

function OrganizationalDashboard() {
  const { user } = useAuth()
  const { organization, organizations, selectedOrgId, switchOrganization, saveOrganization, databaseError, clearDatabaseError } = useOrg()
  const [activeTab, setActiveTab] = useState('setup')

  // Initialize organization if it doesn't exist
  useEffect(() => {
    if (!organization && user) {
      saveOrganization({
        name: '',
        teams: [],
        seasons: [],
        coaches: [],
        players: [],
        parents: []
      })
    }
  }, [organization, user, saveOrganization])

  // Filter tabs based on user permissions
  const allTabs = [
    { id: 'setup', label: 'Setup', icon: Settings, permission: 'edit_organization' },
    { id: 'teams', label: 'Teams', icon: Users, permission: 'manage_teams' },
    { id: 'seasons', label: 'Seasons/Tournaments', icon: Calendar, permission: 'manage_seasons' },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays, permission: 'manage_games' },
    { id: 'recorder', label: 'Recorder', icon: Video, permission: 'record_video' },
    { id: 'videos', label: 'Event Videos', icon: Video, permission: 'view_videos' },
    { id: 'coaches', label: 'Coaches', icon: UserCheck, permission: 'manage_coaches' },
    { id: 'players', label: 'Players', icon: UserPlus, permission: 'manage_players' },
    { id: 'parents', label: 'Parents', icon: Building2, permission: 'manage_parents' },
  ]

  const tabs = user ? allTabs.filter(tab => hasPermission(user, tab.permission)) : []
  
  // Set default tab to first available tab if current tab is not accessible
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(tab => tab.id === activeTab)) {
      setActiveTab(tabs[0].id)
    } else if (tabs.length > 0 && activeTab === 'setup' && !tabs.find(tab => tab.id === 'setup')) {
      // If setup tab is not available, set to first available tab
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  // Show loading if organization is not initialized yet
  if (!organization || !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  // Organization switcher options
  const orgOptions = organizations.map(org => ({
    value: org.id,
    label: `${org.name}${org.accessType === 'owner' ? ' (Owner)' : ` (${org.role})`}`
  }))

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Database Error Banner */}
        {databaseError && (
          <div className="mb-4 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-yellow-400">⚠️</span>
              <p className="text-yellow-200">{databaseError}</p>
            </div>
            <button
              onClick={clearDatabaseError}
              className="text-yellow-400 hover:text-yellow-300 px-3 py-1 rounded hover:bg-yellow-900 bg-opacity-20"
            >
              Dismiss
            </button>
          </div>
        )}
        
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Organizational Dashboard</h1>
              <p className="text-gray-400">Manage your organization, teams, and members</p>
            </div>
            {/* Organization Switcher - only show if user is part of multiple orgs */}
            {organizations && organizations.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Organization:</span>
                <div className="w-64">
                  <Dropdown
                    options={orgOptions}
                    value={selectedOrgId || organization?.id || ''}
                    onChange={(orgId) => {
                      if (orgId && orgId !== selectedOrgId) {
                        switchOrganization(orgId)
                      }
                    }}
                    placeholder="Select organization..."
                    multiple={false}
                    showAllOption={false}
                  />
                </div>
              </div>
            )}
          </div>
          {/* Show current organization info if user is a member (not owner) */}
          {organization && !organization.isOwner && (
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-300">
                You are viewing <strong>{organization.name}</strong> as a <strong>{organization.userRoleInOrg}</strong>.
                {organization.isOwner ? ' You have full access.' : ' Some features may be limited based on your role.'}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="border-b border-gray-700 mb-6">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab Content */}
        {tabs.length > 0 && (
          <div>
            {activeTab === 'setup' && tabs.find(t => t.id === 'setup') && <OrgSetup />}
            {activeTab === 'teams' && tabs.find(t => t.id === 'teams') && <TeamManagement />}
            {activeTab === 'seasons' && tabs.find(t => t.id === 'seasons') && <SeasonManagement />}
            {activeTab === 'schedule' && tabs.find(t => t.id === 'schedule') && <GameManagement />}
            {activeTab === 'recorder' && tabs.find(t => t.id === 'recorder') && <VideoRecorder />}
            {activeTab === 'videos' && tabs.find(t => t.id === 'videos') && <GameVideoViewer />}
            {activeTab === 'coaches' && tabs.find(t => t.id === 'coaches') && <CoachManagement />}
            {activeTab === 'players' && tabs.find(t => t.id === 'players') && <PlayerManagement />}
            {activeTab === 'parents' && tabs.find(t => t.id === 'parents') && <ParentManagement />}
          </div>
        )}

        {tabs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No permissions available. Please contact your administrator.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrganizationalDashboard
