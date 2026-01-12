import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read .env manually
let env = {}
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8')
  envContent.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length >= 2) {
      const key = parts[0].trim()
      const value = parts.slice(1).join('=').trim()
      env[key] = value
    }
  })
} catch (e) {
  console.log('Could not read .env file')
}

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function run() {
  const sqlFile = process.argv[2]
  if (!sqlFile) {
    console.error('Usage: node scripts/try-sql.js <file>')
    process.exit(1)
  }
  
  try {
    const sql = fs.readFileSync(sqlFile, 'utf8')
    console.log('Attempting to execute SQL via exec_sql RPC...')
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('❌ Failed to execute SQL via RPC:', error.message)
      console.log('\n⚠️  Please run this SQL manually in Supabase Dashboard > SQL Editor:')
      console.log(sql)
    } else {
      console.log('✅ SQL executed successfully!')
    }
  } catch (e) {
    console.error('Error:', e.message)
  }
}

run()
