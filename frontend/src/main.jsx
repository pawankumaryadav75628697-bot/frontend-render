import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Reduce console noise in development
if (import.meta.env.DEV) {
  // Only show essential logs in development
  const originalWarn = console.warn;
  console.warn = function(...args) {
    const message = args[0];
    if (typeof message === 'string') {
      // Suppress specific React DevTools messages
      if (message.includes('Download the React DevTools')) return;
      if (message.includes('react-devtools')) return;
    }
    originalWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
