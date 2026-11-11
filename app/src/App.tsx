import { ArchiveUpgradeProvider } from './features/archive/ArchiveUpgradeProvider'
import './App.css'
import { AuthBoundary } from './app/AuthBoundary'
import { AuthenticatedApp } from './app/AuthenticatedApp'

function App() {
  return (
    <ArchiveUpgradeProvider>
      <AuthBoundary>{(auth) => <AuthenticatedApp {...auth} />}</AuthBoundary>
    </ArchiveUpgradeProvider>
  )
}

export default App
