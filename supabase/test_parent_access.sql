-- Test query to check if parent can access teams/seasons through player assignments
-- Run this as a parent user to see if RLS policies are working

-- First, check if policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('icepulse_teams', 'icepulse_seasons')
  AND policyname LIKE '%parent%'
ORDER BY tablename, policyname;

-- Test: Get parent's connected players' teams
-- Replace 'YOUR_PARENT_USER_ID' with actual parent user ID
SELECT DISTINCT
  t.id,
  t.name,
  t.organization_id,
  pa.player_id,
  p.full_name as player_name
FROM icepulse_teams t
JOIN icepulse_player_assignments pa ON pa.team_id = t.id
JOIN icepulse_parent_player_connections ppc ON ppc.player_id = pa.player_id
JOIN icepulse_parents par ON ppc.parent_id = par.id
JOIN icepulse_players p ON p.id = pa.player_id
WHERE par.profile_id = auth.uid()  -- This will use the current logged-in user
ORDER BY t.name;

-- Test: Get parent's connected players' seasons
SELECT DISTINCT
  s.id,
  s.name,
  s.organization_id,
  pa.player_id,
  p.full_name as player_name
FROM icepulse_seasons s
JOIN icepulse_player_assignments pa ON pa.season_id = s.id
JOIN icepulse_parent_player_connections ppc ON ppc.player_id = pa.player_id
JOIN icepulse_parents par ON ppc.parent_id = par.id
JOIN icepulse_players p ON p.id = pa.player_id
WHERE par.profile_id = auth.uid()  -- This will use the current logged-in user
ORDER BY s.name;
