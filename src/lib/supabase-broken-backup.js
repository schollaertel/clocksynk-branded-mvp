import { createClient } from '@supabase/supabase-js'

// TODO: Replace with your actual Supabase credentials
// You can find these in your Supabase project settings
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Game state management functions
export const gameStateService = {
  // Subscribe to game state changes
  subscribeToGameState: (gameId, callback) => {
    return supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_states',
        filter: `game_id=eq.${gameId}`
      }, callback)
      .subscribe()
  },

  // Update game state
  updateGameState: async (gameId, gameState) => {
    const { data, error } = await supabase
      .from('game_states')
      .upsert({
        game_id: gameId,
        home_score: gameState.homeScore,
        away_score: gameState.awayScore,
        period: gameState.period,
        clock_time: gameState.clockTime,
        is_running: gameState.isRunning,
        penalties: gameState.penalties,
        updated_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error updating game state:', error)
      throw error
    }
    
    return data
  },

  // Get current game state
  getGameState: async (gameId) => {
    const { data, error } = await supabase
      .from('game_states')
      .select('*')
      .eq('game_id', gameId)
      .single()
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching game state:', error)
      throw error
    }
    
    return data ? {
      homeScore: data.home_score,
      awayScore: data.away_score,
      period: data.period,
      clockTime: data.clock_time,
      isRunning: data.is_running,
      penalties: data.penalties || {}
    } : null
  },

  // Create initial game state
  createGame: async (gameId, initialState = {}) => {
    const defaultState = {
      homeScore: 0,
      awayScore: 0,
      period: 1,
      clockTime: 0,
      isRunning: false,
      penalties: {},
      ...initialState
    }

    const { data, error } = await supabase
      .from('game_states')
      .insert({
        game_id: gameId,
        home_score: defaultState.homeScore,
        away_score: defaultState.awayScore,
        period: defaultState.period,
        clock_time: defaultState.clockTime,
        is_running: defaultState.isRunning,
        penalties: defaultState.penalties,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating game:', error)
      throw error
    }

    return defaultState
  }
}

// For demo/testing purposes when Supabase is not configured
export const demoGameStateService = {
  subscribeToGameState: (gameId, callback) => {
    // Simulate real-time updates with localStorage polling
    const interval = setInterval(() => {
      const state = localStorage.getItem(`game-${gameId}`)
      if (state) {
        callback({ new: JSON.parse(state) })
      }
    }, 1000)
    
    return {
      unsubscribe: () => clearInterval(interval)
    }
  },

  updateGameState: async (gameId, gameState) => {
    localStorage.setItem(`game-${gameId}`, JSON.stringify(gameState))
    return gameState
  },

  getGameState: async (gameId) => {
    const state = localStorage.getItem(`game-${gameId}`)
    return state ? JSON.parse(state) : null
  },

  createGame: async (gameId, initialState = {}) => {
    const defaultState = {
      homeScore: 0,
      awayScore: 0,
      period: 1,
      clockTime: 0,
      isRunning: false,
      penalties: {},
      ...initialState
    }
    localStorage.setItem(`game-${gameId}`, JSON.stringify(defaultState))
    return defaultState
  }
}

// Auto-detect which service to use
export const getGameService = () => {
  // Check if Supabase is properly configured
  if (supabaseUrl.includes('your-project') || supabaseKey.includes('your-anon-key')) {
    console.log('Using demo service (localStorage) - Supabase not configured')
    return demoGameStateService
  }
  
  console.log('Using Supabase service')
  return gameStateService
}

