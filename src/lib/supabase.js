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
      // Add timeout for auth requests to prevent hanging
      flowType: 'pkce'
    },
    global: {
      // Add fetch timeout to prevent hanging
      fetch: (url, options = {}) => {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000) // 10 second timeout
        })
        
        // Race the fetch against timeout
        return Promise.race([
          fetch(url, options),
          timeoutPromise
        ]).catch((error) => {
          // If it's a timeout or network error, log but don't throw
          if (error.message === 'Request timeout' || error.name === 'TypeError') {
            console.warn('⚠️ Supabase request timeout or network error:', url)
            // Return a response that indicates failure but doesn't crash
            return new Response(JSON.stringify({ error: 'Request timeout' }), {
              status: 408,
              statusText: 'Request Timeout'
            })
          }
          throw error
        })
      }
    }
  })
}

export { supabase }
