import { createClient } from '@supabase/supabase-js'
import { createMockSupabaseClient, USE_MOCK } from './supabase-mock.js'

// Check if we should use mock data
let supabase

if (USE_MOCK) {
  console.warn('⚠️ MOCK MODE: Using mock Supabase client (database unavailable)')
  supabase = createMockSupabaseClient()
} else {
  // Get Supabase URL and anon key from environment variables
  // You'll need to set these in your .env file
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
}

export { supabase }
