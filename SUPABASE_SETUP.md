# Supabase Setup Guide

This guide will help you set up Supabase for the IcePulseVideo application.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed
3. Your project dependencies installed (`npm install`)

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: IcePulseVideo (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
4. Click "Create new project" and wait for it to initialize (2-3 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

## Step 3: Configure Environment Variables

1. Create a `.env` file in the root of your project (if it doesn't exist)
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

3. **Important**: Add `.env` to your `.gitignore` file to keep your keys secure!

## Step 4: Run Database Migrations

1. In your Supabase project dashboard, go to **SQL Editor**
2. Open the file `supabase/schema.sql` from this project
3. Copy and paste the entire contents into the SQL Editor
4. Click "Run" to execute the schema
5. Wait for all tables, indexes, and triggers to be created

## Step 5: Set Up Row Level Security (RLS)

1. Still in the SQL Editor, open the file `supabase/rls.sql` from this project
2. Copy and paste the entire contents into the SQL Editor
3. Click "Run" to execute the RLS policies
4. This will enable security policies for all tables

## Step 6: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Under "Site URL", add your development URL: `http://localhost:5173`
3. Under "Redirect URLs", add:
   - `http://localhost:5173/**`
   - `http://localhost:5173/auth/callback`
4. (Optional) Configure email templates under **Authentication** → **Email Templates**

## Step 7: Test the Connection

1. Start your development server: `npm run dev`
2. The app should now connect to Supabase
3. Try signing up a new user to test authentication

## Database Schema Overview

### Core Tables:
- **profiles**: User profiles (extends Supabase auth)
- **organizations**: Organizational accounts
- **teams**: Teams (can belong to org or individual)
- **seasons**: Seasons/tournaments (can belong to org or individual)
- **coaches**: Coach records
- **players**: Player records
- **parents**: Parent records

### Relationship Tables:
- **coach_assignments**: Links coaches to teams/seasons
- **player_assignments**: Links players to teams/seasons (with jersey numbers)
- **jersey_history**: Historical jersey number changes
- **parent_player_connections**: Links parents to their children

## Next Steps

After setup, you'll need to:
1. Update `AuthContext.jsx` to use Supabase authentication
2. Update `OrgContext.jsx` to use Supabase database
3. Update `IndividualContext.jsx` to use Supabase database
4. Test all CRUD operations

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure your `.env` file exists and has the correct variable names
- Restart your dev server after creating/updating `.env`

### "Failed to fetch" errors
- Check that your Supabase URL is correct
- Verify your anon key is correct
- Check browser console for CORS errors

### RLS Policy errors
- Make sure you've run the `rls.sql` file
- Check that RLS is enabled on all tables
- Verify your user has the correct role in the `profiles` table

### Authentication not working
- Check that your Site URL and Redirect URLs are configured
- Verify email templates are set up (if using email auth)
- Check browser console for auth errors

## Support

For more help:
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
