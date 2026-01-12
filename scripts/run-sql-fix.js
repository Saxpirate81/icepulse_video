
// Script to run SQL fixes using the Supabase admin client
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runSql(filePath) {
  console.log(`Reading SQL file: ${filePath}`)
  try {
    const sql = fs.readFileSync(filePath, 'utf8')
    console.log('Executing SQL...')
    
    // Split SQL into statements to execute them one by one if needed, 
    // but standard Postgres driver often handles multiple statements.
    // However, Supabase-js rpc might be safer if we had a raw SQL function.
    // Since we don't have a direct "exec_sql" RPC exposed by default, 
    // we'll try to use a specialized RPC if available, or just log instructions.
    
    // NOTE: The supabase-js client doesn't support raw SQL execution directly
    // unless you have a specific RPC function set up for it.
    // For this environment, we'll try to use the 'exec_sql' RPC if it exists,
    // or we'll output the SQL to be run in the dashboard.
    
    // Checking for exec_sql function
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' })
    
    if (rpcError && rpcError.message.includes('function "exec_sql" does not exist')) {
        console.log('\n❌ Automatic execution not possible: "exec_sql" function not found.')
        console.log('\n⚠️  PLEASE RUN THE FOLLOWING SQL IN YOUR SUPABASE DASHBOARD > SQL EDITOR:\n')
        console.log('---------------------------------------------------')
        console.log(sql)
        console.log('---------------------------------------------------')
        return
    }

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('Error executing SQL:', error)
    } else {
      console.log('✅ SQL executed successfully!')
    }
  } catch (err) {
    console.error('Error reading/executing file:', err)
  }
}

// Get file from command line args
const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node run-sql-fix.js <path-to-sql-file>')
  process.exit(1)
}

runSql(sqlFile)
