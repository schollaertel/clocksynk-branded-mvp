import { useState, useEffect, useRef } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Play, Pause, RotateCcw, Users, Eye, Settings, QrCode } from 'lucide-react'
import clocksynkLogo from './assets/clocksynk-logo.png'
import { getGameService } from './lib/supabase'
import './App.css'

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
    clockTime: 0, // seconds
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
    const scoreKey = team === 'home' ? 'homeScore' : 'awayScore'
    const newScore = Math.max(0, gameState[scoreKey] + delta)
    updateGameState({ [scoreKey]: newScore })
  }

  const handlePeriodChange = (delta) => {
    const newPeriod = Math.max(1, gameState.period + delta)
    updateGameState({ period: newPeriod })
  }

  const handleClockSet = () => {
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
    if (gameState.clockTime > 0) {
      updateGameState({ isRunning: !gameState.isRunning })
    }
  }

  const handleReset = () => {
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
    const sizeClasses = {
      small: "h-16 text-sm",
      medium: "h-24 text-base",
      large: "h-32 text-lg"
    }
    
    return (
      <div className={`clocksynk-ad-placeholder rounded-lg flex items-center justify-center ${sizeClasses[size]} mb-4`}>
        <div className="text-center">
          <div className="font-semibold">Advertisement</div>
          <div className="text-xs opacity-75">{position}</div>
        </div>
      </div>
    )
  }

  const spectatorUrl = `${window.location.origin}?view=spectator&game=${gameId}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={clocksynkLogo} 
            alt="ClockSynk" 
            className="h-12 w-auto clocksynk-logo-glow"
          />
          <div>
            <h1 className="text-2xl font-bold text-white">ClockSynk</h1>
            <p className="text-sm text-gray-300">Creating Positive Experiences for Young Athletes</p>
          </div>
        </div>
        
        {/* Only show view mode buttons if not in URL spectator mode */}
        {!urlViewMode && (
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'spectator' ? 'default' : 'outline'}
              onClick={() => setViewMode('spectator')}
              className="clocksynk-btn-primary"
            >
              <Eye className="w-4 h-4 mr-2" />
              Spectator
            </Button>
            <Button
              variant={viewMode === 'scorekeeper' ? 'default' : 'outline'}
              onClick={() => setViewMode('scorekeeper')}
              className="clocksynk-btn-secondary"
            >
              <Settings className="w-4 h-4 mr-2" />
              Scorekeeper
            </Button>
          </div>
        )}
        
        {/* Show spectator badge if in URL spectator mode */}
        {urlViewMode === 'spectator' && (
          <Badge className="bg-green-600 text-white">
            <Eye className="w-4 h-4 mr-2" />
            Spectator View
          </Badge>
        )}
      </div>

      {/* QR Code Section for Spectators */}
      {viewMode === 'scorekeeper' && (
        <Card className="mb-6 bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <QrCode className="w-6 h-6 text-white" />
                <div>
                  <p className="text-white font-semibold">Spectator Access</p>
                  <p className="text-gray-300 text-sm">Share this URL for spectator view:</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-1">Spectator URL:</p>
                <code className="text-xs bg-black/30 px-2 py-1 rounded text-green-400">
                  {spectatorUrl}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Ad */}
      <AdPlaceholder position="Top Banner" size="medium" />

      {/* Main Scoreboard */}
      <Card className="clocksynk-scoreboard mb-6">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            
            {/* Home Team */}
            <div className="text-center">
              <h2 className="clocksynk-team-label text-2xl mb-4">HOME</h2>
              <div className="clocksynk-score text-8xl mb-4">{gameState.homeScore}</div>
              {viewMode === 'scorekeeper' && (
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={() => handleScoreChange('home', 1)}
                    className="clocksynk-btn-primary text-xl px-6 py-3"
                  >
                    +
                  </Button>
                  <Button
                    onClick={() => handleScoreChange('home', -1)}
                    className="clocksynk-btn-secondary text-xl px-6 py-3"
                  >
                    -
                  </Button>
                </div>
              )}
            </div>

            {/* Game Info */}
            <div className="text-center">
              <div className="mb-6">
                <h3 className="clocksynk-period text-lg mb-2">PERIOD</h3>
                <div className="clocksynk-period text-4xl mb-2">{gameState.period}</div>
                {viewMode === 'scorekeeper' && (
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={() => handlePeriodChange(1)}
                      className="clocksynk-btn-primary"
                    >
                      +
                    </Button>
                    <Button
                      onClick={() => handlePeriodChange(-1)}
                      className="clocksynk-btn-secondary"
                    >
                      -
                    </Button>
                  </div>
                )}
              </div>
              
              <div className={`clocksynk-clock text-7xl mb-4 ${gameState.isRunning ? 'clocksynk-running' : ''}`}>
                {formatTime(gameState.clockTime)}
              </div>
              
              {viewMode === 'scorekeeper' && (
                <div className="space-y-4">
                  <div className="flex justify-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={clockInput.minutes}
                      onChange={(e) => setClockInput(prev => ({ ...prev, minutes: e.target.value }))}
                      className="w-20 text-center bg-white/10 border-white/20 text-white"
                      min="0"
                      max="99"
                    />
                    <span className="text-white text-xl">:</span>
                    <Input
                      type="number"
                      placeholder="Sec"
                      value={clockInput.seconds}
                      onChange={(e) => setClockInput(prev => ({ ...prev, seconds: e.target.value }))}
                      className="w-20 text-center bg-white/10 border-white/20 text-white"
                      min="0"
                      max="59"
                    />
                    <Button onClick={handleClockSet} className="clocksynk-btn-primary">
                      Set
                    </Button>
                  </div>
                  
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={handlePlayPause}
                      className="clocksynk-btn-primary text-lg px-8 py-3"
                      disabled={gameState.clockTime <= 0}
                    >
                      {gameState.isRunning ? (
                        <>
                          <Pause className="w-5 h-5 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Play
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={handleReset}
                      className="clocksynk-btn-secondary text-lg px-6 py-3"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center">
              <h2 className="clocksynk-team-label text-2xl mb-4">AWAY</h2>
              <div className="clocksynk-score text-8xl mb-4">{gameState.awayScore}</div>
              {viewMode === 'scorekeeper' && (
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={() => handleScoreChange('away', 1)}
                    className="clocksynk-btn-primary text-xl px-6 py-3"
                  >
                    +
                  </Button>
                  <Button
                    onClick={() => handleScoreChange('away', -1)}
                    className="clocksynk-btn-secondary text-xl px-6 py-3"
                  >
                    -
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Sidebar Ad */}
        <div className="lg:col-span-1">
          <AdPlaceholder position="Left Sidebar" size="large" />
        </div>

        {/* Penalties Section */}
        <div className="lg:col-span-1">
          {viewMode === 'scorekeeper' && (
            <Card className="mb-6 bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Add Penalty
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={penaltyInput.team} onValueChange={(value) => setPenaltyInput(prev => ({ ...prev, team: value }))}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Away">Away</SelectItem>
                  </SelectContent>
                </Select>
                
                <Input
                  type="number"
                  placeholder="Player #"
                  value={penaltyInput.playerNum}
                  onChange={(e) => setPenaltyInput(prev => ({ ...prev, playerNum: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
                
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={penaltyInput.minutes}
                    onChange={(e) => setPenaltyInput(prev => ({ ...prev, minutes: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                    min="0"
                  />
                  <Input
                    type="number"
                    placeholder="Sec"
                    value={penaltyInput.seconds}
                    onChange={(e) => setPenaltyInput(prev => ({ ...prev, seconds: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                    min="0"
                    max="59"
                  />
                </div>
                
                <Button onClick={handleAddPenalty} className="w-full clocksynk-btn-primary">
                  Add Penalty
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Active Penalties */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Active Penalties</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(gameState.penalties).length === 0 ? (
                <p className="text-gray-400 text-center py-4">No active penalties</p>
              ) : (
                <div className="space-y-2">
                  {Object.values(gameState.penalties).map((penalty) => (
                    <div key={penalty.id} className="clocksynk-penalty-item p-3 rounded-lg flex justify-between items-center">
                      <div className="flex gap-4">
                        <Badge variant="outline" className="border-orange-600 text-orange-800">
                          {penalty.team}
                        </Badge>
                        <span className="font-semibold">#{penalty.playerNum}</span>
                      </div>
                      <span className="font-mono text-lg font-bold">
                        {formatTime(penalty.remainingTime)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar Ad */}
        <div className="lg:col-span-1">
          <AdPlaceholder position="Right Sidebar" size="large" />
        </div>
      </div>

      {/* Bottom Ad */}
      <div className="mt-6">
        <AdPlaceholder position="Bottom Banner" size="medium" />
      </div>

      {/* Footer */}
      <div className="text-center mt-8 text-gray-400">
        <p className="text-sm">
          Powered by ClockSynk • Creating Positive Experiences for Young Athletes
        </p>
        <p className="text-xs mt-1">
          Current Mode: <Badge variant="outline" className="ml-1">
            {viewMode === 'scorekeeper' ? 'Scorekeeper' : 'Spectator View'}
          </Badge>
          {viewMode === 'scorekeeper' && (
            <span className="ml-2">
              Game ID: <code className="text-xs bg-black/30 px-1 rounded">{gameId}</code>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export default App

