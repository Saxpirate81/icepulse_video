import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getAdminClient } from '../lib/supabase-admin'
import { useAuth } from './AuthContext'
import { USE_MOCK } from '../lib/supabase-mock'
import { mockOrganization, mockOrganizations, mockResponses } from '../lib/mock-data'
import * as tus from 'tus-js-client'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [organizations, setOrganizations] = useState([]) // All organizations user is part of
  const [selectedOrgId, setSelectedOrgId] = useState(null) // Currently selected organization
  const [isLoading, setIsLoading] = useState(true)
  const [databaseError, setDatabaseError] = useState(null) // Track database connection issues
  
  // KILL SWITCH: Disable legacy Supabase video features during migration to Cloudflare
  const USE_CLOUDFLARE_PIVOT = true

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
        headerImageUrl: orgData.header_image_url,
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
          profileId: coach.profile_id, // Add profile_id for streaming permission checks
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
          profileId: player.profile_id, // Add profile_id for streaming permission checks
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
          profileId: parent.profile_id, // Add profile_id for streaming permission checks
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
          notes: game.notes,
          eventType: game.event_type || 'game'
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
      if (updates.headerImageUrl !== undefined) updateData.header_image_url = updates.headerImageUrl

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

  // Upload header image to Supabase storage
  const uploadHeaderImage = async (file) => {
    if (!user?.id || !organization?.id || !file) return null

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${organization.id}/header-${Date.now()}.${fileExt}`
      const filePath = `organizations/${fileName}`

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('videos') // Using existing videos bucket, or create 'images' bucket if preferred
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Error uploading header image:', error)
        return null
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error) {
      console.error('Error uploading header image:', error)
      return null
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
          // Create user account with password "password" for testing
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: coach.email,
            password: 'password', // Standard password for testing
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
            
            console.log('[sendCoachInvite] ✅ Account created. Login credentials:', {
              email: coach.email,
              password: 'password'
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
    
    return { success: true, message: 'Account created successfully. User can log in with email and password "password".' }
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
            console.log('[sendPlayerInvite] No existing account found, creating account with password "password"...')
            // Create user account with password "password" for testing
            const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
              email: playerEmail,
              password: 'password', // Standard password for testing
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
              
              console.log('[sendPlayerInvite] ✅ Account created. Login credentials:', {
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
    
    return { success: true, message: 'Account created successfully. User can log in with email and password "password".' }
  }

  const resendPlayerInvite = async (playerId) => {
    return await sendPlayerInvite(playerId)
  }

  const addParent = async (parent) => {
    if (!user?.id || !organization?.id) {
      console.error('❌ [addParent] Missing user or organization:', { userId: user?.id, orgId: organization?.id })
      return
    }

    console.log('🔍 [addParent] Attempting to add parent:', {
      organizationId: organization.id,
      userId: user.id,
      parentName: parent.fullName || parent.name,
      parentEmail: parent.email
    })

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
        console.error('❌ [addParent] Error adding parent:', error)
        console.error('❌ [addParent] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
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
          // Create user account with password "password" for testing
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: parent.email,
            password: 'password', // Standard password for testing
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
            
            console.log('[sendParentInvite] ✅ Account created. Login credentials:', {
              email: parent.email,
              password: 'password'
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
    
    return { success: true, message: 'Account created successfully. User can log in with email and password "password".' }
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
        notes: game.notes,
        eventType: game.eventType || 'game'
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
          event_type: game.eventType || 'game',
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
        notes: data.notes,
        eventType: data.event_type || 'game'
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
      if (updates.eventType !== undefined) updateData.event_type = updates.eventType
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
  // CLOUDFLARE STREAM INTEGRATION (VOD & LIVE)
  // ============================================

  // 1. Upload Video (VOD) - Replaces Supabase Storage with Cloudflare TUS
  const uploadVideoToStorage = async (videoBlob, gameId, userId) => {
    // MOCK MODE
    if (USE_MOCK) return `mock://video-${Date.now()}.webm`

    if (!user?.id || !organization?.id) {
      throw new Error('Missing user or organization ID')
    }

    try {
      console.log('☁️ [Cloudflare] Requesting Direct Upload URL...')
      
      // Keys from user input - DIRECT CLIENT MODE
      const CF_ACCOUNT_ID = "8ddadc04f6a8c0fd32db2fae084995dc"
      const CF_API_TOKEN = "ZgCaabkk8VGTVH6ZVuIJLgXEPbN2426yM-vtY-uT"

      // Step A: Get upload URL directly from Client
      // Note: "direct_upload" endpoint requires TUS headers OR just a standard POST with maxDurationSeconds
      // Since we are using TUS client later, we should just let TUS client handle the creation if possible,
      // OR use the correct endpoint. 
      // Cloudflare TUS endpoint: https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/stream
      // But for DIRECT upload (from browser), we need to request a token first usually.
      // However, we are using API Token (which is risky in browser but working for now).
      
      // OPTION: Let tus-js-client handle the creation entirely
      console.log('☁️ [Cloudflare] Starting Direct TUS Upload...')
      
      return new Promise((resolve, reject) => {
        const upload = new tus.Upload(videoBlob, {
          endpoint: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
          },
          chunkSize: 50 * 1024 * 1024, // 50MB chunks
          metadata: {
            name: `Game ${gameId} - ${new Date().toISOString()}`,
            filename: `game-${gameId}.webm`,
            filetype: videoBlob.type,
            // Custom metadata must be string values
            meta_userId: userId,
            meta_gameId: gameId,
            meta_orgId: organization.id
          },
          onError: (error) => {
            console.error('❌ [Cloudflare] Upload Failed:', error)
            reject(error)
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2)
            console.log(`☁️ [Cloudflare] Uploading: ${percentage}%`)
          },
          onSuccess: () => {
            console.log('✅ [Cloudflare] Upload Complete!')
            console.log('☁️ [Cloudflare] Full Upload URL:', upload.url)
            
            // Cloudflare TUS returns the URL in upload.url
            // It looks like: https://api.cloudflare.com/.../stream/<UID>?tusv2=true
            const uploadUrl = upload.url
            // Clean the UID - it might have query params like ?tusv2=true
            const rawUid = uploadUrl.split('/').pop()
            const uid = rawUid.split('?')[0]
            
            console.log('☁️ [Cloudflare] Uploaded UID (cleaned):', uid)
            
            const playbackUrl = `https://cloudflarestream.com/${uid}/manifest/video.m3u8`
            const thumbnailUrl = `https://cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`
            
            resolve({
              url: playbackUrl, 
              cloudflareUid: uid,
              thumbnailUrl: thumbnailUrl
            })
          }
        })
        
        upload.start()
      })

    } catch (error) {
      console.error('❌ [Cloudflare] Integration Error:', error)
      throw error
    }
  }

  // 2. Upload Thumbnail (Optional - Cloudflare auto-generates)
  const uploadThumbnailToStorage = async (thumbnailDataUrl, gameId, userId) => {
    console.log('ℹ️ [Cloudflare] Thumbnail upload skipped (Cloudflare auto-generates)')
    return null
  }

  // 3. Add Video Recording Record (Cloudflare & Database)
  const addVideoRecording = async (recordingData) => {
    console.log('💾 addVideoRecording (Cloudflare Mode):', recordingData)

    // For Cloudflare, the 'videoUrl' passed in is likely the object returned from uploadVideoToStorage
    let videoUrl = recordingData.videoUrl
    let cloudflareUid = null
    let thumbnailUrl = recordingData.thumbnailUrl

    // If videoUrl is an object (from our new uploadVideoToStorage return), extract details
    if (typeof videoUrl === 'object' && videoUrl !== null) {
      cloudflareUid = videoUrl.cloudflareUid
      thumbnailUrl = videoUrl.thumbnailUrl || thumbnailUrl
      videoUrl = videoUrl.url // The HLS playback URL
    }

    if (!user?.id || !recordingData.gameId) {
       console.error('❌ Cannot add video - missing ID')
       return null
    }

    // MOCK MODE
    if (USE_MOCK) return { id: `mock-video-${Date.now()}`, ...recordingData }

    try {
      // Resolve team/season info
      let game = organization?.games?.find(g => g.id === recordingData.gameId) || null
      
      if (!game) {
        const { data: gameRow } = await supabase
          .from('icepulse_games')
          .select('id, team_id, season_id')
          .eq('id', recordingData.gameId)
          .single()
        if (gameRow) game = { id: gameRow.id, teamId: gameRow.team_id, seasonId: gameRow.season_id }
      }

      const insertData = {
        game_id: recordingData.gameId,
        user_id: user.id,
        team_id: game?.teamId,
        season_id: game?.seasonId,
        video_url: videoUrl, // HLS URL
        cloudflare_uid: cloudflareUid, // Store the UID!
        cloudflare_status: 'ready',
        thumbnail_url: thumbnailUrl,
        duration_seconds: recordingData.durationSeconds,
        file_size_bytes: recordingData.fileSizeBytes,
        recording_start_timestamp: recordingData.recordingStartTimestamp,
        recording_end_timestamp: recordingData.recordingEndTimestamp,
        game_start_timestamp: recordingData.gameStartTimestamp,
        recording_type: recordingData.recordingType || 'full_game',
        description: recordingData.description,
        upload_status: 'completed'
      }

      console.log('📝 Saving video metadata to DB...')

      const { data, error } = await supabase
        .from('icepulse_video_recordings')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      
      console.log('✅ Video saved:', data.id)
      return { id: data.id, ...data }

    } catch (error) {
      console.error('❌ Error adding video recording:', error)
      return null
    }
  }

  // 4. Create Stream (Live) - Cloudflare Live Input
  const createStream = async (gameId, resumeStreamId = null) => {
    if (USE_MOCK) return { id: 'mock-stream', streamUrl: '#' }

    try {
      // FIRST: Check if there's already an active stream for this game
      const { data: existingStream } = await supabase
        .from('icepulse_streams')
        .select('*')
        .eq('game_id', gameId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingStream) {
        console.log('🔄 [Cloudflare] Reusing existing active stream:', existingStream.id)
        return {
          id: existingStream.id,
          liveInputId: existingStream.cloudflare_live_input_id,
          streamUrl: existingStream.cloudflare_playback_url,
          whipUrl: existingStream.cloudflare_whip_url,
          rtmpsUrl: existingStream.rtmps_url || '',
          rtmpsKey: existingStream.cloudflare_stream_key || ''
        }
      }

      // SECOND: If resuming a specific stream, reactivate it
      if (resumeStreamId) {
        const { data: stoppedStream } = await supabase
          .from('icepulse_streams')
          .select('*')
          .eq('id', resumeStreamId)
          .eq('game_id', gameId)
          .eq('is_active', false)
          .single()

        if (stoppedStream) {
          // Check if it was stopped recently (within 5 minutes)
          const stoppedAt = new Date(stoppedStream.updated_at)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
          
          if (stoppedAt > fiveMinutesAgo) {
            // Reactivate the stream
            const { error: updateError } = await supabase
              .from('icepulse_streams')
              .update({ is_active: true })
              .eq('id', resumeStreamId)

            if (!updateError) {
              console.log('✅ [Cloudflare] Resumed stream:', resumeStreamId)
              return {
                id: stoppedStream.id,
                liveInputId: stoppedStream.cloudflare_live_input_id,
                streamUrl: stoppedStream.cloudflare_playback_url,
                whipUrl: stoppedStream.cloudflare_whip_url,
                rtmpsUrl: stoppedStream.rtmps_url || '',
                rtmpsKey: stoppedStream.cloudflare_stream_key || ''
              }
            }
          }
        }
      }

      // THIRD: Check for any recently stopped stream for this game (within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: recentlyStoppedStream } = await supabase
        .from('icepulse_streams')
        .select('*')
        .eq('game_id', gameId)
        .eq('is_active', false)
        .eq('created_by', user.id) // Only resume streams created by the same user
        .gte('updated_at', fiveMinutesAgo)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentlyStoppedStream) {
        // Reactivate the recently stopped stream
        const { error: updateError } = await supabase
          .from('icepulse_streams')
          .update({ is_active: true })
          .eq('id', recentlyStoppedStream.id)

        if (!updateError) {
          console.log('✅ [Cloudflare] Resumed recently stopped stream:', recentlyStoppedStream.id)
          return {
            id: recentlyStoppedStream.id,
            liveInputId: recentlyStoppedStream.cloudflare_live_input_id,
            streamUrl: recentlyStoppedStream.cloudflare_playback_url,
            whipUrl: recentlyStoppedStream.cloudflare_whip_url,
            rtmpsUrl: recentlyStoppedStream.rtmps_url || '',
            rtmpsKey: recentlyStoppedStream.cloudflare_stream_key || ''
          }
        }
      }

      console.log('☁️ [Cloudflare] Creating Live Input...')

      // Direct API (client-side) only to avoid CORS noise from the edge function path
      let liveInputId, rtmpsKey, rtmpsUrl, whipUrl, playbackUrl

      const CF_ACCOUNT_ID = "8ddadc04f6a8c0fd32db2fae084995dc"
      const CF_API_TOKEN = "ZgCaabkk8VGTVH6ZVuIJLgXEPbN2426yM-vtY-uT"

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meta: {
              name: `Live Stream - ${new Date().toISOString()}`,
              userId: user.id
            },
            recording: { mode: 'automatic' } // Auto-record to VOD
          }),
        }
      )

      const data = await response.json()

      if (!data.success) {
        throw new Error(`Cloudflare Error: ${JSON.stringify(data.errors)}`)
      }

      const result = data.result
      console.log('☁️ [Cloudflare] Live Input Created (direct):', result)
      
      liveInputId = result.uid
      rtmpsKey = result.rtmps?.streamKey || ''
      rtmpsUrl = result.rtmps?.url || ''
      whipUrl = result.webRTC?.url || ''
      playbackUrl =
        result.webRTC?.playback?.url ||
        result.hlsPlayback?.url ||
        null

      // If missing, fetch details for this live input to get playback URLs (poll a few times to allow propagation)
      const fetchPlaybackWithRetries = async () => {
        const maxAttempts = 5
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const detailRes = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/live_inputs/${liveInputId}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${CF_API_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              }
            )
            const detailData = await detailRes.json()
            if (detailData?.success) {
              const det = detailData.result || {}
              const candidate =
                det.webRTC?.playback?.url ||
                det.hlsPlayback?.url ||
                null
              if (candidate && /^https?:\/\//i.test(candidate)) {
                return candidate
              }
            } else {
              console.warn(`⚠️ Attempt ${attempt} could not fetch playback URL:`, detailData?.errors)
            }
          } catch (e) {
            console.warn(`⚠️ Attempt ${attempt} live input detail fetch failed:`, e)
          }
          await new Promise(r => setTimeout(r, 2000))
        }
        return null
      }

      if (!playbackUrl || !/^https?:\/\//i.test(playbackUrl)) {
        const polledUrl = await fetchPlaybackWithRetries()
        if (polledUrl) {
          playbackUrl = polledUrl
          console.log('✅ Playback URL obtained after polling:', playbackUrl)
        }
      }

      // Fallback: derive playback URL from customer domain in WHIP URL if still missing
      if ((!playbackUrl || !/^https?:\/\//i.test(playbackUrl)) && whipUrl) {
        try {
          const whip = new URL(whipUrl)
          const host = whip.host
          const fallbackBase = `https://${host}/${liveInputId}/manifest/video.m3u8`
          playbackUrl = fallbackBase
          console.warn('⚠️ Playback URL missing from API; using derived customer playback URL:', playbackUrl)
        } catch (e) {
          console.warn('⚠️ Could not derive playback URL from WHIP URL:', e)
        }
      }

      // Ultimate fallback: generic cloudflarestream.com domain
      if (!playbackUrl || !/^https?:\/\//i.test(playbackUrl)) {
        playbackUrl = `https://cloudflarestream.com/${liveInputId}/manifest/video.m3u8`
        console.warn('⚠️ Using generic playback URL fallback:', playbackUrl)
      }

      if (!whipUrl) {
         console.error('❌ Cloudflare did not return a WHIP URL. WebRTC broadcasting requires this.', result)
      }

      // Store in icepulse_streams for reference
      // Use maybeSingle() or select() without single() to avoid errors if RLS blocks read-back immediately
      
      // Generate UUIDv4 for ID (robust polyfill)
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      // Build final record
      const streamId = generateUUID()
      const streamRecordToInsert = {
        id: streamId,
        game_id: gameId,
        created_by: user.id,
        is_active: true,
        cloudflare_live_input_id: liveInputId,
        cloudflare_stream_key: rtmpsKey,
        cloudflare_playback_url: playbackUrl,
        cloudflare_whip_url: whipUrl
      }
      console.log('📝 [DATABASE] Inserting stream record:', JSON.stringify(streamRecordToInsert, null, 2))

       const { data: streamRecord, error: dbError } = await supabase
        .from('icepulse_streams')
        .insert(streamRecordToInsert)
        .select()
        .maybeSingle()

      if (dbError) {
        console.error('❌ Could not save stream to DB:', dbError)
        // Try one more time with a simple insert (no select) in case RLS blocks select
        if (dbError.code === '42501' || dbError.message?.includes('violates row-level security')) {
           console.log('🔄 Retrying insert without select...')
           const { error: retryError } = await supabase
            .from('icepulse_streams')
            .insert({
              id: streamId,
              game_id: gameId,
              created_by: user.id,
              is_active: true,
              cloudflare_live_input_id: liveInputId,
              cloudflare_stream_key: rtmpsKey,
              cloudflare_playback_url: playbackUrl,
              cloudflare_whip_url: whipUrl
            })
            
           if (retryError) console.error('❌ Retry failed:', retryError)
           else console.log('✅ Retry insert successful (blind insert)')
        }
      } else {
        console.log('✅ Stream saved to DB:', streamRecord?.id || streamId)
      }

      return {
        id: streamId,           // Use the database UUID for app-level tracking
        liveInputId: liveInputId,
        streamUrl: playbackUrl, // For viewers
        whipUrl: whipUrl,       // For broadcaster
        rtmpsUrl: rtmpsUrl,
        rtmpsKey: rtmpsKey
      }
    } catch (error) {
      console.error('❌ [Cloudflare] Stream Creation Error:', error)
      throw error
    }
  }

  // 5. Queue Upload (Legacy) -> DISABLED
  const queueStreamChunkUpload = () => {
    console.warn('🛑 Legacy chunk upload disabled (Switched to Cloudflare)')
  }

  // 6. Upload Chunk (Legacy) -> DISABLED
  const uploadStreamChunk = async () => {
    console.warn('🛑 Legacy chunk upload disabled (Switched to Cloudflare)')
    return null
  }

  // 7. Stop Stream
  const stopStream = async (streamId) => {
    if (!streamId) return
    
    console.log('ℹ️ [Cloudflare] Stopping stream:', streamId)
    try {
      // Update database status
      const { error } = await supabase
        .from('icepulse_streams')
        .update({ is_active: false })
        .eq('id', streamId)
      
      if (error) console.warn('⚠️ Could not update stream status in DB:', error)
      else console.log('✅ Stream marked inactive in DB')
    } catch (e) {
      console.warn('⚠️ Error stopping stream:', e)
    }
  }

  const reactivateStream = async () => {
    console.warn('ℹ️ [Cloudflare] Reactivate not needed (Just start new session)')
    return null
  }

  // Get recently stopped streams for a game (within 5 minutes) for resume option
  const getRecentlyStoppedStream = async (gameId) => {
    if (!gameId || !user) return null

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: stoppedStream } = await supabase
        .from('icepulse_streams')
        .select('*')
        .eq('game_id', gameId)
        .eq('is_active', false)
        .eq('created_by', user.id)
        .gte('updated_at', fiveMinutesAgo)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return stoppedStream || null
    } catch (error) {
      console.error('Error getting recently stopped stream:', error)
      return null
    }
  }

  // Find profile by email (helper function)
  const findProfileByEmail = async (email) => {
    if (!email) return null
    
    try {
      const { data, error } = await supabase
        .from('icepulse_profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle()

      if (error) {
        console.error('Error finding profile by email:', error)
        return null
      }

      return data?.id || null
    } catch (error) {
      console.error('Error finding profile by email:', error)
      return null
    }
  }

  // Check if a user has streaming permission
  const checkStreamingPermission = async (userId) => {
    if (!userId) return false

    try {
      const { data, error } = await supabase
        .from('icepulse_profiles')
        .select('can_stream_live, streaming_enabled_at, streaming_enabled_by')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error checking streaming permission:', error)
        return false
      }

      return data?.can_stream_live || false
    } catch (error) {
      console.error('Error checking streaming permission:', error)
      return false
    }
  }

  // Update streaming permission for a user
  const updateStreamingPermission = async (userId, enabled) => {
    if (!user?.id || !userId) {
      return { success: false, message: 'User ID required' }
    }

    try {
      // If disabling, check for active streams and stop them
      if (!enabled) {
        const { data: activeStreams } = await supabase
          .from('icepulse_streams')
          .select('id')
          .eq('created_by', userId)
          .eq('is_active', true)

        if (activeStreams && activeStreams.length > 0) {
          // Stop all active streams for this user
          for (const stream of activeStreams) {
            await stopStream(stream.id)
          }
          console.log(`🛑 Stopped ${activeStreams.length} active stream(s) for user ${userId}`)
        }
      }

      // Update permission
      const updateData = {
        can_stream_live: enabled,
        streaming_enabled_at: enabled ? new Date().toISOString() : null,
        streaming_enabled_by: enabled ? user.id : null
      }

      const { error } = await supabase
        .from('icepulse_profiles')
        .update(updateData)
        .eq('id', userId)

      if (error) {
        console.error('Error updating streaming permission:', error)
        return { success: false, message: error.message }
      }

      // Reload organization to refresh user data
      await loadOrganization()

      return { success: true, message: enabled ? 'Streaming enabled' : 'Streaming disabled' }
    } catch (error) {
      console.error('Error updating streaming permission:', error)
      return { success: false, message: error.message }
    }
  }

  // ============================================
  // UPLOAD QUEUE MANAGEMENT (Legacy - Removed)
  // ============================================
  // (Empty placeholders to prevent reference errors if used elsewhere)
  const [uploadQueue, setUploadQueue] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  // Get all videos for a game
  const getGameVideos = async (gameId) => {
    if (!gameId) return []

    // MOCK MODE
    if (USE_MOCK) {
      return []
    }

    try {
      console.log('🎥 Starting SAFE query for game:', gameId)
      
      // SAFER APPROACH: Use simple query without join first to avoid crashing database
      // The join with profiles can be very slow with complex RLS policies
      // We'll fetch user info separately if needed, or use a simpler approach
      const simpleQueryPromise = supabase
        .from('icepulse_video_recordings')
        .select('id, game_id, user_id, video_url, thumbnail_url, recording_start_timestamp, recording_end_timestamp, duration_seconds, recording_type, description, upload_status, created_at')
        .eq('game_id', gameId)
        .eq('upload_status', 'completed')
        .order('recording_start_timestamp', { ascending: true })
        .limit(50) // Reduced limit to prevent crashes

      // Short timeout to prevent database crashes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Query timeout after 10 seconds - database may be overloaded. Please check if indexes exist and try again later.'))
        }, 10000)
      })

      console.log('🎥 Executing simple query (no join)...')
      const { data, error } = await Promise.race([simpleQueryPromise, timeoutPromise])

      console.log('🎥 Query completed:', { hasData: !!data, dataCount: data?.length, hasError: !!error })

      if (error) {
        console.error('🎥 Query error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // Handle timeout errors specifically
        if (error.code === '57014' || error.message?.includes('timeout') || error.message?.includes('canceling statement') || error.message?.includes('Query timeout')) {
          console.error('🎥 Query timeout - database query is taking too long. This may be due to missing indexes or high database load.')
          throw new Error('Query timeout: The database query is taking too long. Please run the performance fix SQL script (supabase/fix_video_recordings_performance.sql) in your Supabase SQL Editor to add indexes.')
        }
        // Bubble up "table missing" so UI can show a clear fix instruction.
        if (error.code === 'PGRST205') {
          throw error
        }
        console.error('Error loading game videos:', error)
        return []
      }

      console.log('🎥 getGameVideos success:', {
        gameId,
        videoCount: data?.length || 0,
        videos: data?.map(v => ({ id: v.id, status: v.upload_status, user: v.user?.name })) || []
      })

      // Map videos - fetch user names separately if we have user_ids
      const videos = (data || []).map(video => ({
        id: video.id,
        video_url: video.video_url,
        thumbnail_url: video.thumbnail_url,
        recording_start_timestamp: video.recording_start_timestamp,
        recording_end_timestamp: video.recording_end_timestamp,
        duration_seconds: video.duration_seconds,
        recording_type: video.recording_type,
        description: video.description,
        userName: 'User', // Will be replaced if we can fetch user info
        user: { id: video.user_id } // Minimal user object
      }))

      // Try to fetch user names in a separate, simpler query (optional - don't block if it fails)
      if (videos.length > 0 && videos[0].user?.id) {
        try {
          const userIds = [...new Set(videos.map(v => v.user.id).filter(Boolean))]
          if (userIds.length > 0) {
            const { data: userData } = await supabase
              .from('icepulse_profiles')
              .select('id, name')
              .in('id', userIds)
              .limit(50)

            if (userData) {
              const userMap = new Map(userData.map(u => [u.id, u.name || 'Unknown User']))
              videos.forEach(video => {
                video.userName = userMap.get(video.user.id) || 'Unknown User'
                video.user = { id: video.user.id, name: video.userName }
              })
            }
          }
        } catch (userError) {
          console.warn('🎥 Could not fetch user names (non-critical):', userError)
          // Continue without user names - videos will still work
        }
      }

      return videos
    } catch (error) {
      if (error?.code === 'PGRST205') {
        throw error
      }
      // Re-throw timeout errors so UI can show helpful message
      if (error.message?.includes('timeout') || error.message?.includes('Query timeout')) {
        throw error
      }
      console.error('Error loading game videos:', error)
      return []
    }
  }

  // Delete a video recording
  const deleteVideoRecording = async (videoId) => {
    if (!user?.id || !videoId) {
      console.error('Cannot delete video - missing userId or videoId')
      return { success: false, message: 'Missing required information' }
    }

    // MOCK MODE
    if (USE_MOCK) {
      console.log('🎭 Mock mode - video deletion simulated')
      return { success: true }
    }

    try {
      // First, get the video to check if it exists and get storage path
      const { data: videoData, error: fetchError } = await supabase
        .from('icepulse_video_recordings')
        .select('video_url, thumbnail_url, game_id')
        .eq('id', videoId)
        .single()

      if (fetchError || !videoData) {
        console.error('Error fetching video for deletion:', fetchError)
        return { success: false, message: 'Video not found' }
      }

      // Delete from database (RLS policies will handle permissions)
      const { error: deleteError } = await supabase
        .from('icepulse_video_recordings')
        .delete()
        .eq('id', videoId)

      if (deleteError) {
        console.error('Error deleting video from database:', deleteError)
        return { success: false, message: deleteError.message || 'Failed to delete video' }
      }

      // Try to delete from storage if it's a storage URL
      // Note: Storage deletion might fail if file doesn't exist, but that's okay
      if (videoData.video_url && videoData.video_url.includes('storage')) {
        try {
          // Extract file path from storage URL
          const urlParts = videoData.video_url.split('/videos/')
          if (urlParts.length > 1) {
            const filePath = urlParts[1].split('?')[0]
            await supabase.storage
              .from('videos')
              .remove([filePath])
          }
        } catch (storageError) {
          // Log but don't fail - storage deletion is best effort
          console.warn('Could not delete video from storage (may already be deleted):', storageError)
        }
      }

      // Try to delete thumbnail if it exists
      if (videoData.thumbnail_url && videoData.thumbnail_url.includes('storage')) {
        try {
          const urlParts = videoData.thumbnail_url.split('/videos/')
          if (urlParts.length > 1) {
            const filePath = urlParts[1].split('?')[0]
            await supabase.storage
              .from('videos')
              .remove([filePath])
          }
        } catch (storageError) {
          // Log but don't fail
          console.warn('Could not delete thumbnail from storage:', storageError)
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting video:', error)
      return { success: false, message: error.message || 'An error occurred while deleting the video' }
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
    uploadHeaderImage,
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
    deleteVideoRecording,
    uploadVideoToStorage,
    uploadThumbnailToStorage,
    createStream,
    uploadStreamChunk, // Keep exposed for direct calls if needed
    queueStreamChunkUpload, // Expose queue function
    stopStream,
    reactivateStream,
    getRecentlyStoppedStream,
    checkStreamingPermission,
    updateStreamingPermission,
    findProfileByEmail,
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
