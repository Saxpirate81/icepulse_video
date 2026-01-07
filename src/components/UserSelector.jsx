import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOrgOptional } from '../context/OrgContext'
import { USE_MOCK } from '../lib/supabase-mock'
import { mockOrganization } from '../lib/mock-data'
import { User, ChevronDown } from 'lucide-react'
import { isTestingEnabled } from '../utils/testing'

/**
 * User Selector Component (Testing Only)
 * Allows switching between different users in the same role
 * Shows different lists based on current view (player/parent/coach)
 * 
 * Works in both mock mode and real database mode (when testing toggles enabled)
 * 
 * Note: In real database mode, this will use organization data from OrgContext
 * if available. For IndividualProvider views, it will be empty (can be enhanced later).
 */
function UserSelector() {
  const { user, setUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  
  // Get organization from context (will be null if not in OrgProvider - that's okay)
  const orgContext = useOrgOptional()
  const organization = orgContext?.organization || null

  // Only show in mock mode or testing mode
  const USE_TESTING = USE_MOCK || isTestingEnabled()
  
  // Debug logging
  console.log('🔍 UserSelector Debug:', {
    USE_MOCK,
    USE_TESTING,
    userRole: user?.role,
    hasUser: !!user,
    hasOrgContext: !!orgContext,
    hasOrganization: !!organization,
    organizationId: organization?.id,
    organizationName: organization?.name
  })
  
  if (!USE_TESTING) return null

  // Only show for player, parent, or coach views
  if (!user || (user.role !== 'player' && user.role !== 'parent' && user.role !== 'coach')) return null

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Get the appropriate list based on role
  // In mock mode: use mockOrganization
  // In real mode: use organization from context, or fetch directly if not available
  const getUsersList = () => {
    // In mock mode, always use mockOrganization
    if (USE_MOCK) {
      const org = mockOrganization
      if (user.role === 'player') {
        return org.players || []
      } else if (user.role === 'parent') {
        return org.parents || []
      } else if (user.role === 'coach') {
        return org.coaches || []
      }
      return []
    }
    
    // In real mode, try to get from organization context first
    if (organization) {
      if (user.role === 'player') {
        return organization.players || []
      } else if (user.role === 'parent') {
        return organization.parents || []
      } else if (user.role === 'coach') {
        return organization.coaches || []
      }
      return []
    }
    
    // If organization not available (e.g., in IndividualProvider), 
    // we need to fetch it directly for testing purposes
    // For now, return empty - will be enhanced to fetch from database
    console.warn('UserSelector: Organization not available in context. Cannot show user list.')
    return []
  }

  const usersList = getUsersList()
  
  console.log('🔍 UserSelector: Users list:', {
    role: user.role,
    usersListLength: usersList.length,
    usersList: usersList.map(u => ({ id: u.id, name: u.fullName || u.name }))
  })

  // Get current user from list
  const getCurrentUserFromList = () => {
    const savedUserId = localStorage.getItem(`mock_${user.role}_id`) || localStorage.getItem(`test_${user.role}_id`)
    if (savedUserId) {
      return usersList.find(u => u.id === savedUserId) || usersList[0]
    }
    // Try to find by current user ID
    return usersList.find(u => u.id === user.id) || usersList[0]
  }

  const currentUser = getCurrentUserFromList()
  
  console.log('🔍 UserSelector: Current user from list:', currentUser)

  const handleUserChange = (selectedUser) => {
    if (selectedUser && setUser) {
      // Save selected user ID to localStorage (works for both mock and real)
      const storageKey = USE_MOCK ? `mock_${user.role}_id` : `test_${user.role}_id`
      localStorage.setItem(storageKey, selectedUser.id)
      
      setUser({
        ...user,
        id: selectedUser.id,
        email: selectedUser.email || user.email,
        name: selectedUser.fullName || selectedUser.name || user.name
      })
      
      // Reload to show that user's data
      setTimeout(() => {
        window.location.reload()
      }, 100)
    }
    setIsOpen(false)
  }

  // Always show the selector button in testing mode, even if org is still loading.
  // This prevents "missing UI" confusion.
  const isOrgLoading = !USE_MOCK && (!orgContext || orgContext?.isLoading || !organization)
  if (isOrgLoading) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          disabled
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg transition-colors border border-gray-700 opacity-70 cursor-not-allowed"
          title="Loading organization data..."
        >
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm font-medium hidden sm:block">Loading…</span>
          <ChevronDown className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    )
  }

  if (usersList.length === 0) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          disabled
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg transition-colors border border-gray-700 opacity-70 cursor-not-allowed"
          title={`No ${user.role}s found`}
        >
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300 text-sm font-medium hidden sm:block">
            No {user.role}s
          </span>
          <ChevronDown className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600"
        title={`Switch ${user.role} (Testing)`}
      >
        <User className="w-4 h-4 text-blue-400" />
        <span className="text-white text-sm font-medium hidden sm:block truncate max-w-[120px]">
          {currentUser?.fullName || currentUser?.name || `Select ${user.role}`}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50 max-h-96 overflow-auto">
          <div className="p-2">
            <div className="text-gray-400 text-xs px-3 py-2 mb-1 border-b border-gray-700">
              Select {user.role.charAt(0).toUpperCase() + user.role.slice(1)} (Testing)
            </div>
            {usersList.map((listUser) => {
              const isActive = user.id === listUser.id
              const displayName = listUser.fullName || listUser.name || 'Unknown'
              
              return (
                <button
                  key={listUser.id}
                  onClick={() => handleUserChange(listUser)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-blue-900 bg-opacity-30 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <User className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span className="font-medium flex-1 truncate">{displayName}</span>
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

export default UserSelector
