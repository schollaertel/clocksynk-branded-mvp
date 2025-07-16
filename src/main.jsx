import React from 'react'
import { createRoot } from 'react-dom/client'

// 1) Tailwind utilities
import './index.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


