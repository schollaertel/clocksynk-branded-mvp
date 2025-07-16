import { useState } from 'react'
import clocksynkLogo from './assets/clocksynk-logo.png'
import './App.css'

function App() {
  const [gameState, setGameState] = useState({
    homeScore: 0,
    awayScore: 0,
    period: 1,
    clockTime: 900, // 15 minutes in seconds
    isRunning: false
  })

  const formatTime = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  const handleScoreChange = (team, delta) => {
    const scoreKey = team === 'home' ? 'homeScore' : 'awayScore'
    const newScore = Math.max(0, gameState[scoreKey] + delta)
    setGameState(prev => ({ ...prev, [scoreKey]: newScore }))
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
      </div>

      {/* Top Ad */}
      <AdPlaceholder position="Top Banner" size="medium" />

      {/* Main Scoreboard */}
      <div className="clocksynk-scoreboard mb-6 rounded-lg p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          
          {/* Home Team */}
          <div className="text-center">
            <h2 className="clocksynk-team-label text-2xl mb-4">HOME</h2>
            <div className="clocksynk-score text-8xl mb-4">{gameState.homeScore}</div>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleScoreChange('home', 1)}
                className="clocksynk-btn-primary text-xl px-6 py-3 rounded"
              >
                +
              </button>
              <button
                onClick={() => handleScoreChange('home', -1)}
                className="clocksynk-btn-secondary text-xl px-6 py-3 rounded"
              >
                -
              </button>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center">
            <div className="mb-6">
              <h3 className="clocksynk-period text-lg mb-2">PERIOD</h3>
              <div className="clocksynk-period text-4xl mb-2">{gameState.period}</div>
            </div>
            
            <div className={`clocksynk-clock text-7xl mb-4 ${gameState.isRunning ? 'clocksynk-running' : ''}`}>
              {formatTime(gameState.clockTime)}
            </div>
          </div>

          {/* Away Team */}
          <div className="text-center">
            <h2 className="clocksynk-team-label text-2xl mb-4">AWAY</h2>
            <div className="clocksynk-score text-8xl mb-4">{gameState.awayScore}</div>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleScoreChange('away', 1)}
                className="clocksynk-btn-primary text-xl px-6 py-3 rounded"
              >
                +
              </button>
              <button
                onClick={() => handleScoreChange('away', -1)}
                className="clocksynk-btn-secondary text-xl px-6 py-3 rounded"
              >
                -
              </button>
            </div>
          </div>
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
          MVP Version - Scorekeeper Mode
        </p>
      </div>
    </div>
  )
}

export default App

