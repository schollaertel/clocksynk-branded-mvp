import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGameService } from './lib/supabase'
// import './responsive-ads.css'

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

  // Local UI state
  const [loading, setLoading] = useState(true)
  const [penaltyTeam, setPenaltyTeam] = useState('Home')
  const [penaltyPlayer, setPenaltyPlayer] = useState('')
  const [penaltyMinutes, setPenaltyMinutes] = useState('')
  const [penaltySeconds, setPenaltySeconds] = useState('')

  // Refs for timer management
  const timerIntervalRef = useRef(null)
  const gameService = useMemo(() => getGameService(), [])
  const gameId = urlGameId || 'demo-game-1'

  // Audio functions for alerts
  const playBeep = useCallback((frequency = 800, duration = 200) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration / 1000)
    } catch (error) {
      console.log('Audio not supported:', error)
    }
  }, [])

  const playOneMinuteWarning = useCallback(() => {
    // Play two beeps for 1-minute warning
    playBeep(1000, 300)
    setTimeout(() => playBeep(1000, 300), 400)
  }, [playBeep])

  const playEndGameSound = useCallback(() => {
    // Play three ascending beeps for end of game
    playBeep(800, 400)
    setTimeout(() => playBeep(1000, 400), 500)
    setTimeout(() => playBeep(1200, 600), 1000)
  }, [playBeep])

  const vibratePhone = useCallback(() => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]) // Vibrate pattern: 200ms on, 100ms off, 200ms on
      }
    } catch (error) {
      console.log('Vibration not supported:', error)
    }
  }, [])

  // Load initial game state
  useEffect(() => {
    const loadGameState = async () => {
      try {
        const state = await gameService.getGameState(gameId)
        if (state) {
          setGameState(state)
        }
      } catch (error) {
        console.error('Error loading game state:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGameState()
  }, [gameService, gameId])

  // Timer effect
  useEffect(() => {
    if (gameState.isRunning && viewMode === 'scorekeeper') {
      timerIntervalRef.current = setInterval(() => {
        setGameState(prevState => {
          // Don't update if timer is not running anymore
          if (!prevState.isRunning) {
            return prevState
          }

          const newTime = Math.max(0, prevState.clockTime - 1)
          const newState = {
            ...prevState,
            clockTime: newTime,
            lastUpdated: Date.now()
          }

          // Check for 1-minute remaining alert
          if (newTime === 60 && prevState.clockTime > 60) {
            playOneMinuteWarning()
          }

          // Check for end of game
          if (newTime === 0 && prevState.clockTime > 0) {
            playEndGameSound()
            newState.isRunning = false
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
              // Vibrate phone when penalty is released
              vibratePhone()
            } else if (penalty.remainingTime !== newPenaltyTime) {
              updatedPenalties[id] = { ...penalty, remainingTime: newPenaltyTime }
              penaltiesChanged = true
            }
          })

          if (penaltiesChanged) {
            newState.penalties = updatedPenalties
          }

          // Update server with new state (async, don't wait)
          gameService.updateGameState(gameId, newState).catch(error => {
            console.error('Error updating server state:', error)
          })

          return newState
        })
      }, 1000)
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [gameState.isRunning, viewMode, gameId, gameService, playOneMinuteWarning, playEndGameSound, vibratePhone])

  // Real-time sync effect for spectators
  useEffect(() => {
    if (viewMode === 'spectator') {
      const syncInterval = setInterval(async () => {
        try {
          const serverState = await gameService.getGameState(gameId)
          if (serverState && serverState.lastUpdated > gameState.lastUpdated) {
            setGameState(serverState)
          }
        } catch (error) {
          console.error('Error syncing game state:', error)
        }
      }, 2000) // Sync every 2 seconds

      return () => clearInterval(syncInterval)
    }
  }, [viewMode, gameId, gameService, gameState.lastUpdated])

  // Helper functions
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const updateGameState = useCallback(async (updates) => {
    if (viewMode !== 'scorekeeper') return
    
    const newState = { ...gameState, ...updates, lastUpdated: Date.now() }
    setGameState(newState)
    
    try {
      await gameService.updateGameState(gameId, newState)
    } catch (error) {
      console.error('Error updating game state:', error)
    }
  }, [gameState, gameService, gameId, viewMode])

  const toggleTimer = useCallback(() => {
    updateGameState({ isRunning: !gameState.isRunning })
  }, [gameState.isRunning, updateGameState])

  const resetTimer = useCallback(() => {
    updateGameState({ 
      clockTime: 15 * 60, 
      isRunning: false,
      homeScore: 0,
      awayScore: 0,
      period: 1,
      penalties: {}
    })
  }, [updateGameState])

  const adjustScore = useCallback((team, delta) => {
    const scoreKey = team === 'home' ? 'homeScore' : 'awayScore'
    const newScore = Math.max(0, gameState[scoreKey] + delta)
    updateGameState({ [scoreKey]: newScore })
  }, [gameState, updateGameState])

  const adjustPeriod = useCallback((delta) => {
    const newPeriod = Math.max(1, Math.min(4, gameState.period + delta))
    updateGameState({ period: newPeriod })
  }, [gameState.period, updateGameState])

  const setCustomTime = useCallback(() => {
    const minutes = parseInt(document.querySelector('input[placeholder="Min"]').value) || 0
    const seconds = parseInt(document.querySelector('input[placeholder="Sec"]').value) || 0
    const totalSeconds = minutes * 60 + seconds
    updateGameState({ clockTime: Math.max(0, totalSeconds) })
  }, [updateGameState])

  const addPenalty = useCallback(() => {
    if (!penaltyPlayer || (!penaltyMinutes && !penaltySeconds)) return
    
    const totalSeconds = (parseInt(penaltyMinutes) || 0) * 60 + (parseInt(penaltySeconds) || 0)
    if (totalSeconds <= 0) return

    const penaltyId = `${penaltyTeam}-${penaltyPlayer}-${Date.now()}`
    const newPenalty = {
      id: penaltyId,
      team: penaltyTeam,
      player: penaltyPlayer,
      remainingTime: totalSeconds,
      originalTime: totalSeconds
    }

    const updatedPenalties = { ...gameState.penalties, [penaltyId]: newPenalty }
    updateGameState({ penalties: updatedPenalties })
    
    // Clear form
    setPenaltyPlayer('')
    setPenaltyMinutes('')
    setPenaltySeconds('')
  }, [penaltyTeam, penaltyPlayer, penaltyMinutes, penaltySeconds, gameState.penalties, updateGameState])

  const removePenalty = useCallback((penaltyId) => {
    const updatedPenalties = { ...gameState.penalties }
    delete updatedPenalties[penaltyId]
    updateGameState({ penalties: updatedPenalties })
  }, [gameState.penalties, updateGameState])

  // Ad rotation data
  const bannerAds = [
    { id: 1, title: "Elite Lacrosse Equipment", subtitle: "20% Off", color: "#10B981" },
    { id: 2, title: "Sports Performance Training", subtitle: "Free Trial", color: "#3B82F6" },
    { id: 3, title: "Team Uniforms & Gear", subtitle: "Bulk Discounts", color: "#8B5CF6" }
  ]

  const footerAds = [
    { id: 1, title: "Local Sports Store", subtitle: "Equipment & Gear", color: "#10B981" },
    { id: 2, title: "Youth Sports League", subtitle: "Register Now", color: "#F59E0B" },
    { id: 3, title: "Sports Medicine Clinic", subtitle: "Injury Prevention", color: "#EF4444" }
  ]

  const gridAds = [
    { id: 1, title: "Fitness Center", subtitle: "Strength Training", color: "#DC2626" },
    { id: 2, title: "Sports Drinks", subtitle: "Stay Hydrated", color: "#10B981" },
    { id: 3, title: "Team Banners", subtitle: "Custom Design", color: "#2563EB" },
    { id: 4, title: "Lacrosse Camps", subtitle: "Summer Programs", color: "#F59E0B" },
    { id: 5, title: "Sports Medicine", subtitle: "Injury Care", color: "#7C3AED" },
    { id: 6, title: "Equipment Store", subtitle: "Gear & Apparel", color: "#EC4899" }
  ]

  // Ad rotation state
  const [currentTopAd, setCurrentTopAd] = useState(0)
  const [currentFooterAd, setCurrentFooterAd] = useState(0)
  const [currentGridSet, setCurrentGridSet] = useState(0)

  // Ad rotation effects
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTopAd(prev => (prev + 1) % bannerAds.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [bannerAds.length])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFooterAd(prev => (prev + 1) % footerAds.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [footerAds.length])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentGridSet(prev => (prev + 1) % Math.ceil(gridAds.length / 6))
    }, 10000)
    return () => clearInterval(interval)
  }, [gridAds.length])

  // Get current ads to display
  const currentBannerAd = bannerAds[currentTopAd] || bannerAds[0]
  const currentFooterBannerAd = footerAds[currentFooterAd] || footerAds[0]
  const currentGridAds = gridAds.slice(currentGridSet * 6, (currentGridSet + 1) * 6)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading ClockSynk...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center font-bold text-black">
            CS
          </div>
          <div>
            <h1 className="text-xl font-bold">ClockSynk</h1>
            <p className="text-sm text-gray-400">Youth Sports Scoreboard</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center">
            👁️ Spectator
          </button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center">
            ⚙️ Scorekeeper
          </button>
        </div>
      </header>

      {/* Spectator Access Info */}
      {viewMode === 'scorekeeper' && (
        <div className="bg-gray-800 p-3 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm">📱 Spectator Access</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Share this URL for spectator view:
          </div>
          <div className="text-xs text-blue-400 mt-1 break-all">
            {window.location.origin}{window.location.pathname}?view=spectator&game={gameId}
          </div>
        </div>
      )}

      {/* Top Banner Ad */}
      <div 
        className="p-4 text-center text-white transition-colors duration-500"
        style={{ backgroundColor: currentBannerAd.color }}
      >
        <div className="font-bold text-lg">{currentBannerAd.title}</div>
        <div className="text-sm opacity-90">{currentBannerAd.subtitle}</div>
      </div>

      {/* Main Scoreboard */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-3 gap-8 items-center">
          {/* Home Team */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">HOME</h2>
            <div className="text-6xl font-bold mb-4">{gameState.homeScore}</div>
            {viewMode === 'scorekeeper' && (
              <div className="flex justify-center space-x-2">
                <button 
                  onClick={() => adjustScore('home', 1)}
                  className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold"
                >
                  +
                </button>
                <button 
                  onClick={() => adjustScore('home', -1)}
                  className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold"
                >
                  -
                </button>
              </div>
            )}
          </div>

          {/* Center - Timer and Period */}
          <div className="text-center">
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-1">PERIOD</div>
              <div className="flex items-center justify-center space-x-2">
                {viewMode === 'scorekeeper' && (
                  <button 
                    onClick={() => adjustPeriod(-1)}
                    className="w-8 h-8 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                  >
                    -
                  </button>
                )}
                <div className="text-3xl font-bold">{gameState.period}</div>
                {viewMode === 'scorekeeper' && (
                  <button 
                    onClick={() => adjustPeriod(1)}
                    className="w-8 h-8 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
            
            <div className="text-6xl font-bold mb-4 font-mono">
              {formatTime(gameState.clockTime)}
            </div>

            {viewMode === 'scorekeeper' && (
              <div className="space-y-3">
                <div className="flex justify-center space-x-2">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    className="w-16 px-2 py-1 bg-gray-700 rounded text-center text-sm"
                    min="0"
                  />
                  <input 
                    type="number" 
                    placeholder="Sec" 
                    className="w-16 px-2 py-1 bg-gray-700 rounded text-center text-sm"
                    min="0"
                    max="59"
                  />
                  <button 
                    onClick={setCustomTime}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    Set
                  </button>
                </div>
                
                <div className="flex justify-center space-x-2">
                  <button 
                    onClick={toggleTimer}
                    className={`px-6 py-2 rounded font-bold ${
                      gameState.isRunning 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {gameState.isRunning ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  <button 
                    onClick={resetTimer}
                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold"
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">AWAY</h2>
            <div className="text-6xl font-bold mb-4">{gameState.awayScore}</div>
            {viewMode === 'scorekeeper' && (
              <div className="flex justify-center space-x-2">
                <button 
                  onClick={() => adjustScore('away', 1)}
                  className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold"
                >
                  +
                </button>
                <button 
                  onClick={() => adjustScore('away', -1)}
                  className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold"
                >
                  -
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Penalties Section */}
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            ⚠️ Penalties
          </h3>
          
          {Object.keys(gameState.penalties).length === 0 ? (
            <p className="text-gray-400 text-center py-4">No active penalties</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {Object.values(gameState.penalties).map((penalty) => (
                <div key={penalty.id} className="bg-gray-800 p-3 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">{penalty.team} #{penalty.player}</div>
                      <div className="text-sm text-gray-400">
                        {formatTime(penalty.remainingTime)} remaining
                      </div>
                    </div>
                    {viewMode === 'scorekeeper' && (
                      <button 
                        onClick={() => removePenalty(penalty.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'scorekeeper' && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Team</label>
                  <select 
                    value={penaltyTeam}
                    onChange={(e) => setPenaltyTeam(e.target.value)}
                    className="px-3 py-2 bg-gray-700 rounded"
                  >
                    <option value="Home">Home</option>
                    <option value="Away">Away</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Player #</label>
                  <input 
                    type="text" 
                    placeholder="#"
                    value={penaltyPlayer}
                    onChange={(e) => setPenaltyPlayer(e.target.value)}
                    className="w-16 px-2 py-2 bg-gray-700 rounded text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Minutes</label>
                  <input 
                    type="number" 
                    placeholder="Min"
                    value={penaltyMinutes}
                    onChange={(e) => setPenaltyMinutes(e.target.value)}
                    className="w-16 px-2 py-2 bg-gray-700 rounded text-center"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Seconds</label>
                  <input 
                    type="number" 
                    placeholder="Sec"
                    value={penaltySeconds}
                    onChange={(e) => setPenaltySeconds(e.target.value)}
                    className="w-16 px-2 py-2 bg-gray-700 rounded text-center"
                    min="0"
                    max="59"
                  />
                </div>
                <button 
                  onClick={addPenalty}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Ads */}
      <div className="px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
            {currentGridAds.map((ad) => (
              <div 
                key={ad.id}
                className="p-4 rounded-lg text-center transition-colors duration-500"
                style={{ backgroundColor: ad.color }}
              >
                <div className="font-bold text-lg">{ad.title}</div>
                <div className="text-sm opacity-90">{ad.subtitle}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Banner Ad */}
      <div 
        className="p-4 text-center text-white transition-colors duration-500"
        style={{ backgroundColor: currentFooterBannerAd.color }}
      >
        <div className="font-bold text-lg">{currentFooterBannerAd.title}</div>
        <div className="text-sm opacity-90">{currentFooterBannerAd.subtitle}</div>
      </div>
    </div>
  )
}

export default App

