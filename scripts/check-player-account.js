/**
 * Script to check if a player account exists in Supabase Auth
 * Usage: node scripts/check-player-account.js <email>
 * 
 * Make sure your .env file has:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env')
    const envFile = readFileSync(envPath, 'utf-8')
    const env = {}
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
      }
    })
    return env
  } catch (error) {
    console.warn('Could not load .env file, using process.env')
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

async function checkAccount(email) {
  const normalizedEmail = email.trim().toLowerCase()
  console.log(`\n🔍 Checking account for: ${normalizedEmail}\n`)

  try {
    // List all users and find matching email
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError)
      return
    }

    // Find user by email (case-insensitive)
    const user = usersData.users.find(u => 
      u.email?.trim().toLowerCase() === normalizedEmail
    )

    if (!user) {
      console.log('❌ No account found with this email')
      console.log('\n📋 All users in system:')
      usersData.users.forEach(u => {
        console.log(`   - ${u.email} (ID: ${u.id}, Confirmed: ${u.email_confirmed_at ? 'Yes' : 'No'})`)
      })
      return
    }

    console.log('✅ Account found!')
    console.log('\n📋 Account Details:')
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Email Confirmed: ${user.email_confirmed_at ? 'Yes ✅' : 'No ❌'}`)
    console.log(`   Created: ${user.created_at}`)
    console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`)
    console.log(`   Metadata:`, JSON.stringify(user.user_metadata, null, 2))

    // Check profile
    const { data: profile, error: profileError } = await adminClient
      .from('icepulse_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.log('\n⚠️  Profile not found or error:', profileError.message)
    } else {
      console.log('\n📋 Profile Details:')
      console.log(`   Name: ${profile.name}`)
      console.log(`   Account Type: ${profile.account_type}`)
      console.log(`   Role: ${profile.role}`)
    }

    // Check player record
    const { data: player, error: playerError } = await adminClient
      .from('icepulse_players')
      .select('*')
      .or(`email.ilike.${normalizedEmail},profile_id.eq.${user.id}`)
      .limit(5)

    if (playerError) {
      console.log('\n⚠️  Error checking player records:', playerError.message)
    } else if (player && player.length > 0) {
      console.log('\n📋 Player Records:')
      player.forEach(p => {
        console.log(`   - ${p.full_name} (ID: ${p.id}, Email: ${p.email || 'N/A'})`)
      })
    } else {
      console.log('\n⚠️  No player records found for this email')
    }

    // Test login (simulate)
    console.log('\n🔐 Login Test:')
    console.log(`   Email: ${normalizedEmail}`)
    console.log(`   Password: password (testing mode)`)
    console.log(`   Email Confirmed: ${user.email_confirmed_at ? '✅ Should work' : '❌ May need confirmation'}`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Get email from command line
const email = process.argv[2]

if (!email) {
  console.error('❌ Please provide an email address')
  console.error('Usage: node scripts/check-player-account.js <email>')
  process.exit(1)
}

checkAccount(email)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
