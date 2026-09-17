import { useCallback, useEffect, useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { deleteNfcTag, getNfcTags } from '../../services/nfcTagsRepository'
import { resetNfcTag } from '../../services/nfcService'
import type { NfcTag } from '../../types/nfc'
import NfcTagDetails from './NfcTagDetails'
import CreateManualTagModal from './CreateManualTagModal'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function NfcTagsPage(): JSX.Element {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [tags, setTags] = useState<NfcTag[]>([])
  const [selectedTag, setSelectedTag] = useState<NfcTag | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState<string | null>(null)

  const loadTags = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      setTags(await getNfcTags())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les tags.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags, session?.user.id])

  function handleTagUpdate(updatedTag: NfcTag): void {
    setTags((currentTags) => currentTags.map((tag) => tag.id === updatedTag.id ? updatedTag : tag))
    setSelectedTag(updatedTag)
  }

  async function handleDelete(tag: NfcTag): Promise<void> {
    const accepted = window.confirm(`Supprimer définitivement « ${tag.name} » ?`)
    if (!accepted) return

    setDeletingId(tag.id)
    setError(null)

    try {
      await deleteNfcTag(tag.id)
      setTags((currentTags) => currentTags.filter((item) => item.id !== tag.id))
      if (selectedTag?.id === tag.id) setSelectedTag(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer ce tag.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleResetPhysicalTag(): Promise<void> {
    setResetLoading(true)
    setResetStatus('Approche le tag NFC à reset et garde-le immobile…')
    setError(null)

    try {
      await resetNfcTag(setResetStatus)

      setResetStatus(
        'Tag reset avec succès : son contenu NDEF a été effacé.',
      )

      window.setTimeout(() => {
        setShowResetConfirm(false)
        setResetStatus(null)
      }, 1_200)
    } catch (resetError) {
      setResetStatus(
        resetError instanceof Error
          ? resetError.message
          : 'Impossible de reset ce tag NFC.',
      )
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="app-page nfc-page">
      <header className="nfc-page__header">
        <div>
          <p className="app-eyebrow">ARNTREAL / NFC VAULT</p>
          <h1>Mon coffre</h1>
          <p className="nfc-page__subtitle">Tes données NDEF sauvegardées, privées et prêtes à être réécrites.</p>
        </div>

        <button
          className="app-button app-button--primary"
          type="button"
          onClick={() => navigate('/scanner')}
        >
          + Scanner
        </button>

        <button
          className="app-button app-button--ghost"
          type="button"
          onClick={() => setShowManualModal(true)}
        >
          + Créer
        </button>

        <button
          className="app-button app-button--danger"
          type="button"
          disabled={resetLoading}
          onClick={() => {
            setResetStatus(null)
            setShowResetConfirm(true)
          }}
        >
          - Reset un tag
        </button>
      </header>

      {error && <p className="app-message app-message--error">{error}</p>}

      {loading ? (
        <section className="nfc-state app-surface"><p>Chargement de ton coffre…</p></section>
      ) : tags.length === 0 ? (
        <section className="nfc-empty app-surface">
          <div className="nfc-empty__symbol" aria-hidden="true">⌁</div>
          <h2>Aucun tag sauvegardé</h2>
          <p>Scanne un tag NFC compatible pour conserver son message NDEF dans ton coffre.</p>
          <button className="app-button app-button--primary" type="button" onClick={() => navigate('/scanner')}>
            Scanner mon premier tag
          </button>
        </section>
      ) : (
        <section className="nfc-tag-grid" aria-label="Tags NFC sauvegardés">
          {tags.map((tag) => (
            <article className="nfc-tag-card app-surface" key={tag.id}>
              <button className="nfc-tag-card__open" type="button" onClick={() => setSelectedTag(tag)}>
                <span className="nfc-tag-card__symbol" aria-hidden="true">⌁</span>
                <span className="nfc-tag-card__content">
                  <strong>{tag.name}</strong>
                  <small>{tag.records.length} enregistrement(s) NDEF</small>
                  <small>Mis à jour le {formatDate(tag.updated_at)}</small>
                </span>
              </button>
              <button
                className="nfc-tag-card__delete"
                type="button"
                disabled={deletingId === tag.id}
                onClick={() => void handleDelete(tag)}
                aria-label={`Supprimer ${tag.name}`}
              >
                {deletingId === tag.id ? '…' : '×'}
              </button>
            </article>
          ))}
        </section>
      )}

      {selectedTag && (
        <div className="nfc-modal-backdrop" role="presentation" onMouseDown={() => setSelectedTag(null)}>
          <div role="dialog" aria-modal="true" className="nfc-modal" onMouseDown={(event) => event.stopPropagation()}>
            <NfcTagDetails
              tag={selectedTag}
              isSaved
              onClose={() => setSelectedTag(null)}
              onSavedChange={handleTagUpdate}
            />
          </div>
        </div>
      )}
      {showManualModal && (
        <CreateManualTagModal
          onClose={() => setShowManualModal(false)}
          onCreated={(createdTag) => {
            setTags((currentTags) => [createdTag, ...currentTags])
            setSelectedTag(createdTag)
          }}
        />
      )}
      {showResetConfirm && (
        <div
          className="nfc-confirm-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!resetLoading) {
              setShowResetConfirm(false)
              setResetStatus(null)
            }
          }}
        >
          <section
            className="nfc-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-tag-title"
            aria-describedby="reset-tag-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="nfc-confirm-dialog__icon" aria-hidden="true">
              !
            </div>

            <p className="app-eyebrow">ACTION IRRÉVERSIBLE</p>
            <h2 id="reset-tag-title">Reset un tag NFC ?</h2>

            <p id="reset-tag-description">
              Le prochain tag physique approché sera effacé.
              Son contenu NDEF sera supprimé.
            </p>

            <p className="nfc-confirm-dialog__warning">
              L’UID matériel, les clés et les protections du tag ne seront pas
              modifiés.
            </p>

            {resetStatus && (
              <p className="app-message app-message--success">
                {resetStatus}
              </p>
            )}

            <div className="nfc-confirm-dialog__actions">
              <button
                className="app-button app-button--ghost"
                type="button"
                disabled={resetLoading}
                onClick={() => {
                  setShowResetConfirm(false)
                  setResetStatus(null)
                }}
              >
                Annuler
              </button>

              <button
                className="app-button app-button--danger"
                type="button"
                disabled={resetLoading}
                onClick={() => void handleResetPhysicalTag()}
              >
                {resetLoading ? 'Reset en cours…' : 'Oui, reset le tag'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}