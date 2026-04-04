import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SharePage } from './components/SharePage'
import './index.css'

// Route /share/:filename to the public share player
const path = window.location.pathname
const shareMatch = path.match(/^\/share\/(.+)$/)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {shareMatch
      ? <SharePage filename={decodeURIComponent(shareMatch[1])} />
      : <App />
    }
  </React.StrictMode>
)
