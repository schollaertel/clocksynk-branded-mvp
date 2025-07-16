import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGameService } from './lib/supabase'
import './responsive-ads.css'

function App() {
  // Check URL parameters for view mode and game ID
  const urlParams = new URLSearchParams(window.location.search)
  const urlViewMode = urlParams.get('view')
  const urlGameId = urlParams.get('game')
  
  const [viewMode, setViewMode] = useState(urlViewMode === 'spectator' ? 'spectator' : 'scorekeeper')
  const [gameState, setGameState] = useState({
    homeScore: 0,
    awayScore: 0,
    period: 1,
    clockTime: 900, // 15 minutes in seconds
    isRunning: false,
    startTime: null,
    lastUpdateTime: null,
    penalties: {}
  })
  
  const [error, setError] = useState(null)
  const [penaltyForm, setPenaltyForm] = useState({
    team: 'Home',
    playerNumber: '',
    minutes: '',
    seconds: ''
  })
  
  // Ad rotation states
  const [currentTopAd, setCurrentTopAd] = useState(0)
  const [currentGridAdSet, setCurrentGridAdSet] = useState(0)
  const [currentFooterAd, setCurrentFooterAd] = useState(0)
  
  // Refs for cleanup and input management
  const subscriptionRef = useRef(null)
  const syncIntervalRef = useRef(null)
  const adRotationRef = useRef(null)
  const minInputRef = useRef(null)
  const secInputRef = useRef(null)
  
  const gameId = urlGameId || process.env.REACT_APP_DEFAULT_GAME_ID || 'demo-game-1'
  const gameService = getGameService()

  // Memoized ad data to prevent unnecessary re-renders
  const bannerAds = useMemo(() => [
    { id: 1, content: "🥍 Elite Lacrosse Equipment - 20% Off", color: "#10b981" },
    { id: 2, content: "⚽ Sports Academy Registration Open", color: "#3b82f6" },
    { id: 3, content: "🥤 Hydration Station - Team Discounts", color: "#f59e0b" }
  ], [])

  const gridAds = useMemo(() => [
    // Set 1 (0-5)
    { id: 1, title: "Local Sports Store", subtitle: "Equipment & Gear", color: "#10b981" },
    { id: 2, title: "Pizza Palace", subtitle: "Post-Game Meals", color: "#ef4444" },
    { id: 3, title: "Sports Medicine", subtitle: "Injury Prevention", color: "#3b82f6" },
    { id: 4, title: "Team Photos", subtitle: "Professional Shots", color: "#8b5cf6" },
    { id: 5, title: "Athletic Training", subtitle: "Skills Development", color: "#f59e0b" },
    { id: 6, title: "Sports Apparel", subtitle: "Custom Jerseys", color: "#06b6d4" },
    
    // Set 2 (6-11)
    { id: 7, title: "Nutrition Center", subtitle: "Performance Fuel", color: "#84cc16" },
    { id: 8, title: "Equipment Repair", subtitle: "Quick Service", color: "#f97316" },
    { id: 9, title: "Youth Leagues", subtitle: "Join Today", color: "#ec4899" },
    { id: 10, title: "Coaching Clinic", subtitle: "Improve Skills", color: "#6366f1" },
    { id: 11, title: "Sports Insurance", subtitle: "Protect Players", color: "#14b8a6" },
    { id: 12, title: "Tournament Hosting", subtitle: "Book Your Event", color: "#a855f7" },
    
    // Set 3 (12-17)
    { id: 13, title: "Fitness Center", subtitle: "Strength Training", color: "#dc2626" },
    { id: 14, title: "Sports Drinks", subtitle: "Stay Hydrated", color: "#059669" },
    { id: 15, title: "Team Banners", subtitle: "Custom Design", color: "#7c3aed" },
    { id: 16, title: "Sports Camps", subtitle: "Summer Programs", color: "#ea580c" },
    { id: 17, title: "Equipment Rental", subtitle: "Game Day Gear", color: "#0891b2" },
    { id: 18, title: "Sports Psychology", subtitle: "Mental Training", color: "#be185d" }
  ], [])

  const footerAds = useMemo(() => [
    { id: 1, content: "🏆 Championship Trophies & Awards", color: "#fbbf24" },
    { id: 2, content: "🚌 Team Transportation Services", color: "#10b981" },
    { id: 3, content: "📱 ClockSynk Pro - Advanced Features", color: "#3b82f6" }
  ], [])

  // Input validation functions
  const validateScore = (score) => {
    const num = parseInt(score)
    return !isNaN(num) && num >= 0 && num <= 999
  }

  const validatePeriod = (period) => {
    const num = parseInt(period)
    return !isNaN(num) && num >= 1 && num <= 10
  }

  const validateTime = (minutes, seconds) => {
    const mins = parseInt(minutes) || 0
    const secs = parseInt(seconds) || 0
    return mins >= 0 && mins <= 99 && secs >= 0 && secs <= 59
  }

  const validatePlayerNumber = (playerNumber) => {
    return playerNumber && playerNumber.trim().length > 0 && playerNumber.trim().length <= 3
  }

  // FIXED: Single timer calculation - no multiple timers
  const calculateCurrentTime = useCallback((state) => {
    try {
      if (!state.isRunning || !state.startTime) {
        return Math.max(0, state.clockTime || 0)
      }
      
      const now = Date.now()
      const elapsedMs = now - state.startTime
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      const remainingTime = Math.max(0, (state.clockTime || 0) - elapsedSeconds)
      
      return remainingTime
    } catch (error) {
      console.error('Error calculating current time:', error)
      return Math.max(0, state.clockTime || 0)
    }
  }, [])

  // Calculate penalty remaining time with error handling
  const calculatePenaltyTime = useCallback((penalty) => {
    try {
      if (!penalty || !penalty.startTime) {
        return penalty?.duration || 0
      }
      
      const now = Date.now()
      const elapsedMs = now - penalty.startTime
      const elapsedSeconds = Math.floor(elapsedMs / 1000)
      const remainingTime = Math.max(0, (penalty.duration || 0) - elapsedSeconds)
      
      return remainingTime
    } catch (error) {
      console.error('Error calculating penalty time:', error)
      return penalty?.duration || 0
    }
  }, [])

  // Error handling wrapper for async functions
  const withErrorHandling = useCallback(async (asyncFn, errorMessage = 'An error occurred') => {
    try {
      setError(null)
      return await asyncFn()
    } catch (error) {
      console.error(errorMessage, error)
      setError(error.message || errorMessage)
      throw error
    }
  }, [])

  // Update game state with proper error handling
  const updateGameState = useCallback(async (updates) => {
    return withErrorHandling(async () => {
      const newState = { ...gameState, ...updates, lastUpdateTime: Date.now() }
      await gameService.updateGameState(gameId, newState)
      setGameState(newState)
      return newState
    }, 'Failed to update game state')
  }, [gameState, gameService, gameId, withErrorHandling])

  // Timer control functions with proper validation
  const startTimer = useCallback(async () => {
    try {
      const now = Date.now()
      await updateGameState({ 
        isRunning: true, 
        startTime: now,
        lastUpdateTime: now
      })
    } catch (error) {
      console.error('Error starting timer:', error)
      setError('Failed to start timer')
    }
  }, [updateGameState])

  const pauseTimer = useCallback(async () => {
    try {
      const currentTime = calculateCurrentTime(gameState)
      await updateGameState({ 
        isRunning: false, 
        clockTime: currentTime,
        startTime: null,
        lastUpdateTime: Date.now()
      })
    } catch (error) {
      console.error('Error pausing timer:', error)
      setError('Failed to pause timer')
    }
  }, [gameState, calculateCurrentTime, updateGameState])

  const resetTimer = useCallback(async () => {
    try {
      await updateGameState({ 
        clockTime: 900, 
        isRunning: false, 
        startTime: null,
        lastUpdateTime: Date.now()
      })
    } catch (error) {
      console.error('Error resetting timer:', error)
      setError('Failed to reset timer')
    }
  }, [updateGameState])

  const setCustomTime = useCallback(async () => {
    try {
      const minutes = parseInt(minInputRef.current?.value) || 0
      const seconds = parseInt(secInputRef.current?.value) || 0
      
      if (!validateTime(minutes, seconds)) {
        throw new Error('Invalid time values')
      }
      
      const totalSeconds = (minutes * 60) + seconds
      
      await updateGameState({ 
        clockTime: totalSeconds, 
        isRunning: false, 
        startTime: null,
        lastUpdateTime: Date.now()
      })
      
      // Clear inputs
      if (minInputRef.current) minInputRef.current.value = ''
      if (secInputRef.current) secInputRef.current.value = ''
    } catch (error) {
      console.error('Error setting custom time:', error)
      setError('Failed to set custom time')
    }
  }, [updateGameState])

  // Score management with validation
  const updateScore = useCallback(async (team, delta) => {
    try {
      const currentScore = team === 'home' ? gameState.homeScore : gameState.awayScore
      const newScore = Math.max(0, currentScore + delta)
      
      if (!validateScore(newScore)) {
        throw new Error('Invalid score value')
      }
      
      const updates = team === 'home' 
        ? { homeScore: newScore }
        : { awayScore: newScore }
      
      await updateGameState(updates)
    } catch (error) {
      console.error('Error updating score:', error)
      setError('Failed to update score')
    }
  }, [gameState.homeScore, gameState.awayScore, updateGameState])

  const updatePeriod = useCallback(async (delta) => {
    try {
      const newPeriod = Math.max(1, Math.min(10, gameState.period + delta))
      
      if (!validatePeriod(newPeriod)) {
        throw new Error('Invalid period value')
      }
      
      await updateGameState({ period: newPeriod })
    } catch (error) {
      console.error('Error updating period:', error)
      setError('Failed to update period')
    }
  }, [gameState.period, updateGameState])

  // Penalty management with validation
  const addPenalty = useCallback(async () => {
    try {
      if (!validatePlayerNumber(penaltyForm.playerNumber)) {
        throw new Error('Player number is required and must be 1-3 characters')
      }
      
      const minutes = parseInt(penaltyForm.minutes) || 0
      const seconds = parseInt(penaltyForm.seconds) || 0
      
      if (!validateTime(minutes, seconds)) {
        throw new Error('Invalid penalty duration')
      }
      
      const duration = (minutes * 60) + seconds
      if (duration <= 0) {
        throw new Error('Penalty duration must be greater than 0')
      }
      
      const penaltyId = `${penaltyForm.team}-${penaltyForm.playerNumber}-${Date.now()}`
      const now = Date.now()
      
      const newPenalty = {
        id: penaltyId,
        team: penaltyForm.team,
        playerNumber: penaltyForm.playerNumber.trim(),
        duration: duration,
        remainingTime: duration,
        startTime: now
      }
      
      const updatedPenalties = {
        ...gameState.penalties,
        [penaltyId]: newPenalty
      }
      
      await updateGameState({ penalties: updatedPenalties })
      
      // Reset form
      setPenaltyForm({
        team: 'Home',
        playerNumber: '',
        minutes: '',
        seconds: ''
      })
    } catch (error) {
      console.error('Error adding penalty:', error)
      setError(error.message || 'Failed to add penalty')
    }
  }, [penaltyForm, gameState.penalties, updateGameState])

  const removePenalty = useCallback(async (penaltyId) => {
    try {
      const updatedPenalties = { ...gameState.penalties }
      delete updatedPenalties[penaltyId]
      await updateGameState({ penalties: updatedPenalties })
    } catch (error) {
      console.error('Error removing penalty:', error)
      setError('Failed to remove penalty')
    }
  }, [gameState.penalties, updateGameState])

  // Format time display
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(Math.abs(seconds) / 60)
    const secs = Math.abs(seconds) % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // FIXED: Single sync system - no conflicting timers
  useEffect(() => {
    let mounted = true

    const initializeGame = async () => {
      try {
        const existingState = await gameService.getGameState(gameId)
        if (mounted && existingState) {
          setGameState(existingState)
        } else if (mounted) {
          await gameService.createGame(gameId, gameState)
        }
      } catch (error) {
        console.error('Error initializing game:', error)
        if (mounted) {
          setError('Failed to initialize game')
        }
      }
    }

    initializeGame()

    // Set up real-time subscription
    if (gameService.subscribeToGameState) {
      subscriptionRef.current = gameService.subscribeToGameState(gameId, (payload) => {
        if (mounted && payload.new) {
          setGameState(payload.new)
        }
      })
    }

    // FIXED: Single sync interval - only for display updates, no timer logic
    syncIntervalRef.current = setInterval(() => {
      if (mounted) {
        setGameState(prevState => {
          // Only update display, don't modify timer
          const currentTime = calculateCurrentTime(prevState)
          
          // Update penalties
          const updatedPenalties = { ...prevState.penalties }
          let penaltiesChanged = false
          
          Object.keys(updatedPenalties).forEach(id => {
            const remainingTime = calculatePenaltyTime(updatedPenalties[id])
            if (remainingTime <= 0) {
              delete updatedPenalties[id]
              penaltiesChanged = true
            }
          })
          
          // Auto-stop timer if time runs out
          if (currentTime <= 0 && prevState.isRunning) {
            const newState = {
              ...prevState,
              clockTime: 0,
              isRunning: false,
              startTime: null,
              penalties: penaltiesChanged ? updatedPenalties : prevState.penalties
            }
            
            // Only update database from scorekeeper view
            if (viewMode === 'scorekeeper') {
              gameService.updateGameState(gameId, newState).catch(error => {
                console.error('Error auto-stopping timer:', error)
              })
            }
            
            return newState
          }
          
          // Return state with updated display time but no timer modification
          return {
            ...prevState,
            penalties: penaltiesChanged ? updatedPenalties : prevState.penalties
          }
        })
      }
    }, 1000)

    return () => {
      mounted = false
      if (subscriptionRef.current?.unsubscribe) {
        subscriptionRef.current.unsubscribe()
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [gameId, gameService, calculateCurrentTime, calculatePenaltyTime, viewMode])

  // Ad rotation effect with error handling
  useEffect(() => {
    try {
      adRotationRef.current = setInterval(() => {
        setCurrentTopAd(prev => (prev + 1) % Math.max(1, bannerAds.length))
        setCurrentGridAdSet(prev => (prev + 1) % 3)
        setCurrentFooterAd(prev => (prev + 1) % Math.max(1, footerAds.length))
      }, 5000)

      return () => {
        if (adRotationRef.current) {
          clearInterval(adRotationRef.current)
        }
      }
    } catch (error) {
      console.error('Error setting up ad rotation:', error)
    }
  }, [bannerAds.length, footerAds.length])

  // Memoized components to prevent unnecessary re-renders
  const TopBannerAd = useMemo(() => {
    const ad = bannerAds[currentTopAd] || bannerAds[0]
    if (!ad) return null
    
    return (
      <div className="banner-ad" style={{ backgroundColor: ad.color }}>
        {ad.content}
      </div>
    )
  }, [bannerAds, currentTopAd])

  const GridAd = useCallback(({ index }) => {
    const adIndex = (currentGridAdSet * 6) + index
    const ad = gridAds[adIndex]
    
    if (!ad) return null
    
    return (
      <div 
        className="ad-grid-item"
        style={{ backgroundColor: ad.color }}
      >
        <div className="ad-title">{ad.title}</div>
        <div className="ad-subtitle">{ad.subtitle}</div>
      </div>
    )
  }, [gridAds, currentGridAdSet])

  const FooterBannerAd = useMemo(() => {
    const ad = footerAds[currentFooterAd] || footerAds[0]
    if (!ad) return null
    
    return (
      <div className="banner-ad" style={{ backgroundColor: ad.color }}>
        {ad.content}
      </div>
    )
  }, [footerAds, currentFooterAd])

  // Get current display time
  const displayTime = calculateCurrentTime(gameState)

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1e293b', 
      color: 'white', 
      padding: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#10b981',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            CS
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>ClockSynk</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Youth Sports Scoreboard</div>
          </div>
        </div>
        
        {!urlViewMode && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('spectator')}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === 'spectator' ? '#10b981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              👁️ Spectator
            </button>
            <button
              onClick={() => setViewMode('scorekeeper')}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === 'scorekeeper' ? '#10b981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              ⚙️ Scorekeeper
            </button>
          </div>
        )}
        
        {viewMode === 'spectator' && (
          <div style={{
            backgroundColor: '#10b981',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            👁️ Spectator View
          </div>
        )}
      </div>

      {/* Spectator Access Info */}
      {viewMode === 'scorekeeper' && (
        <div style={{
          backgroundColor: '#374151',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>📱 Spectator Access</div>
          <div style={{ opacity: 0.8 }}>Share this URL for spectator view:</div>
          <div style={{ 
            backgroundColor: '#1e293b', 
            padding: '6px', 
            borderRadius: '4px', 
            marginTop: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
            wordBreak: 'break-all'
          }}>
            {window.location.origin}{window.location.pathname}?view=spectator&game={gameId}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#dc2626',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Top Banner Ad */}
      <TopBannerAd />

      {/* Main Scoreboard */}
      <div className="scoreboard-grid">
        {/* Home Team */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
            HOME
          </div>
          <div className="score-display" style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '12px' }}>
            {gameState.homeScore}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => updateScore('home', 1)}
                className="touch-button"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
              <button
                onClick={() => updateScore('home', -1)}
                className="touch-button"
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                -
              </button>
            </div>
          )}
        </div>

        {/* Center - Period and Timer */}
        <div style={{ textAlign: 'center' }}>
          <div className="period-display" style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '8px' }}>
            PERIOD
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '8px' }}>
            {gameState.period}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
              <button
                onClick={() => updatePeriod(1)}
                className="touch-button"
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
              <button
                onClick={() => updatePeriod(-1)}
                className="touch-button"
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                -
              </button>
            </div>
          )}
          
          <div className="timer-display" style={{ fontSize: '36px', fontWeight: 'bold', color: '#fbbf24', marginBottom: '12px' }}>
            {formatTime(displayTime)}
          </div>
          
          {viewMode === 'scorekeeper' && (
            <>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
                <input
                  ref={minInputRef}
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="99"
                  style={{
                    width: '50px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: 'white',
                    textAlign: 'center',
                    fontSize: '12px'
                  }}
                />
                <span style={{ alignSelf: 'center', fontSize: '12px' }}>:</span>
                <input
                  ref={secInputRef}
                  type="number"
                  placeholder="Sec"
                  min="0"
                  max="59"
                  style={{
                    width: '50px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: 'white',
                    textAlign: 'center',
                    fontSize: '12px'
                  }}
                />
                <button
                  onClick={setCustomTime}
                  className="touch-button"
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Set
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button
                  onClick={gameState.isRunning ? pauseTimer : startTimer}
                  className="touch-button"
                  style={{
                    backgroundColor: gameState.isRunning ? '#f59e0b' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {gameState.isRunning ? '⏸️ Pause' : '▶️ Play'}
                </button>
                <button
                  onClick={resetTimer}
                  className="touch-button"
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Reset
                </button>
              </div>
            </>
          )}
        </div>

        {/* Away Team */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px' }}>
            AWAY
          </div>
          <div className="score-display" style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '12px' }}>
            {gameState.awayScore}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                onClick={() => updateScore('away', 1)}
                className="touch-button"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
              <button
                onClick={() => updateScore('away', -1)}
                className="touch-button"
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                -
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Penalties Section */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ⚠️ Penalties
        </div>
        
        {viewMode === 'scorekeeper' && (
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '12px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <select
              value={penaltyForm.team}
              onChange={(e) => setPenaltyForm(prev => ({ ...prev, team: e.target.value }))}
              style={{
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                fontSize: '12px'
              }}
            >
              <option value="Home">Home</option>
              <option value="Away">Away</option>
            </select>
            
            <input
              type="text"
              placeholder="#"
              value={penaltyForm.playerNumber}
              onChange={(e) => setPenaltyForm(prev => ({ ...prev, playerNumber: e.target.value }))}
              style={{
                width: '40px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                textAlign: 'center',
                fontSize: '12px'
              }}
            />
            
            <input
              type="number"
              placeholder="Min"
              value={penaltyForm.minutes}
              onChange={(e) => setPenaltyForm(prev => ({ ...prev, minutes: e.target.value }))}
              min="0"
              max="10"
              style={{
                width: '50px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                textAlign: 'center',
                fontSize: '12px'
              }}
            />
            
            <input
              type="number"
              placeholder="Sec"
              value={penaltyForm.seconds}
              onChange={(e) => setPenaltyForm(prev => ({ ...prev, seconds: e.target.value }))}
              min="0"
              max="59"
              style={{
                width: '50px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                textAlign: 'center',
                fontSize: '12px'
              }}
            />
            
            <button
              onClick={addPenalty}
              className="touch-button"
              style={{
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Add
            </button>
          </div>
        )}
        
        <div style={{ fontSize: '14px', opacity: 0.7, fontStyle: 'italic' }}>
          {Object.keys(gameState.penalties).length === 0 ? 'No active penalties' : 
           `${Object.keys(gameState.penalties).length} active penalties`}
        </div>
        
        {Object.values(gameState.penalties).map(penalty => {
          const remainingTime = calculatePenaltyTime(penalty)
          return (
            <div
              key={penalty.id}
              style={{
                backgroundColor: '#374151',
                padding: '8px',
                borderRadius: '6px',
                marginTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontWeight: 'bold' }}>{penalty.team}</span> #{penalty.playerNumber} - {formatTime(remainingTime)}
              </div>
              {viewMode === 'scorekeeper' && (
                <button
                  onClick={() => removePenalty(penalty.id)}
                  style={{
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Responsive Ad Grid */}
      <div className="ad-grid">
        {Array(6).fill(0).map((_, index) => (
          <GridAd key={index} index={index} />
        ))}
      </div>

      {/* Footer Banner Ad */}
      <FooterBannerAd />

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '12px', 
        opacity: 0.6, 
        marginTop: '20px',
        borderTop: '1px solid #374151',
        paddingTop: '16px'
      }}>
        <div>Powered by ClockSynk • Creating Positive Experiences for Young Athletes</div>
        <div style={{ marginTop: '4px' }}>
          Current Mode: {viewMode === 'spectator' ? 'Spectator View' : 'Scorekeeper View'} • Game ID: {gameId}
        </div>
      </div>
    </div>
  )
}

export default App

