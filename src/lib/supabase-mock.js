/**
 * MOCK SUPABASE CLIENT
 * 
 * Use this when database is locked/unavailable.
 * Set VITE_USE_MOCK_DATA=true in .env to enable.
 * 
 * This provides a drop-in replacement for the Supabase client
 * that returns mock data instead of making real queries.
 */

import { mockOrganization, getMockUser, mockOrganizations, mockResponses, delay } from './mock-data.js'

// Check if mock mode is enabled
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

if (USE_MOCK) {
  console.warn('⚠️ MOCK MODE ENABLED - Using mock data instead of database')
}

// Create a mock Supabase client
export const createMockSupabaseClient = () => {
  return {
    from: (table) => ({
      select: (columns = '*') => ({
        eq: (column, value) => ({
          single: async () => {
            await delay(200)
            if (table === 'icepulse_profiles' && column === 'id') {
              return { data: getMockUser(), error: null }
            }
            return { data: null, error: { message: 'Mock: No data found' } }
          },
          maybeSingle: async () => {
            await delay(200)
            return { data: null, error: null }
          },
          limit: async (count) => {
            await delay(200)
            return { data: [], error: null }
          }
        }),
        in: (column, values) => ({
          limit: async (count) => {
            await delay(200)
            return { data: [], error: null }
          }
        }),
        not: (column, operator, value) => ({
          limit: async (count) => {
            await delay(200)
            return { data: [], error: null }
          }
        }),
        limit: async (count) => {
          await delay(200)
          return { data: [], error: null }
        },
        order: (column, options) => ({
          limit: async (count) => {
            await delay(200)
            return { data: [], error: null }
          }
        })
      }),
      insert: (data) => ({
        select: (columns) => ({
          single: async () => {
            await delay(300)
            return { data: { id: `mock-${Date.now()}`, ...data }, error: null }
          }
        })
      }),
      update: (updates) => ({
        eq: (column, value) => ({
          select: (columns) => ({
            single: async () => {
              await delay(200)
              return { data: { id: value, ...updates }, error: null }
            }
          })
        })
      }),
      delete: () => ({
        eq: (column, value) => ({
          select: (columns) => ({
            single: async () => {
              await delay(200)
              return { data: null, error: null }
            }
          })
        })
      })
    }),
    auth: {
      signInWithPassword: async ({ email, password }) => {
        await delay(500)
        if (USE_MOCK) {
          return {
            data: { user: getMockUser() },
            error: null
          }
        }
        return { data: null, error: { message: 'Database unavailable' } }
      },
      signUp: async ({ email, password, options }) => {
        await delay(500)
        if (USE_MOCK) {
          return {
            data: { user: { ...getMockUser(), email } },
            error: null
          }
        }
        return { data: null, error: { message: 'Database unavailable' } }
      },
      signOut: async () => {
        await delay(200)
        return { error: null }
      },
      getSession: async () => {
        await delay(100)
        if (USE_MOCK) {
          return {
            data: { session: { user: getMockUser() } },
            error: null
          }
        }
        return { data: { session: null }, error: null }
      },
      onAuthStateChange: (callback) => {
        let timeoutId = null
        if (USE_MOCK) {
          timeoutId = setTimeout(() => {
            callback('SIGNED_IN', { user: getMockUser() })
          }, 100)
        }
        // Return a proper subscription object that matches Supabase's structure
        const subscription = {
          unsubscribe: () => {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }
          }
        }
        return {
          data: {
            subscription: subscription
          }
        }
      }
    }
  }
}

export { USE_MOCK }
