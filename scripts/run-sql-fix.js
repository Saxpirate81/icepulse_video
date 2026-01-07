#!/usr/bin/env node

/**
 * Run SQL Fix Script
 * 
 * This script executes SQL files against your Supabase database
 * using the service role key (admin access).
 * 
 * Usage: node scripts/run-sql-fix.js <sql-file>
 * Example: node scripts/run-sql-fix.js supabase/fix_rls_v3.sql
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file manually (since we can't use dotenv without installing it)
import { readFileSync as readEnv } from 'fs'
let envVars = {}
try {
  const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      envVars[match[1].trim()] = match[2].trim()
    }
  })
} catch (err) {
  // .env file might not exist or be readable
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env')
  console.error('   Please add these to your .env file')
  process.exit(1)
}

// Get SQL file path from command line
const sqlFile = process.argv[2]

if (!sqlFile) {
  console.error('❌ Please provide a SQL file path')
  console.error('   Usage: node scripts/run-sql-fix.js <sql-file>')
  console.error('   Example: node scripts/run-sql-fix.js supabase/fix_rls_v3.sql')
  process.exit(1)
}

// Read SQL file
let sql
try {
  const filePath = resolve(join(__dirname, '..', sqlFile))
  sql = readFileSync(filePath, 'utf-8')
  console.log(`📄 Read SQL file: ${sqlFile}`)
} catch (error) {
  console.error(`❌ Failed to read SQL file: ${sqlFile}`)
  console.error(`   Error: ${error.message}`)
  process.exit(1)
}

// Note: Supabase JS client doesn't support raw SQL execution
// We need to use the REST API's rpc endpoint or direct PostgreSQL connection
// For now, we'll use the REST API with the PostgREST format

console.log('\n⚠️  Note: Supabase JS client doesn\'t support executing raw SQL directly.')
console.log('   The SQL Editor in the Supabase Dashboard is the recommended way.')
console.log('\n📋 Here is your SQL to copy and paste into the SQL Editor:\n')
console.log('─'.repeat(80))
console.log(sql)
console.log('─'.repeat(80))
console.log('\n💡 To run this SQL:')
console.log('   1. Go to your Supabase Dashboard')
console.log('   2. Navigate to SQL Editor')
console.log('   3. Copy and paste the SQL above')
console.log('   4. Click "Run"')
console.log('\n   Or use the Supabase CLI: supabase db execute < sql-file\n')

// Alternative: Try to execute via REST API (limited - only works for simple queries)
// For complex SQL with DROP/CREATE, we need direct database access
console.log('\n🔧 Attempting to check database connection...')

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test connection
supabaseAdmin
  .from('icepulse_profiles')
  .select('count')
  .limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Database connection test failed:', error.message)
      console.error('   Please run the SQL manually in the Supabase SQL Editor')
    } else {
      console.log('✅ Database connection successful!')
      console.log('   However, raw SQL execution requires the SQL Editor or CLI.')
      console.log('   Please copy the SQL above and run it in the Supabase Dashboard.')
    }
  })
  .catch(err => {
    console.error('❌ Connection error:', err.message)
  })
