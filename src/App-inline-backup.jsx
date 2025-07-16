import { useState } from 'react'

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
      </div>

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
          </div>

          {/* Game Info */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '8px', color: '#fbbf24' }}>PERIOD</h3>
              <div style={{ fontSize: '48px', marginBottom: '8px', fontWeight: 'bold' }}>{gameState.period}</div>
            </div>
            
            <div style={{
              fontSize: '72px',
              marginBottom: '16px',
              fontWeight: 'bold',
              color: gameState.isRunning ? '#10b981' : '#fbbf24'
            }}>
              {formatTime(gameState.clockTime)}
            </div>
          </div>

          {/* Away Team */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#ef4444' }}>AWAY</h2>
            <div style={{ fontSize: '96px', marginBottom: '16px', fontWeight: 'bold' }}>{gameState.awayScore}</div>
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
          </div>
        </div>
      </div>

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
          MVP Version - Scorekeeper Mode
        </p>
      </div>
    </div>
  )
}

export default App

