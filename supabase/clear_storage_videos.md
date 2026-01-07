# Clear Video Files from Supabase Storage

To delete all video files from Storage, you have two options:

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to **Storage** → **videos** bucket
2. Navigate through the folders:
   - `{organizationId}/`
   - `{gameId}/`
   - `{userId}/`
3. Select all files and click **Delete**
4. Also check the `thumbnails/` folder and delete thumbnail images

## Option 2: Using SQL (if you have admin access)

Run this in SQL Editor to delete all files from the `videos` bucket:

```sql
-- Delete all files from videos bucket
DELETE FROM storage.objects 
WHERE bucket_id = 'videos';
```

**Note:** This requires admin/service role access. The anon key won't work for this.

## Option 3: Delete Specific Organization's Videos

If you only want to delete videos for a specific organization:

```sql
-- Replace {organizationId} with your actual organization ID
DELETE FROM storage.objects 
WHERE bucket_id = 'videos' 
  AND name LIKE '{organizationId}/%';
```

## After Deleting

1. Run `supabase/clear_all_video_recordings.sql` to delete database records
2. Refresh the Event Videos viewer
3. Videos should no longer appear
