import { useEffect, useState, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../supabaseClient'
import { askAndApplySelfHostedUpdate, fetchAvailableChannels, getLiveUpdateDebugSnapshot, getSavedUpdateChannel, getSelfHostedUpdateStatus, setLiveUpdateDebugListener } from '../liveUpdate'
import { LiveUpdate } from '@capawesome/capacitor-live-update'

type AuthView = 'login' | 'signup' | 'forgot-password'

function getResetRedirectUrl(): string {
  const appUrl = import.meta.env.VITE_APP_SHARE_URL?.replace(/\/$/, '')
  return `${appUrl || window.location.origin}/update-password`
}

export default function AuthForm(): JSX.Element {
  const navigate = useNavigate()
  const [view, setView] = useState<AuthView>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'error' | 'success'>('error')
  const [activeChannel, setActiveChannel] = useState<string>('default');
  const [currentBundleId, setCurrentBundleId] = useState<string | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState<string | null>(null);

  let currentBundle;

  function switchView(nextView: AuthView): void {
    setView(nextView)
    setPassword('')
    setConfirmPassword('')
    setMessage(null)
  }

  const refreshAppInfo = async () => {
    try {
      const channel = await getSavedUpdateChannel();
      setActiveChannel(channel);

      const baseSnapshot = await getLiveUpdateDebugSnapshot();
      setCurrentBundleId(baseSnapshot.currentBundleId);

      // Si tu veux afficher versionName, tu peux le mettre dans le manifest
      // et le lire via getSelfHostedUpdateStatus
      const status = await getSelfHostedUpdateStatus(channel);
      if (status.manifest?.versionName) {
        setCurrentVersionName(status.manifest.versionName);
      } else {
        setCurrentVersionName(null);
      }
    } catch (error) {
      console.error('Erreur refreshAppInfo:', error);
    }
  };

  async function handleAuth(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setMessage(null)

    if (view === 'signup' && password !== confirmPassword) {
      setMessageType('error')
      setMessage('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const result = view === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

      if (result.error) throw result.error

      if (view === 'signup' && !result.data.session) {
        setMessageType('success')
        setMessage('Compte créé. Vérifie ton email pour confirmer ton inscription.')
        return
      }

      navigate('/tags', { replace: true })
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setMessage(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getResetRedirectUrl(),
      })

      if (error) throw error

      setMessageType('success')
      setMessage('Email envoyé. Vérifie ta boîte de réception et tes spams.')
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Impossible d’envoyer le lien.')
    } finally {
      setLoading(false)
    }
  }

  const isForgotPassword = view === 'forgot-password'
  const isSignUp = view === 'signup'



  useEffect(() => {

    const loadCurrentBundle = async () => {

      const cb = await LiveUpdate.getCurrentBundle().catch(() => ({ bundleId: null }))
      currentBundle = cb.bundleId;
    }
    loadCurrentBundle();
    refreshAppInfo();

    return () => {
      setLiveUpdateDebugListener(null);
    };
  }, []);

  return (
    <main className="auth-page">
      <div className="auth-page__ambient auth-page__ambient--one" aria-hidden="true" />
      <div className="auth-page__ambient auth-page__ambient--two" aria-hidden="true" />
      <div
        className="absolute top-0 left-0 right-0 text-center bg-black/10 backdrop-blur-sm text-white font-medium"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingBottom: '0.5rem',
        }}
      >
        <div className="text-xs sm:text-sm">
          <span className="font-semibold">Channel :</span> {activeChannel}
          {currentBundleId && (
            <>
              {' '}<span className="text-white/70">•</span>{' '}
              <span className="font-semibold">Bundle :</span> {currentBundleId}
            </>
          )}
          {currentVersionName && (
            <>
              {' '}<span className="text-white/70">•</span>{' '}
              <span className="font-semibold">Version :</span> {currentVersionName}
            </>
          )}
        </div>
      </div>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__symbol" aria-hidden="true">⌁</div>
        <p className="app-eyebrow">ARNTREAL / NFC VAULT</p>
        <h1 id="auth-title">arntags</h1>
        <p className="auth-card__subtitle">
          {isForgotPassword ? 'Réinitialise l’accès à ton coffre NFC.' : 'Stocke et réécris tes tags NFC compatibles.'}
        </p>

        {!isForgotPassword ? (
          <form className="auth-form" onSubmit={(event) => void handleAuth(event)}>
            <label className="app-field">
              <span>Email</span>
              <input type="email" autoComplete="username" placeholder="ton@email.fr" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="app-field">
              <span>Mot de passe</span>
              <input type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
            </label>
            {isSignUp && (
              <label className="app-field">
                <span>Confirmer le mot de passe</span>
                <input type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
              </label>
            )}
            {message && <p className={`app-message app-message--${messageType}`} role="status">{message}</p>}
            <button className="app-button app-button--primary" type="submit" disabled={loading}>
              {loading ? 'Chargement…' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => void handleForgotPassword(event)}>
            <label className="app-field">
              <span>Email</span>
              <input type="email" autoComplete="email" placeholder="ton@email.fr" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            {message && <p className={`app-message app-message--${messageType}`} role="status">{message}</p>}
            <button className="app-button app-button--primary" type="submit" disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}

        <div className="auth-card__links">
          {!isForgotPassword && (
            <button className="app-link-button" type="button" onClick={() => switchView(isSignUp ? 'login' : 'signup')}>
              {isSignUp ? 'J’ai déjà un compte' : 'Créer un compte'}
            </button>
          )}
          {view === 'login' && (
            <button className="app-link-button" type="button" onClick={() => switchView('forgot-password')}>
              Mot de passe oublié ?
            </button>
          )}
          {isForgotPassword && (
            <button className="app-link-button" type="button" onClick={() => switchView('login')}>
              Retour à la connexion
            </button>
          )}
        </div>
      </section>
    </main>
  )
}