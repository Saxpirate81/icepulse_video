import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'
import { IndividualProvider } from './context/IndividualContext'
import VideoRecorder from './components/VideoRecorder'
import WelcomeScreen from './components/WelcomeScreen'
import AccountMenu from './components/AccountMenu'
import ViewToggle from './components/ViewToggle'
import UserSelector from './components/UserSelector'
import OrganizationalDashboard from './components/OrganizationalDashboard'
import IndividualDashboard from './components/IndividualDashboard'
import StreamViewer from './components/StreamViewer'
import { isTestingEnabled } from './utils/testing'

function AppContent() {
  const { user, isLoading, showLogo } = useAuth()
  const [streamId, setStreamId] = useState(null)

  // Check if we're on a streaming route (no auth required)
  // Do this immediately, before auth loading
  useEffect(() => {
    const checkStreamRoute = () => {
      const path = window.location.pathname
      const match = path.match(/^\/stream\/([a-zA-Z0-9_-]+)$/)
      if (match) {
        setStreamId(match[1])
      }
    }
    
    // Check immediately
    checkStreamRoute()
    
    // Also listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', checkStreamRoute)
    
    return () => {
      window.removeEventListener('popstate', checkStreamRoute)
    }
  }, [])

  // If streaming route, show stream viewer (no auth required - bypass auth check)
  if (streamId) {
    return <StreamViewer streamId={streamId} />
  }

  // Show logo animation only while showLogo is true
  // Once logo animation completes (after 3s), show login screen immediately
  // even if still loading (to avoid gap)
  if (showLogo && !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center transition-opacity duration-500">
        <div className="text-center">
          <div className="logo-flash-container">
            <img
              src="/Logo.png"
              alt="IcePulse Logo"
              className="logo-flash mx-auto object-contain"
              onError={(e) => {
                // Try lowercase if uppercase fails
                if (e.target.src.includes('Logo.png')) {
                  e.target.src = '/logo.png'
                  return
                }
                // Fallback if image doesn't exist - show text logo
                e.target.style.display = 'none'
                const fallback = e.target.nextElementSibling
                if (fallback) fallback.style.display = 'block'
              }}
            />
            <div className="hidden text-6xl font-bold text-blue-400">
              IcePulse
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <WelcomeScreen />
  }

  // Show different dashboard based on account type and role
  // Organization role sees Organizational Dashboard
  if (user.role === 'organization' || (user.type === 'organization' && !user.role)) {
    return (
      <OrgProvider>
        <div className="min-h-screen bg-gray-900">
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            <ViewToggle />
            <UserSelector />
            <AccountMenu />
          </div>
          <OrganizationalDashboard />
        </div>
      </OrgProvider>
    )
  }

  // Coach role sees Coach Dashboard (team view)
  if (user.role === 'coach') {
    return (
      <OrgProvider>
        <div className="min-h-screen bg-gray-900">
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            <ViewToggle />
            <UserSelector />
            <AccountMenu />
          </div>
          <OrganizationalDashboard />
        </div>
      </OrgProvider>
    )
  }

  // Individual account (Player, Parent, Game Recorder, or default individual)
  // For testing mode, wrap in OrgProvider so UserSelector can access organization data
  const USE_TESTING = isTestingEnabled()
  const isTestingRole = user.role === 'player' || user.role === 'parent'
  
  // If testing mode and player/parent role, use OrgProvider so UserSelector works
  if (USE_TESTING && isTestingRole) {
    return (
      <OrgProvider>
        <IndividualProvider>
          <div className="min-h-screen bg-gray-900">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
              <ViewToggle />
              <UserSelector />
              <AccountMenu />
            </div>
            <IndividualDashboard />
          </div>
        </IndividualProvider>
      </OrgProvider>
    )
  }
  
  // Normal mode or non-testing roles
  return (
    <IndividualProvider>
      <div className="min-h-screen bg-gray-900">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <ViewToggle />
          <UserSelector />
          <AccountMenu />
        </div>
        <IndividualDashboard />
      </div>
    </IndividualProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
