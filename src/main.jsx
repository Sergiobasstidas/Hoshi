import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './alturaNavegacion.js'
import { installParsecDepthPrecision } from './scene/depthPrecision.js'

installParsecDepthPrecision()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
