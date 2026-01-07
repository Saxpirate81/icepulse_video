# Supabase Storage Setup for Video Recordings

This guide explains how to set up Supabase Storage to store video recordings and thumbnails.

## Step 1: Create Storage Bucket

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name**: `videos`
   - **Public bucket**: ✅ **Enable this** (so videos can be accessed via public URLs)
   - **File size limit**: Set to a reasonable limit (e.g., 500 MB per file)
   - **Allowed MIME types**: 
     - `video/mp4`
     - `video/webm`
     - `image/jpeg`
     - `image/png`
5. Click **"Create bucket"**

## Step 2: Set Up Storage Policies (RLS)

After creating the bucket, you need to set up Row Level Security (RLS) policies so users can upload and view videos.

### Option A: Using Supabase Dashboard

1. Go to **Storage** → **Policies** for the `videos` bucket
2. Click **"New Policy"**
3. Create the following policies:

#### Policy 1: Allow authenticated users to upload videos
- **Policy name**: `Allow authenticated users to upload videos`
- **Allowed operation**: `INSERT`
- **Policy definition**:
```sql
bucket_id = 'videos' AND auth.role() = 'authenticated'
```

#### Policy 2: Allow authenticated users to view videos
- **Policy name**: `Allow authenticated users to view videos`
- **Allowed operation**: `SELECT`
- **Policy definition**:
```sql
bucket_id = 'videos' AND auth.role() = 'authenticated'
```

#### Policy 3: Allow users to delete their own videos
- **Policy name**: `Allow users to delete their own videos`
- **Allowed operation**: `DELETE`
- **Policy definition**:
```sql
bucket_id = 'videos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
```

### Option B: Using SQL Editor

Run this SQL script in the Supabase SQL Editor:

```sql
-- Enable RLS on the videos bucket
UPDATE storage.buckets SET public = true WHERE id = 'videos';

-- Allow authenticated users to upload videos
CREATE POLICY "Allow authenticated users to upload videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Allow authenticated users to view videos
CREATE POLICY "Allow authenticated users to view videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'videos');

-- Allow users to delete their own videos (optional, for cleanup)
CREATE POLICY "Allow users to delete their own videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'videos' AND auth.role() = 'authenticated');
```

## Step 3: Verify Setup

1. **Test upload**: Try recording a video in the app. Check the browser console for upload progress logs.
2. **Check Storage**: Go to **Storage** → **videos** bucket and verify files are being created in the folder structure:
   ```
   videos/
     {organizationId}/
       {gameId}/
         {userId}/
           {timestamp}.mp4
           {timestamp}.jpg (thumbnail)
   ```

## Troubleshooting

### Error: "Bucket not found"
- Make sure the bucket name is exactly `videos` (lowercase, no spaces)
- Verify the bucket exists in the Storage dashboard

### Error: "new row violates row-level security policy"
- Check that RLS policies are set up correctly (see Step 2)
- Verify the user is authenticated (`auth.role() = 'authenticated'`)

### Error: "The resource already exists"
- This means a file with the same path already exists
- The upload function uses unique timestamps, so this should be rare
- If it happens, the app will fall back to using a blob URL

### Videos not playing after page refresh
- This was the original issue we're fixing!
- Make sure videos are being uploaded to Storage (check console logs)
- Verify the `video_url` in the database is a Storage URL (starts with `https://`) not a blob URL (starts with `blob:`)

## Storage Structure

Videos are organized in Storage as follows:

```
videos/
  {organizationId}/
    {gameId}/
      {userId}/
        {timestamp}.mp4          # Video file
        {timestamp}.jpg            # Thumbnail image
```

This structure:
- Keeps videos organized by organization, game, and user
- Makes it easy to find and manage videos
- Allows for efficient cleanup if needed

## Cost Considerations

- **Storage**: Supabase Pro includes 8 GB of storage. Video files can be large, so monitor usage.
- **Bandwidth**: Public bucket URLs count toward egress. Consider CDN caching for high-traffic scenarios.
- **File size limits**: Set reasonable limits in bucket settings to prevent abuse.

## Next Steps

Once Storage is set up:
1. Record a test video
2. Verify it appears in the Storage bucket
3. Check that the video plays correctly in the Event Videos viewer
4. Test that videos persist after page refresh (the main goal!)
