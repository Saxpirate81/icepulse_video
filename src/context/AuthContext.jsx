import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createProfileManually, checkUserProfile } from '../lib/supabase-admin'

const AuthContext = createContext(null)

// Helper function to check testing toggles (check at runtime, not module load time)
const isTestingTogglesEnabled = () => {
  // Check multiple ways to ensure we get the value
  const envValue = import.meta.env.VITE_ENABLE_TESTING_TOGGLES
  return envValue === 'true' || envValue === true
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showLogo, setShowLogo] = useState(true)

  // Check for existing session on mount and listen for auth changes
  useEffect(() => {
    // MOCK MODE: Load user directly from localStorage
    const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'
    
    let subscription = null
    
    if (USE_MOCK) {
      // In mock mode, load user from localStorage
      import('../lib/mock-data.js').then(({ getMockUser }) => {
        const mockUserData = getMockUser()
        const userData = {
          id: mockUserData.id,
          email: mockUserData.email,
          name: mockUserData.name,
          type: mockUserData.account_type,
          role: mockUserData.role,
          avatar_url: null,
        }
        setUser(userData)
        setIsLoading(false)
      })
      // Create a dummy subscription for mock mode
      subscription = {
        unsubscribe: () => {}
      }
    } else {
      // Normal mode: Get initial session with shorter timeout to prevent hanging
      // Use a more aggressive timeout since Supabase might be down
      const sessionTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session check timeout')), 8000) // 8 seconds - faster timeout
      )
      
      // Also set a maximum loading time - always stop loading after 10 seconds
      const maxLoadingTimeout = setTimeout(() => {
        console.warn('⚠️ Maximum loading time reached - continuing without auth')
        setIsLoading(false)
      }, 10000)
      
      Promise.race([
        supabase.auth.getSession(),
        sessionTimeout
      ]).then(({ data: { session } }) => {
        clearTimeout(maxLoadingTimeout)
        if (session) {
          loadUserProfile(session.user.id).catch((error) => {
            // Don't log as error - timeout is expected if Supabase is slow
            console.warn('⚠️ Could not load user profile (Supabase may be slow):', error.message || error)
            setIsLoading(false)
          })
        } else {
          setIsLoading(false)
        }
      }).catch((error) => {
        clearTimeout(maxLoadingTimeout)
        // Don't log as error - timeout is expected if Supabase is slow
        // App can continue without session (e.g., for stream viewing)
        console.warn('⚠️ Session check failed (Supabase may be slow):', error.message || error)
        setIsLoading(false)
      })
      
      // Also check for testing role override on mount (in case user refreshed)
      const testingTogglesEnabled = import.meta.env.VITE_ENABLE_TESTING_TOGGLES === 'true'
      if (testingTogglesEnabled) {
        const testRole = localStorage.getItem('mock_user_role')
        if (testRole && ['organization', 'coach', 'player', 'parent'].includes(testRole)) {
          console.log('🔍 Testing mode: Found role override in localStorage:', testRole)
        }
      }

      // Listen for auth state changes
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          loadUserProfile(session.user.id)
        } else {
          setUser(null)
          setIsLoading(false)
        }
      })
      subscription = sub
    }

    // Hide logo after animation: 1.5s bounce + 1s hold + 0.5s fade = 3s total
    const timer = setTimeout(() => {
      setShowLogo(false)
    }, 3000)

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
      clearTimeout(timer)
    }
  }, [])

  // Helper function to add timeout to a promise (increased for slow connections)
  const withTimeout = (promise, timeoutMs = 15000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ])
  }

  // Load user profile from database
  const loadUserProfile = async (userId) => {
    try {
      // MOCK MODE: Use localStorage role if available
      const { USE_MOCK } = await import('../lib/supabase-mock')
      if (USE_MOCK) {
        const { getMockUser } = await import('../lib/mock-data')
        const mockUserData = getMockUser()
        const userData = {
          id: mockUserData.id,
          email: mockUserData.email,
          name: mockUserData.name,
          type: mockUserData.account_type,
          role: mockUserData.role,
          avatar_url: null,
        }
        setUser(userData)
        setIsLoading(false)
        return true
      }

      // First check if we have a session (with timeout)
      let session = null
      try {
        const { data } = await withTimeout(supabase.auth.getSession())
        session = data?.session
      } catch (timeoutError) {
        console.warn('⚠️ Session check timeout - Supabase may be slow. Continuing without session...')
        setIsLoading(false)
        // Allow app to continue - stream viewing doesn't need auth
        return false
      }
      
      if (!session) {
        console.warn('No session available to load profile')
        setIsLoading(false)
        return false
      }
      
      // Load profile with timeout
      let profile = null
      let error = null
      try {
        const result = await withTimeout(
          supabase
            .from('icepulse_profiles')
            .select('*')
            .eq('id', userId)
            .single()
        )
        profile = result.data
        error = result.error
      } catch (timeoutError) {
        console.warn('⚠️ Profile load timeout - Supabase may be slow. Continuing without profile...')
        setIsLoading(false)
        // Allow app to continue - some features work without profile (e.g., stream viewing)
        return false
      }

      if (error) {
        // If it's a "no rows" error, the profile might not exist or RLS is blocking
        if (error.code === 'PGRST116') {
          console.warn('Profile not found or RLS blocking access:', error.message)
        } else {
          console.error('Error loading profile:', error)
        }
        setIsLoading(false)
        return false
      }

      if (profile) {
        // Check if testing toggles are enabled and override role from localStorage
        // Check at runtime to avoid module loading timing issues
        const testingTogglesEnabled = isTestingTogglesEnabled()
        let role = profile.role
        let accountType = profile.account_type
        
        // ALWAYS log this to debug
        const envVar = import.meta.env.VITE_ENABLE_TESTING_TOGGLES
        const testRole = localStorage.getItem('mock_user_role')
        const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV
        
        console.log('🔍 loadUserProfile - Testing mode check:', { 
          testingTogglesEnabled,
          envVar,
          envVarType: typeof envVar,
          isDev,
          profileRole: profile.role,
          localStorageValue: testRole,
          allLocalStorage: Object.keys(localStorage).filter(k => k.includes('mock') || k.includes('test'))
        })
        
        // Only override role if testing toggles are EXPLICITLY enabled
        // Don't override based on dev mode alone - this causes issues when logging in directly
        if (testingTogglesEnabled) {
          console.log('🔍 Testing mode check:', { 
            enabled: testingTogglesEnabled, 
            isDev,
            testRole, 
            profileRole: profile.role,
            localStorage: testRole
          })
          if (testRole && ['organization', 'coach', 'player', 'parent'].includes(testRole)) {
            role = testRole
            accountType = testRole === 'organization' ? 'organization' : 'individual'
            console.log('✅ Testing mode: Overriding role from', profile.role, 'to', role)
          } else {
            console.log('⚠️ Testing mode: No valid role override found in localStorage. testRole:', testRole)
          }
        } else {
          // Clear any stale testing role from localStorage when not in testing mode
          if (testRole && isDev) {
            console.log('🧹 Clearing stale testing role from localStorage:', testRole)
            localStorage.removeItem('mock_user_role')
          }
          console.log('ℹ️ Testing toggles not enabled, using profile role:', profile.role)
        }
        
        // Map profile to user object format expected by app
        const userData = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          type: accountType,
          role: role,
          avatar_url: profile.avatar_url,
        }
        console.log('🔍 Setting user data:', { role: userData.role, type: userData.type })
        setUser(userData)
        setIsLoading(false) // Important: set loading to false when profile is loaded
        return true
      }
      
      // No profile found
      setIsLoading(false)
      return false
    } catch (error) {
      console.error('Error loading user profile:', error)
      setIsLoading(false)
      return false
    }
  }

  const login = async (email, password) => {
    try {
      // Normalize email (trim and lowercase) for consistent login
      const normalizedEmail = email.trim().toLowerCase()
      console.log('[login] Attempting login with:', { email: normalizedEmail, passwordLength: password.length })
      
      // Add timeout to login request to prevent hanging (increased timeout for slow connections)
      const loginPromise = supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timed out. Please check your internet connection and try again.')), 30000)
      )
      
      const { data, error } = await Promise.race([loginPromise, timeoutPromise])

      if (error) {
        console.error('[login] Login error:', {
          message: error.message,
          status: error.status,
          name: error.name
        })
        
        // Handle CORS/network errors
        if (error.message?.includes('Failed to fetch') || 
            error.message?.includes('CORS') || 
            error.status === 0 ||
            error.name === 'AuthRetryableFetchError') {
          return { 
            success: false, 
            message: 'Unable to connect to server. This may be a temporary network issue. Please check your internet connection and try again in a few moments.' 
          }
        }
        
        // Provide more helpful error messages
        if (error.message?.includes('Invalid login credentials') || error.message?.includes('Invalid login')) {
          return { success: false, message: `Invalid email or password. Please check your credentials and try again.\n\nEmail used: ${normalizedEmail}\nPassword: ${password === 'password' ? 'password (testing)' : '***'}` }
        }
        if (error.message?.includes('Email not confirmed')) {
          return { success: false, message: 'Please check your email and confirm your account before logging in.' }
        }
        return { success: false, message: error.message || 'Login failed' }
      }

      if (data.user) {
        const profileLoaded = await loadUserProfile(data.user.id)
        if (profileLoaded && user) {
          return { success: true, user: user }
        } else {
          // User exists but profile couldn't be loaded
          // This might be an RLS issue or profile doesn't exist - try using admin client to verify/create
          const { checkUserProfile, createProfileManually } = await import('../lib/supabase-admin')
          const { data: adminProfile, error: adminError } = await checkUserProfile(data.user.id)
          
          if (adminProfile) {
            // Profile exists but RLS is blocking - try loading again after a delay
            console.log('[login] Profile exists but RLS blocked, retrying...')
            await new Promise(resolve => setTimeout(resolve, 500))
            const retryLoaded = await loadUserProfile(data.user.id)
            if (retryLoaded && user) {
              return { success: true, user: user }
            }
            return { 
              success: false, 
              message: 'Login successful but profile access is blocked. Please contact support or check database configuration.' 
            }
          } else {
            // Profile doesn't exist - create it
            console.warn('[login] Profile not found, creating it...')
            const { data: newProfile, error: createError } = await createProfileManually({
              id: data.user.id,
              email: data.user.email || normalizedEmail,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
              account_type: data.user.user_metadata?.account_type || 'individual',
              role: data.user.user_metadata?.role || 'player'
            })
            
            if (newProfile && !createError) {
              console.log('[login] Profile created successfully, loading...')
              await new Promise(resolve => setTimeout(resolve, 500))
              const retryLoaded = await loadUserProfile(data.user.id)
              if (retryLoaded && user) {
                return { success: true, user: user }
              }
            }
            
            return { 
              success: false, 
              message: 'Login successful but profile not found. Please contact support.' 
            }
          }
        }
      }

      return { success: false, message: 'Login failed - no user data returned' }
    } catch (error) {
      console.error('Login error:', error)
      
      // Handle timeout and network errors
      if (error.message?.includes('timed out') || 
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('CORS') ||
          error.name === 'AuthRetryableFetchError') {
        return { 
          success: false, 
          message: 'Unable to connect to server. This may be a temporary network issue. Please check your internet connection and try again in a few moments.' 
        }
      }
      
      return { success: false, message: error.message || 'An error occurred during login' }
    }
  }

  const signup = async (email, password, accountType) => {
    try {
      // Set default role based on account type
      let defaultRole = 'player'
      if (accountType === 'organization') {
        defaultRole = 'organization'
      }

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: email.split('@')[0],
            account_type: accountType,
            role: defaultRole,
          },
        },
      })

      // Check if user was created even if email confirmation failed
      if (data.user) {
        // Check if we have a session (email confirmation might be disabled)
        const hasSession = data.session !== null
        
        // Profile should be created automatically by the trigger
        // Wait a moment for the trigger to execute and for linking trigger to run
        // The linking trigger (on_profile_created_link_records) runs after profile creation
        // and links the user to any existing player/coach/parent records by email
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // If we have a session, try to load the profile immediately
        let profileLoaded = false
        if (hasSession) {
          // Try to load the profile - wait a bit longer for triggers to complete
          await new Promise(resolve => setTimeout(resolve, 500))
          profileLoaded = await loadUserProfile(data.user.id)
          
          // If profile loaded successfully, we're done!
          if (profileLoaded && user) {
            return { success: true, user: user }
          }
        }
        
        // If profile still doesn't exist after trigger (or no session), try to create it manually using admin client
        if (!profileLoaded) {
          // Wait a bit more for trigger if we have a session
          if (hasSession) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            profileLoaded = await loadUserProfile(data.user.id)
          }
          
          if (!profileLoaded) {
            console.warn('Profile not found after signup - attempting to create manually via admin client')
            try {
              // Use admin client to create profile as fallback
              const { data: profileData, error: createError } = await createProfileManually({
                id: data.user.id,
                email: data.user.email || email,
                name: email.split('@')[0],
                account_type: accountType,
                role: defaultRole,
              })
              
              // Handle duplicate key error - means trigger already created it
              if (createError && createError.code === '23505') {
                console.log('Profile already exists (trigger created it) - verifying...')
                // Profile exists, verify it and proceed
                const { data: verifyData, error: verifyError } = await checkUserProfile(data.user.id)
                
                if (verifyData && !verifyError) {
                  console.log('Profile verified - exists in database')
                  // Profile exists, try to load it if we have a session
                  if (hasSession) {
                    profileLoaded = await loadUserProfile(data.user.id)
                    if (profileLoaded && user) {
                      return { success: true, user: user }
                    }
                  }
                  // Profile exists but no session (email confirmation required)
                  return { 
                    success: true, 
                    user: null,
                    message: hasSession 
                      ? 'Account created successfully! Please log in to continue.' 
                      : 'Account created! Please check your email to confirm your account, then log in.'
                  }
                }
              }
              
              if (createError) {
                console.error('Failed to create profile manually:', createError)
                // Check if profile exists anyway (trigger might have created it)
                const { data: verifyData, error: verifyError } = await checkUserProfile(data.user.id)
                
                if (verifyData && !verifyError) {
                  // Profile exists! Trigger worked
                  console.log('Profile exists (created by trigger)')
                  if (hasSession) {
                    profileLoaded = await loadUserProfile(data.user.id)
                    if (profileLoaded && user) {
                      return { success: true, user: user }
                    }
                  }
                  return { 
                    success: true, 
                    user: null,
                    message: hasSession 
                      ? 'Account created successfully! Please log in to continue.' 
                      : 'Account created! Please check your email to confirm your account, then log in.'
                  }
                }
                
                return { 
                  success: false, 
                  message: `Account created but profile setup failed: ${createError.message}. Please check your .env file has VITE_SUPABASE_SERVICE_ROLE_KEY set, or check database configuration.` 
                }
              }
              
              // Profile was created successfully
              console.log('Profile created successfully by admin client')
              
              // Verify and try to load if we have a session
              if (hasSession) {
                profileLoaded = await loadUserProfile(data.user.id)
                if (profileLoaded && user) {
                  return { success: true, user: user }
                }
              }
              
              // Profile exists but can't load yet (no session = email confirmation required)
              return { 
                success: true, 
                user: null,
                message: hasSession 
                  ? 'Account created successfully! Please log in to continue.' 
                  : 'Account created! Please check your email to confirm your account, then log in.'
              }
            } catch (adminErr) {
              console.error('Admin profile creation error:', adminErr)
              return { 
                success: false, 
                message: `Account created but profile setup failed: ${adminErr.message}. Please ensure VITE_SUPABASE_SERVICE_ROLE_KEY is set in your .env file.` 
              }
            }
          }
        }

        // If no session, email confirmation is likely required
        if (!hasSession) {
          return { 
            success: true, 
            user: null,
            message: 'Account created! Please check your email to confirm your account, then log in.',
            requiresConfirmation: true
          }
        }

        // If we successfully loaded the profile, return success with user
        if (profileLoaded && user) {
          return { success: true, user: user }
        }
        
        // Profile exists but couldn't be loaded (might need to log in)
        return { 
          success: true, 
          user: null,
          message: 'Account created successfully! Please log in to continue.' 
        }
      }

      // If there's an error and no user was created
      if (error) {
        console.error('Supabase signup error:', error)
        
        // Check if it's just an email confirmation error
        if (error.message?.includes('confirmation email') || error.message?.includes('Error sending')) {
          return { 
            success: false, 
            message: 'Account may have been created but email confirmation failed. Please check your email settings in Supabase or try logging in directly.' 
          }
        }
        
        return { success: false, message: error.message || 'Signup failed. Please check if the database schema has been set up.' }
      }

      return { success: false, message: 'Signup failed - no user data returned' }
    } catch (error) {
      console.error('Signup error:', error)
      return { 
        success: false, 
        message: error.message || 'An error occurred during signup. Please ensure the database schema has been set up.' 
      }
    }
  }

  const updateUserRole = async (newRole) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('icepulse_profiles')
        .update({ role: newRole })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating role:', error)
        return { success: false, message: error.message }
      }

      // Reload profile to get updated data
      await loadUserProfile(user.id)
      return { success: true, user: user }
    } catch (error) {
      console.error('Error updating role:', error)
      return { success: false, message: 'An error occurred' }
    }
  }

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return { success: true, message: 'Password reset email sent' }
    } catch (error) {
      console.error('Password reset error:', error)
      return { success: false, message: 'An error occurred' }
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setShowLogo(true)
      // Hide logo after animation: 1.5s bounce + 1s hold + 0.5s fade = 3s total
      setTimeout(() => {
        setShowLogo(false)
      }, 3000)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value = {
    user,
    setUser,
    isLoading,
    showLogo,
    setShowLogo,
    login,
    signup,
    resetPassword,
    logout,
    updateUserRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
