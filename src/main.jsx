import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap-utilities.min.css'
import './index.css'
import './styles/academic.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="min-vh-100">
      <App />
    </div>
  </StrictMode>,
)
