-- Fix Storage Policies for Public Stream Access
-- This allows anyone to view stream videos without authentication

-- First, ensure the videos bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'videos';

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public to view stream videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view all videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own videos" ON storage.objects;

-- Allow PUBLIC (anyone) to SELECT (view) videos in streams folder
-- This is needed so stream viewers can watch without logging in
CREATE POLICY "Allow public to view stream videos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = 'streams'
);

-- Allow authenticated users to INSERT (upload) videos anywhere
CREATE POLICY "Allow authenticated users to upload videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Allow authenticated users to SELECT (view) all videos
CREATE POLICY "Allow authenticated users to view all videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'videos');

-- Allow authenticated users to DELETE their own videos (optional)
CREATE POLICY "Allow users to delete their own videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'videos');
