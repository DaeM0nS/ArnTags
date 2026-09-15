import { useEffect, useState, type JSX } from 'react'

import { updateNfcTagName } from '../../services/nfcTagsRepository'
import { writeNfcTag } from '../../services/nfcService'
import type { NfcTag, ScannedNfcTag } from '../../types/nfc'
import NdefRecordsList from './NdefRecordsList'

type TagValue = NfcTag | ScannedNfcTag

type NfcTagDetailsProps = {
  tag: TagValue
  isSaved: boolean
  onClose: () => void
  onSavedChange: (tag: NfcTag) => void
}

function isStoredTag(tag: TagValue): tag is NfcTag {
  return 'id' in tag
}

function getUid(tag: TagValue): string | null {
  return isStoredTag(tag) ? tag.tag_uid : tag.uid
}

function getType(tag: TagValue): string | null {
  return isStoredTag(tag) ? tag.tag_type : tag.type
}

function getCapacity(tag: TagValue): number | null {
  return tag.capacity
}

function getWritable(tag: TagValue): boolean | null {
  return isStoredTag(tag) ? tag.is_writable : tag.isWritable
}

export default function NfcTagDetails({
  tag,
  isSaved,
  onClose,
  onSavedChange,
}: NfcTagDetailsProps): JSX.Element {
  const [name, setName] = useState(isStoredTag(tag) ? tag.name : '')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(isStoredTag(tag) ? tag.name : '')
    setStatus(null)
  }, [tag])

  async function handleSaveName(): Promise<void> {
    if (!isStoredTag(tag)) return

    const cleanName = name.trim()
    if (!cleanName) {
      setStatus('Choisis un nom pour ce tag.')
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const updated = await updateNfcTagName(tag.id, cleanName)
      onSavedChange(updated)
      setStatus('Nom enregistré.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impossible d’enregistrer le nom.')
    } finally {
      setLoading(false)
    }
  }

  async function handleWrite(): Promise<void> {
    setLoading(true)
    setStatus('Approche un tag NFC NDEF réinscriptible…')

    try {
      await writeNfcTag(tag.records, setStatus)
      setStatus('Écriture terminée.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impossible d’écrire le tag.')
    } finally {
      setLoading(false)
    }
  }

  const writable = getWritable(tag)

  return (
    <section className="nfc-detail app-surface" aria-label="Détail du tag NFC">
      <div className="nfc-detail__top">
        <div>
          <p className="app-eyebrow">{isSaved ? 'TAG SAUVEGARDÉ' : 'LECTURE EN MÉMOIRE'}</p>
          {isSaved ? (
            <input
              className="nfc-detail__name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Nom du tag"
            />
          ) : (
            <h2>Tag à sauvegarder</h2>
          )}
        </div>
        <button className="nfc-icon-button" type="button" onClick={onClose} aria-label="Fermer le détail">
          ×
        </button>
      </div>

      <div className="nfc-facts">
        <div><span>UID</span><strong>{getUid(tag) ?? 'Non disponible'}</strong></div>
        <div><span>Type</span><strong>{getType(tag) ?? 'NDEF'}</strong></div>
        <div><span>Écriture</span><strong>{writable === false ? 'Verrouillé' : 'À vérifier'}</strong></div>
        <div><span>Capacité</span><strong>{getCapacity(tag) ? `${getCapacity(tag)} octets` : 'Non disponible'}</strong></div>
      </div>

      <div className="nfc-detail__records-heading">
        <p className="app-eyebrow">CONTENU NDEF</p>
        <span>{tag.records.length} enregistrement(s)</span>
      </div>

      <NdefRecordsList records={tag.records} />

      {status && <p className="app-message app-message--success">{status}</p>}

      <div className="nfc-detail__actions">
        {isSaved && (
          <button className="app-button app-button--ghost" type="button" disabled={loading} onClick={() => void handleSaveName()}>
            Enregistrer le nom
          </button>
        )}
        <button className="app-button app-button--primary" type="button" disabled={loading || tag.records.length === 0} onClick={() => void handleWrite()}>
          {loading ? 'Traitement…' : 'Réécrire sur un tag'}
        </button>
      </div>
    </section>
  )
}