import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

let supabase = null

// Initialize Supabase client
try {
  if (supabaseUrl !== 'https://your-project.supabase.co' && supabaseKey !== 'your-anon-key') {
    supabase = createClient(supabaseUrl, supabaseKey)
  }
} catch (error) {
  console.warn('Supabase initialization failed, using demo mode:', error)
}

// Demo service for when Supabase is not configured
class DemoGameService {
  constructor() {
    this.storageKey = 'clocksynk-game-state'
    this.defaultState = {
      homeScore: 0,
      awayScore: 0,
      period: 1,
      clockTime: 15 * 60, // 15 minutes in seconds
      isRunning: false,
      penalties: {},
      lastUpdated: Date.now()
    }
  }

  async getGameState(gameId) {
    try {
      const stored = localStorage.getItem(`${this.storageKey}-${gameId}`)
      if (stored) {
        const state = JSON.parse(stored)
        // Ensure we have all required fields
        return { ...this.defaultState, ...state }
      }
      return this.defaultState
    } catch (error) {
      console.error('Error getting game state:', error)
      return this.defaultState
    }
  }

  async updateGameState(gameId, gameState) {
    try {
      const stateToStore = {
        ...gameState,
        lastUpdated: Date.now()
      }
      localStorage.setItem(`${this.storageKey}-${gameId}`, JSON.stringify(stateToStore))
      return stateToStore
    } catch (error) {
      console.error('Error updating game state:', error)
      throw error
    }
  }

  async createGame(gameData) {
    const gameId = `demo-game-${Date.now()}`
    const initialState = {
      ...this.defaultState,
      ...gameData,
      id: gameId,
      createdAt: new Date().toISOString()
    }
    
    await this.updateGameState(gameId, initialState)
    return { id: gameId, ...initialState }
  }

  async deleteGame(gameId) {
    try {
      localStorage.removeItem(`${this.storageKey}-${gameId}`)
      return true
    } catch (error) {
      console.error('Error deleting game:', error)
      return false
    }
  }
}

// Real Supabase service
class SupabaseGameService {
  constructor(client) {
    this.supabase = client
    this.tableName = 'games'
  }

  async getGameState(gameId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', gameId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Game doesn't exist, create it
          return await this.createGame({ id: gameId })
        }
        throw error
      }

      // Ensure penalties is an object
      if (typeof data.penalties === 'string') {
        data.penalties = JSON.parse(data.penalties)
      }

      return {
        homeScore: data.home_score || 0,
        awayScore: data.away_score || 0,
        period: data.period || 1,
        clockTime: data.clock_time || (15 * 60),
        isRunning: data.is_running || false,
        penalties: data.penalties || {},
        lastUpdated: data.last_updated ? new Date(data.last_updated).getTime() : Date.now()
      }
    } catch (error) {
      console.error('Error getting game state:', error)
      throw error
    }
  }

  async updateGameState(gameId, gameState) {
    try {
      const updateData = {
        home_score: gameState.homeScore,
        away_score: gameState.awayScore,
        period: gameState.period,
        clock_time: gameState.clockTime,
        is_running: gameState.isRunning,
        penalties: JSON.stringify(gameState.penalties || {}),
        last_updated: new Date().toISOString()
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .upsert({ id: gameId, ...updateData })
        .select()
        .single()

      if (error) throw error

      return {
        homeScore: data.home_score,
        awayScore: data.away_score,
        period: data.period,
        clockTime: data.clock_time,
        isRunning: data.is_running,
        penalties: JSON.parse(data.penalties || '{}'),
        lastUpdated: new Date(data.last_updated).getTime()
      }
    } catch (error) {
      console.error('Error updating game state:', error)
      throw error
    }
  }

  async createGame(gameData) {
    try {
      const gameId = gameData.id || `game-${Date.now()}`
      const initialData = {
        id: gameId,
        home_score: gameData.homeScore || 0,
        away_score: gameData.awayScore || 0,
        period: gameData.period || 1,
        clock_time: gameData.clockTime || (15 * 60),
        is_running: gameData.isRunning || false,
        penalties: JSON.stringify(gameData.penalties || {}),
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(initialData)
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        homeScore: data.home_score,
        awayScore: data.away_score,
        period: data.period,
        clockTime: data.clock_time,
        isRunning: data.is_running,
        penalties: JSON.parse(data.penalties || '{}'),
        lastUpdated: new Date(data.last_updated).getTime()
      }
    } catch (error) {
      console.error('Error creating game:', error)
      throw error
    }
  }

  async deleteGame(gameId) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', gameId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting game:', error)
      return false
    }
  }
}

// Export the appropriate service
export function getGameService() {
  if (supabase) {
    return new SupabaseGameService(supabase)
  } else {
    return new DemoGameService()
  }
}

export { supabase }

