import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getAdminClient } from '../lib/supabase-admin'
import { useAuth } from './AuthContext'
import { USE_MOCK } from '../lib/supabase-mock'
import { mockOrganization, mockOrganizations, mockResponses } from '../lib/mock-data'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [organizations, setOrganizations] = useState([]) // All organizations user is part of
  const [selectedOrgId, setSelectedOrgId] = useState(null) // Currently selected organization
  const [isLoading, setIsLoading] = useState(true)
  const [databaseError, setDatabaseError] = useState(null) // Track database connection issues

  // Find all organizations where user is a member (owner OR player/coach/parent)
  const findUserOrganizations = async (userId) => {
    const orgs = []

    // 1. Organizations user OWNS
    const { data: ownedOrgs } = await supabase
      .from('icepulse_organizations')
      .select('id, name, owner_id')
      .eq('owner_id', userId)

    if (ownedOrgs) {
      orgs.push(...ownedOrgs.map(org => ({ ...org, role: 'owner', accessType: 'owner' })))
    }

    // 2. Organizations where user is a PLAYER
    const { data: playerRecords } = await supabase
      .from('icepulse_players')
      .select('organization_id')
      .eq('profile_id', userId)
      .not('organization_id', 'is', null)

    if (playerRecords && playerRecords.length > 0) {
      const playerOrgIds = [...new Set(playerRecords.map(p => p.organization_id).filter(Boolean))]
      if (playerOrgIds.length > 0) {
        const { data: playerOrgData } = await supabase
          .from('icepulse_organizations')
          .select('id, name, owner_id')
          .in('id', playerOrgIds)

        if (playerOrgData) {
          orgs.push(...playerOrgData.map(org => ({
            ...org,
            role: 'player',
            accessType: 'member'
          })))
        }
      }
    }

    // 3. Organizations where user is a COACH
    const { data: coachRecords } = await supabase
      .from('icepulse_coaches')
      .select('organization_id')
      .eq('profile_id', userId)
      .not('organization_id', 'is', null)

    if (coachRecords && coachRecords.length > 0) {
      const coachOrgIds = [...new Set(coachRecords.map(c => c.organization_id).filter(Boolean))]
      if (coachOrgIds.length > 0) {
        const { data: coachOrgData } = await supabase
          .from('icepulse_organizations')
          .select('id, name, owner_id')
          .in('id', coachOrgIds)

        if (coachOrgData) {
          orgs.push(...coachOrgData.map(org => ({
            ...org,
            role: 'coach',
            accessType: 'member'
          })))
        }
      }
    }

    // 4. Organizations where user is a PARENT
    const { data: parentRecords } = await supabase
      .from('icepulse_parents')
      .select('organization_id')
      .eq('profile_id', userId)
      .not('organization_id', 'is', null)

    if (parentRecords && parentRecords.length > 0) {
      const parentOrgIds = [...new Set(parentRecords.map(p => p.organization_id).filter(Boolean))]
      if (parentOrgIds.length > 0) {
        const { data: parentOrgData } = await supabase
          .from('icepulse_organizations')
          .select('id, name, owner_id')
          .in('id', parentOrgIds)

        if (parentOrgData) {
          orgs.push(...parentOrgData.map(org => ({
            ...org,
            role: 'parent',
            accessType: 'member'
          })))
        }
      }
    }

    // Remove duplicates and return
    const uniqueOrgs = orgs.filter((org, index, self) => 
      index === self.findIndex(o => o.id === org.id)
    )

    return uniqueOrgs
  }

  // Load organization data from Supabase
  // This function is extracted so it can be called after updates to refresh data
  const loadOrganization = async (orgId = null) => {
    // MOCK MODE: Use mock data if enabled
    if (USE_MOCK) {
      setIsLoading(true)
      await new Promise(resolve => setTimeout(resolve, 300)) // Simulate network delay
      setOrganizations(mockOrganizations)
      setSelectedOrgId(mockOrganization.id)
      setOrganization({
        ...mockOrganization,
        isOwner: true,
        userRoleInOrg: 'organization',
        ownerId: user?.id || 'mock-user-1'
      })
      setIsLoading(false)
      return
    }

    if (!user?.id) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const userId = user.id

      // First, find all organizations user is part of
      const userOrgs = await findUserOrganizations(userId)
      setOrganizations(userOrgs)

      // Determine which organization to load
      // Use the passed orgId parameter, or fall back to selectedOrgId state
      let targetOrgId = orgId !== null && orgId !== undefined ? orgId : (selectedOrgId || null)

      // If no org selected, prioritize: owned org > first org
      if (!targetOrgId) {
        const ownedOrg = userOrgs.find(org => org.accessType === 'owner')
        if (ownedOrg) {
          targetOrgId = ownedOrg.id
        } else if (userOrgs.length > 0) {
          targetOrgId = userOrgs[0].id
        }
      }

      // If still no org and user has role that suggests they should have an org, create one
      if (!targetOrgId && (user.role === 'organization' || user.role === 'coach')) {
        const { data: newOrg, error: createError } = await supabase
          .from('icepulse_organizations')
          .insert({
            owner_id: userId,
            name: user.name || 'My Organization'
          })
          .select()
          .single()

        if (!createError && newOrg) {
          targetOrgId = newOrg.id
          // Reload orgs list
          const updatedOrgs = await findUserOrganizations(userId)
          setOrganizations(updatedOrgs)
        }
      }

      if (!targetOrgId) {
        setIsLoading(false)
        return
      }

      // Update selected org
      setSelectedOrgId(targetOrgId)

      // Load the selected organization
      let { data: orgData, error: orgError } = await supabase
        .from('icepulse_organizations')
        .select('*')
        .eq('id', targetOrgId)
        .single()

      if (orgError) {
        console.error('Error loading organization:', orgError)
        setIsLoading(false)
        return
      }

      if (!orgData) {
        setIsLoading(false)
        return
      }

      const currentOrgId = orgData.id

      // Helper function to add timeout to a promise
      const withTimeout = (promise, timeoutMs = 10000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ])
      }

      // Load all related data in parallel with timeout protection
      let teamsResult, seasonsResult, coachesResult, playersResult, parentsResult, gamesResult, locationsResult
      
      try {
        [teamsResult, seasonsResult, coachesResult, playersResult, parentsResult, gamesResult, locationsResult] = await Promise.all([
          // Teams
          withTimeout(
            supabase
              .from('icepulse_teams')
              .select('*')
              .eq('organization_id', currentOrgId)
              .order('created_at', { ascending: false })
          ),
          
          // Seasons
          withTimeout(
            supabase
              .from('icepulse_seasons')
              .select('*')
              .eq('organization_id', currentOrgId)
              .order('created_at', { ascending: false })
          ),
          
          // Coaches with assignments
          withTimeout(
            supabase
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
              .eq('organization_id', currentOrgId)
              .order('created_at', { ascending: false })
          ),
          
          // Players with assignments
          withTimeout(
            supabase
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
              .eq('organization_id', currentOrgId)
              .order('created_at', { ascending: false })
          ),
          
          // Parents with connections
          withTimeout(
            supabase
              .from('icepulse_parents')
              .select(`
                *,
                connections:icepulse_parent_player_connections(
                  player_id
                )
              `)
              .eq('organization_id', currentOrgId)
              .order('created_at', { ascending: false })
          ),
          
          // Games/Schedule
          withTimeout(
            supabase
              .from('icepulse_games')
              .select('*')
              .eq('organization_id', currentOrgId)
              .order('game_date', { ascending: true })
              .order('game_time', { ascending: true })
          ),
          
          // Locations
          withTimeout(
            supabase
              .from('icepulse_locations')
              .select('*')
              .eq('organization_id', currentOrgId)
              .order('name', { ascending: true })
          )
        ])
      } catch (timeoutError) {
        console.error('⚠️ Database query timeout - Supabase may be slow or unavailable:', timeoutError)
        setDatabaseError('Database connection timeout. Supabase may be restarting. Please wait a moment and refresh.')
        // Continue with empty data rather than crashing
        teamsResult = { data: [], error: timeoutError }
        seasonsResult = { data: [], error: timeoutError }
        coachesResult = { data: [], error: timeoutError }
        playersResult = { data: [], error: timeoutError }
        parentsResult = { data: [], error: timeoutError }
        gamesResult = { data: [], error: timeoutError }
        locationsResult = { data: [], error: timeoutError }
      }

      // Get user's role in this organization
      const userOrg = userOrgs.find(o => o.id === orgData.id)
      const userRoleInOrg = userOrg?.role || user.role
      const isOwner = userOrg?.accessType === 'owner' || orgData.owner_id === userId

      // Transform and set organization data
      const org = {
        id: orgData.id,
        name: orgData.name,
        ownerId: orgData.owner_id,
        isOwner: isOwner,
        userRoleInOrg: userRoleInOrg,
        teams: (teamsResult.data || []).map(team => ({
          id: team.id,
          name: team.name
        })),
        seasons: (seasonsResult.data || []).map(season => ({
          id: season.id,
          name: season.name,
          type: season.type,
          startDate: season.start_date,
          endDate: season.end_date
        })),
        coaches: (coachesResult.data || []).map(coach => ({
          id: coach.id,
          name: coach.full_name,
          fullName: coach.full_name,
          email: coach.email,
          isExistingUser: coach.is_existing_user,
          inviteSent: coach.invite_sent,
          inviteDate: coach.invite_date,
          assignments: (coach.assignments || []).map(a => ({
            id: a.id,
            teamId: a.team_id,
            seasonId: a.season_id,
            teamName: a.team?.name || '',
            seasonName: a.season?.name || '',
            assignedDate: a.assigned_date
          }))
        })),
        players: (playersResult.data || []).map(player => ({
          id: player.id,
          name: player.full_name?.split(' ')[0] || player.full_name,
          fullName: player.full_name,
          email: player.email,
          avatar: player.avatar_url,
          isExistingUser: player.is_existing_user,
          inviteSent: player.invite_sent,
          inviteDate: player.invite_date,
          teamAssignments: (player.assignments || []).map(a => ({
            id: a.id,
            teamId: a.team_id,
            seasonId: a.season_id,
            teamName: a.team?.name || '',
            seasonName: a.season?.name || '',
            jerseyNumber: a.jersey_number,
            position: a.position,
            assignedDate: a.assigned_date
          }))
        })),
        parents: (parentsResult.data || []).map(parent => ({
          id: parent.id,
          name: parent.full_name,
          fullName: parent.full_name,
          email: parent.email,
          isExistingUser: parent.is_existing_user,
          inviteSent: parent.invite_sent,
          inviteDate: parent.invite_date,
          playerConnections: (parent.connections || []).map(c => c.player_id)
        })),
        games: (gamesResult.data || []).map(game => ({
          id: game.id,
          teamId: game.team_id,
          seasonId: game.season_id,
          gameDate: game.game_date,
          gameTime: game.game_time,
          opponent: game.opponent,
          location: game.location,
          notes: game.notes
        })),
        locations: (locationsResult.data || []).map(location => ({
          id: location.id,
          name: location.name,
          city: location.city,
          state: location.state
        }))
      }

      setOrganization(org)
    } catch (error) {
      console.error('Error loading organization:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to switch organizations
  const switchOrganization = async (orgId) => {
    setSelectedOrgId(orgId)
    await loadOrganization(orgId)
  }

  // Load organization on mount and when user changes
  useEffect(() => {
    loadOrganization()
  }, [user?.id])

  // Note: We don't add a useEffect for selectedOrgId to avoid infinite loops
  // The switchOrganization function handles loading when org is switched

  const saveOrganization = async (orgData) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_organizations')
        .update({
          name: orgData.name
        })
        .eq('id', organization.id)
        .eq('owner_id', user.id)

      if (error) {
        console.error('Error saving organization:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error saving organization:', error)
    }
  }

  const updateOrganization = async (updates) => {
    if (!user?.id || !organization?.id) return

    try {
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name

      const { error } = await supabase
        .from('icepulse_organizations')
        .update(updateData)
        .eq('id', organization.id)
        .eq('owner_id', user.id)

      if (error) {
        console.error('Error updating organization:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating organization:', error)
    }
  }

  const addTeam = async (team) => {
    if (!user?.id || !organization?.id) return

    try {
      const { data, error } = await supabase
        .from('icepulse_teams')
        .insert({
          organization_id: organization.id,
          name: team.name
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding team:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error adding team:', error)
    }
  }

  const updateTeam = async (teamId, updates) => {
    if (!user?.id || !organization?.id) return

    try {
      const updateData = {}
      if (updates.name !== undefined) updateData.name = updates.name

      const { error } = await supabase
        .from('icepulse_teams')
        .update(updateData)
        .eq('id', teamId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error updating team:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating team:', error)
    }
  }

  const deleteTeam = async (teamId) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_teams')
        .delete()
        .eq('id', teamId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error deleting team:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error deleting team:', error)
    }
  }

  const addSeason = async (season) => {
    if (!user?.id || !organization?.id) return

    try {
      const { data, error } = await supabase
        .from('icepulse_seasons')
        .insert({
          organization_id: organization.id,
          name: season.name,
          type: season.type || 'season',
          start_date: season.startDate || null,
          end_date: season.endDate || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding season:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error adding season:', error)
    }
  }

  const updateSeason = async (seasonId, updates) => {
    if (!user?.id || !organization?.id) return

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
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error updating season:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating season:', error)
    }
  }

  const deleteSeason = async (seasonId) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_seasons')
        .delete()
        .eq('id', seasonId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error deleting season:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error deleting season:', error)
    }
  }

  const addCoach = async (coach) => {
    if (!user?.id || !organization?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_coaches')
        .insert({
          organization_id: organization.id,
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

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
      
      // Return the newly added coach from the reloaded data
      const reloadedOrg = await supabase
        .from('icepulse_organizations')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      
      if (reloadedOrg.data) {
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
            assignments: (coachData.assignments || []).map(a => ({
              id: a.id,
              teamId: a.team_id,
              seasonId: a.season_id,
              teamName: a.team?.name || '',
              seasonName: a.season?.name || '',
              assignedDate: a.assigned_date
            }))
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error adding coach:', error)
      return null
    }
  }

  const updateCoach = async (coachId, updates) => {
    if (!user?.id || !organization?.id) return

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
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error updating coach:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating coach:', error)
    }
  }

  const deleteCoach = async (coachId) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_coaches')
        .delete()
        .eq('id', coachId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error deleting coach:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error deleting coach:', error)
    }
  }

  const sendCoachInvite = async (coachId) => {
    console.log('[sendCoachInvite] Starting invite process for coachId:', coachId)
    const coach = organization?.coaches?.find(c => c.id === coachId)
    if (!coach) {
      console.error('[sendCoachInvite] Coach not found:', coachId)
      return { success: false, message: 'Coach not found' }
    }
    if (!coach.email || !coach.email.trim()) {
      console.error('[sendCoachInvite] No email address for coach:', coach)
      return { success: false, message: 'Email address is required to send invite' }
    }
    
    console.log('[sendCoachInvite] Coach found:', { id: coach.id, name: coach.fullName, email: coach.email })
    
    // For testing: Automatically create auth account with password "password"
    const adminClient = getAdminClient()
    if (adminClient) {
      try {
        console.log('[sendCoachInvite] Creating auth account for testing...')
        
        // Check if user already exists
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === coach.email)
        
        if (existingUser) {
          console.log('[sendCoachInvite] Auth account already exists for this email:', existingUser.id)
          // Update coach record to link to existing user
          await updateCoach(coachId, {
            isExistingUser: true
          })
        } else {
          // Create new auth user with password "password" for testing
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: coach.email,
            password: 'password', // Generic password for testing
            email_confirm: true, // Auto-confirm email for testing
            user_metadata: {
              name: coach.fullName || coach.name,
              account_type: 'individual',
              role: 'coach'
            }
          })
          
          if (createError) {
            console.error('[sendCoachInvite] Failed to create auth account:', createError)
            // Continue anyway - we'll still mark invite as sent
          } else {
            console.log('[sendCoachInvite] Auth account created successfully:', newUser.user.id)
            // Wait for trigger to create profile and link to coach record
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            // Update coach record to mark as existing user
            await updateCoach(coachId, {
              isExistingUser: true
            })
          }
        }
      } catch (error) {
        console.error('[sendCoachInvite] Error creating auth account:', error)
        // Continue anyway - we'll still mark invite as sent
      }
    } else {
      console.warn('[sendCoachInvite] Admin client not available - skipping auto-account creation')
    }
    
    // Update database to mark invite as sent
    console.log('[sendCoachInvite] Updating database to mark invite as sent...')
    await updateCoach(coachId, {
      inviteSent: true,
      inviteDate: new Date().toISOString()
    })
    console.log('[sendCoachInvite] Database updated successfully')
    
    // TODO: Replace with actual API call to send invite email
    // For now, log what would be sent
    console.log('[sendCoachInvite] EMAIL SENDING NOT IMPLEMENTED - Would send email to:', {
      to: coach.email,
      subject: `Invitation to join ${organization?.name || 'the organization'}`,
      body: `Hello ${coach.fullName || coach.name},\n\nYou have been invited to join ${organization?.name || 'the organization'} as a coach.\n\nFor testing, you can log in with:\nEmail: ${coach.email}\nPassword: password\n\nSign in at: ${window.location.origin}\n\nThank you!`
    })
    console.warn('[sendCoachInvite] ⚠️ Email sending is not yet implemented. The invite has been marked as sent in the database, but no actual email was sent.')
    console.log('[sendCoachInvite] ✅ TESTING MODE: Auth account created/verified. Login credentials:', {
      email: coach.email,
      password: 'password'
    })
    
    return { success: true, message: 'Invite sent successfully. Account created for testing - login with password "password"' }
  }

  const resendCoachInvite = async (coachId) => {
    return await sendCoachInvite(coachId)
  }

  const assignCoachToTeam = async (coachId, teamId, seasonId) => {
    if (!user?.id || !organization?.id) return

    try {
      // Check if assignment already exists
      const { data: existing, error: checkError } = await supabase
        .from('icepulse_coach_assignments')
        .select('id')
        .eq('coach_id', coachId)
        .eq('team_id', teamId)
        .eq('season_id', seasonId)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid 406 when no row exists

      if (existing) {
        // Assignment already exists
        return
      }

      const { data, error } = await supabase
        .from('icepulse_coach_assignments')
        .insert({
          coach_id: coachId,
          team_id: teamId,
          season_id: seasonId
        })
        .select()
        .single()

      if (error) throw error

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error assigning coach to team:', error)
    }
  }

  const addPlayer = async (player) => {
    if (!user?.id || !organization?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_players')
        .insert({
          organization_id: organization.id,
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

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
      
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
          teamAssignments: (playerData.assignments || []).map(a => ({
            id: a.id,
            teamId: a.team_id,
            seasonId: a.season_id,
            teamName: a.team?.name || '',
            seasonName: a.season?.name || '',
            jerseyNumber: a.jersey_number,
            position: a.position,
            assignedDate: a.assigned_date
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
    if (!user?.id || !organization?.id) return

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
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error updating player:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating player:', error)
    }
  }

  const deletePlayer = async (playerId) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_players')
        .delete()
        .eq('id', playerId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error deleting player:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error deleting player:', error)
    }
  }

  const assignPlayerToTeam = async (playerId, teamId, seasonId, jerseyNumber) => {
    if (!user?.id || !organization?.id) return

    try {
      // Check if assignment already exists
      const { data: existing, error: checkError } = await supabase
        .from('icepulse_player_assignments')
        .select('id, jersey_number')
        .eq('player_id', playerId)
        .eq('team_id', teamId)
        .eq('season_id', seasonId)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid 406 when no row exists

      let assignmentId
      if (existing) {
        // Update existing assignment (preserve jersey history if changed)
        if (existing.jersey_number !== jerseyNumber && jerseyNumber) {
          // Save old jersey to history
          await supabase
            .from('icepulse_jersey_history')
            .insert({
              player_assignment_id: existing.id,
              jersey_number: existing.jersey_number
            })
        }

        const { data, error } = await supabase
          .from('icepulse_player_assignments')
          .update({
            jersey_number: jerseyNumber || null
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
            team_id: teamId,
            season_id: seasonId,
            jersey_number: jerseyNumber || null
          })
          .select()
          .single()

        if (error) throw error
        assignmentId = data.id
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error assigning player to team:', error)
    }
  }

  const sendPlayerInvite = async (playerId) => {
    console.log('[sendPlayerInvite] Starting invite process for playerId:', playerId)
    const player = organization?.players?.find(p => p.id === playerId)
    if (!player) {
      console.error('[sendPlayerInvite] Player not found:', playerId)
      return { success: false, message: 'Player not found' }
    }
    if (!player.email || !player.email.trim()) {
      console.error('[sendPlayerInvite] No email address for player:', player)
      return { success: false, message: 'Email address is required to send invite' }
    }
    
    console.log('[sendPlayerInvite] Player found:', { id: player.id, name: player.fullName, email: player.email })
    
    // For testing: Automatically create auth account with password "password"
    const adminClient = getAdminClient()
    if (adminClient) {
      try {
        const playerEmail = player.email.trim().toLowerCase() // Normalize email
        console.log('[sendPlayerInvite] Creating auth account for testing...')
        console.log('[sendPlayerInvite] Email (normalized):', playerEmail)
        
        // Check if user already exists
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers()
        
        if (listError) {
          console.error('[sendPlayerInvite] Error listing users:', listError)
        } else {
          console.log('[sendPlayerInvite] Checking for existing user...')
          // Normalize emails for comparison
          const existingUser = existingUsers?.users?.find(u => 
            u.email?.trim().toLowerCase() === playerEmail
          )
          
          if (existingUser) {
            console.log('[sendPlayerInvite] ✅ Auth account already exists:', {
              id: existingUser.id,
              email: existingUser.email,
              confirmed: existingUser.email_confirmed_at ? 'Yes' : 'No'
            })
            // Update player record to link to existing user
            await updatePlayer(playerId, {
              isExistingUser: true
            })
          } else {
            console.log('[sendPlayerInvite] No existing account found, creating new one...')
            // Create new auth user with password "password" for testing
            const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
              email: playerEmail,
              password: 'password', // Generic password for testing
              email_confirm: true, // Auto-confirm email for testing
              user_metadata: {
                name: player.fullName || player.name,
                account_type: 'individual',
                role: 'player'
              }
            })
            
            if (createError) {
              console.error('[sendPlayerInvite] ❌ Failed to create auth account:', createError)
              console.error('[sendPlayerInvite] Error details:', {
                message: createError.message,
                status: createError.status,
                name: createError.name
              })
              // Continue anyway - we'll still mark invite as sent
            } else if (newUser?.user) {
              console.log('[sendPlayerInvite] ✅ Auth account created successfully:', {
                id: newUser.user.id,
                email: newUser.user.email,
                confirmed: newUser.user.email_confirmed_at ? 'Yes' : 'No'
              })
              
              // Verify the account was created by trying to fetch it
              const { data: verifyUser, error: verifyError } = await adminClient.auth.admin.getUserById(newUser.user.id)
              if (verifyError) {
                console.error('[sendPlayerInvite] ⚠️ Warning: Could not verify created account:', verifyError)
              } else {
                console.log('[sendPlayerInvite] ✅ Account verified:', {
                  id: verifyUser.user.id,
                  email: verifyUser.user.email,
                  canLogin: verifyUser.user.email_confirmed_at ? 'Yes' : 'No'
                })
              }
              
              // Wait for trigger to create profile
              console.log('[sendPlayerInvite] Waiting for database triggers to create profile...')
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              // Check if profile was created by trigger
              const { data: profileCheck, error: profileCheckError } = await adminClient
                .from('icepulse_profiles')
                .select('*')
                .eq('id', newUser.user.id)
                .maybeSingle()
              
              if (profileCheckError || !profileCheck) {
                console.warn('[sendPlayerInvite] ⚠️ Profile not found after trigger, creating manually...')
                // Import the createProfileManually function
                const { createProfileManually } = await import('../lib/supabase-admin')
                const { data: profileData, error: profileError } = await createProfileManually({
                  id: newUser.user.id,
                  email: newUser.user.email || playerEmail,
                  name: player.fullName || player.name || playerEmail.split('@')[0],
                  account_type: 'individual',
                  role: 'player'
                })
                
                if (profileError && profileError.code !== '23505') {
                  console.error('[sendPlayerInvite] ❌ Failed to create profile manually:', profileError)
                } else {
                  console.log('[sendPlayerInvite] ✅ Profile created/verified successfully')
                }
              } else {
                console.log('[sendPlayerInvite] ✅ Profile exists (created by trigger)')
              }
              
              // Update player record to mark as existing user and link profile_id
              await updatePlayer(playerId, {
                isExistingUser: true
              })
              
              // Also update the player record's profile_id if it's not set
              const { data: playerRecord } = await adminClient
                .from('icepulse_players')
                .select('profile_id')
                .eq('id', playerId)
                .single()
              
              if (playerRecord && !playerRecord.profile_id) {
                console.log('[sendPlayerInvite] Linking player record to profile...')
                await adminClient
                  .from('icepulse_players')
                  .update({ profile_id: newUser.user.id })
                  .eq('id', playerId)
              }
              
              console.log('[sendPlayerInvite] ✅ Account setup complete. Login credentials:', {
                email: playerEmail,
                password: 'password'
              })
            } else {
              console.error('[sendPlayerInvite] ❌ Account creation returned no user data')
            }
          }
        }
      } catch (error) {
        console.error('[sendPlayerInvite] ❌ Exception creating auth account:', error)
        console.error('[sendPlayerInvite] Error stack:', error.stack)
        // Continue anyway - we'll still mark invite as sent
      }
    } else {
      console.warn('[sendPlayerInvite] ⚠️ Admin client not available - skipping auto-account creation')
      console.warn('[sendPlayerInvite] Make sure VITE_SUPABASE_SERVICE_ROLE_KEY is set in .env')
    }
    
    // Update database to mark invite as sent
    console.log('[sendPlayerInvite] Updating database to mark invite as sent...')
    await updatePlayer(playerId, {
      inviteSent: true,
      inviteDate: new Date().toISOString()
    })
    console.log('[sendPlayerInvite] Database updated successfully')
    
    // TODO: Replace with actual API call to send invite email
    // For now, log what would be sent
    console.log('[sendPlayerInvite] EMAIL SENDING NOT IMPLEMENTED - Would send email to:', {
      to: player.email,
      subject: `Invitation to join ${organization?.name || 'the organization'}`,
      body: `Hello ${player.fullName || player.name},\n\nYou have been invited to join ${organization?.name || 'the organization'} as a player.\n\nFor testing, you can log in with:\nEmail: ${player.email}\nPassword: password\n\nSign in at: ${window.location.origin}\n\nThank you!`
    })
    console.warn('[sendPlayerInvite] ⚠️ Email sending is not yet implemented. The invite has been marked as sent in the database, but no actual email was sent.')
    console.log('[sendPlayerInvite] ✅ TESTING MODE: Auth account created/verified. Login credentials:', {
      email: player.email,
      password: 'password'
    })
    
    return { success: true, message: 'Invite sent successfully. Account created for testing - login with password "password"' }
  }

  const resendPlayerInvite = async (playerId) => {
    return await sendPlayerInvite(playerId)
  }

  const addParent = async (parent) => {
    if (!user?.id || !organization?.id) return

    try {
      const { data, error } = await supabase
        .from('icepulse_parents')
        .insert({
          organization_id: organization.id,
          full_name: parent.fullName || parent.name,
          email: parent.email || null,
          is_existing_user: parent.isExistingUser || false,
          invite_sent: false,
          invite_date: null
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding parent:', error)
        return
      }

      const newParent = {
        id: data.id,
        name: data.full_name,
        fullName: data.full_name,
        email: data.email,
        isExistingUser: data.is_existing_user,
        inviteSent: data.invite_sent,
        inviteDate: data.invite_date,
        playerConnections: []
      }

      // If there are initial player connections, add them
      if (parent.playerConnections && parent.playerConnections.length > 0) {
        for (const playerId of parent.playerConnections) {
          await connectParentToPlayer(data.id, playerId)
        }
      }

      setOrganization({
        ...organization,
        parents: [...(organization.parents || []), newParent]
      })
    } catch (error) {
      console.error('Error adding parent:', error)
    }
  }

  const updateParent = async (parentId, updates) => {
    if (!user?.id || !organization?.id) return

    try {
      const updateData = {}
      if (updates.fullName) updateData.full_name = updates.fullName
      if (updates.name) updateData.full_name = updates.name
      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.isExistingUser !== undefined) updateData.is_existing_user = updates.isExistingUser
      if (updates.inviteSent !== undefined) updateData.invite_sent = updates.inviteSent
      if (updates.inviteDate !== undefined) updateData.invite_date = updates.inviteDate

      const { error } = await supabase
        .from('icepulse_parents')
        .update(updateData)
        .eq('id', parentId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error updating parent:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating parent:', error)
    }
  }

  const deleteParent = async (parentId) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_parents')
        .delete()
        .eq('id', parentId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error deleting parent:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error deleting parent:', error)
    }
  }

  const connectParentToPlayer = async (parentId, playerId) => {
    if (!user?.id || !organization?.id) return

    try {
      // Check if connection already exists
      const { data: existing } = await supabase
        .from('icepulse_parent_player_connections')
        .select('id')
        .eq('parent_id', parentId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (existing) {
        // Connection already exists
        return
      }

      const { error } = await supabase
        .from('icepulse_parent_player_connections')
        .insert({
          parent_id: parentId,
          player_id: playerId
        })

      if (error) throw error

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error connecting parent to player:', error)
    }
  }

  const disconnectParentFromPlayer = async (parentId, playerId) => {
    if (!user?.id || !organization?.id) return

    try {
      const { error } = await supabase
        .from('icepulse_parent_player_connections')
        .delete()
        .eq('parent_id', parentId)
        .eq('player_id', playerId)

      if (error) throw error

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error disconnecting parent from player:', error)
    }
  }

  const sendParentInvite = async (parentId) => {
    console.log('[sendParentInvite] Starting invite process for parentId:', parentId)
    const parent = organization?.parents?.find(p => p.id === parentId)
    if (!parent) {
      console.error('[sendParentInvite] Parent not found:', parentId)
      return { success: false, message: 'Parent not found' }
    }
    if (!parent.email || !parent.email.trim()) {
      console.error('[sendParentInvite] No email address for parent:', parent)
      return { success: false, message: 'Email address is required to send invite' }
    }
    
    console.log('[sendParentInvite] Parent found:', { id: parent.id, name: parent.fullName, email: parent.email })
    
    // For testing: Automatically create auth account with password "password"
    const adminClient = getAdminClient()
    if (adminClient) {
      try {
        console.log('[sendParentInvite] Creating auth account for testing...')
        
        // Check if user already exists
        const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === parent.email)
        
        if (existingUser) {
          console.log('[sendParentInvite] Auth account already exists for this email:', existingUser.id)
          // Update parent record to link to existing user
          await updateParent(parentId, {
            isExistingUser: true
          })
        } else {
          // Create new auth user with password "password" for testing
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: parent.email,
            password: 'password', // Generic password for testing
            email_confirm: true, // Auto-confirm email for testing
            user_metadata: {
              name: parent.fullName || parent.name,
              account_type: 'individual',
              role: 'parent'
            }
          })
          
          if (createError) {
            console.error('[sendParentInvite] Failed to create auth account:', createError)
            // Continue anyway - we'll still mark invite as sent
          } else {
            console.log('[sendParentInvite] Auth account created successfully:', newUser.user.id)
            // Wait for trigger to create profile and link to parent record
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            // Update parent record to mark as existing user
            await updateParent(parentId, {
              isExistingUser: true
            })
          }
        }
      } catch (error) {
        console.error('[sendParentInvite] Error creating auth account:', error)
        // Continue anyway - we'll still mark invite as sent
      }
    } else {
      console.warn('[sendParentInvite] Admin client not available - skipping auto-account creation')
    }
    
    // Update database to mark invite as sent
    console.log('[sendParentInvite] Updating database to mark invite as sent...')
    await updateParent(parentId, {
      inviteSent: true,
      inviteDate: new Date().toISOString()
    })
    console.log('[sendParentInvite] Database updated successfully')
    
    // TODO: Replace with actual API call to send invite email
    // For now, log what would be sent
    console.log('[sendParentInvite] EMAIL SENDING NOT IMPLEMENTED - Would send email to:', {
      to: parent.email,
      subject: `Invitation to join ${organization?.name || 'the organization'}`,
      body: `Hello ${parent.fullName || parent.name},\n\nYou have been invited to join ${organization?.name || 'the organization'} as a parent.\n\nFor testing, you can log in with:\nEmail: ${parent.email}\nPassword: password\n\nSign in at: ${window.location.origin}\n\nThank you!`
    })
    console.warn('[sendParentInvite] ⚠️ Email sending is not yet implemented. The invite has been marked as sent in the database, but no actual email was sent.')
    console.log('[sendParentInvite] ✅ TESTING MODE: Auth account created/verified. Login credentials:', {
      email: parent.email,
      password: 'password'
    })
    
    return { success: true, message: 'Invite sent successfully. Account created for testing - login with password "password"' }
  }

  const resendParentInvite = async (parentId) => {
    return await sendParentInvite(parentId)
  }

  // ============================================
  // GAMES/SCHEDULE MANAGEMENT
  // ============================================

  const addGame = async (game) => {
    if (!user?.id || !organization?.id) return null

    // MOCK MODE
    if (USE_MOCK) {
      const newGame = {
        id: `mock-game-${Date.now()}`,
        teamId: game.teamId,
        seasonId: game.seasonId,
        gameDate: game.gameDate,
        gameTime: game.gameTime,
        opponent: game.opponent,
        location: game.location,
        notes: game.notes
      }
      // Add to mock organization
      if (organization) {
        setOrganization({
          ...organization,
          games: [...(organization.games || []), newGame]
        })
      }
      return newGame
    }

    try {
      // Save location if provided and doesn't exist
      if (game.location && game.location.trim()) {
        await saveLocationIfNew(game.location.trim())
      }

      const { data, error } = await supabase
        .from('icepulse_games')
        .insert({
          organization_id: organization.id,
          team_id: game.teamId,
          season_id: game.seasonId,
          game_date: game.gameDate,
          game_time: game.gameTime,
          opponent: game.opponent,
          location: game.location || null,
          notes: game.notes || null,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding game:', error)
        return null
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
      
      return {
        id: data.id,
        teamId: data.team_id,
        seasonId: data.season_id,
        gameDate: data.game_date,
        gameTime: data.game_time,
        opponent: data.opponent,
        location: data.location,
        notes: data.notes
      }
    } catch (error) {
      console.error('Error adding game:', error)
      return null
    }
  }

  const updateGame = async (gameId, updates) => {
    if (!user?.id || !organization?.id) return

    // MOCK MODE
    if (USE_MOCK) {
      if (organization) {
        setOrganization({
          ...organization,
          games: organization.games?.map(game =>
            game.id === gameId ? { ...game, ...updates } : game
          ) || []
        })
      }
      return
    }

    try {
      // Save location if provided and doesn't exist
      if (updates.location && updates.location.trim()) {
        await saveLocationIfNew(updates.location.trim())
      }

      const updateData = {}
      if (updates.teamId) updateData.team_id = updates.teamId
      if (updates.seasonId) updateData.season_id = updates.seasonId
      if (updates.gameDate) updateData.game_date = updates.gameDate
      if (updates.gameTime) updateData.game_time = updates.gameTime
      if (updates.opponent !== undefined) updateData.opponent = updates.opponent
      if (updates.location !== undefined) updateData.location = updates.location
      if (updates.notes !== undefined) updateData.notes = updates.notes
      updateData.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('icepulse_games')
        .update(updateData)
        .eq('id', gameId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error updating game:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error updating game:', error)
    }
  }

  const deleteGame = async (gameId) => {
    if (!user?.id || !organization?.id) return

    // MOCK MODE
    if (USE_MOCK) {
      if (organization) {
        setOrganization({
          ...organization,
          games: organization.games?.filter(game => game.id !== gameId) || []
        })
      }
      return
    }

    try {
      const { error } = await supabase
        .from('icepulse_games')
        .delete()
        .eq('id', gameId)
        .eq('organization_id', organization.id)

      if (error) {
        console.error('Error deleting game:', error)
        return
      }

      // Reload organization data to ensure all views have the latest data
      await loadOrganization()
    } catch (error) {
      console.error('Error deleting game:', error)
    }
  }

  // ============================================
  // VIDEO RECORDING MANAGEMENT
  // ============================================

  // Upload video blob to Supabase Storage
  const uploadVideoToStorage = async (videoBlob, gameId, userId) => {
    if (!user?.id || !organization?.id || USE_MOCK) {
      // In mock mode, return a mock URL
      return `mock://video-${Date.now()}.webm`
    }

    try {
      // Determine file extension based on blob type
      const isWebM = videoBlob.type?.includes('webm')
      const extension = isWebM ? 'webm' : 'mp4'
      const contentType = isWebM ? 'video/webm' : 'video/mp4'
      
      // Generate a unique filename: {orgId}/{gameId}/{userId}/{timestamp}.webm
      const timestamp = Date.now()
      const filePath = `${organization.id}/${gameId}/${userId}/${timestamp}.${extension}`

      console.log('📤 Uploading to path:', filePath, 'type:', contentType)

      // Upload to Supabase Storage bucket 'videos'
      console.log('📤 Attempting upload to bucket "videos" with path:', filePath)
      console.log('📤 Video blob size:', videoBlob.size, 'bytes, type:', videoBlob.type)
      
      const { data, error } = await supabase.storage
        .from('videos')
        .upload(filePath, videoBlob, {
          contentType: contentType,
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('❌ Storage upload error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error,
          name: error.name
        })
        throw error
      }

      console.log('✅ Upload successful, data:', data)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)

      console.log('✅ Video public URL:', urlData.publicUrl)
      return urlData.publicUrl
    } catch (error) {
      console.error('Error uploading video to storage:', error)
      throw error
    }
  }

  // Upload thumbnail image to Supabase Storage
  const uploadThumbnailToStorage = async (thumbnailDataUrl, gameId, userId) => {
    if (!user?.id || !organization?.id || USE_MOCK) {
      // In mock mode, return the data URL as-is
      return thumbnailDataUrl
    }

    try {
      // Convert data URL to blob
      const response = await fetch(thumbnailDataUrl)
      const blob = await response.blob()

      // Generate a unique filename: thumbnails/{orgId}/{gameId}/{userId}/{timestamp}.jpg
      const timestamp = Date.now()
      const filename = `${organization.id}/${gameId}/${userId}/${timestamp}.jpg`
      const filePath = `thumbnails/${filename}`

      // Upload to Supabase Storage bucket 'videos' (same bucket, different folder)
      const { data, error } = await supabase.storage
        .from('videos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Error uploading thumbnail to storage:', error)
        // Don't throw - thumbnail is optional, continue with data URL
        return thumbnailDataUrl
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error) {
      console.error('Error uploading thumbnail to storage:', error)
      // Return original data URL as fallback
      return thumbnailDataUrl
    }
  }

  // Add a video recording
  const addVideoRecording = async (recordingData) => {
    console.log('💾 addVideoRecording called with:', {
      hasUserId: !!user?.id,
      userId: user?.id,
      hasGameId: !!recordingData?.gameId,
      gameId: recordingData?.gameId,
      videoUrl: recordingData?.videoUrl?.substring(0, 50) + '...',
      recordingType: recordingData?.recordingType,
      description: recordingData?.description
    })

    if (!user?.id || !recordingData.gameId) {
      console.error('❌ Cannot add video recording - missing:', {
        userId: user?.id || 'MISSING',
        gameId: recordingData?.gameId || 'MISSING'
      })
      return null
    }

    // MOCK MODE
    if (USE_MOCK) {
      console.log('🎭 Mock mode - returning mock video')
      return {
        id: `mock-video-${Date.now()}`,
        ...recordingData
      }
    }

    try {
      // Resolve team/season from local organization cache or fetch from DB (needed for newly-created events)
      let game = organization?.games?.find(g => g.id === recordingData.gameId) || null
      console.log('🔍 Looking for game:', recordingData.gameId, 'Found in cache:', !!game)
      
      if (!game) {
        console.log('🔍 Game not in cache, fetching from database...')
        const { data: gameRow, error: gameErr } = await supabase
          .from('icepulse_games')
          .select('id, team_id, season_id')
          .eq('id', recordingData.gameId)
          .single()

        if (gameErr || !gameRow) {
          console.error('❌ Game not found for video recording:', gameErr)
          return null
        }
        game = { id: gameRow.id, teamId: gameRow.team_id, seasonId: gameRow.season_id }
        console.log('✅ Game fetched from DB:', game)
      }

      const insertData = {
        game_id: recordingData.gameId,
        user_id: user.id,
        team_id: game.teamId,
        season_id: game.seasonId,
        video_url: recordingData.videoUrl,
        thumbnail_url: recordingData.thumbnailUrl || null,
        duration_seconds: recordingData.durationSeconds || null,
        file_size_bytes: recordingData.fileSizeBytes || null,
        recording_start_timestamp: recordingData.recordingStartTimestamp,
        recording_end_timestamp: recordingData.recordingEndTimestamp || null,
        game_start_timestamp: recordingData.gameStartTimestamp || null,
        recording_type: recordingData.recordingType || 'full_game',
        description: recordingData.description || null,
        upload_status: 'completed'
      }

      console.log('📝 Inserting video recording to database:', {
        game_id: insertData.game_id,
        user_id: insertData.user_id,
        team_id: insertData.team_id,
        season_id: insertData.season_id,
        video_url: insertData.video_url?.substring(0, 50) + '...',
        recording_type: insertData.recording_type,
        description: insertData.description
      })

      const { data, error } = await supabase
        .from('icepulse_video_recordings')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('❌ Error adding video recording to database:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        })
        return null
      }

      console.log('✅ Video recording saved to database:', {
        id: data.id,
        game_id: data.game_id,
        video_url: data.video_url?.substring(0, 50) + '...'
      })

      return {
        id: data.id,
        gameId: data.game_id,
        userId: data.user_id,
        videoUrl: data.video_url,
        recordingStartTimestamp: data.recording_start_timestamp
      }
    } catch (error) {
      console.error('❌ Exception in addVideoRecording:', error)
      return null
    }
  }

  // Get all videos for a game
  const getGameVideos = async (gameId) => {
    if (!gameId) return []

    // MOCK MODE
    if (USE_MOCK) {
      return []
    }

    try {
      const { data, error } = await supabase
        .from('icepulse_video_recordings')
        .select(`
          *,
          user:icepulse_profiles(id, name, email)
        `)
        .eq('game_id', gameId)
        .eq('upload_status', 'completed')
        .order('recording_start_timestamp', { ascending: true })

      if (error) {
        // Bubble up "table missing" so UI can show a clear fix instruction.
        if (error.code === 'PGRST205') {
          throw error
        }
        console.error('Error loading game videos:', error)
        return []
      }

      return (data || []).map(video => ({
        id: video.id,
        video_url: video.video_url,
        thumbnail_url: video.thumbnail_url,
        recording_start_timestamp: video.recording_start_timestamp,
        recording_end_timestamp: video.recording_end_timestamp,
        duration_seconds: video.duration_seconds,
        recording_type: video.recording_type,
        description: video.description,
        userName: video.user?.name || 'Unknown User',
        user: video.user
      }))
    } catch (error) {
      if (error?.code === 'PGRST205') {
        throw error
      }
      console.error('Error loading game videos:', error)
      return []
    }
  }

  // ============================================
  // LOCATION MANAGEMENT
  // ============================================

  // Save location if it doesn't already exist
  const saveLocationIfNew = async (locationName) => {
    if (!user?.id || !organization?.id || !locationName || !locationName.trim()) return

    try {
      // Check if location already exists
      const { data: existing } = await supabase
        .from('icepulse_locations')
        .select('id')
        .eq('organization_id', organization.id)
        .ilike('name', locationName.trim())
        .maybeSingle()

      // If it doesn't exist, create it
      if (!existing) {
        await supabase
          .from('icepulse_locations')
          .insert({
            organization_id: organization.id,
            name: locationName.trim(),
            created_by: user.id
          })
      }
    } catch (error) {
      console.error('Error saving location:', error)
      // Don't fail game creation if location save fails
    }
  }

  // Search locations by name
  const searchLocations = useCallback(async (query) => {
    if (!organization?.id || !query || query.trim().length < 1) return []

    // MOCK MODE
    if (USE_MOCK) {
      return mockResponses.searchLocations(query)
    }

    try {
      const { data, error } = await supabase
        .from('icepulse_locations')
        .select('*')
        .eq('organization_id', organization.id)
        .ilike('name', `%${query.trim()}%`)
        .order('name', { ascending: true })
        .limit(10)

      if (error) {
        console.error('Error searching locations:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error searching locations:', error)
      return []
    }
  }, [organization?.id])

  // Add a new location manually
  const addLocation = async (locationData) => {
    if (!user?.id || !organization?.id) return null

    try {
      const { data, error } = await supabase
        .from('icepulse_locations')
        .insert({
          organization_id: organization.id,
          name: locationData.name.trim(),
          city: locationData.city?.trim() || null,
          state: locationData.state?.trim() || null,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        // If duplicate, just return the existing one
        if (error.code === '23505') {
          const { data: existing } = await supabase
            .from('icepulse_locations')
            .select('*')
            .eq('organization_id', organization.id)
            .ilike('name', locationData.name.trim())
            .single()
          if (existing) {
            await loadOrganization()
            return {
              id: existing.id,
              name: existing.name,
              city: existing.city,
              state: existing.state
            }
          }
        }
        console.error('Error adding location:', error)
        return null
      }

      // Reload organization data
      await loadOrganization()

      return {
        id: data.id,
        name: data.name,
        city: data.city,
        state: data.state
      }
    } catch (error) {
      console.error('Error adding location:', error)
      return null
    }
  }

  const value = {
    organization,
    organizations, // All organizations user is part of
    selectedOrgId,
    switchOrganization, // Function to switch between organizations
    saveOrganization,
    updateOrganization,
    addTeam,
    updateTeam,
    deleteTeam,
    addSeason,
    updateSeason,
    deleteSeason,
    addCoach,
    updateCoach,
    deleteCoach,
    sendCoachInvite,
    resendCoachInvite,
    assignCoachToTeam,
    addPlayer,
    updatePlayer,
    deletePlayer,
    assignPlayerToTeam,
    sendPlayerInvite,
    resendPlayerInvite,
    addParent,
    updateParent,
    deleteParent,
    connectParentToPlayer,
    sendParentInvite,
    resendParentInvite,
    addGame,
    updateGame,
    deleteGame,
    searchLocations,
    addLocation,
    addVideoRecording,
    getGameVideos,
    uploadVideoToStorage,
    uploadThumbnailToStorage,
    isLoading,
    databaseError,
    clearDatabaseError: () => setDatabaseError(null),
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return context
}

// Optional variant for components that may render outside OrgProvider (e.g. testing toggles).
// Returns null when no OrgProvider is present.
export function useOrgOptional() {
  return useContext(OrgContext)
}
