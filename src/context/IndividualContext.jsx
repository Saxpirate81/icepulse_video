import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const IndividualContext = createContext(null)

export function IndividualProvider({ children }) {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [coaches, setCoaches] = useState([])
  const [seasons, setSeasons] = useState([])
  const [teams, setTeams] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Load all data from Supabase
  // This function is extracted so it can be called after updates to refresh data
  const loadData = async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const userId = user.id

      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('icepulse_teams')
        .select('*')
        .eq('individual_user_id', userId)
        .order('created_at', { ascending: false })

      if (teamsError) {
        console.error('Error loading teams:', teamsError)
      } else {
        setTeams(teamsData || [])
      }

      // Load seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('icepulse_seasons')
        .select('*')
        .eq('individual_user_id', userId)
        .order('created_at', { ascending: false })

      if (seasonsError) {
        console.error('Error loading seasons:', seasonsError)
      } else {
        setSeasons(seasonsData || [])
      }

      // Load coaches with assignments
      const { data: coachesData, error: coachesError } = await supabase
        .from('icepulse_coaches')
        .select(`
          *,
          assignments:icepulse_coach_assignments(
            id,
            team_id,
            season_id,
            assigned_date,
            team:icepulse_teams(name),
            season:icepulse_seasons(name)
          )
        `)
        .eq('individual_user_id', userId)
        .order('created_at', { ascending: false })

      if (coachesError) {
        console.error('Error loading coaches:', coachesError)
      } else {
        // Transform coaches data to match expected format
        const transformedCoaches = (coachesData || []).map(coach => ({
          id: coach.id,
          name: coach.full_name,
          fullName: coach.full_name,
          email: coach.email,
          isExistingUser: coach.is_existing_user,
          inviteSent: coach.invite_sent,
          inviteDate: coach.invite_date,
          assignments: (coach.assignments || []).map(assignment => ({
            id: assignment.id,
            teamId: assignment.team_id,
            seasonId: assignment.season_id,
            teamName: assignment.team?.name || '',
            seasonName: assignment.season?.name || '',
            assignedDate: assignment.assigned_date
          }))
        }))
        setCoaches(transformedCoaches)
      }

      // Load players with assignments
      // Players are accessible if:
      // 1. They belong to this user (individual_user_id matches)
      // 2. They have their own account (profile_id matches)
      // 3. They're connected to a parent whose email matches the user's email
      const userEmail = user.email?.toLowerCase() || ''
      
      // First, get players directly owned by this user or with matching profile_id
      const { data: directPlayers, error: directError } = await supabase
        .from('icepulse_players')
        .select(`
          *,
          assignments:icepulse_player_assignments(
            id,
            team_id,
            season_id,
            jersey_number,
            position,
            assigned_date,
            team:icepulse_teams(name),
            season:icepulse_seasons(name)
          )
        `)
        .or(`individual_user_id.eq.${userId},profile_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      // Then, get players accessible via parent email
      let parentPlayers = []
      if (userEmail) {
        // First, find parents with matching email
        const { data: matchingParents, error: parentLookupError } = await supabase
          .from('icepulse_parents')
          .select('id')
          .ilike('email', userEmail)

        if (!parentLookupError && matchingParents && matchingParents.length > 0) {
          const parentIds = matchingParents.map(p => p.id)
          
          // Find player connections to these parents
          const { data: connections, error: connectionsError } = await supabase
            .from('icepulse_parent_player_connections')
            .select('player_id')
            .in('parent_id', parentIds)

          if (!connectionsError && connections && connections.length > 0) {
            const playerIds = connections.map(c => c.player_id)
            
            // Get the actual player records with assignments
            const { data: parentPlayersData, error: parentPlayersError } = await supabase
              .from('icepulse_players')
              .select(`
                *,
                assignments:icepulse_player_assignments(
                  id,
                  team_id,
                  season_id,
                  jersey_number,
                  position,
                  assigned_date,
                  team:icepulse_teams(name),
                  season:icepulse_seasons(name)
                )
              `)
              .in('id', playerIds)
              .order('created_at', { ascending: false })

            if (!parentPlayersError && parentPlayersData) {
              parentPlayers = parentPlayersData
            }
          }
        }
      }

      // Combine and deduplicate players
      const allPlayers = [...(directPlayers || []), ...parentPlayers]
      const uniquePlayers = allPlayers.filter((player, index, self) =>
        index === self.findIndex(p => p.id === player.id)
      )

      const playersError = directError
      const playersData = uniquePlayers

      if (playersError) {
        console.error('Error loading players:', playersError)
      } else {
        // Transform players data to match expected format
        const transformedPlayers = (playersData || []).map(player => ({
          id: player.id,
          name: player.full_name?.split(' ')[0] || player.full_name,
          fullName: player.full_name,
          email: player.email,
          avatar: player.avatar_url,
          isExistingUser: player.is_existing_user,
          inviteSent: player.invite_sent,
          inviteDate: player.invite_date,
          teamAssignments: (player.assignments || []).map(assignment => ({
            id: assignment.id,
            teamId: assignment.team_id,
            seasonId: assignment.season_id,
            teamName: assignment.team?.name || '',
            seasonName: assignment.season?.name || '',
            jerseyNumber: assignment.jersey_number,
            position: assignment.position,
            assignedDate: assignment.assigned_date
          }))
        }))
        setPlayers(transformedPlayers)
      }
    } catch (error) {
      console.error('Error loading individual data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount and when user changes
  // SKIP auto-loading for parents/players to prevent database overload
  // They don't need this data - only individual users managing their own teams/seasons need it
  useEffect(() => {
    // Only load data for users who actually need it (not parents/players)
    if (user?.role && ['parent', 'player', 'game_recorder'].includes(user.role)) {
      console.log('⏭️ Skipping IndividualContext auto-load for', user.role, '- not needed')
      setIsLoading(false)
      return
    }
    
    loadData()
  }, [user?.id, user?.role])

  // Players CRUD
  const addPlayer = async (player) => {
    if (!user?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_players')
        .insert({
          individual_user_id: user.id,
          full_name: player.fullName || player.name,
          email: player.email || null,
          avatar_url: player.avatar || null,
          is_existing_user: player.isExistingUser || false,
          invite_sent: false,
          invite_date: null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding player:', error)
        return null
      }

      // Reload data to ensure all views have the latest data
      await loadData()
      
      // Return the newly added player from the reloaded data
      const { data: playerData } = await supabase
        .from('icepulse_players')
        .select(`
          *,
          assignments:icepulse_player_assignments(
            id,
            team_id,
            season_id,
            jersey_number,
            position,
            assigned_date,
            team:icepulse_teams(name),
            season:icepulse_seasons(name)
          )
        `)
        .eq('id', data.id)
        .single()
      
      if (playerData) {
        return {
          id: playerData.id,
          name: playerData.full_name?.split(' ')[0] || playerData.full_name,
          fullName: playerData.full_name,
          email: playerData.email,
          avatar: playerData.avatar_url,
          isExistingUser: playerData.is_existing_user,
          inviteSent: playerData.invite_sent,
          inviteDate: playerData.invite_date,
          teamAssignments: (playerData.assignments || []).map(assignment => ({
            id: assignment.id,
            teamId: assignment.team_id,
            seasonId: assignment.season_id,
            teamName: assignment.team?.name || '',
            seasonName: assignment.season?.name || '',
            jerseyNumber: assignment.jersey_number,
            position: assignment.position,
            assignedDate: assignment.assigned_date
          }))
        }
      }
      
      return null
    } catch (error) {
      console.error('Error adding player:', error)
      return null
    }
  }

  const updatePlayer = async (playerId, updates) => {
    if (!user?.id) return

    try {
      const updateData = {}
      if (updates.fullName) updateData.full_name = updates.fullName
      if (updates.name) updateData.full_name = updates.name
      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.avatar !== undefined) updateData.avatar_url = updates.avatar
      if (updates.isExistingUser !== undefined) updateData.is_existing_user = updates.isExistingUser
      if (updates.inviteSent !== undefined) updateData.invite_sent = updates.inviteSent
      if (updates.inviteDate !== undefined) updateData.invite_date = updates.inviteDate

      const { error } = await supabase
        .from('icepulse_players')
        .update(updateData)
        .eq('id', playerId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error updating player:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error updating player:', error)
    }
  }

  const deletePlayer = async (playerId) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_players')
        .delete()
        .eq('id', playerId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error deleting player:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error deleting player:', error)
    }
  }

  const addTeamAssignment = async (playerId, assignment) => {
    if (!user?.id) return

    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('icepulse_player_assignments')
        .select('id')
        .eq('player_id', playerId)
        .eq('team_id', assignment.teamId)
        .eq('season_id', assignment.seasonId)
        .single()

      let assignmentId
      if (existing) {
        // Update existing assignment
        const { data, error } = await supabase
          .from('icepulse_player_assignments')
          .update({
            jersey_number: assignment.jerseyNumber || null,
            position: assignment.position || null
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        assignmentId = data.id
      } else {
        // Create new assignment
        const { data, error } = await supabase
          .from('icepulse_player_assignments')
          .insert({
            player_id: playerId,
            team_id: assignment.teamId,
            season_id: assignment.seasonId,
            jersey_number: assignment.jerseyNumber || null,
            position: assignment.position || null
          })
          .select()
          .single()

        if (error) throw error
        assignmentId = data.id
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error adding team assignment:', error)
    }
  }

  const updateTeamAssignment = async (playerId, assignmentId, updates) => {
    if (!user?.id) return

    try {
      const updateData = {}
      if (updates.teamId !== undefined) updateData.team_id = updates.teamId
      if (updates.seasonId !== undefined) updateData.season_id = updates.seasonId
      if (updates.jerseyNumber !== undefined) updateData.jersey_number = updates.jerseyNumber
      if (updates.position !== undefined) updateData.position = updates.position

      const { error } = await supabase
        .from('icepulse_player_assignments')
        .update(updateData)
        .eq('id', assignmentId)

      if (error) throw error

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error updating team assignment:', error)
    }
  }

  const deleteTeamAssignment = async (playerId, assignmentId) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_player_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error deleting team assignment:', error)
    }
  }

  // Coaches CRUD
  const addCoach = async (coach) => {
    if (!user?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_coaches')
        .insert({
          individual_user_id: user.id,
          full_name: coach.fullName || coach.name,
          email: coach.email || null,
          is_existing_user: coach.isExistingUser || false,
          invite_sent: false,
          invite_date: null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding coach:', error)
        return null
      }

      const newCoach = {
        id: data.id,
        name: data.full_name,
        fullName: data.full_name,
        email: data.email,
        isExistingUser: data.is_existing_user,
        inviteSent: data.invite_sent,
        inviteDate: data.invite_date,
        assignments: []
      }

      // Reload data to ensure all views have the latest data
      await loadData()
      
      // Return the newly added coach from the reloaded data
      const { data: coachData } = await supabase
        .from('icepulse_coaches')
        .select(`
          *,
          assignments:icepulse_coach_assignments(
            id,
            team_id,
            season_id,
            assigned_date,
            team:icepulse_teams(name),
            season:icepulse_seasons(name)
          )
        `)
        .eq('id', data.id)
        .single()
      
      if (coachData) {
        return {
          id: coachData.id,
          name: coachData.full_name,
          fullName: coachData.full_name,
          email: coachData.email,
          isExistingUser: coachData.is_existing_user,
          inviteSent: coachData.invite_sent,
          inviteDate: coachData.invite_date,
          assignments: (coachData.assignments || []).map(assignment => ({
            id: assignment.id,
            teamId: assignment.team_id,
            seasonId: assignment.season_id,
            teamName: assignment.team?.name || '',
            seasonName: assignment.season?.name || '',
            assignedDate: assignment.assigned_date
          }))
        }
      }
      
      return null
    } catch (error) {
      console.error('Error adding coach:', error)
      return null
    }
  }

  const updateCoach = async (coachId, updates) => {
    if (!user?.id) return

    try {
      const updateData = {}
      if (updates.fullName) updateData.full_name = updates.fullName
      if (updates.name) updateData.full_name = updates.name
      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.isExistingUser !== undefined) updateData.is_existing_user = updates.isExistingUser
      if (updates.inviteSent !== undefined) updateData.invite_sent = updates.inviteSent
      if (updates.inviteDate !== undefined) updateData.invite_date = updates.inviteDate

      const { error } = await supabase
        .from('icepulse_coaches')
        .update(updateData)
        .eq('id', coachId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error updating coach:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error updating coach:', error)
    }
  }

  const deleteCoach = async (coachId) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_coaches')
        .delete()
        .eq('id', coachId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error deleting coach:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error deleting coach:', error)
    }
  }

  const addCoachAssignment = async (coachId, assignment) => {
    if (!user?.id) return

    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('icepulse_coach_assignments')
        .select('id')
        .eq('coach_id', coachId)
        .eq('team_id', assignment.teamId)
        .eq('season_id', assignment.seasonId)
        .single()

      if (existing) {
        // Assignment already exists, no need to create again
        return
      }

      const { data, error } = await supabase
        .from('icepulse_coach_assignments')
        .insert({
          coach_id: coachId,
          team_id: assignment.teamId,
          season_id: assignment.seasonId
        })
        .select()
        .single()

      if (error) throw error

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error adding coach assignment:', error)
    }
  }

  const updateCoachAssignment = async (coachId, assignmentId, updates) => {
    if (!user?.id) return

    try {
      const updateData = {}
      if (updates.teamId !== undefined) updateData.team_id = updates.teamId
      if (updates.seasonId !== undefined) updateData.season_id = updates.seasonId

      const { error } = await supabase
        .from('icepulse_coach_assignments')
        .update(updateData)
        .eq('id', assignmentId)

      if (error) throw error

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error updating coach assignment:', error)
    }
  }

  const deleteCoachAssignment = async (coachId, assignmentId) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_coach_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error deleting coach assignment:', error)
    }
  }

  // Seasons CRUD
  const addSeason = async (season) => {
    if (!user?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_seasons')
        .insert({
          individual_user_id: user.id,
          name: season.name,
          type: season.type || 'season',
          start_date: season.startDate || null,
          end_date: season.endDate || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding season:', error)
        return null
      }

      const newSeason = {
        id: data.id,
        name: data.name,
        type: data.type,
        startDate: data.start_date,
        endDate: data.end_date
      }

      // Reload data to ensure all views have the latest data
      await loadData()
      
      // Return the newly added season from the reloaded data
      const { data: seasonData } = await supabase
        .from('icepulse_seasons')
        .select('*')
        .eq('id', data.id)
        .single()
      
      if (seasonData) {
        return {
          id: seasonData.id,
          name: seasonData.name,
          type: seasonData.type,
          startDate: seasonData.start_date,
          endDate: seasonData.end_date
        }
      }
      
      return null
    } catch (error) {
      console.error('Error adding season:', error)
      return null
    }
  }

  const updateSeason = async (seasonId, updates) => {
    if (!user?.id) return

    try {
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.type !== undefined) updateData.type = updates.type
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate

      const { error } = await supabase
        .from('icepulse_seasons')
        .update(updateData)
        .eq('id', seasonId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error updating season:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error updating season:', error)
    }
  }

  const deleteSeason = async (seasonId) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_seasons')
        .delete()
        .eq('id', seasonId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error deleting season:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error deleting season:', error)
    }
  }

  // Teams CRUD
  const addTeam = async (team) => {
    if (!user?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_teams')
        .insert({
          individual_user_id: user.id,
          name: team.name
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding team:', error)
        return null
      }

      // Reload data to ensure all views have the latest data
      await loadData()
      
      // Return the newly added team from the reloaded data
      const { data: teamData } = await supabase
        .from('icepulse_teams')
        .select('*')
        .eq('id', data.id)
        .single()
      
      if (teamData) {
        return {
          id: teamData.id,
          name: teamData.name
        }
      }
      
      return null
    } catch (error) {
      console.error('Error adding team:', error)
      return null
    }
  }

  const updateTeam = async (teamId, updates) => {
    if (!user?.id) return

    try {
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name

      const { error } = await supabase
        .from('icepulse_teams')
        .update(updateData)
        .eq('id', teamId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error updating team:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error updating team:', error)
    }
  }

  const deleteTeam = async (teamId) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_teams')
        .delete()
        .eq('id', teamId)
        .eq('individual_user_id', user.id)

      if (error) {
        console.error('Error deleting team:', error)
        return
      }

      // Reload data to ensure all views have the latest data
      await loadData()
    } catch (error) {
      console.error('Error deleting team:', error)
    }
  }

  // Get videos for players/parents based on their team/season associations
  // Timeout helper for video queries
  const withVideoTimeout = (promise, timeoutMs = 8000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Video query timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ])
  }

  const getPlayerVideos = async () => {
    console.log('🎥 getPlayerVideos: Called', { hasUser: !!user, userId: user?.id, userRole: user?.role })
    
    if (!user?.id) {
      console.log('🎥 getPlayerVideos: No user ID')
      return []
    }

    try {
      const userId = user.id
      const isPlayer = user.role === 'player'
      const isParent = user.role === 'parent'

      console.log('🎥 getPlayerVideos: Starting', { userId, isPlayer, isParent, actualRole: user.role })

      if (!isPlayer && !isParent) {
        console.log('🎥 getPlayerVideos: Not a player or parent - role is:', user.role)
        return []
      }

      // Get team IDs that the player/parent is associated with
      let teamIds = []

      if (isPlayer) {
        // For players: get teams from player assignments with timeout
        const playerResult = await withVideoTimeout(
          supabase
            .from('icepulse_players')
            .select('id')
            .or(`profile_id.eq.${userId},individual_user_id.eq.${userId}`)
            .limit(1),
          5000
        ).catch(err => ({ data: null, error: err }))

        const playerData = playerResult.data?.[0]

        if (playerData?.id) {
          const assignmentsResult = await withVideoTimeout(
            supabase
              .from('icepulse_player_assignments')
              .select('team_id')
              .eq('player_id', playerData.id)
              .limit(20), // Limit assignments
            5000
          ).catch(err => ({ data: null, error: err }))

          if (assignmentsResult.data) {
            teamIds = assignmentsResult.data.map(a => a.team_id)
          }
        }
      } else if (isParent) {
        // For parents: get teams from their children's assignments with timeout
        console.log('🎥 getPlayerVideos: Looking up parent record for userId:', userId)
        const parentResult = await withVideoTimeout(
          supabase
            .from('icepulse_parents')
            .select('id')
            .eq('profile_id', userId)
            .limit(1),
          5000
        ).catch(err => {
          console.error('🎥 getPlayerVideos: Parent query error:', err)
          return { data: null, error: err }
        })

        console.log('🎥 getPlayerVideos: Parent query result', { parentResult })

        if (parentResult.error) {
          console.error('🎥 getPlayerVideos: Error finding parent:', parentResult.error)
        }

        const parentData = parentResult.data?.[0]

        if (parentData?.id) {
          console.log('🎥 getPlayerVideos: Found parent, looking up connections for parent_id:', parentData.id)
          const connectionsResult = await withVideoTimeout(
            supabase
              .from('icepulse_parent_player_connections')
              .select('player_id')
              .eq('parent_id', parentData.id)
              .limit(10), // Limit connections
            5000
          ).catch(err => {
            console.error('🎥 getPlayerVideos: Connections query error:', err)
            return { data: null, error: err }
          })

          console.log('🎥 getPlayerVideos: Connections query result', { connectionsResult })

          if (connectionsResult.data && connectionsResult.data.length > 0) {
            const playerIds = connectionsResult.data.map(c => c.player_id)
            console.log('🎥 getPlayerVideos: Found connected player IDs:', playerIds)
            
            const assignmentsResult = await withVideoTimeout(
              supabase
                .from('icepulse_player_assignments')
                .select('team_id')
                .in('player_id', playerIds)
                .limit(20), // Limit assignments
              5000
            ).catch(err => {
              console.error('🎥 getPlayerVideos: Assignments query error:', err)
              return { data: null, error: err }
            })

            console.log('🎥 getPlayerVideos: Assignments query result', { assignmentsResult })

            if (assignmentsResult.data && assignmentsResult.data.length > 0) {
              teamIds = [...new Set(assignmentsResult.data.map(a => a.team_id).filter(Boolean))]
              console.log('🎥 getPlayerVideos: Found team IDs from assignments:', teamIds)
            } else {
              console.warn('🎥 getPlayerVideos: No assignments found for connected players')
            }
          } else {
            console.warn('🎥 getPlayerVideos: No player connections found for parent')
          }
        } else {
          console.warn('🎥 getPlayerVideos: No parent record found for userId:', userId)
        }
      }

      if (teamIds.length === 0) {
        console.log('🎥 getPlayerVideos: No team IDs found')
        return []
      }

      // Limit team IDs to prevent huge queries
      teamIds = teamIds.slice(0, 10)
      console.log('🎥 getPlayerVideos: Looking up games for team IDs:', teamIds.length)

      // Get games for these teams with timeout
      const gamesResult = await withVideoTimeout(
        supabase
          .from('icepulse_games')
          .select('id')
          .in('team_id', teamIds)
          .limit(50), // Limit games
        5000
      ).catch(err => ({ data: null, error: err }))

      // Use database function to efficiently fetch videos, bypassing complex RLS checks
      // This function performs optimized queries internally and avoids timeout issues
      console.log('🎥 getPlayerVideos: Using database function to fetch videos efficiently')
      
      const { data: videos, error: videosError } = await withVideoTimeout(
        supabase.rpc('get_player_parent_videos', {
          p_user_id: userId,
          p_user_role: user.role,
          p_limit: 20
        }),
        10000 // 10 second timeout for the function
      ).catch(err => {
        console.error('🎥 getPlayerVideos: Database function error:', err)
        return { data: null, error: err }
      })

      if (videosError) {
        console.error('❌ Error fetching player videos via function:', videosError)
        return []
      }

      if (!videos || videos.length === 0) {
        console.log('🎥 getPlayerVideos: No videos found via database function')
        return []
      }

      console.log('🎥 getPlayerVideos: Found', videos.length, 'videos via database function')

      // Use the videos from the function
      const limitedVideos = videos
      
      // Now fetch game/team/season data separately with timeout
      const gameIdsForLookup = [...new Set(limitedVideos.map(v => v.game_id).filter(Boolean))]
      console.log('🎥 getPlayerVideos: Fetching game details for', gameIdsForLookup.length, 'games')
      
      const gamesDataResult = await withVideoTimeout(
        supabase
          .from('icepulse_games')
          .select('id, opponent, game_date, game_time, location, team_id, season_id')
          .in('id', gameIdsForLookup)
          .limit(20), // Limit games
        5000
      ).catch(err => {
        console.error('🎥 Games data query timeout:', err)
        return { data: [], error: err }
      })

      const gamesData = gamesDataResult.data || []

      // Create a map of game data
      const gamesMap = new Map()
      gamesData.forEach(game => {
        gamesMap.set(game.id, game)
      })

      // Fetch team and season names separately with timeouts
      const gameTeamIds = [...new Set(gamesData.map(g => g.team_id).filter(Boolean))].slice(0, 10)
      const gameSeasonIds = [...new Set(gamesData.map(g => g.season_id).filter(Boolean))].slice(0, 10)

      const [teamsResult, seasonsResult] = await Promise.all([
        gameTeamIds.length > 0 
          ? withVideoTimeout(
              supabase.from('icepulse_teams').select('id, name').in('id', gameTeamIds).limit(10),
              5000
            ).catch(err => {
              console.error('🎥 Teams query timeout:', err)
              return { data: [], error: err }
            })
          : Promise.resolve({ data: [], error: null }),
        gameSeasonIds.length > 0
          ? withVideoTimeout(
              supabase.from('icepulse_seasons').select('id, name').in('id', gameSeasonIds).limit(10),
              5000
            ).catch(err => {
              console.error('🎥 Seasons query timeout:', err)
              return { data: [], error: err }
            })
          : Promise.resolve({ data: [], error: null })
      ])

      const teamsMap = new Map()
      if (teamsResult.data) {
        teamsResult.data.forEach(team => teamsMap.set(team.id, team.name))
      }

      const seasonsMap = new Map()
      if (seasonsResult.data) {
        seasonsResult.data.forEach(season => seasonsMap.set(season.id, season.name))
      }

      // Format videos with game/team/season data (use limited videos)
      const formattedVideos = limitedVideos.map(video => {
        const game = gamesMap.get(video.game_id)
        const teamName = game?.team_id ? teamsMap.get(game.team_id) : null
        const seasonName = game?.season_id ? seasonsMap.get(game.season_id) : null

        // Format video URL properly
        let videoUrl = video.video_url
        if (videoUrl && !videoUrl.startsWith('http')) {
          // If it's a storage path, get the public URL
          videoUrl = supabase.storage.from('videos').getPublicUrl(videoUrl).data.publicUrl
        }

        let thumbnailUrl = video.thumbnail_url
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          thumbnailUrl = supabase.storage.from('videos').getPublicUrl(thumbnailUrl).data.publicUrl
        }

        return {
          ...video,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          game: game ? {
            ...game,
            teamName,
            seasonName,
            gameDate: game.game_date,
            gameTime: game.game_time,
          } : null,
          userName: 'Unknown User' // We can fetch this separately if needed
        }
      })

      console.log('🎥 getPlayerVideos: Returning', formattedVideos.length, 'formatted videos')
      return formattedVideos
    } catch (error) {
      console.error('Error in getPlayerVideos:', error)
      return []
    }
  }

  const value = {
    players,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addTeamAssignment,
    updateTeamAssignment,
    deleteTeamAssignment,
    coaches,
    addCoach,
    updateCoach,
    deleteCoach,
    addCoachAssignment,
    updateCoachAssignment,
    deleteCoachAssignment,
    seasons,
    addSeason,
    updateSeason,
    deleteSeason,
    teams,
    addTeam,
    updateTeam,
    deleteTeam,
    isLoading,
    getPlayerVideos,
  }

  return <IndividualContext.Provider value={value}>{children}</IndividualContext.Provider>
}

export function useIndividual() {
  const context = useContext(IndividualContext)
  if (!context) {
    throw new Error('useIndividual must be used within an IndividualProvider')
  }
  return context
}
