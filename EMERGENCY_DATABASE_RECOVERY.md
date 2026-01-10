# Emergency Database Recovery Guide

## Current Situation
The database appears to be completely locked - even schema queries are timing out. This suggests:
- Stuck queries blocking the entire database
- Database connection pool exhaustion
- Supabase infrastructure issue

## Immediate Actions

### 1. Wait for Recovery (Recommended First Step)
- **Wait 10-15 minutes** - Supabase may automatically recover
- The database connection pool may reset
- Stuck queries may timeout and release locks

### 2. Check Supabase Status
- Go to: https://status.supabase.com
- Check if there are any ongoing incidents
- Check your project's status in the Supabase Dashboard

### 3. Check Supabase Dashboard (Not SQL Editor)
- Go to: Supabase Dashboard → Your Project
- Check "Database" → "Tables" (may work even if SQL Editor doesn't)
- Look for any warnings or error messages
- Check "Logs" for any error patterns

### 4. Try Supabase Dashboard Features
- **Table Editor**: Try viewing `icepulse_video_recordings` table directly
- **Database Settings**: Check connection pool settings
- **Logs**: Check for error patterns

### 5. Contact Supabase Support
If the issue persists after 15-20 minutes:
- Go to: Supabase Dashboard → Support
- Describe: "Database completely locked, even schema queries timeout"
- Include: Your project URL and approximate time when it started

## What NOT to Do
- ❌ Don't keep running queries - this makes it worse
- ❌ Don't try to restart/reset the database yourself
- ❌ Don't delete tables or data
- ❌ Don't run multiple queries simultaneously

## Prevention (After Recovery)

### 1. Add Query Timeouts
- Already implemented in code (10 second timeout)
- Consider reducing further if needed

### 2. Monitor Query Performance
- Use `EXPLAIN ANALYZE` on slow queries
- Check for missing indexes
- Monitor table sizes

### 3. Add Connection Pooling
- Check Supabase connection pool settings
- Consider using Supabase connection pooling

### 4. Optimize Queries
- Use indexes (already added)
- Limit result sets
- Avoid complex joins when possible

## Recovery Checklist
Once database is accessible again:

- [ ] Run `supabase/check_database_locks.sql` to verify no stuck queries
- [ ] Run `supabase/safe_check_videos.sql` to verify table is accessible
- [ ] Test video loading in the app
- [ ] Check if indexes exist: `supabase/fix_video_recordings_performance.sql`
- [ ] Monitor for any recurring issues

## Alternative: Use App Features That Don't Require Video Queries
While waiting for recovery, you can still:
- ✅ Record new videos (writes may work even if reads don't)
- ✅ Manage games/schedule
- ✅ Manage teams/players
- ✅ Use other features that don't query video_recordings

## Root Cause Analysis (After Recovery)
Once database is working:
1. Check Supabase logs for what caused the lock
2. Review query patterns that led to this
3. Implement additional safeguards
4. Consider archiving old videos if table is very large
