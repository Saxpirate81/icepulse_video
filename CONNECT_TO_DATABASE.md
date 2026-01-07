# Connect Database to Frontend

## Step 1: Disable Mock Mode

1. **Check your `.env` file** (create it if it doesn't exist in the root directory)
2. **Set mock mode to false**:
   ```env
   VITE_USE_MOCK_DATA=false
   ```

3. **Ensure you have Supabase credentials**:
   ```env
   VITE_SUPABASE_URL=your_project_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

## Step 2: Enable Testing Toggles (Optional but Recommended)

To keep the view toggles working with the real database:

```env
VITE_ENABLE_TESTING_TOGGLES=true
```

This allows you to:
- Switch between Organization/Coach/Player/Parent views
- Switch between different users in the same role
- Test all views with real database data

## Step 3: Restart Dev Server

```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

## Step 4: Verify Connection

1. **Check browser console** - Should NOT see "MOCK MODE" warnings
2. **Login** - Should connect to real Supabase Auth
3. **View data** - Should load from real database

## Step 5: Test Video Components

### Test Video Recording:
1. Go to **Video Recorder** tab
2. Select a game (if you have games created)
3. Start recording
4. Stop recording
5. Check that recording is saved (check database or Game Videos tab)

### Test Video Viewing:
1. Go to **Game Videos** tab (in Organizational Dashboard)
2. Select a game that has videos
3. Verify videos load and display
4. Test synchronized playback

## What's Connected

✅ **Authentication** - Real Supabase Auth
✅ **Organizations** - Loads from `icepulse_organizations`
✅ **Teams** - Loads from `icepulse_teams`
✅ **Seasons** - Loads from `icepulse_seasons`
✅ **Coaches** - Loads from `icepulse_coaches`
✅ **Players** - Loads from `icepulse_players`
✅ **Parents** - Loads from `icepulse_parents`
✅ **Games** - Loads from `icepulse_games`
✅ **Locations** - Loads from `icepulse_locations`
✅ **Video Recordings** - Saves to and loads from `icepulse_video_recordings`

## Testing Toggles Still Work

With `VITE_ENABLE_TESTING_TOGGLES=true`, you can:
- **View Toggle**: Switch between role views (uses real database data)
- **User Selector**: Switch between users in same role (uses real database data)

These are great for testing what each user sees with real data!

## Troubleshooting

### If you see "MOCK MODE" warnings:
- Check `.env` file has `VITE_USE_MOCK_DATA=false`
- Restart dev server after changing `.env`

### If you see "Missing Supabase environment variables":
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`
- Restart dev server

### If data doesn't load:
- Check browser console for errors
- Verify tables exist in Supabase (run `complete_setup_all_tables.sql` if needed)
- Check RLS policies allow your user to access data

### If video recording doesn't save:
- Check that a game is selected
- Check browser console for errors
- Verify `icepulse_video_recordings` table exists
- Check that user has permission to insert (RLS policies)

---

**Ready to connect!** Just set `VITE_USE_MOCK_DATA=false` and restart your dev server.
