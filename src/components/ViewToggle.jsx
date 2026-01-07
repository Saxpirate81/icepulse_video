import { useState } from 'react'
import React from 'react'
import { useAuth } from '../context/AuthContext'
import { USE_MOCK } from '../lib/supabase-mock'
import { Users, UserCheck, UserPlus, Building2 } from 'lucide-react'
import { isTestingEnabled } from '../utils/testing'

/**
 * View Toggle Component (Testing Only)
 * Allows switching between different user role views in mock mode
 */
function ViewToggle() {
  const { user, setUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  // Show in mock mode or if testing toggles are enabled
  const USE_TESTING = USE_MOCK || isTestingEnabled()
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 ViewToggle Debug:', {
      USE_MOCK,
      VITE_ENABLE_TESTING_TOGGLES: import.meta.env.VITE_ENABLE_TESTING_TOGGLES,
      'import.meta.env keys': Object.keys(import.meta.env).filter(k => k.includes('TESTING')),
      USE_TESTING,
      user: user?.role,
      'All VITE_ vars': Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
    })
  }
  
  if (!USE_TESTING) return null

  const views = [
    { role: 'organization', label: 'Organization', icon: Building2, colorClass: 'blue' },
    { role: 'coach', label: 'Coach', icon: UserCheck, colorClass: 'green' },
    { role: 'player', label: 'Player', icon: UserPlus, colorClass: 'yellow' },
    { role: 'parent', label: 'Parent', icon: Users, colorClass: 'purple' }
  ]

  const currentView = views.find(v => v.role === user?.role) || views[0]

  const handleViewChange = (newRole) => {
    if (user && setUser) {
      console.log('🔄 ViewToggle: Changing role from', user.role, 'to', newRole)
      
      // Save selected role to localStorage (for testing mode)
      localStorage.setItem('mock_user_role', newRole)
      console.log('💾 ViewToggle: Saved to localStorage:', localStorage.getItem('mock_user_role'))
      
      // Update user state immediately (no reload needed - let React handle the view change)
      setUser({
        ...user,
        role: newRole,
        type: newRole === 'organization' ? 'organization' : 'individual',
        account_type: newRole === 'organization' ? 'organization' : 'individual'
      })
      console.log('👤 ViewToggle: Updated user state to role:', newRole)
      
      // Small delay to ensure localStorage is saved, then reload to switch views properly
      setTimeout(() => {
        console.log('🔄 ViewToggle: Reloading page...')
        window.location.reload()
      }, 100)
    }
    setIsOpen(false)
  }

  const getColorClasses = (view, isActive) => {
    const colorMap = {
      blue: isActive ? 'bg-blue-900 bg-opacity-30 text-blue-400' : 'text-gray-300',
      green: isActive ? 'bg-green-900 bg-opacity-30 text-green-400' : 'text-gray-300',
      yellow: isActive ? 'bg-yellow-900 bg-opacity-30 text-yellow-400' : 'text-gray-300',
      purple: isActive ? 'bg-purple-900 bg-opacity-30 text-purple-400' : 'text-gray-300'
    }
    return colorMap[view.colorClass] || 'text-gray-300'
  }

  const getIconColorClasses = (view, isActive) => {
    const colorMap = {
      blue: isActive ? 'text-blue-400' : 'text-gray-400',
      green: isActive ? 'text-green-400' : 'text-gray-400',
      yellow: isActive ? 'text-yellow-400' : 'text-gray-400',
      purple: isActive ? 'text-purple-400' : 'text-gray-400'
    }
    return colorMap[view.colorClass] || 'text-gray-400'
  }

  const getButtonIconColor = (view) => {
    const colorMap = {
      blue: 'text-blue-400',
      green: 'text-green-400',
      yellow: 'text-yellow-400',
      purple: 'text-purple-400'
    }
    return colorMap[view.colorClass] || 'text-gray-400'
  }

  const CurrentIcon = currentView.icon

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600"
        title="Switch View (Testing)"
      >
        <CurrentIcon className={`w-4 h-4 ${getButtonIconColor(currentView)}`} />
        <span className="text-white text-sm font-medium hidden sm:block">
          {currentView.label}
        </span>
        <span className="text-gray-400 text-xs">View</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="p-2">
            <div className="text-gray-400 text-xs px-3 py-2 mb-1 border-b border-gray-700">
              Switch View (Testing)
            </div>
            {views.map((view) => {
              const Icon = view.icon
              const isActive = user?.role === view.role
              return (
                <button
                  key={view.role}
                  onClick={() => handleViewChange(view.role)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? getColorClasses(view, true)
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${getIconColorClasses(view, isActive)}`} />
                  <span className="font-medium">{view.label}</span>
                  {isActive && (
                    <span className="ml-auto text-xs text-gray-500">Current</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewToggle
