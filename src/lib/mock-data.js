/**
 * MOCK DATA FOR DEVELOPMENT
 * 
 * Use this when the database is locked or unavailable.
 * Set VITE_USE_MOCK_DATA=true in .env to enable mock mode.
 */

// Generate 15 players with full names
const generatePlayers = () => {
  const firstNames = ['James', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul']
  const lastNames = ['Anderson', 'Brown', 'Davis', 'Garcia', 'Harris', 'Jackson', 'Johnson', 'Jones', 'Lee', 'Martinez', 'Miller', 'Moore', 'Smith', 'Taylor', 'Wilson']
  
  return firstNames.map((firstName, index) => ({
    id: `mock-player-${index + 1}`,
    fullName: `${firstName} ${lastNames[index]}`,
    email: `${firstName.toLowerCase()}.${lastNames[index].toLowerCase()}@example.com`,
    assignments: [{
      id: `mock-assignment-${index + 1}`,
      teamId: 'mock-team-1',
      seasonId: 'mock-season-1',
      jerseyNumber: index + 1,
      position: index < 6 ? 'Forward' : index < 12 ? 'Defense' : 'Goalie',
      teamName: 'Team A',
      seasonName: '2024 Season'
    }]
  }))
}

// Generate parents connected to players
const generateParents = () => {
  const players = generatePlayers()
  const parentNames = [
    { first: 'Robert', last: 'Anderson' }, { first: 'Jennifer', last: 'Brown' },
    { first: 'John', last: 'Davis' }, { first: 'Mary', last: 'Garcia' },
    { first: 'Patricia', last: 'Harris' }, { first: 'Linda', last: 'Jackson' },
    { first: 'Barbara', last: 'Johnson' }, { first: 'Elizabeth', last: 'Jones' },
    { first: 'Susan', last: 'Lee' }, { first: 'Jessica', last: 'Martinez' },
    { first: 'Sarah', last: 'Miller' }, { first: 'Karen', last: 'Moore' },
    { first: 'Nancy', last: 'Smith' }, { first: 'Lisa', last: 'Taylor' },
    { first: 'Betty', last: 'Wilson' }
  ]
  
  return players.map((player, index) => ({
    id: `mock-parent-${index + 1}`,
    fullName: `${parentNames[index].first} ${parentNames[index].last}`,
    email: `${parentNames[index].first.toLowerCase()}.${parentNames[index].last.toLowerCase()}@example.com`,
    connections: [{ player_id: player.id }]
  }))
}

// Generate coaches with full names
const generateCoaches = () => {
  return [
    { id: 'mock-coach-1', fullName: 'Robert Thompson', email: 'robert.thompson@example.com' },
    { id: 'mock-coach-2', fullName: 'Jennifer Martinez', email: 'jennifer.martinez@example.com' },
    { id: 'mock-coach-3', fullName: 'Michael Chen', email: 'michael.chen@example.com' }
  ]
}

const mockPlayers = generatePlayers()
const mockParents = generateParents()
const mockCoaches = generateCoaches()

// Mock organization data
export const mockOrganization = {
  id: 'mock-org-1',
  name: 'Mock Hockey Organization',
  teams: [
    { id: 'mock-team-1', name: 'Team A' },
    { id: 'mock-team-2', name: 'Team B' }
  ],
  seasons: [
    { id: 'mock-season-1', name: '2024 Season', type: 'season' },
    { id: 'mock-season-2', name: 'Winter Tournament', type: 'tournament' }
  ],
  coaches: mockCoaches.map(coach => ({
    ...coach,
    assignments: [{
      id: `mock-coach-assignment-${coach.id}`,
      teamId: 'mock-team-1',
      seasonId: 'mock-season-1',
      teamName: 'Team A',
      seasonName: '2024 Season'
    }]
  })),
  players: mockPlayers,
  parents: mockParents,
  games: [
    {
      id: 'mock-game-1',
      teamId: 'mock-team-1',
      seasonId: 'mock-season-1',
      gameDate: '2024-01-15',
      gameTime: '18:00',
      opponent: 'Rival Team',
      location: 'Main Rink',
      notes: 'Important game'
    }
  ],
  locations: [
    { id: 'mock-loc-1', name: 'Main Rink', city: 'Toronto', state: 'ON' },
    { id: 'mock-loc-2', name: 'Arena 2', city: 'Mississauga', state: 'ON' }
  ]
}

// Get mock user with role from localStorage (for view switching)
export const getMockUser = () => {
  const savedRole = localStorage.getItem('mock_user_role') || 'organization'
  
  // Get selected user ID for player/parent/coach views
  let userId = 'mock-user-1'
  let userEmail = 'user@example.com'
  let userName = 'Test User'
  
  if (savedRole === 'player') {
    const savedPlayerId = localStorage.getItem('mock_player_id')
    if (savedPlayerId) {
      const player = mockPlayers.find(p => p.id === savedPlayerId)
      if (player) {
        userId = player.id
        userEmail = player.email
        userName = player.fullName
      }
    } else {
      // Default to first player
      userId = mockPlayers[0]?.id || 'mock-user-1'
      userEmail = mockPlayers[0]?.email || 'user@example.com'
      userName = mockPlayers[0]?.fullName || 'Test User'
    }
  } else if (savedRole === 'parent') {
    const savedParentId = localStorage.getItem('mock_parent_id')
    if (savedParentId) {
      const parent = mockParents.find(p => p.id === savedParentId)
      if (parent) {
        userId = parent.id
        userEmail = parent.email
        userName = parent.fullName
      }
    } else {
      // Default to first parent
      userId = mockParents[0]?.id || 'mock-user-1'
      userEmail = mockParents[0]?.email || 'user@example.com'
      userName = mockParents[0]?.fullName || 'Test User'
    }
  } else if (savedRole === 'coach') {
    const savedCoachId = localStorage.getItem('mock_coach_id')
    if (savedCoachId) {
      const coach = mockCoaches.find(c => c.id === savedCoachId)
      if (coach) {
        userId = coach.id
        userEmail = coach.email
        userName = coach.fullName
      }
    } else {
      // Default to first coach
      userId = mockCoaches[0]?.id || 'mock-user-1'
      userEmail = mockCoaches[0]?.email || 'user@example.com'
      userName = mockCoaches[0]?.fullName || 'Test User'
    }
  }
  
  return {
    id: userId,
    email: userEmail,
    name: userName,
    account_type: savedRole === 'organization' ? 'organization' : 'individual',
    role: savedRole
  }
}

// Mock user data (default - use getMockUser() instead)
export const mockUser = getMockUser()

// Mock organizations list
export const mockOrganizations = [
  {
    id: 'mock-org-1',
    name: 'Mock Hockey Organization',
    accessType: 'owner',
    role: 'organization'
  }
]

// Delay function to simulate network latency
export const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms))

// Mock API responses
export const mockResponses = {
  async loadOrganization() {
    await delay(300)
    return { ...mockOrganization }
  },
  
  async addGame(game) {
    await delay(200)
    return {
      id: `mock-game-${Date.now()}`,
      ...game
    }
  },
  
  async updateGame(gameId, updates) {
    await delay(200)
    return { success: true }
  },
  
  async deleteGame(gameId) {
    await delay(200)
    return { success: true }
  },
  
  async searchLocations(query) {
    await delay(200)
    return mockOrganization.locations.filter(loc =>
      loc.name.toLowerCase().includes(query.toLowerCase())
    )
  },
  
  async addLocation(locationData) {
    await delay(200)
    return {
      id: `mock-loc-${Date.now()}`,
      ...locationData
    }
  }
}
