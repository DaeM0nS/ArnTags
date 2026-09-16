import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { askAndApplySelfHostedUpdate, downloadSelfHostedUpdate, fetchAvailableChannels, getDefaultUpdateChannel, getLiveUpdateDebugSnapshot, getSavedUpdateChannel, getSelfHostedUpdateStatus } from '../../liveUpdate';
import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { Dialog } from '@capacitor/dialog';
import ChangePasswordForm from './ChangePasswordForm'

import { useAuth } from '../../context/AuthContext'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const [showChangePass, setShowChangePass] = useState(false);

  async function handleSignOut(): Promise<void> {
    setLoading(true)
    setError(null)

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      navigate('/login', { replace: true })
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Impossible de se déconnecter.')
    } finally {
      setLoading(false)
    }
  }

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

  const handleSelectChannel = (channel: string) => {
    setChannelInput(channel);
  };

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
        const { switchToChannelAndApplyLatest } = await import('../../liveUpdate');
        return await switchToChannelAndApplyLatest(normalized);
      })();

      setChannelInput(normalized);
      setAvailableChannels(channels);

      // // Petit délai pour laisser le reset se propager
      await new Promise(r => setTimeout(r, 500));

      // 2. Déjà sur la dernière version
      if (result.action === 'already_on_latest') {
        setChannelStatus(`Déjà sur la dernière version du channel ${normalized}.`);
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

        setShowSettings(false);
        return;
      }

      // 4. Cas B : bundle déjà en local → application immédiate sans prompt
      if (result.action === 'apply_existing_bundle') {
        setChannelStatus(`Application de la version ${result.bundleId}...`);
        await LiveUpdate.reload();

        setShowSettings(false);
        return;
      }

      // Fallback (ne devrait pas arriver)
      setChannelStatus(`Action inconnue : ${result.action}`);
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
        refreshDebugInfo();
      }, 1000);
    } catch (error) {
      setDebugText(`Erreur application update: ${String(error)}`);
    } finally {
      setDebugLoading(false);
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

  useEffect(() => {
    const existingScript = document.getElementById('paypal-donate-script');

    const initPayPalButton = () => {
      // En transtypant (window as any), TypeScript ignore la vérification stricte du type
      const globalWindow = window as any;

      if (globalWindow.PayPal && globalWindow.PayPal.Donation) {
        const container = document.getElementById('donate-button');
        if (container) container.innerHTML = '';

        globalWindow.PayPal.Donation.Button({
          env: 'production',
          hosted_button_id: 'KD3TP34KH3U42', // <-- Remplacez par votre ID de bouton
          image: {
            src: 'https://paypalobjects.com',
            alt: 'Bouton Faites un don avec PayPal',
            title: 'PayPal - The safer, easier way to pay online!',
          }
        }).render('#donate-button');
      }
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'paypal-donate-script';
      script.src = 'https://paypalobjects.com';
      script.charset = 'UTF-8';
      script.async = true;
      script.onload = initPayPalButton;
      document.body.appendChild(script);
    } else {
      initPayPalButton();
    }
  }, []);

  return (
    <main className="app-page nfc-page">
      <header className="nfc-page__header">
        <div>
          <p className="app-eyebrow">ARNTAGS / ACCOUNT</p>
          <h1>Profil</h1>
          <p className="nfc-page__subtitle">Gère ta session et ton accès à ton coffre NFC.</p>
        </div>
      </header>

      <section className="profile-card app-surface">
        <div className="profile-card__avatar" aria-hidden="true">✦</div>
        <div>
          <p className="app-eyebrow">COMPTE CONNECTÉ</p>
          <h2>{session?.user.email ?? 'Utilisateur'}</h2>
          <p>Les tags NFC sauvegardés sont séparés par compte grâce aux règles de sécurité Supabase.</p>
        </div>
      </section>

      <section className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/80">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          👤 Mon compte
        </h2>

        {/* <p className="text-gray-500">
              Les informations du compte connecté seront affichées ici.
            </p> */}
        <div><button
          type="button"
          onClick={() => setShowChangePass(v => !v)}
          className="rounded-full bg-white/80 border items-center justify-center text-gray-700 hover:bg-white"
          aria-label="Debug Settings"
        >
          {showChangePass ? "Changer de mot de passe v" : "Changer de mot de passe >"}
        </button>
        </div>
        {showChangePass && (
          <ChangePasswordForm />
        )}

      </section>

      <section className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/80">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          ⚙️ Préférences
        </h2>
        <div><button
          type="button"
          onClick={() => setShowSettings(v => !v)}
          className="rounded-full bg-white/80 border items-center justify-center text-gray-700 hover:bg-white"
          aria-label="Channel Settings"
        >
          {showSettings ? "Channel Settings v" : "Channel Settings >"}
        </button>
        </div>
        {showSettings && (
          <div className="mb-6 p-4 rounded-xl bg-gray-50 border space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Channel d’update
            </label>

            <input
              type="text"
              value={channelInput}
              onChange={e => setChannelInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="default"
            />

            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                {loadingChannels ? 'Chargement des channels...' : 'Available Channels:'}
              </p>

              <div className="flex flex-wrap gap-2">
                {availableChannels.map(channel => (
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
        <div><button
          type="button"
          onClick={() => setShowDebug(v => !v)}
          className="rounded-full bg-white/80 border items-center justify-center text-gray-700 hover:bg-white"
          aria-label="Debug Settings"
        >
          {showDebug ? "Debug Settings v" : "Debug Settings >"}
        </button>
        </div>
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
      </section>

          <section className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/80">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              ☕ Me soutenir
            </h2>
            <p>Wowowow j'vais ajouter des pubs ici si tu veux cliquer.</p>
            <div className="flex justify-center my-4">
              <a
                href='https://www.paypal.com/donate/?hosted_button_id=KD3TP34KH3U42'
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-[#FFC439] hover:bg-[#F4B41A] text-black font-semibold rounded-full shadow-md transition-all transform hover:scale-105"
              >
                {/* Logo PayPal simplifié */}
                <span className="italic font-extrabold text-[#003087]">Pay</span>
                <span className="italic font-extrabold text-[#0079C1]">Pal</span>
                <span className="ml-1 text-sm font-medium">Faire un don</span>
              </a>
            </div>

            <p className='flex justify-center my-4'>
              <a href='https://checkout.revolut.com/pay/bb4a53dc-84a3-48c0-91a6-b7b622b675e3'>
                Donation via Revolut
                <img
                  src="https://pixelmon-france.fr/revolutdonation.png"
                  alt="QR Code Revolut"
                />
              </a>
            </p>
          </section>

      <section className="profile-list app-surface">
        <div className="profile-list__row"><span>Email</span><strong>{session?.user.email ?? 'Non disponible'}</strong></div>
        <div className="profile-list__row"><span>Identifiant</span><strong>{session?.user.id ?? 'Non disponible'}</strong></div>
        <div className="profile-list__row"><span>Synchronisation</span><strong>Supabase actif</strong></div>
      </section>

      {error && <p className="app-message app-message--error">{error}</p>}

      <button className="app-button app-button--danger profile-sign-out" type="button" disabled={loading} onClick={() => void handleSignOut()}>
        {loading ? 'Déconnexion…' : 'Se déconnecter'}
      </button>
    </main>
  )
}