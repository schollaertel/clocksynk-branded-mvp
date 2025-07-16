import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGameService } from './lib/supabase'
import './responsive-ads.css'

function App() {
  // Check URL for view mode and game ID
  const urlParams = new URLSearchParams(window.location.search)
  const urlViewMode = urlParams.get('view')
  const urlGameId = urlParams.get('game')
  const isSpectatorFromURL = urlViewMode === 'spectator'
  const viewMode = isSpectatorFromURL ? 'spectator' : 'scorekeeper'

  // Game state - this will be synced with server
  const [gameState, setGameState] = useState({
    homeScore: 0,
    awayScore: 0,
    period: 1,
    clockTime: 15 * 60, // 15 minutes in seconds
    isRunning: false,
    penalties: {},
    lastUpdated: Date.now()
  })

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customMinutes, setCustomMinutes] = useState('')
  const [customSeconds, setCustomSeconds] = useState('')
  const [penaltyTeam, setPenaltyTeam] = useState('Home')
  const [penaltyPlayer, setPenaltyPlayer] = useState('')
  const [penaltyMinutes, setPenaltyMinutes] = useState('')
  const [penaltySeconds, setPenaltySeconds] = useState('')

  // Ad rotation states
  const [currentTopAd, setCurrentTopAd] = useState(0)
  const [currentFooterAd, setCurrentFooterAd] = useState(0)
  const [currentGridSet, setCurrentGridSet] = useState(0)

  // Refs
  const syncIntervalRef = useRef(null)
  const gameId = urlGameId || process.env.REACT_APP_DEFAULT_GAME_ID || 'demo-game-1'
  const gameService = getGameService()

  // Ad content
  const bannerAds = useMemo(() => [
    { id: 1, text: '🥍 Elite Lacrosse Equipment - 20% Off', color: '#10B981' },
    { id: 2, text: '🥤 Hydration Station - Team Discounts', color: '#F59E0B' },
    { id: 3, text: '🏃 Speed Training Academy - Free Trial', color: '#3B82F6' }
  ], [])

  const footerAds = useMemo(() => [
    { id: 1, text: 'Local Sports Store - Equipment & Gear', color: '#10B981' },
    { id: 2, text: 'Pizza Palace - Post-Game Meals', color: '#EF4444' },
    { id: 3, text: 'Sports Medicine - Injury Prevention', color: '#3B82F6' }
  ], [])

  const gridAds = useMemo(() => [
    // Set 1 (6 ads)
    { id: 1, title: 'Fitness Center', subtitle: 'Strength Training', color: '#EF4444' },
    { id: 2, title: 'Sports Drinks', subtitle: 'Stay Hydrated', color: '#10B981' },
    { id: 3, title: 'Team Banners', subtitle: 'Custom Design', color: '#8B5CF6' },
    { id: 4, title: 'Lacrosse Camps', subtitle: 'Summer Programs', color: '#F59E0B' },
    { id: 5, title: 'Sports Medicine', subtitle: 'Injury Care', color: '#3B82F6' },
    { id: 6, title: 'Equipment Store', subtitle: 'Gear & Apparel', color: '#EC4899' },
    // Set 2 (6 ads)
    { id: 7, title: 'Youth Coaching', subtitle: 'Skill Development', color: '#06B6D4' },
    { id: 8, title: 'Team Photos', subtitle: 'Professional Shots', color: '#84CC16' },
    { id: 9, title: 'Nutrition Bar', subtitle: 'Healthy Snacks', color: '#F97316' },
    { id: 10, title: 'Tournament Gear', subtitle: 'Competition Ready', color: '#6366F1' },
    { id: 11, title: 'Recovery Center', subtitle: 'Post-Game Care', color: '#14B8A6' },
    { id: 12, title: 'Fan Merchandise', subtitle: 'Show Your Spirit', color: '#F43F5E' },
    // Set 3 (6 ads)
    { id: 13, title: 'Training Facility', subtitle: 'Year-Round Practice', color: '#8B5CF6' },
    { id: 14, title: 'Sports Apparel', subtitle: 'Team Uniforms', color: '#10B981' },
    { id: 15, title: 'Video Analysis', subtitle: 'Game Footage', color: '#F59E0B' },
    { id: 16, title: 'Referee Gear', subtitle: 'Official Equipment', color: '#EF4444' },
    { id: 17, title: 'Field Maintenance', subtitle: 'Turf Care', color: '#3B82F6' },
    { id: 18, title: 'Parent Portal', subtitle: 'Stay Connected', color: '#EC4899' }
  ], [])

  // Ad rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTopAd(prev => (prev + 1) % Math.max(1, bannerAds.length))
      setCurrentFooterAd(prev => (prev + 1) % Math.max(1, footerAds.length))
      setCurrentGridSet(prev => (prev + 1) % 3) // 3 sets of 6 ads
    }, 5000) // Rotate every 5 seconds

    return () => clearInterval(interval)
  }, [bannerAds.length, footerAds.length])

  // Server sync effect - this is the key fix for real-time sync
  useEffect(() => {
    let isMounted = true

    const syncWithServer = async () => {
      try {
        const serverState = await gameService.getGameState(gameId)
        if (isMounted && serverState) {
          setGameState(serverState)
          setError(null)
        }
      } catch (err) {
        console.error('Sync error:', err)
        if (isMounted) {
          setError('Connection error - using local state')
        }
      }
    }

    // Initial sync
    syncWithServer().finally(() => {
      if (isMounted) {
        setLoading(false)
      }
    })

    // Set up real-time sync every 2 seconds
    syncIntervalRef.current = setInterval(syncWithServer, 2000)

    return () => {
      isMounted = false
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [gameId, gameService])

  // Timer effect - only runs on scorekeeper and updates server
  useEffect(() => {
    let timerInterval = null

    if (gameState.isRunning && viewMode === 'scorekeeper') {
      timerInterval = setInterval(async () => {
        setGameState(prevState => {
          const newTime = Math.max(0, prevState.clockTime - 1)
          const newState = {
            ...prevState,
            clockTime: newTime,
            lastUpdated: Date.now()
          }

          // Update penalties
          const updatedPenalties = { ...prevState.penalties }
          let penaltiesChanged = false

          Object.keys(updatedPenalties).forEach(id => {
            const penalty = updatedPenalties[id]
            const newPenaltyTime = Math.max(0, penalty.remainingTime - 1)
            
            if (newPenaltyTime <= 0) {
              delete updatedPenalties[id]
              penaltiesChanged = true
            } else if (penalty.remainingTime !== newPenaltyTime) {
              updatedPenalties[id] = { ...penalty, remainingTime: newPenaltyTime }
              penaltiesChanged = true
            }
          })

          if (penaltiesChanged) {
            newState.penalties = updatedPenalties
          }

          // Auto-stop timer if time runs out
          if (newTime <= 0 && prevState.isRunning) {
            newState.isRunning = false
          }

          // Update server with new state
          gameService.updateGameState(gameId, newState).catch(error => {
            console.error('Error updating server state:', error)
          })

          return newState
        })
      }, 1000)
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval)
      }
    }
  }, [gameState.isRunning, viewMode, gameId, gameService])

  // Helper functions
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const updateGameState = useCallback(async (updates) => {
    if (viewMode !== 'scorekeeper') return

    try {
      const newState = { ...gameState, ...updates, lastUpdated: Date.now() }
      setGameState(newState)
      await gameService.updateGameState(gameId, newState)
      setError(null)
    } catch (err) {
      console.error('Error updating game state:', err)
      setError('Failed to update - changes may not sync')
    }
  }, [gameState, gameId, gameService, viewMode])

  // Game control functions
  const startTimer = useCallback(() => {
    updateGameState({ isRunning: true })
  }, [updateGameState])

  const pauseTimer = useCallback(() => {
    updateGameState({ isRunning: false })
  }, [updateGameState])

  const resetTimer = useCallback(() => {
    updateGameState({
      clockTime: 15 * 60,
      isRunning: false,
      penalties: {}
    })
  }, [updateGameState])

  const setCustomTime = useCallback(() => {
    const minutes = parseInt(customMinutes) || 0
    const seconds = parseInt(customSeconds) || 0
    const totalSeconds = minutes * 60 + seconds
    
    if (totalSeconds > 0) {
      updateGameState({ clockTime: totalSeconds, isRunning: false })
      setCustomMinutes('')
      setCustomSeconds('')
    }
  }, [customMinutes, customSeconds, updateGameState])

  const adjustScore = useCallback((team, delta) => {
    const key = team === 'home' ? 'homeScore' : 'awayScore'
    const newScore = Math.max(0, gameState[key] + delta)
    updateGameState({ [key]: newScore })
  }, [gameState, updateGameState])

  const adjustPeriod = useCallback((delta) => {
    const newPeriod = Math.max(1, gameState.period + delta)
    updateGameState({ period: newPeriod })
  }, [gameState.period, updateGameState])

  const addPenalty = useCallback(() => {
    if (!penaltyPlayer || (!penaltyMinutes && !penaltySeconds)) return

    const minutes = parseInt(penaltyMinutes) || 0
    const seconds = parseInt(penaltySeconds) || 0
    const totalSeconds = minutes * 60 + seconds

    if (totalSeconds > 0) {
      const penaltyId = `${Date.now()}-${Math.random()}`
      const newPenalty = {
        id: penaltyId,
        team: penaltyTeam,
        player: penaltyPlayer,
        remainingTime: totalSeconds,
        startTime: Date.now()
      }

      const newPenalties = { ...gameState.penalties, [penaltyId]: newPenalty }
      updateGameState({ penalties: newPenalties })

      // Clear form
      setPenaltyPlayer('')
      setPenaltyMinutes('')
      setPenaltySeconds('')
    }
  }, [penaltyTeam, penaltyPlayer, penaltyMinutes, penaltySeconds, gameState.penalties, updateGameState])

  const removePenalty = useCallback((penaltyId) => {
    const newPenalties = { ...gameState.penalties }
    delete newPenalties[penaltyId]
    updateGameState({ penalties: newPenalties })
  }, [gameState.penalties, updateGameState])

  // Component definitions
  const TopBannerAd = useMemo(() => {
    const ad = bannerAds[currentTopAd] || bannerAds[0]
    if (!ad) return null

    return (
      <div 
        className="banner-ad"
        style={{ backgroundColor: ad.color }}
      >
        {ad.text}
      </div>
    )
  }, [bannerAds, currentTopAd])

  const FooterBannerAd = useMemo(() => {
    const ad = footerAds[currentFooterAd] || footerAds[0]
    if (!ad) return null

    return (
      <div 
        className="banner-ad"
        style={{ backgroundColor: ad.color }}
      >
        {ad.text}
      </div>
    )
  }, [footerAds, currentFooterAd])

  const GridAd = ({ index }) => {
    const adIndex = currentGridSet * 6 + index
    const ad = gridAds[adIndex] || gridAds[index % gridAds.length]
    
    return (
      <div 
        className="ad-grid-item"
        style={{ backgroundColor: ad.color }}
      >
        <div className="ad-title">{ad.title}</div>
        <div className="ad-subtitle">{ad.subtitle}</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#1F2937',
        color: 'white',
        fontSize: '18px'
      }}>
        Loading ClockSynk...
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1F2937', 
      color: 'white', 
      padding: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
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
            width: '32px', 
            height: '32px', 
            backgroundColor: '#10B981', 
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            CS
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>ClockSynk</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Youth Sports Scoreboard</div>
          </div>
        </div>

        {!isSpectatorFromURL && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.location.href = `?view=spectator&game=${gameId}`}
              style={{
                padding: '8px 12px',
                backgroundColor: viewMode === 'spectator' ? '#10B981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              👁️ Spectator
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '8px 12px',
                backgroundColor: viewMode === 'scorekeeper' ? '#10B981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ⚙️ Scorekeeper
            </button>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Spectator Access Info */}
      {viewMode === 'scorekeeper' && (
        <div style={{
          backgroundColor: '#374151',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
            📱 Spectator Access
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            Share this URL for spectator view
          </div>
          <div style={{
            backgroundColor: '#1F2937',
            padding: '8px',
            borderRadius: '4px',
            marginTop: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }}>
            {window.location.origin}?view=spectator&game={gameId}
          </div>
        </div>
      )}

      {/* Top Banner Ad */}
      {TopBannerAd}

      {/* Main Scoreboard */}
      <div className="scoreboard-grid" style={{ marginBottom: '20px' }}>
        {/* HOME */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#10B981', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            HOME
          </div>
          <div className="score-display" style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '12px' }}>
            {gameState.homeScore}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className="touch-button"
                onClick={() => adjustScore('home', 1)}
                style={{
                  backgroundColor: '#10B981',
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
                className="touch-button"
                onClick={() => adjustScore('home', -1)}
                style={{
                  backgroundColor: '#EF4444',
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

        {/* CENTER - Period and Timer */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#F59E0B', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            PERIOD
          </div>
          <div className="period-display" style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            {gameState.period}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
              <button
                onClick={() => adjustPeriod(1)}
                style={{
                  backgroundColor: '#F59E0B',
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
                onClick={() => adjustPeriod(-1)}
                style={{
                  backgroundColor: '#EF4444',
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

          <div className="timer-display" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '12px' }}>
            {formatTime(gameState.clockTime)}
          </div>

          {viewMode === 'scorekeeper' && (
            <>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  style={{
                    width: '50px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />
                <span style={{ alignSelf: 'center' }}>:</span>
                <input
                  type="number"
                  placeholder="Sec"
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(e.target.value)}
                  style={{
                    width: '50px',
                    padding: '4px',
                    borderRadius: '4px',
                    border: '1px solid #374151',
                    backgroundColor: '#374151',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />
                <button
                  onClick={setCustomTime}
                  style={{
                    backgroundColor: '#3B82F6',
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
                  className="touch-button"
                  onClick={gameState.isRunning ? pauseTimer : startTimer}
                  style={{
                    backgroundColor: gameState.isRunning ? '#F59E0B' : '#10B981',
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
                  className="touch-button"
                  onClick={resetTimer}
                  style={{
                    backgroundColor: '#EF4444',
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

        {/* AWAY */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#EF4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            AWAY
          </div>
          <div className="score-display" style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '12px' }}>
            {gameState.awayScore}
          </div>
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className="touch-button"
                onClick={() => adjustScore('away', 1)}
                style={{
                  backgroundColor: '#10B981',
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
                className="touch-button"
                onClick={() => adjustScore('away', -1)}
                style={{
                  backgroundColor: '#EF4444',
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
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '12px',
          fontSize: '16px',
          fontWeight: 'bold'
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
              value={penaltyTeam}
              onChange={(e) => setPenaltyTeam(e.target.value)}
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
              value={penaltyPlayer}
              onChange={(e) => setPenaltyPlayer(e.target.value)}
              style={{
                width: '40px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                fontSize: '12px'
              }}
            />
            <input
              type="number"
              placeholder="Min"
              value={penaltyMinutes}
              onChange={(e) => setPenaltyMinutes(e.target.value)}
              style={{
                width: '50px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                fontSize: '12px'
              }}
            />
            <input
              type="number"
              placeholder="Sec"
              value={penaltySeconds}
              onChange={(e) => setPenaltySeconds(e.target.value)}
              style={{
                width: '50px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #374151',
                backgroundColor: '#374151',
                color: 'white',
                fontSize: '12px'
              }}
            />
            <button
              onClick={addPenalty}
              style={{
                backgroundColor: '#F59E0B',
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

        <div style={{ minHeight: '40px' }}>
          {Object.keys(gameState.penalties).length === 0 ? (
            <div style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '14px' }}>
              No active penalties
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.values(gameState.penalties).map((penalty) => (
                <div
                  key={penalty.id}
                  style={{
                    backgroundColor: penalty.team === 'Home' ? '#10B981' : '#EF4444',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>#{penalty.player}</span>
                  <span>{formatTime(penalty.remainingTime)}</span>
                  {viewMode === 'scorekeeper' && (
                    <button
                      onClick={() => removePenalty(penalty.id)}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2px',
                        padding: '2px 4px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Responsive Ad Grid */}
      <div className="ad-grid">
        {Array(6).fill(0).map((_, index) => (
          <GridAd key={index} index={index} />
        ))}
      </div>

      {/* Footer Banner Ad */}
      {FooterBannerAd}
    </div>
  )
}

export default App

