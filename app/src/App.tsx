import './App.css'
import { AuthBoundary } from './app/AuthBoundary'
import { AuthenticatedApp } from './app/AuthenticatedApp'

function App() {
  return <AuthBoundary>{(auth) => <AuthenticatedApp {...auth} />}</AuthBoundary>
}

export default App
