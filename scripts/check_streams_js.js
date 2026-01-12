import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
    console.error('Error loading .env:', err)
  }
  return envVars
}

const env = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkStreams() {
  console.log('Checking recent streams...')
  
  const { data, error } = await supabase
    .from('icepulse_streams')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching streams:', error)
    return
  }

  console.log('Recent streams:', data)
  
  // Try to insert a dummy record to check ID type if possible?
  // No, let's just inspect the data.
  if (data && data.length > 0) {
      console.log('First stream ID type:', typeof data[0].id)
      console.log('First stream ID value:', data[0].id)
  }
}

checkStreams()
