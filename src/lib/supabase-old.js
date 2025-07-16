import { createClient } from '@supabase/supabase-js'

// TODO: Replace with your actual Supabase credentials
// You can find these in your Supabase project settings
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Game state management functions with enhanced error handling and timestamp support
export const gameStateService = {
  // Subscribe to game state changes
  subscribeToGameState: (gameId, callback) => {
    try {
      return supabase
        .channel(`game-${gameId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'game_states',
          filter: `game_id=eq.${gameId}`
        }, (payload) => {
          try {
            callback(payload)
          } catch (error) {
            console.error('Error in subscription callback:', error)
          }
        })
        .subscribe()
    } catch (error) {
      console.error('Error setting up subscription:', error)
      return { unsubscribe: () => {} }
    }
  },

  // Update game state with proper timestamp handling
  updateGameState: async (gameId, gameState) => {
    try {
      // Validate required fields
      if (!gameId || typeof gameId !== 'string') {
        throw new Error('Invalid game ID')
      }

      if (!gameState || typeof gameState !== 'object') {
        throw new Error('Invalid game state')
      }

      // Prepare data for database with proper timestamp handling
      const dbData = {
        game_id: gameId,
        home_score: parseInt(gameState.homeScore) || 0,
        away_score: parseInt(gameState.awayScore) || 0,
        period: parseInt(gameState.period) || 1,
        clock_time: parseInt(gameState.clockTime) || 0,
        is_running: Boolean(gameState.isRunning),
        start_time: gameState.startTime ? new Date(gameState.startTime).toISOString() : null,
        last_update_time: gameState.lastUpdateTime ? new Date(gameState.lastUpdateTime).toISOString() : new Date().toISOString(),
        penalties: gameState.penalties || {},
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('game_states')
        .upsert(dbData, {
          onConflict: 'game_id'
        })
        .select()
      
      if (error) {
        console.error('Supabase error updating game state:', error)
        throw new Error(`Database error: ${error.message}`)
      }
      
      return data
    } catch (error) {
      console.error('Error updating game state:', error)
      throw error
    }
  },

  // Get current game state with proper timestamp conversion
  getGameState: async (gameId) => {
    try {
      if (!gameId || typeof gameId !== 'string') {
        throw new Error('Invalid game ID')
      }

      const { data, error } = await supabase
        .from('game_states')
        .select('*')
        .eq('game_id', gameId)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Supabase error fetching game state:', error)
        throw new Error(`Database error: ${error.message}`)
      }
      
      if (!data) {
        return null
      }

      // Convert database format to app format with proper timestamp handling
      return {
        homeScore: parseInt(data.home_score) || 0,
        awayScore: parseInt(data.away_score) || 0,
        period: parseInt(data.period) || 1,
        clockTime: parseInt(data.clock_time) || 0,
        isRunning: Boolean(data.is_running),
        startTime: data.start_time ? new Date(data.start_time).getTime() : null,
        lastUpdateTime: data.last_update_time ? new Date(data.last_update_time).getTime() : null,
        penalties: data.penalties || {}
      }
    } catch (error) {
      console.error('Error fetching game state:', error)
      throw error
    }
  },

  // Create initial game state with proper validation
  createGame: async (gameId, initialState = {}) => {
    try {
      if (!gameId || typeof gameId !== 'string') {
        throw new Error('Invalid game ID')
      }

      const defaultState = {
        homeScore: 0,
        awayScore: 0,
        period: 1,
        clockTime: 900, // 15 minutes default
        isRunning: false,
        startTime: null,
        lastUpdateTime: Date.now(),
        penalties: {},
        ...initialState
      }

      // Validate the state
      if (defaultState.homeScore < 0 || defaultState.awayScore < 0) {
        throw new Error('Scores cannot be negative')
      }

      if (defaultState.period < 1 || defaultState.period > 10) {
        throw new Error('Period must be between 1 and 10')
      }

      if (defaultState.clockTime < 0) {
        throw new Error('Clock time cannot be negative')
      }

      const now = new Date().toISOString()
      const dbData = {
        game_id: gameId,
        home_score: defaultState.homeScore,
        away_score: defaultState.awayScore,
        period: defaultState.period,
        clock_time: defaultState.clockTime,
        is_running: defaultState.isRunning,
        start_time: defaultState.startTime ? new Date(defaultState.startTime).toISOString() : null,
        last_update_time: new Date(defaultState.lastUpdateTime).toISOString(),
        penalties: defaultState.penalties,
        created_at: now,
        updated_at: now
      }

      const { data, error } = await supabase
        .from('game_states')
        .insert(dbData)
        .select()
        .single()

      if (error) {
        console.error('Supabase error creating game:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      return defaultState
    } catch (error) {
      console.error('Error creating game:', error)
      throw error
    }
  }
}

// Enhanced demo service with timestamp support for testing
export const demoGameStateService = {
  subscribeToGameState: (gameId, callback) => {
    try {
      // Simulate real-time updates with localStorage polling
      const interval = setInterval(() => {
        try {
          const state = localStorage.getItem(`game-${gameId}`)
          if (state) {
            const parsedState = JSON.parse(state)
            callback({ new: parsedState })
          }
        } catch (error) {
          console.error('Error in demo subscription:', error)
        }
      }, 1000)
      
      return {
        unsubscribe: () => {
          try {
            clearInterval(interval)
          } catch (error) {
            console.error('Error unsubscribing from demo service:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error setting up demo subscription:', error)
      return { unsubscribe: () => {} }
    }
  },

  updateGameState: async (gameId, gameState) => {
    try {
      if (!gameId || typeof gameId !== 'string') {
        throw new Error('Invalid game ID')
      }

      if (!gameState || typeof gameState !== 'object') {
        throw new Error('Invalid game state')
      }

      // Validate state before storing
      const validatedState = {
        homeScore: Math.max(0, parseInt(gameState.homeScore) || 0),
        awayScore: Math.max(0, parseInt(gameState.awayScore) || 0),
        period: Math.max(1, Math.min(10, parseInt(gameState.period) || 1)),
        clockTime: Math.max(0, parseInt(gameState.clockTime) || 0),
        isRunning: Boolean(gameState.isRunning),
        startTime: gameState.startTime || null,
        lastUpdateTime: gameState.lastUpdateTime || Date.now(),
        penalties: gameState.penalties || {}
      }

      localStorage.setItem(`game-${gameId}`, JSON.stringify(validatedState))
      return validatedState
    } catch (error) {
      console.error('Error updating demo game state:', error)
      throw error
    }
  },

  getGameState: async (gameId) => {
    try {
      if (!gameId || typeof gameId !== 'string') {
        throw new Error('Invalid game ID')
      }

      const state = localStorage.getItem(`game-${gameId}`)
      if (!state) {
        return null
      }

      const parsedState = JSON.parse(state)
      
      // Validate and sanitize the loaded state
      return {
        homeScore: Math.max(0, parseInt(parsedState.homeScore) || 0),
        awayScore: Math.max(0, parseInt(parsedState.awayScore) || 0),
        period: Math.max(1, Math.min(10, parseInt(parsedState.period) || 1)),
        clockTime: Math.max(0, parseInt(parsedState.clockTime) || 0),
        isRunning: Boolean(parsedState.isRunning),
        startTime: parsedState.startTime || null,
        lastUpdateTime: parsedState.lastUpdateTime || Date.now(),
        penalties: parsedState.penalties || {}
      }
    } catch (error) {
      console.error('Error getting demo game state:', error)
      return null
    }
  },

  createGame: async (gameId, initialState = {}) => {
    try {
      if (!gameId || typeof gameId !== 'string') {
        throw new Error('Invalid game ID')
      }

      const defaultState = {
        homeScore: 0,
        awayScore: 0,
        period: 1,
        clockTime: 900,
        isRunning: false,
        startTime: null,
        lastUpdateTime: Date.now(),
        penalties: {},
        ...initialState
      }

      // Validate the initial state
      const validatedState = {
        homeScore: Math.max(0, parseInt(defaultState.homeScore) || 0),
        awayScore: Math.max(0, parseInt(defaultState.awayScore) || 0),
        period: Math.max(1, Math.min(10, parseInt(defaultState.period) || 1)),
        clockTime: Math.max(0, parseInt(defaultState.clockTime) || 0),
        isRunning: Boolean(defaultState.isRunning),
        startTime: defaultState.startTime,
        lastUpdateTime: defaultState.lastUpdateTime,
        penalties: defaultState.penalties || {}
      }

      localStorage.setItem(`game-${gameId}`, JSON.stringify(validatedState))
      return validatedState
    } catch (error) {
      console.error('Error creating demo game:', error)
      throw error
    }
  }
}

// Auto-detect which service to use with better error handling
export const getGameService = () => {
  try {
    // Check if Supabase is properly configured
    if (supabaseUrl.includes('your-project') || supabaseKey.includes('your-anon-key')) {
      console.log('Using demo service (localStorage) - Supabase not configured')
      return demoGameStateService
    }
    
    console.log('Using Supabase service')
    return gameStateService
  } catch (error) {
    console.error('Error determining game service:', error)
    console.log('Falling back to demo service')
    return demoGameStateService
  }
}

