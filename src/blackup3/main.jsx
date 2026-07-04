import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- บรรทัดนี้สำคัญมาก! ห้ามลบ

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)