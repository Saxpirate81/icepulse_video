import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { User, LogOut, ChevronDown } from 'lucide-react'

function AccountMenu() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

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

  const handleLogout = () => {
    logout()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-medium hidden sm:block">
          {user?.name || user?.email?.split('@')[0] || 'Account'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-gray-400 text-sm truncate">{user?.email}</p>
                <p className="text-gray-500 text-xs mt-1 capitalize">
                  {user?.role ? `${user.role} (${user.type || 'individual'})` : (user?.type || 'individual')}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900 hover:bg-opacity-30 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-semibold">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountMenu
