import { useState, type JSX } from 'react'

import { usePwaInstall } from '../services/usePwaInstall'

export default function InstallPwaButton(): JSX.Element | null {
  const {
    canInstall,
    canShowIosInstructions,
    isInstalled,
    install,
  } = usePwaInstall()

  const [showHelp, setShowHelp] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  if (isInstalled) {
    return null
  }

  const canShowButton = canInstall || canShowIosInstructions

  if (!canShowButton) {
    return null
  }

  async function handleInstallClick(): Promise<void> {
    setInstallError(null)

    if (canInstall) {
      setInstalling(true)

      try {
        await install()
      } catch (error) {
        setInstallError(
          error instanceof Error
            ? error.message
            : 'Impossible de lancer l’installation de l’application.',
        )
      } finally {
        setInstalling(false)
      }

      return
    }

    if (canShowIosInstructions) {
      setShowHelp(true)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        disabled={installing}
        className="app-button app-button--primary pwa-install-button"
        aria-label="Installer ArnTags sur cet appareil"
      >
        <span className="pwa-install-button__icon" aria-hidden="true">
          ⇩
        </span>

        <span className="pwa-install-button__text">
          <span>Installer ArnTags</span>
          <small>
            {installing
              ? 'Préparation…'
              : canShowIosInstructions
                ? 'Ajouter à l’écran d’accueil'
                : 'Disponible sur cet appareil'}
          </small>
        </span>
      </button>

      {installError && (
        <p
          className="app-message app-message--error pwa-install-error"
          role="alert"
        >
          {installError}
        </p>
      )}

      {showHelp && (
        <div
          className="nfc-modal-backdrop pwa-install-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowHelp(false)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            aria-describedby="pwa-install-description"
            className="pwa-install-dialog app-surface"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="pwa-install-dialog__header">
              <div className="pwa-install-dialog__brand">
                <span
                  className="pwa-install-dialog__brand-icon"
                  aria-hidden="true"
                >
                  ⌁
                </span>

                <div>
                  <p className="app-eyebrow">ARNTAGS / PWA</p>
                  <h2 id="pwa-install-title">Installer ArnTags</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="pwa-install-dialog__close"
                aria-label="Fermer la fenêtre d’installation"
              >
                ×
              </button>
            </header>

            <p
              id="pwa-install-description"
              className="pwa-install-dialog__intro"
            >
              Installe ArnTags sur ton écran d’accueil pour l’ouvrir comme une
              application et accéder plus rapidement à ton coffre NFC.
            </p>

            <div className="pwa-install-dialog__steps">
              <div className="pwa-install-step">
                <span className="pwa-install-step__number">1</span>

                <div>
                  <strong>Ouvre le menu Partager</strong>
                  <p>
                    Dans Safari, appuie sur l’icône Partager en bas de l’écran.
                  </p>
                </div>

                <span className="pwa-install-step__symbol" aria-hidden="true">
                  ⎋
                </span>
              </div>

              <div className="pwa-install-step">
                <span className="pwa-install-step__number">2</span>

                <div>
                  <strong>Ajoute l’application</strong>
                  <p>Sélectionne « Sur l’écran d’accueil » dans la liste.</p>
                </div>

                <span className="pwa-install-step__symbol" aria-hidden="true">
                  ＋
                </span>
              </div>

              <div className="pwa-install-step">
                <span className="pwa-install-step__number">3</span>

                <div>
                  <strong>Confirme l’installation</strong>
                  <p>Appuie sur « Ajouter » pour créer l’icône ArnTags.</p>
                </div>

                <span className="pwa-install-step__symbol" aria-hidden="true">
                  ✓
                </span>
              </div>
            </div>

            <footer className="pwa-install-dialog__footer">
              <p>
                Une fois installée, ArnTags apparaîtra avec une icône dédiée sur
                ton écran d’accueil.
              </p>

              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="app-button app-button--primary"
              >
                Compris
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}