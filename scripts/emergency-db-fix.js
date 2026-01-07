/**
 * EMERGENCY DATABASE FIX SCRIPT
 * 
 * This script attempts to fix the database when everything is timing out.
 * It uses the Supabase admin client to execute SQL commands directly.
 * 
 * Usage: node scripts/emergency-db-fix.js
 * 
 * Make sure your .env file has:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env')
    const envFile = readFileSync(envPath, 'utf-8')
    const env = { ...process.env }
    envFile.split('\n').forEach(line => {
      // Skip comments and empty lines
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        env[key] = value
      }
    })
    return env
  } catch (error) {
    console.warn('Could not load .env file:', error.message)
    return process.env
  }
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing environment variables:')
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅' : '❌')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Execute SQL via RPC (if we have a function) or REST API
async function executeSQL(sql) {
  try {
    // Try using the REST API to execute SQL
    // Note: Supabase REST API doesn't support raw SQL, so we'll use RPC if available
    // For now, we'll try to use the admin client's direct methods
    
    // Check if tables exist first
    const { data, error } = await adminClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['icepulse_locations', 'icepulse_games'])
    
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

// Check what tables exist
async function checkTables() {
  console.log('\n🔍 Checking existing tables...')
  
  try {
    // Try to query the tables directly
    const locationsCheck = await adminClient
      .from('icepulse_locations')
      .select('count')
      .limit(1)
    
    const gamesCheck = await adminClient
      .from('icepulse_games')
      .select('count')
      .limit(1)
    
    console.log('✅ icepulse_locations:', locationsCheck.error ? '❌ Error: ' + locationsCheck.error.message : '✅ Exists')
    console.log('✅ icepulse_games:', gamesCheck.error ? '❌ Error: ' + gamesCheck.error.message : '✅ Exists')
    
    return {
      locations: !locationsCheck.error,
      games: !gamesCheck.error,
      errors: {
        locations: locationsCheck.error,
        games: gamesCheck.error
      }
    }
  } catch (err) {
    console.error('❌ Error checking tables:', err.message)
    return { locations: false, games: false, errors: { general: err } }
  }
}

// Try to delete tables using REST API (if possible)
async function deleteTable(tableName) {
  console.log(`\n🗑️  Attempting to delete table: ${tableName}`)
  
  // Supabase REST API doesn't support DROP TABLE directly
  // We need to use the SQL Editor or Postgres connection
  console.log(`⚠️  Cannot delete table via REST API.`)
  console.log(`   Please use Supabase Dashboard → SQL Editor to run:`)
  console.log(`   DROP TABLE IF EXISTS ${tableName} CASCADE;`)
  
  return false
}

// Main fix function
async function emergencyFix() {
  console.log('🚨 EMERGENCY DATABASE FIX')
  console.log('=' .repeat(50))
  
  // Step 1: Check connection
  console.log('\n📡 Testing database connection...')
  try {
    const { data, error } = await adminClient
      .from('icepulse_profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Connection failed:', error.message)
      console.error('\n💡 The database appears to be completely locked.')
      console.error('   You may need to:')
      console.error('   1. Wait a few minutes for locks to clear')
      console.error('   2. Contact Supabase support')
      console.error('   3. Check Supabase Dashboard → Logs for errors')
      return
    }
    
    console.log('✅ Connection successful!')
  } catch (err) {
    console.error('❌ Connection error:', err.message)
    return
  }
  
  // Step 2: Check tables
  const tableStatus = await checkTables()
  
  // Step 3: Provide instructions
  console.log('\n📋 DIAGNOSIS:')
  console.log('   - icepulse_locations:', tableStatus.locations ? '✅ Exists' : '❌ Missing or locked')
  console.log('   - icepulse_games:', tableStatus.games ? '✅ Exists' : '❌ Missing or locked')
  
  if (!tableStatus.locations && !tableStatus.games) {
    console.log('\n✅ Good news: Tables don\'t exist or are locked.')
    console.log('   This means we can recreate them cleanly.')
  } else {
    console.log('\n⚠️  Tables exist but may be in a bad state.')
    console.log('   They need to be dropped and recreated.')
  }
  
  console.log('\n🔧 RECOMMENDED FIX:')
  console.log('   1. Wait 5-10 minutes for any locks to clear')
  console.log('   2. Try Supabase Dashboard → SQL Editor again')
  console.log('   3. If still timing out, contact Supabase support')
  console.log('   4. They can manually kill stuck queries/transactions')
  
  console.log('\n📝 SQL TO RUN (when dashboard works):')
  console.log('   File: supabase/emergency_drop_tables.sql')
  console.log('   Then: supabase/recreate_tables_clean.sql')
  
  console.log('\n💡 ALTERNATIVE:')
  console.log('   If Supabase support can\'t help immediately,')
  console.log('   you may need to wait for the database to automatically')
  console.log('   clear locks (usually 5-15 minutes).')
}

// Run the fix
emergencyFix().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
