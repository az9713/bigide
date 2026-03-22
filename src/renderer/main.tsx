import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Debug: log uncaught errors (suppress benign ResizeObserver noise)
window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) {
    e.stopImmediatePropagation()
    return
  }
  console.error('Uncaught error:', e.error)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
})

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} else {
  console.error('No #root element found — check index.html')
}
