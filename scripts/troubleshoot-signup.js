#!/usr/bin/env node

/**
 * Troubleshoot Signup Issues
 * 
 * This script uses the admin client to check:
 * - Recent auth users
 * - Corresponding profiles
 * - Trigger status
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function troubleshoot() {
  console.log('🔍 Troubleshooting signup issues...\n')

  // Check recent auth users
  console.log('1. Checking recent auth users...')
  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error fetching auth users:', authError)
  } else {
    console.log(`   Found ${authUsers.users.length} total users`)
    const recentUsers = authUsers.users.slice(-5).reverse()
    console.log(`   Recent 5 users:`)
    recentUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.id}) - Created: ${new Date(user.created_at).toLocaleString()}`)
    })
  }

  // Check profiles
  console.log('\n2. Checking profiles...')
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('icepulse_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (profileError) {
    console.error('   Error:', profileError)
  } else {
    console.log(`   Found ${profiles.length} recent profiles:`)
    profiles.forEach(profile => {
      console.log(`   - ${profile.email} (${profile.id}) - Type: ${profile.account_type}, Role: ${profile.role}`)
    })
  }

  // Find users without profiles
  console.log('\n3. Finding users without profiles...')
  if (authUsers && authUsers.users) {
    const usersWithoutProfiles = []
    for (const user of authUsers.users.slice(-10)) {
      const { data: profile } = await supabaseAdmin
        .from('icepulse_profiles')
        .select('id')
        .eq('id', user.id)
        .single()
      
      if (!profile) {
        usersWithoutProfiles.push(user)
        console.log(`   ⚠️  User ${user.email} (${user.id}) has no profile`)
        console.log(`      Metadata:`, user.user_metadata)
      }
    }
    
    if (usersWithoutProfiles.length > 0) {
      console.log(`\n   Found ${usersWithoutProfiles.length} users without profiles`)
      console.log('   You can manually create profiles for these users using the admin utilities.')
    } else {
      console.log('   ✅ All recent users have profiles')
    }
  }

  // Check trigger
  console.log('\n4. Checking trigger status...')
  console.log('   Run this SQL in Supabase to check trigger:')
  console.log('   SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_name = \'on_auth_user_created\';')
}

troubleshoot().catch(console.error)
