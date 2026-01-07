# How to Check Supabase Dashboard Usage

## Step-by-Step Guide

### 1. Go to Supabase Dashboard
1. Open your browser
2. Go to: **https://app.supabase.com**
3. Log in to your account
4. Select your project (IcePulseVideo or your project name)

### 2. Navigate to Usage Page
1. In the left sidebar, click **"Settings"** (gear icon at the bottom)
2. Click **"Usage"** in the settings menu
3. You'll see a page with multiple resource metrics

### 3. What to Look For

The Usage page shows several metrics:

#### **Database Size**
- Shows how much storage your database is using
- Your current: **13 MB** (very small, not an issue)
- Free tier limit: **500 MB**
- ✅ You're well under the limit

#### **Active Connections**
- Shows current database connections
- Free tier limit: **60 connections**
- ⚠️ This is often the culprit for resource warnings
- Look for the current count vs. the limit

#### **API Requests**
- Shows API calls per month
- Free tier limit: **50,000/month**
- Check if you're approaching the limit

#### **Storage**
- Shows file storage usage (if using Supabase Storage)
- Free tier limit: **1 GB**
- Check if you're using storage buckets

#### **Bandwidth**
- Shows data transfer
- Free tier limit: **5 GB/month**
- Usually not an issue unless transferring lots of files

### 4. Check Real-Time Connections
1. Go to **"Database"** in the left sidebar
2. Click **"Connection Pooler"** (if available)
3. Or check **"Settings" → "Database"** for connection info

### 5. Check for Active Queries
1. Go to **"Database"** in the left sidebar
2. Click **"Reports"** or **"Activity"**
3. Look for:
   - Long-running queries
   - High query count
   - Stuck transactions

## What Your Numbers Mean

**Database Size: 13 MB**
- ✅ Very small, not a problem
- You have 487 MB remaining on free tier

**The resource warning is likely from:**
- **Too many active connections** (most common)
- **API request spikes** (less likely with 13 MB database)
- **Stuck queries** holding connections

## Quick Actions Based on What You See

### If "Active Connections" is High (>40):
1. Restart dev server (already done ✅)
2. Run `supabase/cleanup_resources.sql` to kill stuck connections
3. Check for connection leaks in your code

### If "API Requests" is High:
1. Check for rapid polling/refreshing
2. Add debouncing to search/filter queries
3. Cache frequently accessed data

### If You See Stuck Queries:
1. Run `supabase/diagnose_resource_usage.sql`
2. Run `supabase/cleanup_resources.sql` to kill them
3. Check for missing indexes causing slow queries

## Direct Links

- **Usage Dashboard**: `https://app.supabase.com/project/[your-project-id]/settings/usage`
- **Database Activity**: `https://app.supabase.com/project/[your-project-id]/database/activity`
- **Connection Pooler**: `https://app.supabase.com/project/[your-project-id]/database/pooler`

## After Checking

Once you see what's high, you can:
1. **Share the numbers** with me and I'll help optimize
2. **Run the cleanup scripts** if you see stuck connections
3. **Optimize your code** based on what's consuming resources

---

**Your database size (13 MB) is tiny, so the issue is likely connections or API requests, not storage!**
