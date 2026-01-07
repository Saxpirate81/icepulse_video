# Pro Account Resource Troubleshooting

Since you have a **Pro account**, the resource warning is likely from one of these:

## Pro Plan Limits

- **Database Connections**: 200 (vs 60 on free)
- **Database Size**: 8 GB included, can scale automatically
- **API Requests**: Much higher limits
- **Compute**: More generous, but still has limits

## Most Likely Causes on Pro

### 1. Too Many Database Connections (Most Common)

Even on Pro, if you have:
- Stuck "idle in transaction" connections
- Connection leaks from dev server
- Too many simultaneous connections

**Check**: Run `supabase/check_pro_usage.sql` and look at connection count

**Fix**: 
- Restart dev server (already done ✅)
- Run `supabase/cleanup_resources.sql` to kill stuck connections
- Check for connection leaks in code

### 2. Database Size Approaching Limit

Pro includes 8 GB, but if you're close:
- Database automatically scales (costs extra)
- Warning appears before scaling

**Check**: Run `supabase/check_pro_usage.sql` to see actual database size

**Fix**:
- Archive old data if needed
- Optimize table sizes
- Check for bloated indexes

### 3. Compute Hours (Less Likely on Pro)

Pro has more compute credits, but if you're running 24/7:
- Still consumes compute hours
- Warning if approaching monthly limit

**Fix**: Pause project when not in use (optional on Pro)

## Immediate Actions

1. **Run Diagnostic**: Execute `supabase/check_pro_usage.sql` in SQL Editor
2. **Check Results**:
   - If connections > 150: Clean up stuck connections
   - If database size > 7 GB: Check table sizes
   - If many "idle in transaction": Run cleanup script

3. **Clean Up**: If you see stuck connections, run `supabase/cleanup_resources.sql`

## What to Share

After running `check_pro_usage.sql`, share:
- Total connections count
- Database size
- Number of "idle in transaction" connections
- Any unusually large tables

This will help identify the exact issue!
