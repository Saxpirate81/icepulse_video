/**
 * Supabase Troubleshooting Utilities
 * 
 * These functions can be called from the browser console for debugging.
 * They use the admin client which has full access.
 * 
 * Usage in browser console:
 * import { checkUserProfile, testConnection } from './utils/supabase-troubleshoot'
 * await testConnection()
 */

import { 
  supabaseAdmin, 
  checkUserProfile, 
  getAllProfiles,
  createProfileManually,
  checkTableExists,
  testAdminConnection
} from '../lib/supabase-admin'

// Export troubleshooting functions
export {
  checkUserProfile,
  getAllProfiles,
  createProfileManually,
  checkTableExists,
  testAdminConnection
}

// Convenience function to test everything
export async function runDiagnostics() {
  console.log('🔍 Running Supabase diagnostics...')
  
  // Test admin connection
  console.log('\n1. Testing admin connection...')
  const connectionTest = await testAdminConnection()
  console.log(connectionTest)
  
  // Check if tables exist
  console.log('\n2. Checking tables...')
  const tables = [
    'icepulse_profiles',
    'icepulse_organizations',
    'icepulse_teams',
    'icepulse_seasons',
    'icepulse_coaches',
    'icepulse_players',
    'icepulse_parents'
  ]
  
  for (const table of tables) {
    const result = await checkTableExists(table)
    console.log(`  ${table}: ${result.exists ? '✅' : '❌'}`, result.error?.message || '')
  }
  
  // Get profile count
  console.log('\n3. Checking profiles...')
  const profiles = await getAllProfiles()
  if (profiles.error) {
    console.error('  Error:', profiles.error)
  } else {
    console.log(`  Found ${profiles.data?.length || 0} profiles`)
  }
  
  return {
    connection: connectionTest,
    tables: tables.map(t => ({ name: t, exists: true })), // Simplified
    profiles: profiles
  }
}
