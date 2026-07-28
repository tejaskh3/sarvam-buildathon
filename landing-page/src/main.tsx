import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, restoreRoute } from './components/Auth'

/* Before the first render, so a family coming back from Google's OAuth hop
   lands on the dashboard they were signing in to reach rather than flashing
   the marketing page. See restoreRoute() for why the fragment can go missing. */
restoreRoute()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
