import { useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { createNfcTag } from '../../services/nfcTagsRepository'
import { isNfcAvailable, scanNfcTag } from '../../services/nfcService'
import type { NfcTag, ScannedNfcTag } from '../../types/nfc'
import NdefRecordsList from './NdefRecordsList'
import NfcScanOverlay from './NfcScanOverlay'
import { tryAttachArntrealProfile } from '../../services/nfcTagsRepository'

type ScanState = 'idle' | 'scanning' | 'read' | 'saving'

function createDefaultName(): string {
  return `Tag ${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date())}`
}

export default function NfcScannerPage(): JSX.Element {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [tag, setTag] = useState<ScannedNfcTag | null>(null)
  const [name, setName] = useState(createDefaultName)
  const [status, setStatus] = useState<string | null>(null)

  async function handleScan(): Promise<void> {
    setStatus(null)
    setTag(null)

    if (!isNfcAvailable()) {
      setStatus('NFC indisponible. Utilise l’application Android/iOS ou Chrome Android servi en HTTPS.')
      return
    }

    setScanState('scanning')

    try {
      const scannedTag = await scanNfcTag(setStatus)
      setTag(scannedTag)
      setName(createDefaultName())
      setStatus(`${scannedTag.records.length} enregistrement(s) NDEF lu(s).`)
      setScanState('read')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impossible de lire le tag.')
      setScanState('idle')
    }
  }

  async function handleSave(): Promise<void> {
    if (!tag || !session) return

    const cleanName = name.trim()
    if (!cleanName) {
      setStatus('Donne un nom à ce tag avant de le sauvegarder.')
      return
    }

    setScanState('saving')
    setStatus('Sauvegarde dans ton coffre…')

    try {
      const saved: NfcTag = await createNfcTag({
        user_id: session.user.id,
        name: cleanName,
        tag_uid: tag.uid,
        tag_type: tag.type,
        capacity: tag.capacity,
        is_writable: tag.isWritable,
        records: tag.records,
        raw_ndef: tag.rawNdef,
        source: 'nfc',
        ndef_format: tag.ndefFormat,
        display_order: 0,
      })


      // Après avoir créé le tag et obtenu createdTag :
      const attached = await tryAttachArntrealProfile(saved)

      if (attached) {
        // createdTag a maintenant profile_data rempli
        // setTags((current) =>
        //   current.map((t) => (t.id === attached.id ? attached : t)),
        // )

        // if (selectedTag?.id === attached.id) {
        //   setSelectedTag(attached)
        // }
      }

      setStatus(`« ${saved.name} » a été ajouté à ton coffre.`)
      setScanState('read')
      navigate('/tags')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impossible de sauvegarder le tag.')
      setScanState('read')
    }
  }

  return (
    <main className="app-page nfc-page">
      <header className="nfc-page__header nfc-page__header--scanner">
        <div>
          <p className="app-eyebrow">NFC CAPTURE</p>
          <h1>Scanner un tag</h1>
          <p className="nfc-page__subtitle">Lis le contenu NDEF d’un tag, puis conserve-le dans ton coffre privé.</p>
        </div>
      </header>

      <section className="nfc-scanner app-surface">
        <div className="nfc-scanner__visual" aria-hidden="true">
          <span className="nfc-scanner__ring nfc-scanner__ring--one" />
          <span className="nfc-scanner__ring nfc-scanner__ring--two" />
          <span className="nfc-scanner__symbol">⌁</span>
        </div>

        <h2>{scanState === 'read' ? 'Tag détecté' : 'Prêt à scanner'}</h2>
        <p>
          {scanState === 'read'
            ? 'Vérifie les données ci-dessous puis enregistre-les dans ton coffre.'
            : 'Active le NFC sur ton appareil puis approche un tag compatible.'}
        </p>

        <button className="app-button app-button--primary" type="button" disabled={scanState === 'scanning' || scanState === 'saving'} onClick={() => void handleScan()}>
          {scanState === 'scanning' ? 'Lecture en cours…' : 'Démarrer le scan'}
        </button>

        {status && <p className="app-message app-message--success">{status}</p>}
      </section>

      {tag && (
        <form
          className="nfc-scan-result app-surface"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <div className="nfc-scan-result__header">
            <div>
              <p className="app-eyebrow">DONNÉES LUES</p>
              <h2>Contenu NDEF</h2>
            </div>

            <span>{tag.records.length} record(s)</span>
          </div>

          <label className="app-field">
            <span>Nom dans le coffre</span>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              enterKeyHint="done"
              autoComplete="off"
              autoFocus
            />
          </label>

          <NdefRecordsList records={tag.records} />

          <div className="nfc-scan-result__actions">
            <button
              className="app-button app-button--primary"
              type="submit"
              disabled={scanState === 'saving'}
            >
              {scanState === 'saving'
                ? 'Sauvegarde…'
                : 'Sauvegarder le tag'}
            </button>
          </div>
        </form>
      )}

      {scanState === 'scanning' && <NfcScanOverlay message={status ?? 'Approche le tag du téléphone…'} />}
    </main>
  )
}