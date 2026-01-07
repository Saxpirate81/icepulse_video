#!/usr/bin/env node

/**
 * Execute SQL Script Against Supabase
 * 
 * This script executes SQL files directly against your Supabase PostgreSQL database.
 * 
 * Usage: node scripts/execute-sql.js <sql-file>
 * Example: node scripts/execute-sql.js supabase/fix_rls_v3.sql
 * 
 * Requirements:
 * - VITE_SUPABASE_URL in .env
 * - VITE_SUPABASE_SERVICE_ROLE_KEY in .env (or DATABASE_PASSWORD)
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import postgres from 'postgres'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file manually
function loadEnv() {
  const envVars = {}
  try {
    const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8')
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (match) {
          envVars[match[1].trim()] = match[2].trim()
        }
      }
    })
  } catch (err) {
    // .env file might not exist
  }
  return envVars
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const dbPassword = env.DATABASE_PASSWORD || process.env.DATABASE_PASSWORD

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL in .env')
  console.error('   Please add VITE_SUPABASE_URL to your .env file')
  process.exit(1)
}

// Extract project ref from Supabase URL
// URL format: https://xxxxx.supabase.co
const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
if (!urlMatch) {
  console.error('❌ Invalid VITE_SUPABASE_URL format')
  console.error('   Expected format: https://xxxxx.supabase.co')
  process.exit(1)
}

const projectRef = urlMatch[1]

// Get SQL file path from command line
const sqlFile = process.argv[2]

if (!sqlFile) {
  console.error('❌ Please provide a SQL file path')
  console.error('   Usage: node scripts/execute-sql.js <sql-file>')
  console.error('   Example: node scripts/execute-sql.js supabase/fix_rls_v3.sql')
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

// Construct database connection string
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
if (!dbPassword) {
  console.error('❌ Missing DATABASE_PASSWORD in .env')
  console.error('   You can find this in Supabase Dashboard → Settings → Database')
  console.error('   Or use the connection string from Settings → Database → Connection string')
  console.error('\n   Alternatively, you can run the SQL manually in the Supabase SQL Editor:')
  console.log('\n' + '─'.repeat(80))
  console.log(sql)
  console.log('─'.repeat(80))
  process.exit(1)
}

const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

console.log(`🔌 Connecting to database: ${projectRef}.supabase.co`)
console.log('⏳ Executing SQL...\n')

// Execute SQL
const sqlClient = postgres(connectionString, {
  ssl: 'require',
  max: 1, // Use single connection for script execution
})

try {
  // Split SQL by semicolons and execute each statement
  // Note: postgres.unsafe() can execute multiple statements
  await sqlClient.unsafe(sql)
  
  console.log('✅ SQL script executed successfully!')
  console.log('\n📋 Summary:')
  console.log('   - RLS policies have been updated')
  console.log('   - Infinite recursion issues should be resolved')
  console.log('   - Try creating an organizational account again')
} catch (error) {
  console.error('❌ Error executing SQL:', error.message)
  if (error.code) {
    console.error(`   Error code: ${error.code}`)
  }
  if (error.position) {
    console.error(`   Position: ${error.position}`)
  }
  process.exit(1)
} finally {
  await sqlClient.end()
  console.log('\n🔌 Database connection closed')
}
