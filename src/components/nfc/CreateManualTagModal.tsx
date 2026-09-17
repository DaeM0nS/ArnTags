import { useState, type FormEvent } from 'react'

import { useAuth } from '../../context/AuthContext'
import { createNfcTag } from '../../services/nfcTagsRepository'
import type { NdefRecord, NfcTag } from '../../types/nfc'

type ManualRecordType = 'text' | 'url'

type CreateManualTagModalProps = {
  onClose: () => void
  onCreated: (tag: NfcTag) => void
}

function createManualRecord(
  type: ManualRecordType,
  value: string,
): NdefRecord {
  return {
    recordType: type,
    mediaType: null,
    id: null,
    encoding: type === 'text' ? 'utf-8' : null,
    language: type === 'text' ? 'fr' : null,
    text: type === 'text' ? value : null,
    uri: type === 'url' ? value : null,
    dataBase64: null,
    dataText: value,
    nativeTnf: null,
    nativeType: null,
    nativeId: null,
    nativePayload: null,
  }
}

export default function CreateManualTagModal({
  onClose,
  onCreated,
}: CreateManualTagModalProps) {
  const { session } = useAuth()

  const [name, setName] = useState('')
  const [recordType, setRecordType] = useState<ManualRecordType>('text')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const cleanName = name.trim()
    const cleanValue = value.trim()

    if (!session) {
      setError('Session utilisateur introuvable.')
      return
    }

    if (!cleanName) {
      setError('Donne un nom à ce tag.')
      return
    }

    if (!cleanValue) {
      setError(recordType === 'text' ? 'Entre un texte à écrire.' : 'Entre une URL à écrire.')
      return
    }

    if (recordType === 'url') {
      try {
        const url = new URL(cleanValue)

        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new Error()
        }
      } catch {
        setError('Entre une URL valide, par exemple https://arntreal.com.')
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const tag = await createNfcTag({
        user_id: session.user.id,
        name: cleanName,
        tag_uid: null,
        tag_type: 'NDEF manuel',
        capacity: null,
        is_writable: null,
        records: [createManualRecord(recordType, cleanValue)],
        raw_ndef: null,
        source: 'manual',
        ndef_format: 'unknown',
        display_order: 0,
      })

      onCreated(tag)
      onClose()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Impossible de créer ce tag.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nfc-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="nfc-modal app-surface manual-tag-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-tag-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="nfc-detail__top">
          <div>
            <p className="app-eyebrow">NOUVEAU TAG</p>
            <h2 id="manual-tag-title">Créer un tag manuel</h2>
          </div>

          <button
            className="nfc-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <p className="manual-tag-modal__description">
          Crée un message NDEF texte ou URL, sauvegarde-le dans ton coffre,
          puis utilise « Réécrire sur un tag » pour l’écrire sur un tag NFC.
        </p>

        <form className="manual-tag-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="app-field">
            <span>Nom du tag</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Profil Arntreal"
              maxLength={80}
              autoFocus
            />
          </label>

          <label className="app-field">
            <span>Type de contenu</span>
            <select
              value={recordType}
              onChange={(event) => setRecordType(event.target.value as ManualRecordType)}
            >
              <option value="text">Texte</option>
              <option value="url">Lien / URL</option>
            </select>
          </label>

          <label className="app-field">
            <span>{recordType === 'text' ? 'Texte NDEF' : 'URL NDEF'}</span>
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={
                recordType === 'text'
                  ? 'Écris le contenu du tag…'
                  : 'https://profile.arntreal.com/...'
              }
              rows={4}
              maxLength={1000}
            />
          </label>

          {error && <p className="app-message app-message--error">{error}</p>}

          <div className="nfc-detail__actions">
            <button className="app-button app-button--ghost" type="button" onClick={onClose}>
              Annuler
            </button>
            <button className="app-button app-button--primary" type="submit" disabled={loading}>
              {loading ? 'Création…' : 'Créer le tag'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}