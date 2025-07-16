import { useState, useEffect, useRef } from 'react'
import { getGameService } from './lib/supabase'

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
    penalties: {}
  })
  
  const [clockInput, setClockInput] = useState({ minutes: '', seconds: '' })
  const [penaltyInput, setPenaltyInput] = useState({
    team: 'Home',
    playerNum: '',
    minutes: '',
    seconds: ''
  })
  
  const timerRef = useRef(null)
  const gameId = urlGameId || process.env.REACT_APP_DEFAULT_GAME_ID || 'demo-game-1'
  const gameService = getGameService()

  // Initialize game state and subscribe to changes
  useEffect(() => {
    const initializeGame = async () => {
      try {
        let existingState = await gameService.getGameState(gameId)
        if (!existingState) {
          // Create initial game state
          existingState = await gameService.createGame(gameId, {
            homeScore: 0,
            awayScore: 0,
            period: 1,
            clockTime: 900, // 15 minutes default
            isRunning: false,
            penalties: {}
          })
        }
        setGameState(existingState)
      } catch (error) {
        console.error('Error initializing game:', error)
        // Fallback to default state
        setGameState({
          homeScore: 0,
          awayScore: 0,
          period: 1,
          clockTime: 900,
          isRunning: false,
          penalties: {}
        })
      }
    }

    initializeGame()

    // Subscribe to real-time updates
    const subscription = gameService.subscribeToGameState(gameId, (payload) => {
      if (payload.new) {
        setGameState(payload.new)
      }
    })

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe()
      }
    }
  }, [gameId])

  // Timer effect
  useEffect(() => {
    if (gameState.isRunning && gameState.clockTime > 0) {
      timerRef.current = setInterval(() => {
        setGameState(prevState => {
          const newState = { ...prevState }
          
          // Decrement main clock
          if (newState.clockTime > 0) {
            newState.clockTime--
          }
          
          // Stop if clock reaches zero
          if (newState.clockTime <= 0) {
            newState.isRunning = false
          }
          
          // Decrement penalties
          const updatedPenalties = { ...newState.penalties }
          let penaltiesChanged = false
          
          Object.keys(updatedPenalties).forEach(id => {
            if (updatedPenalties[id].remainingTime > 0) {
              updatedPenalties[id].remainingTime--
              penaltiesChanged = true
              
              // Remove expired penalties
              if (updatedPenalties[id].remainingTime <= 0) {
                delete updatedPenalties[id]
              }
            }
          })
          
          if (penaltiesChanged) {
            newState.penalties = updatedPenalties
          }
          
          // Update database if scorekeeper
          if (viewMode === 'scorekeeper') {
            gameService.updateGameState(gameId, newState)
          }
          
          return newState
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [gameState.isRunning, gameState.clockTime, viewMode, gameId])

  const updateGameState = async (updates) => {
    const newState = { ...gameState, ...updates }
    setGameState(newState)
    
    if (viewMode === 'scorekeeper') {
      try {
        await gameService.updateGameState(gameId, newState)
      } catch (error) {
        console.error('Error updating game state:', error)
      }
    }
  }

  const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  const handleScoreChange = (team, delta) => {
    if (viewMode !== 'scorekeeper') return
    
    const scoreKey = team === 'home' ? 'homeScore' : 'awayScore'
    const newScore = Math.max(0, gameState[scoreKey] + delta)
    updateGameState({ [scoreKey]: newScore })
  }

  const handlePeriodChange = (delta) => {
    if (viewMode !== 'scorekeeper') return
    
    const newPeriod = Math.max(1, gameState.period + delta)
    updateGameState({ period: newPeriod })
  }

  const handleClockSet = () => {
    if (viewMode !== 'scorekeeper') return
    
    const minutes = parseInt(clockInput.minutes) || 0
    const seconds = parseInt(clockInput.seconds) || 0
    const totalSeconds = (minutes * 60) + seconds
    
    updateGameState({ 
      clockTime: totalSeconds, 
      isRunning: false 
    })
    
    setClockInput({ minutes: '', seconds: '' })
  }

  const handlePlayPause = () => {
    if (viewMode !== 'scorekeeper') return
    
    if (gameState.clockTime > 0) {
      updateGameState({ isRunning: !gameState.isRunning })
    }
  }

  const handleReset = () => {
    if (viewMode !== 'scorekeeper') return
    
    updateGameState({
      homeScore: 0,
      awayScore: 0,
      period: 1,
      clockTime: 900, // 15 minutes
      isRunning: false,
      penalties: {}
    })
  }

  const handleAddPenalty = () => {
    if (viewMode !== 'scorekeeper') return
    
    const { team, playerNum, minutes, seconds } = penaltyInput
    
    if (!playerNum || (!minutes && !seconds)) {
      alert('Please enter player number and penalty duration')
      return
    }
    
    const duration = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0)
    if (duration <= 0) {
      alert('Penalty duration must be greater than 0')
      return
    }
    
    const penaltyId = `penalty_${Date.now()}`
    const newPenalty = {
      id: penaltyId,
      team,
      playerNum,
      remainingTime: duration
    }
    
    const updatedPenalties = { ...gameState.penalties, [penaltyId]: newPenalty }
    updateGameState({ penalties: updatedPenalties })
    
    setPenaltyInput({ team: 'Home', playerNum: '', minutes: '', seconds: '' })
  }

  const AdPlaceholder = ({ position, size = "medium" }) => {
    const heights = {
      small: '64px',
      medium: '96px',
      large: '128px'
    }
    
    return (
      <div style={{
        height: heights[size],
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold' }}>Advertisement</div>
          <div style={{ fontSize: '12px', opacity: 0.75 }}>{position}</div>
        </div>
      </div>
    )
  }

  const spectatorUrl = `${window.location.origin}?view=spectator&game=${gameId}`

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #0f172a, #1e3a8a, #0f172a)',
      padding: '16px',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            height: '48px',
            width: '48px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>CS</span>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>ClockSynk</h1>
            <p style={{ fontSize: '14px', color: '#d1d5db', margin: 0 }}>Creating Positive Experiences for Young Athletes</p>
          </div>
        </div>
        
        {/* Only show view mode buttons if not in URL spectator mode */}
        {!urlViewMode && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('spectator')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: viewMode === 'spectator' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              👁️ Spectator
            </button>
            <button
              onClick={() => setViewMode('scorekeeper')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: viewMode === 'scorekeeper' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ⚙️ Scorekeeper
            </button>
          </div>
        )}
        
        {/* Show spectator badge if in URL spectator mode */}
        {urlViewMode === 'spectator' && (
          <div style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#10b981',
            color: 'white'
          }}>
            👁️ Spectator View
          </div>
        )}
      </div>

      {/* QR Code Section for Spectators */}
      {viewMode === 'scorekeeper' && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>📱</span>
              <div>
                <p style={{ color: 'white', fontWeight: 'bold', margin: 0 }}>Spectator Access</p>
                <p style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>Share this URL for spectator view:</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Spectator URL:</p>
              <code style={{ 
                fontSize: '12px', 
                backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                color: '#10b981' 
              }}>
                {spectatorUrl}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Top Ad */}
      <AdPlaceholder position="Top Banner" size="medium" />

      {/* Main Scoreboard */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '32px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px',
          alignItems: 'center'
        }}>
          
          {/* Home Team */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#10b981' }}>HOME</h2>
            <div style={{ fontSize: '96px', marginBottom: '16px', fontWeight: 'bold' }}>{gameState.homeScore}</div>
            {viewMode === 'scorekeeper' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleScoreChange('home', 1)}
                  style={{
                    fontSize: '20px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
                <button
                  onClick={() => handleScoreChange('home', -1)}
                  style={{
                    fontSize: '20px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  -
                </button>
              </div>
            )}
          </div>

          {/* Game Info */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fbbf24' }}>PERIOD</h3>
              <div style={{ fontSize: '48px', marginBottom: '8px', fontWeight: 'bold' }}>{gameState.period}</div>
              {viewMode === 'scorekeeper' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handlePeriodChange(1)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    +
                  </button>
                  <button
                    onClick={() => handlePeriodChange(-1)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    -
                  </button>
                </div>
              )}
            </div>
            
            <div style={{
              fontSize: '72px',
              marginBottom: '16px',
              fontWeight: 'bold',
              color: gameState.isRunning ? '#10b981' : '#fbbf24'
            }}>
              {formatTime(gameState.clockTime)}
            </div>
            
            {viewMode === 'scorekeeper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={clockInput.minutes}
                    onChange={(e) => setClockInput(prev => ({ ...prev, minutes: e.target.value }))}
                    style={{
                      width: '60px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '4px'
                    }}
                    min="0"
                    max="99"
                  />
                  <span style={{ color: 'white', fontSize: '20px' }}>:</span>
                  <input
                    type="number"
                    placeholder="Sec"
                    value={clockInput.seconds}
                    onChange={(e) => setClockInput(prev => ({ ...prev, seconds: e.target.value }))}
                    style={{
                      width: '60px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '4px'
                    }}
                    min="0"
                    max="59"
                  />
                  <button 
                    onClick={handleClockSet}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Set
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handlePlayPause}
                    disabled={gameState.clockTime <= 0}
                    style={{
                      fontSize: '16px',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      backgroundColor: gameState.clockTime <= 0 ? '#6b7280' : '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: gameState.clockTime <= 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {gameState.isRunning ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  
                  <button
                    onClick={handleReset}
                    style={{
                      fontSize: '16px',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#ef4444' }}>AWAY</h2>
            <div style={{ fontSize: '96px', marginBottom: '16px', fontWeight: 'bold' }}>{gameState.awayScore}</div>
            {viewMode === 'scorekeeper' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleScoreChange('away', 1)}
                  style={{
                    fontSize: '20px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
                <button
                  onClick={() => handleScoreChange('away', -1)}
                  style={{
                    fontSize: '20px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  -
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Penalties Section */}
      {Object.keys(gameState.penalties).length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h3 style={{ color: 'white', marginBottom: '16px' }}>Active Penalties</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.values(gameState.penalties).map((penalty) => (
              <div key={penalty.id} style={{
                backgroundColor: 'rgba(255, 165, 0, 0.2)',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <span style={{ 
                  backgroundColor: '#f59e0b', 
                  color: 'white', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontSize: '12px' 
                }}>
                  {penalty.team}
                </span>
                <span style={{ fontWeight: 'bold' }}>#{penalty.playerNum}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold' }}>
                  {formatTime(penalty.remainingTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Ad */}
      <div style={{ marginTop: '24px' }}>
        <AdPlaceholder position="Bottom Banner" size="medium" />
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '32px', color: '#9ca3af' }}>
        <p style={{ fontSize: '14px', margin: 0 }}>
          Powered by ClockSynk • Creating Positive Experiences for Young Athletes
        </p>
        <p style={{ fontSize: '12px', marginTop: '4px', margin: 0 }}>
          Current Mode: {viewMode === 'scorekeeper' ? 'Scorekeeper' : 'Spectator View'}
          {viewMode === 'scorekeeper' && (
            <span style={{ marginLeft: '8px' }}>
              Game ID: <code style={{ fontSize: '12px', backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 4px', borderRadius: '2px' }}>{gameId}</code>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default App

