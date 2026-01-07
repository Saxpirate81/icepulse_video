-- Check Storage Policies for 'videos' bucket
-- Run this to verify your storage policies are set up correctly

-- 1. Check if bucket exists and is public
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'videos';

-- 2. List all policies on storage.objects for the 'videos' bucket
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%videos%' OR policyname LIKE '%video%'
ORDER BY policyname;

-- 3. Check all storage policies (more comprehensive)
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
ORDER BY policyname;

-- 4. Test if you can insert (this will show if policies allow uploads)
-- Note: This won't actually insert, just check permissions
SELECT 
  has_table_privilege('authenticated', 'storage.objects', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'storage.objects', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'storage.objects', 'UPDATE') as can_update,
  has_table_privilege('authenticated', 'storage.objects', 'DELETE') as can_delete;
