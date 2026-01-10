import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, User, Building2, ArrowRight, LogIn } from 'lucide-react'

function WelcomeScreen() {
  const { login, signup, resetPassword, showLogo, setShowLogo } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountType, setAccountType] = useState('individual')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  // Start showing login screen immediately (will fade in when showLogo becomes false)
  const [showLoginScreen, setShowLoginScreen] = useState(true)

  // Handle logo fade out and login screen fade in
  useEffect(() => {
    if (showLogo) {
      // Start showing login screen earlier for seamless transition
      // Logo animation: 1.5s flash + 1s hold + 0.5s fade = 3s total
      // Logo starts fading at 2.5s, so start login fade-in at 1.8s
      // This ensures login screen is fully visible (1.8s + 0.6s = 2.4s) before logo fully fades (3s)
      const showLoginTimer = setTimeout(() => {
        setShowLoginScreen(true)
      }, 1800)
      
      return () => {
        clearTimeout(showLoginTimer)
      }
    } else {
      // Once logo is hidden, ensure login screen is visible immediately (no delay)
      setShowLoginScreen(true)
    }
  }, [showLogo])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    try {
      const result = await login(email, password)
      if (!result.success) {
        setError(result.message || 'Login failed')
      }
    } catch (err) {
      setError('An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const result = await signup(email, password, accountType)
      if (!result.success) {
        setError(result.message || 'Signup failed')
      }
    } catch (err) {
      setError('An error occurred during signup')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!email) {
      setError('Please enter your email')
      setLoading(false)
      return
    }

    try {
      const result = await resetPassword(email)
      if (result.success) {
        setResetEmailSent(true)
      } else {
        setError(result.message || 'Failed to send reset email')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (showLogo) {
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

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className={`bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-xl ${showLoginScreen ? 'login-screen-fade-in' : 'opacity-0'}`}>
          <h2 className="text-2xl font-bold mb-6 text-center">Reset Password</h2>
          
          {resetEmailSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-300 mb-4">
                Password reset instructions have been sent to <strong className="text-white">{email}</strong>
              </p>
              <button
                onClick={() => {
                  setShowForgotPassword(false)
                  setResetEmailSent(false)
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="bg-red-900 bg-opacity-50 border border-red-500 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                    className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setError('')
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className={`bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-xl ${showLoginScreen ? 'login-screen-fade-in' : 'opacity-0'}`}>
        <div className="text-center mb-8">
          <img
            src="/Logo.png"
            alt="IcePulse Logo"
            className="w-32 h-32 mx-auto mb-4 object-contain"
            onError={(e) => {
              // Try lowercase if uppercase fails
              if (e.target.src.includes('Logo.png')) {
                e.target.src = '/logo.png'
                return
              }
              e.target.style.display = 'none'
              const fallback = e.target.nextElementSibling
              if (fallback) fallback.style.display = 'block'
            }}
          />
          <div className="hidden text-4xl font-bold text-blue-400 mb-2">
            IcePulse
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-400">
            {isLogin ? 'Sign in to continue' : 'Get started with IcePulse'}
          </p>
        </div>

        {!isLogin && (
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType('individual')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  accountType === 'individual'
                    ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                }`}
              >
                <User className={`w-5 h-5 ${accountType === 'individual' ? 'text-white' : 'text-gray-300'}`} />
                <span className="font-semibold">Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType('organization')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  accountType === 'organization'
                    ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500 text-gray-200'
                }`}
              >
                <Building2 className={`w-5 h-5 ${accountType === 'organization' ? 'text-white' : 'text-gray-300'}`} />
                <span className="font-semibold">Organization</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
          {error && (
            <div className="bg-red-900 bg-opacity-50 border border-red-500 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="your@email.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-gray-300 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          )}

          {isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                {isLogin ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    Create Account
                  </>
                )}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setPassword('')
              setConfirmPassword('')
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isLogin ? (
              <>
                Don't have an account? <span className="text-blue-400 font-semibold">Sign up</span>
              </>
            ) : (
              <>
                Already have an account? <span className="text-blue-400 font-semibold">Sign in</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WelcomeScreen
