import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WayangExperience } from './components/WayangExperience'
import './styles/wayang.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WayangExperience />
  </StrictMode>,
)
