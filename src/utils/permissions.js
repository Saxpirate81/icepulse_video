// Permission levels and their access
export const ROLES = {
  ORGANIZATION: 'organization',
  COACH: 'coach',
  PLAYER: 'player',
  PARENT: 'parent',
  GAME_RECORDER: 'game_recorder', // For recording live games for teams
}

// Permission checks
export const hasPermission = (user, permission) => {
  if (!user || !user.role) return false

  switch (user.role) {
    case ROLES.ORGANIZATION:
      // Organization can edit organizational information
      return permission === 'edit_organization' || 
             permission === 'view_organization' ||
             permission === 'manage_teams' ||
             permission === 'manage_seasons' ||
             permission === 'manage_coaches' ||
             permission === 'manage_players' ||
             permission === 'manage_parents' ||
             permission === 'manage_games' ||
             permission === 'view_videos' ||
             permission === 'record_video'
    
    case ROLES.COACH:
      // Coach has similar access to organization
      return permission === 'edit_organization' || 
             permission === 'view_organization' ||
             permission === 'manage_teams' ||
             permission === 'manage_seasons' ||
             permission === 'manage_coaches' ||
             permission === 'manage_players' ||
             permission === 'manage_parents' ||
             permission === 'manage_games' ||
             permission === 'view_videos' ||
             permission === 'record_video'
    
    case ROLES.PLAYER:
    case ROLES.PARENT:
      // Players and parents cannot see Manage Data
      return permission === 'view_videos' || 
             permission === 'record_video' ||
             permission === 'view_stats'
    
    case ROLES.GAME_RECORDER:
      // Game recorder can record live games for teams
      return permission === 'record_team_game' ||
             permission === 'view_videos' ||
             permission === 'record_video'
    
    default:
      return false
  }
}

// Check if user can access Manage Data
export const canAccessManageData = (user) => {
  if (!user || !user.role) return false
  return user.role === ROLES.ORGANIZATION || user.role === ROLES.COACH
}

// Check if user can edit organizational info
export const canEditOrganization = (user) => {
  if (!user || !user.role) return false
  return user.role === ROLES.ORGANIZATION || user.role === ROLES.COACH
}

// Check if user can view videos
export const canViewVideos = (user) => {
  if (!user || !user.role) return false
  return true // All roles can view videos
}
