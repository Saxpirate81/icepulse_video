-- ============================================
-- FILE SIZE ANALYSIS
-- Analyze video file sizes and identify optimization opportunities
-- ============================================

-- 1. FILE SIZE STATISTICS
SELECT 
  'File Size Statistics' as section,
  COUNT(*) as total_files,
  pg_size_pretty(MIN(file_size_bytes)) as smallest_file,
  pg_size_pretty(MAX(file_size_bytes)) as largest_file,
  pg_size_pretty(ROUND(AVG(file_size_bytes::numeric))::bigint) as average_file_size,
  pg_size_pretty(ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY file_size_bytes))::numeric)::bigint) as median_file_size,
  pg_size_pretty(SUM(file_size_bytes)) as total_size,
  SUM(file_size_bytes) as total_bytes
FROM icepulse_video_recordings
WHERE file_size_bytes IS NOT NULL;

-- 2. FILE SIZE DISTRIBUTION (by size ranges)
SELECT 
  'Size Distribution' as section,
  CASE 
    WHEN file_size_bytes < 5 * 1024 * 1024 THEN '< 5 MB'
    WHEN file_size_bytes < 10 * 1024 * 1024 THEN '5-10 MB'
    WHEN file_size_bytes < 15 * 1024 * 1024 THEN '10-15 MB'
    WHEN file_size_bytes < 20 * 1024 * 1024 THEN '15-20 MB'
    WHEN file_size_bytes < 25 * 1024 * 1024 THEN '20-25 MB'
    ELSE '> 25 MB'
  END as size_range,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(file_size_bytes)) as total_size_in_range,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM icepulse_video_recordings
WHERE file_size_bytes IS NOT NULL
GROUP BY size_range
ORDER BY MIN(file_size_bytes);

-- 3. LARGEST FILES (Top 20)
SELECT 
  'Largest Files' as section,
  id,
  game_id,
  created_at,
  pg_size_pretty(file_size_bytes) as file_size,
  file_size_bytes,
  ROUND(file_size_bytes / 1024.0 / 1024.0, 2) as size_mb,
  video_url,
  CASE 
    WHEN video_url LIKE '%/streams/%' THEN 'Stream Chunk'
    ELSE 'Regular Recording'
  END as file_type
FROM icepulse_video_recordings
WHERE file_size_bytes IS NOT NULL
ORDER BY file_size_bytes DESC
LIMIT 20;

-- 4. AVERAGE FILE SIZE BY TYPE
SELECT 
  'Average Size by Type' as section,
  CASE 
    WHEN video_url LIKE '%/streams/%' THEN 'Stream Chunk'
    ELSE 'Regular Recording'
  END as file_type,
  COUNT(*) as count,
  pg_size_pretty(ROUND(AVG(file_size_bytes::numeric))::bigint) as avg_size,
  pg_size_pretty(MIN(file_size_bytes)) as min_size,
  pg_size_pretty(MAX(file_size_bytes)) as max_size,
  pg_size_pretty(SUM(file_size_bytes)) as total_size
FROM icepulse_video_recordings
WHERE file_size_bytes IS NOT NULL
GROUP BY file_type;

-- 5. FILES WITHOUT SIZE TRACKING
SELECT 
  'Files Missing Size Data' as section,
  COUNT(*) as count,
  'These files need size tracking added' as note
FROM icepulse_video_recordings
WHERE file_size_bytes IS NULL
  AND video_url IS NOT NULL;

-- 6. STORAGE COST ESTIMATE (if using Supabase Pro)
-- Pro plan includes 100 GB storage, then $0.021 per GB/month
SELECT 
  'Storage Cost Estimate' as section,
  pg_size_pretty(SUM(COALESCE(file_size_bytes, 0))) as total_storage_used,
  ROUND(SUM(COALESCE(file_size_bytes, 0))::numeric / 1024.0 / 1024.0 / 1024.0, 2) as total_gb,
  CASE 
    WHEN SUM(COALESCE(file_size_bytes, 0))::numeric < 100 * 1024.0 * 1024.0 * 1024.0 THEN '$0 (within Pro plan 100 GB)'
    ELSE '$' || ROUND((SUM(COALESCE(file_size_bytes, 0))::numeric / 1024.0 / 1024.0 / 1024.0 - 100) * 0.021, 2) || ' per month (over 100 GB)'
  END as estimated_cost
FROM icepulse_video_recordings;

-- 7. RECOMMENDATIONS
SELECT 
  'Recommendations' as section,
  CASE 
    WHEN AVG(file_size_bytes) > 20 * 1024 * 1024 THEN 
      'Consider reducing video quality or bitrate - average file size is high (>20MB)'
    WHEN AVG(file_size_bytes) > 15 * 1024 * 1024 THEN 
      'File sizes are reasonable but could be optimized'
    ELSE 
      'File sizes look good'
  END as recommendation
FROM icepulse_video_recordings
WHERE file_size_bytes IS NOT NULL;
