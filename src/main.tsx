import React, { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthForm from './components/AuthForm';
import NfcTagsPage from './components/nfc/NfcTagsPage'
import './index.css';
import { setupLiveUpdates } from './liveUpdate';

import { Capacitor } from '@capacitor/core';
import NfcScannerPage from './components/nfc/NfcScannerPage'
import AppLayout from './layouts/AppLayout'
import ProfilePage from './components/profile/ProfilePage'
import UpdatePasswordPage from './components/auth/UpdatePasswordPage'

const baseurl = import.meta.env.DEV ? 'http://localhost:5173' : import.meta.env.VITE_APP_SHARE_URL
const basename = Capacitor.isNativePlatform() ? '/' : import.meta.env.DEV ? '/' : '/ArnTags'

export const branch = import.meta.env.VITE_BRANCH_NAME ?? 'default'

export const color =
  branch === 'dev'
    ? 'from-pink-500 to-purple-700'
    : branch === 'beta'
      ? 'from-orange-500 to-fuchsia-700'
      : 'from-indigo-500 to-purple-700';

type GuardProps = {
  children: ReactElement
}

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

class AppErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('[ArnTags] Erreur de rendu :', error)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="app-fatal-error">
          <p className="app-eyebrow">ARNTAGS / ERROR</p>
          <h1>Erreur de démarrage</h1>
          <pre>{this.state.error.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

function LoadingScreen() {
  return <div className="app-loading">Chargement d’ArnTags…</div>
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
      <Route path="/update-password" element={
        <UpdatePasswordPage />
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  </AppErrorBoundary>,
)
