import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

import { AuthProvider, useAuth } from './context/AuthContext'
import AuthForm from './components/AuthForm'
import NfcScannerPage from './components/nfc/NfcScannerPage'
import NfcTagsPage from './components/nfc/NfcTagsPage'
import ProfilePage from './components/profile/ProfilePage'
import UpdatePasswordPage from './components/auth/UpdatePasswordPage'
import AppLayout from './layouts/AppLayout'
import { setupLiveUpdates } from './liveUpdate'

import './index.css'

const baseUrl = import.meta.env.DEV
  ? 'http://localhost:5173'
  : import.meta.env.VITE_APP_SHARE_URL ?? window.location.origin

const basename = Capacitor.isNativePlatform()
  ? '/'
  : import.meta.env.DEV
    ? '/'
    : '/ArnTags-Site'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${baseUrl}/sw.js`, {
        scope: `${baseUrl}/`,
      })
      .then((registration) => {
        console.info('Service worker enregistré :', registration.scope)
      })
      .catch((error: unknown) => {
        console.error('Erreur service worker :', error)
      })
  })
}

export const branch = import.meta.env.VITE_BRANCH_NAME ?? 'production'

export const color =
  branch === 'dev'
    ? 'from-pink-500 to-purple-700'
    : branch === 'beta'
      ? 'from-orange-500 to-fuchsia-700'
      : 'from-indigo-500 to-purple-700'

type GuardProps = {
  children: React.ReactElement
}

function LoadingScreen() {
  return <div className="app-loading">Chargement d’arntags…</div>
}

type RouteChildrenProps = {
  children: React.ReactElement
}

function AuthRoute({ children }: GuardProps) {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />
  return session ? <Navigate to="/tags" replace /> : children
}

function ProtectedRoute({ children }: RouteChildrenProps) {
  const { session, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return session ? children : <Navigate to="/login" replace />
}

function AppContent() {
  const liveUpdateStartedRef = useRef(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || liveUpdateStartedRef.current) {
      return
    }

    liveUpdateStartedRef.current = true
    void setupLiveUpdates()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><AuthForm /></AuthRoute>} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/tags" element={<NfcTagsPage />} />
        <Route path="/scanner" element={<NfcScannerPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="/" element={<Navigate to="/tags" replace />} />
      <Route path="*" element={<Navigate to="/tags" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <BrowserRouter basename={basename}>
      <AppContent />
    </BrowserRouter>
  </AuthProvider>,
)
