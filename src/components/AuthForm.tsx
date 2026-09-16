import * as React from 'react';
const { useState, useEffect } = React;

import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { LiveUpdate } from '@capawesome/capacitor-live-update'

import {
  fetchAvailableChannels,
  getSavedUpdateChannel,
  saveUpdateChannel,
  getDefaultUpdateChannel,
  getCurrentUpdateChannel,
  getLiveUpdateDebugSnapshot,
  setLiveUpdateDebugListener,
  getSelfHostedUpdateStatus,
  downloadSelfHostedUpdate,
  askAndApplySelfHostedUpdate,
  setLiveUpdateChannel,
  getCurrentBundle,
} from '../liveUpdate';
import { Dialog } from '@capacitor/dialog';
import { Capacitor } from '@capacitor/core';
import { color } from '../main';

type AuthView = 'login' | 'signup' | 'forgot-password'

function getResetRedirectUrl(): string {
  const appUrl = import.meta.env.VITE_APP_SHARE_URL?.replace(/\/$/, '')
  return `${appUrl || window.location.origin}/update-password`
}

export default function AuthForm() {
  const [view, setView] = useState<AuthView>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [messageType, setMessageType] = useState<'error' | 'success'>('error')

  const [showSettings, setShowSettings] = useState(false);
  const [channelInput, setChannelInput] = useState(getDefaultUpdateChannel());
  const [availableChannels, setAvailableChannels] = useState<string[]>([
    getDefaultUpdateChannel(),
  ]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelStatus, setChannelStatus] = useState('');

  const [showDebug, setShowDebug] = useState(false);
  const [debugText, setDebugText] = useState('Aucun debug');
  const [debugLoading, setDebugLoading] = useState(false);

  const [activeChannel, setActiveChannel] = useState<string>(getDefaultUpdateChannel());
  const [currentBundleId, setCurrentBundleId] = useState<string | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState<string | null>(null);

  const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  const navigate = useNavigate();

  let currentBundle;

const refreshDebugInfo = async () => {
    setDebugLoading(true);

    try {
      const baseSnapshot = await getLiveUpdateDebugSnapshot();
      const selfHostedStatus = await getSelfHostedUpdateStatus(
        baseSnapshot.savedChannel
      );

      const channels = await fetchAvailableChannels();

      const payload = {
        ...baseSnapshot,
        availableChannels: channels,
        selfHosted: {
          manifestUrl: `.../manifests/${baseSnapshot.savedChannel}.json`,
          manifest: selfHostedStatus.manifest,
          latestBundleId: selfHostedStatus.latestBundleId,
          updateAvailable: selfHostedStatus.updateAvailable,
          updateDownloaded: selfHostedStatus.updateDownloaded,
        },
        at: new Date().toISOString(),
      };

      setDebugText(JSON.stringify(payload, null, 2));
    } catch (error) {
      setDebugText(`Erreur debug: ${String(error)}`);
    } finally {
      setDebugLoading(false);
    }
  };

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

  useEffect(() => {
    setLiveUpdateDebugListener(setDebugText);

    const loadChannels = async () => {
      setLoadingChannels(true);

      try {
        const saved = await getSavedUpdateChannel();
        setChannelInput(saved);

        const channels = await fetchAvailableChannels();
        setAvailableChannels(channels);

        const currentNativeChannel = await getCurrentUpdateChannel();
        setChannelStatus(`Channel sauvegardé : ${saved} | Channel natif : ${currentNativeChannel}`);
      } catch (error) {
        setChannelStatus(`Erreur chargement channels : ${String(error)}`);
      } finally {
        setLoadingChannels(false);
        const cb = await LiveUpdate.getCurrentBundle().catch(() => ({ bundleId: null }))
        currentBundle = cb.bundleId;
      }
    };

    loadChannels();
    refreshDebugInfo();
    refreshAppInfo();

    return () => {
      setLiveUpdateDebugListener(null);
    };
  }, []);

  function switchView(nextView: AuthView): void {
    setView(nextView)
    setPassword('')
    setConfirmPassword('')
    setMessage(null)
  }

  const handleSaveChannel = async () => {
    const normalized = channelInput.trim() || getDefaultUpdateChannel();

    setLoadingChannels(true);
    setChannelStatus('');

    try {
      const channels = await fetchAvailableChannels();

      if (!channels.includes(normalized)) {
        throw new Error(`Le channel "${normalized}" n’existe pas dans channels.json.`);
      }

      // 1. Switch + download + setNextBundle
      const result = await (async () => {
        const { switchToChannelAndApplyLatest } = await import('../liveUpdate');
        return await switchToChannelAndApplyLatest(normalized);
      })();

      setChannelInput(normalized);
      setAvailableChannels(channels);

      // // Petit délai pour laisser le reset se propager
      await new Promise(r => setTimeout(r, 500));

      // 2. Déjà sur la dernière version
      if (result.action === 'already_on_latest') {
        setChannelStatus(`Déjà sur la dernière version du channel ${normalized}.`);
        await refreshAppInfo();
        await refreshDebugInfo();
        setShowSettings(false);
        return;
      }

      // 3. Cas A : nouvelle version téléchargée → prompt
      if (result.action === 'new_update_downloaded') {
        const { Dialog } = await import('@capacitor/dialog');

        const confirmResult = await Dialog.confirm({
          title: 'Mise à jour disponible',
          message: `Une nouvelle version (${result.bundleId}) est prête. Voulez-vous redémarrer l\u2019application maintenant ?`,
          okButtonTitle: 'Redémarrer',
          cancelButtonTitle: 'Plus tard',
        });

        if (confirmResult.value) {
          // Redémarrer → reload
          setChannelStatus(`Application de la version ${result.bundleId}...`);
          await LiveUpdate.reload();
        } else {
          // Plus tard → on ne fait rien, l'app reste sur l'ancienne version
          setChannelStatus(`Version ${result.bundleId} téléchargée. Elle sera appliquée au prochain redémarrage.`);
        }

        await refreshAppInfo();
        await refreshDebugInfo();
        setShowSettings(false);
        return;
      }

      // 4. Cas B : bundle déjà en local → application immédiate sans prompt
      if (result.action === 'apply_existing_bundle') {
        setChannelStatus(`Application de la version ${result.bundleId}...`);
        await LiveUpdate.reload();

        await refreshAppInfo();
        await refreshDebugInfo();
        setShowSettings(false);
        return;
      }

      // Fallback (ne devrait pas arriver)
      setChannelStatus(`Action inconnue : ${result.action}`);
      await refreshAppInfo();
      await refreshDebugInfo();
      setShowSettings(false);




      // const updateStatus = await getSelfHostedUpdateStatus(normalized);

      // setChannelStatus(
      //   `Channel sélectionné : ${normalized} — ` +
      //   (updateStatus.updateAvailable
      //     ? `update ${updateStatus.latestBundleId} disponible`
      //     : 'déjà à jour')
      // );

      // await refreshAppInfo();
      // await refreshDebugInfo();
      // setShowSettings(false);
    } catch (error) {
      setChannelStatus(`Impossible de changer le channel : ${String(error)}`);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleSelectChannel = (channel: string) => {
    setChannelInput(channel);
  };

  const handleCheckUpdates = async () => {
    setDebugLoading(true);

    try {
      const channel = await getSavedUpdateChannel();
      setDebugText(`Vérification du manifest self-hosted pour "${channel}"...`);

      const status = await getSelfHostedUpdateStatus(channel);

      if (!status.manifest) {
        setDebugText(`Aucun manifest disponible pour "${channel}".`);
        return;
      }

      if (status.currentBundleId === status.latestBundleId) {
        setDebugText('Déjà sur la dernière version.');
        return;
      }

      // Cas 2 : bundle téléchargé mais pas appliqué
      if (status.updateDownloaded && status.nextBundleId === status.latestBundleId) {
        setDebugText(
          `L’update ${status.latestBundleId} est téléchargée. Utilise “Appliquer update”.`,
        );
        return;
      }

      setDebugText(`Téléchargement de ${status.latestBundleId}...`);

      await downloadSelfHostedUpdate(status.manifest);

      setDebugText(
        `Update ${status.latestBundleId} téléchargée. Elle est prête à être appliquée.`
      );

      await refreshDebugInfo();
    } catch (error) {
      setDebugText(`Erreur check update: ${String(error)}`);
    } finally {
      setDebugLoading(false);
    }
  };

  const handleApplyDownloadedUpdate = async () => {
    setDebugLoading(true);

    try {
      const next = await LiveUpdate.getNextBundle().catch(() => ({
        bundleId: null,
      }));

      if (!next.bundleId) {
        setDebugText('Aucune update téléchargée à appliquer.');
        return;
      }

      const confirmed = await askAndApplySelfHostedUpdate(next.bundleId);

      if (!confirmed) {
        setDebugText('Application de l’update reportée.');
        return;
      }

      // Petit délai pour laisser le reload se produire
      setTimeout(() => {
        refreshAppInfo();
        refreshDebugInfo();
      }, 1000);
    } catch (error) {
      setDebugText(`Erreur application update: ${String(error)}`);
    } finally {
      setDebugLoading(false);
    }
  };

  const handleRefreshChannels = async () => {
    setLoadingChannels(true);

    try {
      const channels = await fetchAvailableChannels();
      const saved = await getSavedUpdateChannel();

      setAvailableChannels(channels);
      setChannelStatus(
        `Channels chargés : ${channels.join(', ')}. Channel actuel : ${saved}`
      );
    } catch (error) {
      setChannelStatus(`Erreur de récupération : ${String(error)}`);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleResetToDefault = async () => {
    try {
      setDebugText('Retour vers le bundle natif…');

      await LiveUpdate.reset();

      const result = await Dialog.confirm({
        title: 'Retour au bundle natif',
        message: 'Le bundle OTA a été désactivé. Redémarrer maintenant ?',
        okButtonTitle: 'Redémarrer',
        cancelButtonTitle: 'Plus tard',
      });

      if (result.value) {
        await LiveUpdate.reload();
        return;
      }

      await refreshDebugInfo();
    } catch (error) {
      setDebugText(`Erreur reset: ${String(error)}`);
    }
  };

  async function handleAuth(event: React.FormEvent<HTMLFormElement>): Promise<void> {
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

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>): Promise<void> {
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
        {Capacitor.isNativePlatform() && (
            <>
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/80 border flex items-center justify-center text-gray-700 hover:bg-white"
                aria-label="Ouvrir les réglages"
              >
                ⚙️
              </button>

              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/80 border flex items-center justify-center text-gray-700 hover:bg-white"
                aria-label="Ouvrir le debug"
              >
                🐞
              </button>
            </>
          )}

          {showSettings && (
            <div className="mb-6 p-4 rounded-xl bg-gray-50 border space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Channel d’update
              </label>

              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="default"
              />

              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  {loadingChannels
                    ? 'Chargement des channels...'
                    : 'Available Channels:'}
                </p>

                <div className="flex flex-wrap gap-2">
                  {availableChannels.map((channel) => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => handleSelectChannel(channel)}
                      className={`px-3 py-1 rounded-full border text-sm ${channelInput === channel
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300'
                        }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefreshChannels}
                disabled={loadingChannels}
                className="px-3 py-2 rounded-lg border bg-white text-sm"
              >
                {loadingChannels ? 'Actualisation...' : 'Rafraîchir les channels'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveChannel}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                >
                  Valider
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setChannelInput(getDefaultUpdateChannel());
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 rounded-lg border"
                >
                  Fermer
                </button>
              </div>

              {channelStatus && (
                <p className="text-xs text-gray-600 break-words">{channelStatus}</p>
              )}
            </div>
          )}

          {showDebug && (
            <div className="mb-6 p-4 rounded-xl bg-black text-green-400 border border-gray-800 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={refreshDebugInfo}
                  className="px-3 py-2 rounded-lg bg-zinc-800 text-white text-sm"
                  disabled={debugLoading}
                >
                  {debugLoading ? 'Chargement...' : 'Rafraîchir le debug'}
                </button>

                <button
                  type="button"
                  onClick={handleCheckUpdates}
                  className="px-3 py-2 rounded-lg bg-blue-700 text-white text-sm"
                  disabled={debugLoading}
                >
                  Télécharger update
                </button>

                <button
                  type="button"
                  onClick={handleApplyDownloadedUpdate}
                  className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm"
                  disabled={debugLoading}
                >
                  Appliquer update
                </button>

                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-3 py-2 rounded-lg bg-red-700 text-white text-sm"
                  disabled={debugLoading}
                >
                  Reset bundle
                </button>
              </div>

              <pre className="text-[11px] whitespace-pre-wrap break-words max-h-72 overflow-auto">
                {debugText}
              </pre>
            </div>
          )}
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