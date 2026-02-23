import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { migrateLocalStorageIds } from './lib/migrateIds'

// Migrate old IDs to UUIDs (one-time migration)
const needsRefresh = migrateLocalStorageIds();
if (needsRefresh) {
  // Force refresh to reload stores with migrated data
  window.location.reload();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
