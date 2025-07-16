import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
    startTime: null, // Server timestamp when timer started
    lastUpdateTime: null, // Last time the clock was updated
    penalties: {}
  })
  
  const [penaltyForm, setPenaltyForm] = useState({
    team: 'Home',
    playerNumber: '',
    minutes: '2',
    seconds: '0'
  })
  
  // Ad rotation states
  const [currentTopAd, setCurrentTopAd] = useState(0)
  const [currentGridAdSet, setCurrentGridAdSet] = useState(0) // 0, 1, or 2 for 3 different sets
  const [currentFooterAd, setCurrentFooterAd] = useState(0)
  
  // Error handling state
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Refs for timer and ad rotation
  const timerRef = useRef(null)
  const adRotationRef = useRef(null)
  const displayUpdateRef = useRef(null)
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

  // Calculate current time based on server timestamps with error handling
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
      setError(`${errorMessage}: ${error.message}`)
      throw error
    }
  }, [])

  // Optimized game state update function
  const updateGameState = useCallback(async (updates) => {
    try {
      // Validate updates
      if (updates.homeScore !== undefined && !validateScore(updates.homeScore)) {
        throw new Error('Invalid home score')
      }
      if (updates.awayScore !== undefined && !validateScore(updates.awayScore)) {
        throw new Error('Invalid away score')
      }
      if (updates.period !== undefined && !validatePeriod(updates.period)) {
        throw new Error('Invalid period')
      }

      const newState = { ...gameState, ...updates, lastUpdateTime: Date.now() }
      setGameState(newState)
      
      if (viewMode === 'scorekeeper') {
        await withErrorHandling(
          () => gameService.updateGameState(gameId, newState),
          'Failed to update game state'
        )
      }
    } catch (error) {
      console.error('Error updating game state:', error)
      setError(error.message)
    }
  }, [gameState, viewMode, gameId, gameService, withErrorHandling])

  // Timer control functions with proper error handling
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
        minutes: '2',
        seconds: '0'
      })
    } catch (error) {
      console.error('Error adding penalty:', error)
      setError(error.message)
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

  // Utility functions
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(Math.max(0, seconds) / 60)
    const secs = Math.max(0, seconds) % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Initialize game state and subscribe to changes
  useEffect(() => {
    const loadGameState = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const state = await withErrorHandling(
          () => gameService.getGameState(gameId),
          'Failed to load game state'
        )
        
        if (state) {
          setGameState(state)
        }
      } catch (error) {
        console.error('Error loading game state:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadGameState()

    // Subscribe to real-time updates
    let subscription = null
    try {
      subscription = gameService.subscribeToGameState(gameId, (payload) => {
        try {
          const newState = payload?.new || payload
          if (newState && typeof newState === 'object') {
            setGameState(prevState => ({
              ...prevState,
              ...newState,
              penalties: newState.penalties || {}
            }))
          }
        } catch (error) {
          console.error('Error processing subscription update:', error)
        }
      })
    } catch (error) {
      console.error('Error setting up subscription:', error)
    }

    return () => {
      if (subscription && subscription.unsubscribe) {
        try {
          subscription.unsubscribe()
        } catch (error) {
          console.error('Error unsubscribing:', error)
        }
      }
    }
  }, [gameId, gameService, withErrorHandling])

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

  // FIXED: Display update effect - separate from timer logic to prevent infinite loop
  useEffect(() => {
    if (gameState.isRunning) {
      displayUpdateRef.current = setInterval(() => {
        setGameState(prevState => {
          const currentTime = calculateCurrentTime(prevState)
          
          // Update penalties
          const updatedPenalties = { ...prevState.penalties }
          let penaltiesChanged = false
          
          Object.keys(updatedPenalties).forEach(id => {
            const remainingTime = calculatePenaltyTime(updatedPenalties[id])
            if (remainingTime <= 0) {
              delete updatedPenalties[id]
              penaltiesChanged = true
            } else if (updatedPenalties[id].remainingTime !== remainingTime) {
              updatedPenalties[id] = { ...updatedPenalties[id], remainingTime }
              penaltiesChanged = true
            }
          })
          
          const newState = {
            ...prevState,
            penalties: penaltiesChanged ? updatedPenalties : prevState.penalties
          }
          
          // Auto-stop timer if time runs out
          if (currentTime <= 0 && prevState.isRunning) {
            newState.isRunning = false
            newState.startTime = null
            
            // Only update database from scorekeeper view
            if (viewMode === 'scorekeeper') {
              gameService.updateGameState(gameId, { 
                ...newState, 
                clockTime: 0 
              }).catch(error => {
                console.error('Error auto-stopping timer:', error)
              })
            }
          }
          
          return newState
        })
      }, 1000)
    } else {
      if (displayUpdateRef.current) {
        clearInterval(displayUpdateRef.current)
        displayUpdateRef.current = null
      }
    }

    return () => {
      if (displayUpdateRef.current) {
        clearInterval(displayUpdateRef.current)
      }
    }
  }, [gameState.isRunning, calculateCurrentTime, calculatePenaltyTime, viewMode, gameId, gameService])

  // Memoized components to prevent unnecessary re-renders
  const TopBannerAd = useMemo(() => {
    const ad = bannerAds[currentTopAd] || bannerAds[0]
    if (!ad) return null
    
    return (
      <div style={{
        height: '60px',
        backgroundColor: ad.color,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
        transition: 'all 0.5s ease-in-out',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '0 12px'
      }}>
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
      <div style={{
        height: '60px',
        backgroundColor: ad.color,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'center',
        transition: 'all 0.5s ease-in-out',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '0 12px'
      }}>
        {ad.content}
      </div>
    )
  }, [footerAds, currentFooterAd])

  const spectatorUrl = `${window.location.origin}?view=spectator&game=${gameId}`
  const currentTime = calculateCurrentTime(gameState)

  // Loading state
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#0f172a', 
        color: 'white', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <div>Loading ClockSynk...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0f172a', 
      color: 'white', 
      padding: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '100vw',
      overflowX: 'hidden'
    }}>
      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#ef4444',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header - Mobile Optimized */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            CS
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>ClockSynk</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Youth Sports Scoreboard</p>
          </div>
        </div>
        
        {!urlViewMode && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setViewMode('spectator')}
              style={{
                padding: '6px 12px',
                backgroundColor: viewMode === 'spectator' ? '#10b981' : 'transparent',
                color: 'white',
                border: '2px solid #10b981',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                minHeight: '44px'
              }}
            >
              👁️ Spectator
            </button>
            <button
              onClick={() => setViewMode('scorekeeper')}
              style={{
                padding: '6px 12px',
                backgroundColor: viewMode === 'scorekeeper' ? '#10b981' : 'transparent',
                color: 'white',
                border: '2px solid #10b981',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                minHeight: '44px'
              }}
            >
              ⚙️ Scorekeeper
            </button>
          </div>
        )}
        
        {urlViewMode === 'spectator' && (
          <div style={{
            padding: '6px 12px',
            backgroundColor: '#10b981',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            👁️ Spectator View
          </div>
        )}
      </div>

      {/* Spectator Access Info - Mobile Optimized */}
      {viewMode === 'scorekeeper' && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📱 Spectator Access
          </h3>
          <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#9ca3af' }}>Share this URL for spectator view</p>
          <code style={{ 
            backgroundColor: 'rgba(0,0,0,0.3)', 
            padding: '6px', 
            borderRadius: '4px', 
            fontSize: '10px',
            display: 'block',
            wordBreak: 'break-all'
          }}>
            {spectatorUrl}
          </code>
        </div>
      )}

      {/* Top Banner Ad */}
      {TopBannerAd}

      {/* Main Scoreboard - Mobile Optimized */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr auto 1fr', 
        gap: '8px', 
        alignItems: 'center',
        marginBottom: '20px',
        textAlign: 'center',
        maxWidth: '100%'
      }}>
        {/* HOME */}
        <div style={{ minWidth: 0 }}>
          <h2 style={{ 
            margin: '0 0 6px 0', 
            fontSize: '16px', 
            color: '#10b981',
            fontWeight: 'bold'
          }}>HOME</h2>
          <div style={{ 
            fontSize: '48px', 
            fontWeight: 'bold', 
            margin: '0 0 10px 0',
            lineHeight: '1'
          }}>
            {gameState.homeScore}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              <button
                onClick={() => updateGameState({ homeScore: gameState.homeScore + 1 })}
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                +
              </button>
              <button
                onClick={() => updateGameState({ homeScore: Math.max(0, gameState.homeScore - 1) })}
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                -
              </button>
            </div>
          )}
        </div>

        {/* CENTER - Timer and Period */}
        <div style={{ minWidth: '120px', maxWidth: '160px' }}>
          <h3 style={{ 
            margin: '0 0 6px 0', 
            fontSize: '14px', 
            color: '#f59e0b',
            fontWeight: 'bold'
          }}>PERIOD</h3>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            margin: '0 0 10px 0',
            color: '#f59e0b'
          }}>
            {gameState.period}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '10px' }}>
              <button
                onClick={() => updateGameState({ period: gameState.period + 1 })}
                style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                +
              </button>
              <button
                onClick={() => updateGameState({ period: Math.max(1, gameState.period - 1) })}
                style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                -
              </button>
            </div>
          )}
          
          {/* Timer Display */}
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#fbbf24',
            margin: '0 0 10px 0'
          }}>
            {formatTime(currentTime)}
          </div>
          
          {viewMode === 'scorekeeper' && (
            <div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
                <input
                  ref={minInputRef}
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="99"
                  style={{
                    width: '40px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#1f2937',
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
                    width: '40px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#1f2937',
                    color: 'white',
                    textAlign: 'center',
                    fontSize: '12px'
                  }}
                />
                <button
                  onClick={setCustomTime}
                  style={{
                    padding: '4px 6px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    minHeight: '32px'
                  }}
                >
                  Set
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                <button
                  onClick={gameState.isRunning ? pauseTimer : startTimer}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: gameState.isRunning ? '#f59e0b' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                >
                  {gameState.isRunning ? '⏸️ Pause' : '▶️ Play'}
                </button>
                <button
                  onClick={resetTimer}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    minHeight: '44px'
                  }}
                >
                  🔄 Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AWAY */}
        <div style={{ minWidth: 0 }}>
          <h2 style={{ 
            margin: '0 0 6px 0', 
            fontSize: '16px', 
            color: '#ef4444',
            fontWeight: 'bold'
          }}>AWAY</h2>
          <div style={{ 
            fontSize: '48px', 
            fontWeight: 'bold', 
            margin: '0 0 10px 0',
            lineHeight: '1'
          }}>
            {gameState.awayScore}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              <button
                onClick={() => updateGameState({ awayScore: gameState.awayScore + 1 })}
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                +
              </button>
              <button
                onClick={() => updateGameState({ awayScore: Math.max(0, gameState.awayScore - 1) })}
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  minHeight: '44px'
                }}
              >
                -
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Penalties Section - Mobile Optimized */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⚠️ Penalties
        </h3>
        
        {viewMode === 'scorekeeper' && (
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            marginBottom: '8px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <select
              value={penaltyForm.team}
              onChange={(e) => setPenaltyForm({...penaltyForm, team: e.target.value})}
              style={{
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: 'white',
                fontSize: '12px',
                minHeight: '32px'
              }}
            >
              <option value="Home">Home</option>
              <option value="Away">Away</option>
            </select>
            <input
              type="text"
              placeholder="#"
              value={penaltyForm.playerNumber}
              onChange={(e) => setPenaltyForm({...penaltyForm, playerNumber: e.target.value})}
              maxLength="3"
              style={{
                width: '32px',
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: 'white',
                textAlign: 'center',
                fontSize: '12px',
                minHeight: '32px'
              }}
            />
            <input
              type="number"
              placeholder="Min"
              value={penaltyForm.minutes}
              onChange={(e) => setPenaltyForm({...penaltyForm, minutes: e.target.value})}
              min="0"
              max="10"
              style={{
                width: '40px',
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: 'white',
                textAlign: 'center',
                fontSize: '12px',
                minHeight: '32px'
              }}
            />
            <input
              type="number"
              placeholder="Sec"
              value={penaltyForm.seconds}
              onChange={(e) => setPenaltyForm({...penaltyForm, seconds: e.target.value})}
              min="0"
              max="59"
              style={{
                width: '40px',
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: 'white',
                textAlign: 'center',
                fontSize: '12px',
                minHeight: '32px'
              }}
            />
            <button
              onClick={addPenalty}
              style={{
                padding: '4px 8px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                minHeight: '44px'
              }}
            >
              Add
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.values(gameState.penalties).length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>No active penalties</p>
          ) : (
            Object.values(gameState.penalties).map(penalty => {
              const remainingTime = calculatePenaltyTime(penalty)
              return (
                <div
                  key={penalty.id}
                  style={{
                    backgroundColor: penalty.team === 'Home' ? '#10b981' : '#ef4444',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{penalty.team} #{penalty.playerNumber}</span>
                  <span>{formatTime(remainingTime)}</span>
                  {viewMode === 'scorekeeper' && (
                    <button
                      onClick={() => removePenalty(penalty.id)}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '2px',
                        padding: '2px 4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        minHeight: '24px'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Responsive Ad Grid - 6 ads total */}
      <div className="ad-grid">
        {Array(6).fill(0).map((_, index) => (
          <GridAd key={index} index={index} />
        ))}
      </div>

      {/* Footer Banner Ad */}
      {FooterBannerAd}

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}>
          Powered by ClockSynk • Creating Positive Experiences for Young Athletes
        </p>
        <p style={{ margin: 0, fontSize: '10px' }}>
          Current Mode: {viewMode === 'spectator' ? 'Spectator View' : 'Scorekeeper'} • Game ID: <code>{gameId}</code>
        </p>
      </div>
    </div>
  )
}

export default App

