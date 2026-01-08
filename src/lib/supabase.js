import { createClient } from '@supabase/supabase-js'
import { createMockSupabaseClient, USE_MOCK } from './supabase-mock.js'

// Check if we should use mock data
let supabase

if (USE_MOCK) {
  console.warn('⚠️ MOCK MODE: Using mock Supabase client (database unavailable)')
  supabase = createMockSupabaseClient()
} else {
  // Get Supabase URL and anon key from environment variables
  // You'll need to set these in your .env file or Vercel environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Debug: Log available env vars (only in dev or if missing)
  if (!supabaseUrl || !supabaseAnonKey) {
    const availableVars = Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
    console.error('❌ Missing Supabase environment variables')
    console.error('Available VITE_ vars:', availableVars)
    console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing')
    console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Missing')
    console.error('Environment mode:', import.meta.env.MODE)
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel project settings (Settings → Environment Variables). ' +
      'Make sure they are set for Production, Preview, and Development environments.'
    )
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Don't auto-refresh on mount if it's causing issues
      // The app will handle session refresh manually if needed
    }
  })
  
  // Suppress token refresh errors to prevent console spam
  // These are non-critical - app can work without fresh tokens
  const originalOnAuthStateChange = supabase.auth.onAuthStateChange
  supabase.auth.onAuthStateChange = function(callback) {
    return originalOnAuthStateChange.call(this, (event, session) => {
      // Suppress token refresh errors
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        try {
          callback(event, session)
        } catch (err) {
          // Silently handle token refresh errors
          console.warn('⚠️ Auth state change error (non-critical):', err.message || err)
        }
      } else {
        callback(event, session)
      }
    })
  }
}

export { supabase }
