import { useState, useEffect, useRef } from 'react'
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
    penalties: {}
  })
  
  const [clockInput, setClockInput] = useState({ minutes: '', seconds: '' })
  const [penaltyInput, setPenaltyInput] = useState({
    team: 'Home',
    playerNum: '',
    minutes: '2',
    seconds: '0'
  })
  
  // Ad rotation states
  const [currentTopAd, setCurrentTopAd] = useState(0)
  const [currentGridAdSet, setCurrentGridAdSet] = useState(0) // 0, 1, or 2 for 3 different sets
  const [currentFooterAd, setCurrentFooterAd] = useState(0)
  
  const timerRef = useRef(null)
  const adRotationRef = useRef(null)
  const gameId = urlGameId || process.env.REACT_APP_DEFAULT_GAME_ID || 'demo-game-1'
  const gameService = getGameService()

  // Ad content arrays
  const topBannerAds = [
    { id: 1, content: "🏒 Elite Hockey Equipment - 20% Off", color: "#10b981" },
    { id: 2, content: "⚽ Sports Academy Registration Open", color: "#3b82f6" },
    { id: 3, content: "🥤 Hydration Station - Team Discounts", color: "#f59e0b" }
  ]

  const gridAds = [
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
  ]

  const footerAds = [
    { id: 1, content: "🏆 Championship Trophies & Awards", color: "#fbbf24" },
    { id: 2, content: "🚌 Team Transportation Services", color: "#10b981" },
    { id: 3, content: "📱 ClockSynk Pro - Advanced Features", color: "#3b82f6" }
  ]

  // Initialize game state and subscribe to changes
  useEffect(() => {
    const initializeGame = async () => {
      try {
        let existingState = await gameService.getGameState(gameId)
        if (!existingState) {
          existingState = await gameService.createGame(gameId, {
            homeScore: 0,
            awayScore: 0,
            period: 1,
            clockTime: 900,
            isRunning: false,
            penalties: {}
          })
        }
        setGameState(existingState)
      } catch (error) {
        console.error('Error initializing game:', error)
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

  // Ad rotation effect
  useEffect(() => {
    adRotationRef.current = setInterval(() => {
      // Rotate top banner ad
      setCurrentTopAd(prev => (prev + 1) % topBannerAds.length)
      
      // Rotate grid ad set (0, 1, 2 for 3 different sets of 6 ads)
      setCurrentGridAdSet(prev => (prev + 1) % 3)
      
      // Rotate footer ad
      setCurrentFooterAd(prev => (prev + 1) % footerAds.length)
    }, 5000) // Rotate every 5 seconds

    return () => {
      if (adRotationRef.current) {
        clearInterval(adRotationRef.current)
      }
    }
  }, [])

  // Timer effect
  useEffect(() => {
    if (gameState.isRunning && gameState.clockTime > 0) {
      timerRef.current = setInterval(() => {
        setGameState(prevState => {
          const newState = { ...prevState }
          
          if (newState.clockTime > 0) {
            newState.clockTime--
          }
          
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
              
              if (updatedPenalties[id].remainingTime <= 0) {
                delete updatedPenalties[id]
              }
            }
          })
          
          if (penaltiesChanged) {
            newState.penalties = updatedPenalties
          }
          
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
      clockTime: 900,
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
    
    setPenaltyInput({ team: 'Home', playerNum: '', minutes: '2', seconds: '0' })
  }

  const handleRemovePenalty = (penaltyId) => {
    if (viewMode !== 'scorekeeper') return
    
    const updatedPenalties = { ...gameState.penalties }
    delete updatedPenalties[penaltyId]
    updateGameState({ penalties: updatedPenalties })
  }

  const TopBannerAd = () => {
    const ad = topBannerAds[currentTopAd]
    return (
      <div style={{
        height: '80px',
        backgroundColor: ad.color,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
        transition: 'all 0.5s ease-in-out',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        {ad.content}
      </div>
    )
  }

  const GridAd = ({ index }) => {
    // Calculate which ad to show based on current set and index
    const adIndex = (currentGridAdSet * 6) + index
    const ad = gridAds[adIndex]
    
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

  const FooterBannerAd = () => {
    const ad = footerAds[currentFooterAd]
    return (
      <div style={{
        height: '80px',
        backgroundColor: ad.color,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
        transition: 'all 0.5s ease-in-out',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        {ad.content}
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
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
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
                cursor: 'pointer',
                fontSize: '14px'
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
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ⚙️ Scorekeeper
            </button>
          </div>
        )}
        
        {urlViewMode === 'spectator' && (
          <div style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: '#10b981',
            color: 'white',
            fontSize: '14px'
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
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>📱</span>
              <div>
                <p style={{ color: 'white', fontWeight: 'bold', margin: 0, fontSize: '14px' }}>Spectator Access</p>
                <p style={{ color: '#d1d5db', fontSize: '12px', margin: 0 }}>Share this URL for spectator view</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <code style={{ 
                fontSize: '10px', 
                backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                color: '#10b981',
                wordBreak: 'break-all'
              }}>
                {spectatorUrl}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner Ad */}
      <TopBannerAd />

      {/* Main Scoreboard */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px',
          alignItems: 'center'
        }}>
          
          {/* Home Team */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '12px', color: '#10b981', margin: 0 }}>HOME</h2>
            <div style={{ fontSize: '64px', marginBottom: '12px', fontWeight: 'bold', lineHeight: 1 }}>{gameState.homeScore}</div>
            {viewMode === 'scorekeeper' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleScoreChange('home', 1)}
                  style={{
                    fontSize: '18px',
                    padding: '8px 16px',
                    borderRadius: '6px',
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
                    fontSize: '18px',
                    padding: '8px 16px',
                    borderRadius: '6px',
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
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '6px', color: '#fbbf24', margin: 0 }}>PERIOD</h3>
              <div style={{ fontSize: '32px', marginBottom: '6px', fontWeight: 'bold', lineHeight: 1 }}>{gameState.period}</div>
              {viewMode === 'scorekeeper' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  <button
                    onClick={() => handlePeriodChange(1)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    +
                  </button>
                  <button
                    onClick={() => handlePeriodChange(-1)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    -
                  </button>
                </div>
              )}
            </div>
            
            <div style={{
              fontSize: '48px',
              marginBottom: '12px',
              fontWeight: 'bold',
              color: gameState.isRunning ? '#10b981' : '#fbbf24',
              lineHeight: 1
            }}>
              {formatTime(gameState.clockTime)}
            </div>
            
            {viewMode === 'scorekeeper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={clockInput.minutes}
                    onChange={(e) => setClockInput(prev => ({ ...prev, minutes: e.target.value }))}
                    style={{
                      width: '50px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '4px',
                      fontSize: '12px'
                    }}
                    min="0"
                    max="99"
                  />
                  <span style={{ color: 'white', fontSize: '16px' }}>:</span>
                  <input
                    type="number"
                    placeholder="Sec"
                    value={clockInput.seconds}
                    onChange={(e) => setClockInput(prev => ({ ...prev, seconds: e.target.value }))}
                    style={{
                      width: '50px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '4px',
                      fontSize: '12px'
                    }}
                    min="0"
                    max="59"
                  />
                  <button 
                    onClick={handleClockSet}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Set
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handlePlayPause}
                    disabled={gameState.clockTime <= 0}
                    style={{
                      fontSize: '12px',
                      padding: '8px 12px',
                      borderRadius: '6px',
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
                      fontSize: '12px',
                      padding: '8px 12px',
                      borderRadius: '6px',
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
            <h2 style={{ fontSize: '20px', marginBottom: '12px', color: '#ef4444', margin: 0 }}>AWAY</h2>
            <div style={{ fontSize: '64px', marginBottom: '12px', fontWeight: 'bold', lineHeight: 1 }}>{gameState.awayScore}</div>
            {viewMode === 'scorekeeper' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleScoreChange('away', 1)}
                  style={{
                    fontSize: '18px',
                    padding: '8px 16px',
                    borderRadius: '6px',
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
                    fontSize: '18px',
                    padding: '8px 16px',
                    borderRadius: '6px',
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
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>⚠️ Penalties</h3>
          
          {viewMode === 'scorekeeper' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={penaltyInput.team}
                onChange={(e) => setPenaltyInput(prev => ({ ...prev, team: e.target.value }))}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '4px',
                  padding: '4px',
                  fontSize: '12px'
                }}
              >
                <option value="Home">Home</option>
                <option value="Away">Away</option>
              </select>
              
              <input
                type="number"
                placeholder="#"
                value={penaltyInput.playerNum}
                onChange={(e) => setPenaltyInput(prev => ({ ...prev, playerNum: e.target.value }))}
                style={{
                  width: '40px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '4px',
                  padding: '4px',
                  fontSize: '12px'
                }}
              />
              
              <input
                type="number"
                placeholder="Min"
                value={penaltyInput.minutes}
                onChange={(e) => setPenaltyInput(prev => ({ ...prev, minutes: e.target.value }))}
                style={{
                  width: '40px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '4px',
                  padding: '4px',
                  fontSize: '12px'
                }}
                min="0"
              />
              
              <input
                type="number"
                placeholder="Sec"
                value={penaltyInput.seconds}
                onChange={(e) => setPenaltyInput(prev => ({ ...prev, seconds: e.target.value }))}
                style={{
                  width: '40px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '4px',
                  padding: '4px',
                  fontSize: '12px'
                }}
                min="0"
                max="59"
              />
              
              <button 
                onClick={handleAddPenalty}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>

        {Object.keys(gameState.penalties).length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', margin: 0, fontSize: '14px' }}>No active penalties</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.values(gameState.penalties).map((penalty) => (
              <div key={penalty.id} style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '8px 12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                fontSize: '14px'
              }}>
                <span style={{ 
                  backgroundColor: penalty.team === 'Home' ? '#10b981' : '#ef4444', 
                  color: 'white', 
                  padding: '2px 6px', 
                  borderRadius: '3px', 
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {penalty.team}
                </span>
                <span style={{ fontWeight: 'bold' }}>#{penalty.playerNum}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {formatTime(penalty.remainingTime)}
                </span>
                {viewMode === 'scorekeeper' && (
                  <button
                    onClick={() => handleRemovePenalty(penalty.id)}
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Responsive Ad Grid - 6 ads total */}
      <div className="ad-grid">
        {Array(6).fill(0).map((_, index) => (
          <GridAd key={index} index={index} />
        ))}
      </div>

      {/* Footer Banner Ad */}
      <FooterBannerAd />

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <p style={{ fontSize: '14px', margin: 0 }}>
          Powered by ClockSynk • Creating Positive Experiences for Young Athletes
        </p>
        <p style={{ fontSize: '12px', marginTop: '4px', margin: 0 }}>
          Current Mode: {viewMode === 'scorekeeper' ? 'Scorekeeper' : 'Spectator View'}
          {viewMode === 'scorekeeper' && (
            <span style={{ marginLeft: '8px' }}>
              Game ID: <code style={{ fontSize: '10px', backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 4px', borderRadius: '2px' }}>{gameId}</code>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default App

