/**
 * SUPABASE ADMIN UTILITIES
 * 
 * ⚠️ WARNING: This file uses the SERVICE ROLE KEY which bypasses RLS.
 * 
 * DO NOT:
 * - Import this in any frontend components
 * - Commit the service role key to git
 * - Use this in production frontend code
 * 
 * USE ONLY FOR:
 * - Development troubleshooting
 * - Admin operations
 * - Database migrations
 * - Backend/server operations
 */

import { createClient } from '@supabase/supabase-js'

// Get admin credentials from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Create admin client with service role key (bypasses RLS)
// Only create if both URL and key are available
// Use lazy initialization to avoid creating multiple GoTrueClient instances
let supabaseAdmin = null

function getAdminClient() {
  if (supabaseAdmin) {
    return supabaseAdmin
  }
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('Supabase admin utilities require VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env')
    return null
  }
  
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        // Use a different storage key to avoid conflicts with the main client
        storageKey: 'supabase-admin-auth'
      }
    })
    return supabaseAdmin
  } catch (error) {
    console.error('Failed to initialize Supabase admin client:', error)
    return null
  }
}

// Export getAdminClient for direct access if needed
export { getAdminClient }

/**
 * Admin utility functions for troubleshooting
 */

// Check if a user profile exists
export async function checkUserProfile(userId) {
  const admin = getAdminClient()
  if (!admin) {
    return { 
      data: null, 
      error: { 
        message: 'Admin client not initialized. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.' 
      } 
    }
  }
  
  const { data, error } = await admin
    .from('icepulse_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  return { data, error }
}

// Get all profiles (admin only)
export async function getAllProfiles() {
  const admin = getAdminClient()
  if (!admin) {
    return { 
      data: null, 
      error: { 
        message: 'Admin client not initialized. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.' 
      } 
    }
  }
  
  const { data, error } = await admin
    .from('icepulse_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  
  return { data, error }
}

// Manually create a profile (if trigger failed)
export async function createProfileManually(profileData) {
  const admin = getAdminClient()
  if (!admin) {
    return { 
      data: null, 
      error: { 
        message: 'Admin client not initialized. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.' 
      } 
    }
  }
  
  try {
    // First check if profile already exists (trigger might have created it)
    const { data: existing, error: checkError } = await admin
      .from('icepulse_profiles')
      .select('*')
      .eq('id', profileData.id)
      .single()
    
    // If profile exists, return it (not an error)
    if (existing && !checkError) {
      return { data: existing, error: null }
    }
    
    // Profile doesn't exist, create it
    const { data, error } = await admin
      .from('icepulse_profiles')
      .insert(profileData)
      .select()
      .single()
    
    // If duplicate key error, the trigger probably created it - try to fetch it
    if (error && error.code === '23505') {
      const { data: fetched, error: fetchError } = await admin
        .from('icepulse_profiles')
        .select('*')
        .eq('id', profileData.id)
        .single()
      
      if (fetched && !fetchError) {
        return { data: fetched, error: null }
      }
    }
    
    return { data, error }
  } catch (err) {
    return { 
      data: null, 
      error: { 
        message: err.message || 'Failed to create profile' 
      } 
    }
  }
}

// Check database tables
export async function checkTableExists(tableName) {
  const admin = getAdminClient()
  if (!admin) {
    return { 
      exists: false, 
      error: { 
        message: 'Admin client not initialized. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.' 
      } 
    }
  }
  
  try {
    const { data, error } = await admin
      .from(tableName)
      .select('*')
      .limit(1)
    
    return { exists: !error, error }
  } catch (err) {
    return { exists: false, error: err }
  }
}

// Get organization data
export async function getOrganization(orgId) {
  const admin = getAdminClient()
  if (!admin) {
    return { 
      data: null, 
      error: { 
        message: 'Admin client not initialized. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.' 
      } 
    }
  }
  
  const { data, error } = await admin
    .from('icepulse_organizations')
    .select('*')
    .eq('id', orgId)
    .single()
  
  return { data, error }
}

// Test database connection
export async function testAdminConnection() {
  const admin = getAdminClient()
  if (!admin) {
    return { success: false, message: 'Admin client not initialized' }
  }
  
  try {
    const { data, error } = await admin
      .from('icepulse_profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      return { success: false, message: error.message, error }
    }
    
    return { success: true, message: 'Admin connection successful' }
  } catch (err) {
    return { success: false, message: err.message, error: err }
  }
}
