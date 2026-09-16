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
import React from 'react'

const basename = Capacitor.isNativePlatform()
  ? '/'
  : import.meta.env.DEV
    ? '/'
    : '/ArnTags-Site'


export const branch = import.meta.env.VITE_BRANCH_NAME ?? 'default'

export const color =
  branch === 'dev'
    ? 'from-pink-500 to-purple-700'
    : branch === 'beta'
      ? 'from-orange-500 to-fuchsia-700'
      : 'from-indigo-500 to-purple-700'

function LoadingScreen() {
  return <div className="app-loading">Chargement d’arntags…</div>
}

function AuthRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />
  return session ? <Navigate to="/tags" replace /> : children
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  return loading ? <LoadingScreen /> : session ? children : <Navigate to="/login" replace />;
}

function AppContent() {
  const liveUpdateStartedRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (liveUpdateStartedRef.current) return;
    liveUpdateStartedRef.current = true;

    setupLiveUpdates();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={
        <AuthRoute>
          <AuthForm />
        </AuthRoute>
      } />
      <Route path="/update-password" element={<UpdatePasswordPage />} />

      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/tags" element={
          <ProtectedRoute>
            <NfcTagsPage />
          </ProtectedRoute>
        } />
        <Route path="/scanner" element={
          <ProtectedRoute>
            <NfcScannerPage /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="/" element={<Navigate to="/tags" replace />} />
      <Route path="*" element={<Navigate to="/tags" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)
