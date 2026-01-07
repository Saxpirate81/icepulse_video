# Resource Optimization Guide

**Your Supabase project is showing resource exhaustion warnings. Follow these steps to identify and fix the issue.**

## Step 1: Identify the Problem

Run `supabase/diagnose_resource_usage.sql` to see what's consuming resources:

1. **Connection Count** - Check if you're hitting connection limits
2. **Long-Running Queries** - Find queries that are stuck or taking too long
3. **Idle in Transaction** - Connections holding locks unnecessarily
4. **Table Sizes** - Check if any tables are unusually large
5. **Application Sources** - See which apps are creating connections

## Step 2: Check Supabase Dashboard

Go to **Supabase Dashboard → Settings → Usage** and check:

- **Database Size**: Should be reasonable for your plan
- **Active Connections**: Check your plan limit (Free: 60, Pro: 200)
- **API Requests**: Look for unusual spikes
- **Storage**: Check if storage is full

## Step 3: Common Causes & Solutions

### Cause 1: Too Many Connections from Dev Server

**Symptoms:**
- High connection count
- Many connections from same application name
- Connections in "idle" state

**Solution:**
1. **Restart your dev server** - This closes all connections
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm run dev
   ```

2. **Check for connection leaks** - Make sure you're closing Supabase connections properly
   - The Supabase client should handle this automatically
   - But if you're creating multiple clients, consolidate them

3. **Reduce connection pool size** (if using connection pooling)
   - Check your Supabase connection string
   - Use transaction mode if available

### Cause 2: Stuck Queries/Transactions

**Symptoms:**
- Queries running for a long time
- "idle in transaction" connections
- Locks on tables

**Solution:**
1. **Run cleanup script** (carefully):
   ```sql
   -- First, see what will be killed
   -- Run the preview query in cleanup_resources.sql
   
   -- Then kill stuck connections
   -- Run cleanup_resources.sql
   ```

2. **Check for long-running operations**:
   - Large data imports
   - Complex queries without timeouts
   - Missing indexes causing slow queries

### Cause 3: Large Tables

**Symptoms:**
- Tables with large sizes
- Slow queries
- High storage usage

**Solution:**
1. **Check table sizes** (from diagnose script)
2. **Add indexes** to speed up queries
3. **Archive old data** if needed
4. **Consider partitioning** for very large tables

### Cause 4: API Request Spikes

**Symptoms:**
- High API request count in dashboard
- Many rapid queries

**Solution:**
1. **Add request debouncing** in your app
2. **Cache frequently accessed data**
3. **Batch multiple queries** into one
4. **Use subscriptions efficiently** (don't create too many)

## Step 4: Immediate Actions

### Quick Fix 1: Restart Dev Server
```bash
# Stop your dev server
# Wait 30 seconds
# Restart it
npm run dev
```

### Quick Fix 2: Kill Stuck Connections
1. Run `supabase/diagnose_resource_usage.sql`
2. Look for "idle in transaction" or long-running queries
3. Run `supabase/cleanup_resources.sql` (carefully!)

### Quick Fix 3: Check for Connection Leaks
Look in your code for:
- Multiple Supabase client instances
- Unclosed subscriptions
- Loops creating connections

## Step 5: Optimize Your Application

### Reduce Connection Usage

1. **Use a single Supabase client**:
   ```javascript
   // ✅ Good - Single client
   import { supabase } from './lib/supabase'
   
   // ❌ Bad - Multiple clients
   const supabase1 = createClient(...)
   const supabase2 = createClient(...)
   ```

2. **Close subscriptions properly**:
   ```javascript
   useEffect(() => {
     const subscription = supabase
       .channel('my-channel')
       .subscribe()
     
     return () => {
       subscription.unsubscribe() // ✅ Always cleanup
     }
   }, [])
   ```

3. **Debounce rapid queries**:
   ```javascript
   // Use debounce for search/filter queries
   const debouncedSearch = useMemo(
     () => debounce((query) => {
       // Search query
     }, 300),
     []
   )
   ```

### Optimize Queries

1. **Add indexes** (already done for new tables)
2. **Use select() to limit columns**:
   ```javascript
   // ✅ Good - Only get what you need
   .select('id, name, email')
   
   // ❌ Bad - Gets everything
   .select('*')
   ```

3. **Add limits to queries**:
   ```javascript
   .select('*')
   .limit(100) // Don't fetch thousands of rows
   ```

4. **Use pagination** for large datasets

## Step 6: Monitor Going Forward

1. **Check dashboard regularly** - Watch for spikes
2. **Set up alerts** (if available on your plan)
3. **Monitor connection count** - Keep it under 50% of limit
4. **Review slow queries** - Optimize them

## Step 7: If Problem Persists

If resources are still exhausted after cleanup:

1. **Wait 10-15 minutes** - Let connections clear naturally
2. **Check Supabase status page** - May be a platform issue
3. **Contact Supabase support** - They can help diagnose
4. **Consider upgrading plan** - If you've outgrown free tier

## Prevention Checklist

- [ ] Single Supabase client instance
- [ ] All subscriptions properly cleaned up
- [ ] Queries have timeouts/limits
- [ ] No connection leaks in code
- [ ] Regular cleanup of old data
- [ ] Indexes on frequently queried columns
- [ ] Debouncing on search/filter operations

---

## Quick Reference

**Diagnose**: `supabase/diagnose_resource_usage.sql`
**Cleanup**: `supabase/cleanup_resources.sql` (use carefully!)
**Dashboard**: Supabase → Settings → Usage

**Free Tier Limits:**
- Connections: 60
- Database Size: 500 MB
- API Requests: 50,000/month

**If you're hitting limits, consider:**
- Optimizing queries
- Reducing connection usage
- Upgrading plan if needed
