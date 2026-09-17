import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import {
  deleteNfcTag,
  getNfcTags,
  updateNfcTagFavorite,
  updateNfcTagsOrder,
} from '../../services/nfcTagsRepository'
import { resetNfcTag } from '../../services/nfcService'
import type { NfcTag } from '../../types/nfc'
import CreateManualTagModal from './CreateManualTagModal'
import NfcTagDetails from './NfcTagDetails'

type SortMode = 'custom' | 'recent' | 'name'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function normaliseForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
}

function sortTags(tags: NfcTag[], mode: SortMode): NfcTag[] {
  const next = [...tags]

  const sortWithinGroup = (left: NfcTag, right: NfcTag): number => {
    if (mode === 'name') {
      return left.name.localeCompare(right.name, 'fr-FR', {
        sensitivity: 'base',
        numeric: true,
      })
    }

    if (mode === 'recent') {
      return (
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime()
      )
    }

    const orderDifference = left.display_order - right.display_order

    if (orderDifference !== 0) {
      return orderDifference
    }

    return (
      new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime()
    )
  }

  return next.sort((left, right) => {
    /* Les favoris restent toujours au-dessus des autres. */
    if (left.is_favorite !== right.is_favorite) {
      return left.is_favorite ? -1 : 1
    }

    return sortWithinGroup(left, right)
  })
}

export default function NfcTagsPage(): JSX.Element {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [tags, setTags] = useState<NfcTag[]>([])
  const [selectedTag, setSelectedTag] = useState<NfcTag | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('custom')
  const [ordering, setOrdering] = useState(false)

  const [showManualModal, setShowManualModal] = useState(false)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState<string | null>(null)

  const [favoriteUpdatingId, setFavoriteUpdatingId] = useState<string | null>(null)

  const loadTags = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      setTags(await getNfcTags())
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossible de charger les tags.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags, session?.user.id])

  const visibleTags = useMemo(() => {
    const normalisedSearch = normaliseForSearch(search.trim())

    const filtered = normalisedSearch
      ? tags.filter((tag) =>
        normaliseForSearch(tag.name).includes(normalisedSearch),
      )
      : tags

    return sortTags(filtered, sortMode)
  }, [search, sortMode, tags])

  function handleTagUpdate(updatedTag: NfcTag): void {
    setTags((currentTags) =>
      currentTags.map((tag) =>
        tag.id === updatedTag.id ? updatedTag : tag,
      ),
    )

    setSelectedTag(updatedTag)
  }

  async function handleDelete(tag: NfcTag): Promise<void> {
    const accepted = window.confirm(
      `Supprimer définitivement « ${tag.name} » ?`,
    )

    if (!accepted) {
      return
    }

    setDeletingId(tag.id)
    setError(null)

    try {
      await deleteNfcTag(tag.id)

      setTags((currentTags) =>
        currentTags.filter((item) => item.id !== tag.id),
      )

      if (selectedTag?.id === tag.id) {
        setSelectedTag(null)
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Impossible de supprimer ce tag.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function handleMoveTag(tagId: string, direction: 'up' | 'down'): Promise<void> {
    /*
     * Le déplacement manuel n'a de sens qu'en ordre personnalisé
     * et sans filtre de recherche actif.
     */
    if (sortMode !== 'custom' || search.trim()) {
      setError(
        'Pour changer l’ordre, sélectionne « Ordre personnalisé » et vide la recherche.',
      )
      return
    }

    const currentIndex = tags.findIndex((tag) => tag.id === tagId)

    if (currentIndex === -1) {
      return
    }

    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= tags.length) {
      return
    }

    const reordered = [...tags]
    const [movedTag] = reordered.splice(currentIndex, 1)

    if (!movedTag) {
      return
    }

    reordered.splice(targetIndex, 0, movedTag)

    const withNewOrder = reordered.map((tag, index) => ({
      ...tag,
      display_order: index + 1,
    }))

    /*
     * Mise à jour optimiste : l'UI bouge immédiatement.
     * En cas d'erreur Supabase, on recharge l'ordre réel depuis la base.
     */
    const previousTags = tags
    setTags(withNewOrder)
    setOrdering(true)
    setError(null)

    try {
      await updateNfcTagsOrder(withNewOrder.map((tag) => tag.id))
    } catch (orderError) {
      setTags(previousTags)
      setError(
        orderError instanceof Error
          ? orderError.message
          : 'Impossible d’enregistrer le nouvel ordre.',
      )
    } finally {
      setOrdering(false)
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

  async function handleToggleFavorite(tag: NfcTag): Promise<void> {
    setFavoriteUpdatingId(tag.id)
    setError(null)

    /* Mise à jour optimiste : l’étoile et l’ordre changent immédiatement. */
    const previousTags = tags
    const nextFavoriteState = !tag.is_favorite

    setTags((currentTags) =>
      currentTags.map((currentTag) =>
        currentTag.id === tag.id
          ? { ...currentTag, is_favorite: nextFavoriteState }
          : currentTag,
      ),
    )

    if (selectedTag?.id === tag.id) {
      setSelectedTag((currentTag) =>
        currentTag
          ? { ...currentTag, is_favorite: nextFavoriteState }
          : currentTag,
      )
    }

    try {
      const updatedTag = await updateNfcTagFavorite(tag.id, nextFavoriteState)

      setTags((currentTags) =>
        currentTags.map((currentTag) =>
          currentTag.id === updatedTag.id ? updatedTag : currentTag,
        ),
      )

      if (selectedTag?.id === updatedTag.id) {
        setSelectedTag(updatedTag)
      }
    } catch (favoriteError) {
      setTags(previousTags)

      if (selectedTag?.id === tag.id) {
        setSelectedTag(tag)
      }

      setError(
        favoriteError instanceof Error
          ? favoriteError.message
          : 'Impossible de modifier le favori.',
      )
    } finally {
      setFavoriteUpdatingId(null)
    }
  }

  return (
    <main className="app-page nfc-page">
      <header className="nfc-page__header">
        <div>
          <p className="app-eyebrow">ARNTREAL / NFC VAULT</p>
          <h1>Mon coffre</h1>
          <p className="nfc-page__subtitle">
            Tes données NDEF sauvegardées, privées et prêtes à être réécrites.
          </p>
        </div>

        <div className="nfc-page__header-actions">
          <div className="nfc-page__create-actions">
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
              Reset un tag
            </button>
          </div>

          <button
            className="app-button app-button--primary"
            type="button"
            disabled={resetLoading}
            onClick={() => navigate('/scanner')}
          >
            + Scanner
          </button>
        </div>
      </header>

      {error && <p className="app-message app-message--error">{error}</p>}

      {!loading && tags.length > 0 && (
        <section className="nfc-toolbar app-surface" aria-label="Recherche et tri">
          <label className="nfc-search">
            <span className="nfc-search__icon" aria-hidden="true">
              ⌕
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un tag…"
              aria-label="Rechercher un tag par nom"
              autoComplete="off"
            />

            {search && (
              <button
                className="nfc-search__clear"
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
              >
                ×
              </button>
            )}
          </label>

          <label className="nfc-sort">
            <span>Trier</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              aria-label="Ordre d’affichage des tags"
            >
              <option value="custom">Ordre personnalisé</option>
              <option value="recent">Plus récemment modifiés</option>
              <option value="name">Nom : A à Z</option>
            </select>
          </label>
        </section>
      )}

      {loading ? (
        <section className="nfc-state app-surface">
          <p>Chargement de ton coffre…</p>
        </section>
      ) : tags.length === 0 ? (
        <section className="nfc-empty app-surface">
          <div className="nfc-empty__symbol" aria-hidden="true">
            ⌁
          </div>

          <h2>Aucun tag sauvegardé</h2>

          <p>
            Scanne un tag NFC compatible ou crée un tag manuel pour commencer.
          </p>

          <div className="nfc-empty__actions">
            <button
              className="app-button app-button--ghost"
              type="button"
              onClick={() => setShowManualModal(true)}
            >
              Créer un tag
            </button>

            <button
              className="app-button app-button--primary"
              type="button"
              onClick={() => navigate('/scanner')}
            >
              Scanner un tag
            </button>
          </div>
        </section>
      ) : visibleTags.length === 0 ? (
        <section className="nfc-state app-surface">
          <p>Aucun tag ne correspond à « {search} ».</p>
        </section>
      ) : (
        <>
          {sortMode === 'custom' && !search.trim() && (
            <p className="nfc-order-help">
              Utilise les flèches sur une carte pour changer son ordre.
              {ordering ? ' Sauvegarde de l’ordre…' : ''}
            </p>
          )}

          <section className="nfc-tag-grid" aria-label="Tags NFC sauvegardés">
            {visibleTags.map((tag, index) => {
              const manualOrderActive = sortMode === 'custom' && !search.trim()

              return (
                <article className="nfc-tag-card app-surface" key={tag.id}>
                  <button
                    className="nfc-tag-card__open"
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                  >
                    <span className="nfc-tag-card__symbol" aria-hidden="true">
                      ⌁
                    </span>

                    <span className="nfc-tag-card__content">
                      <strong>{tag.name}</strong>
                      <small>{tag.records.length} enregistrement(s) NDEF</small>
                      <small>Mis à jour le {formatDate(tag.updated_at)}</small>
                    </span>
                  </button>

                  <div className="nfc-tag-card__side-actions">
                    <button
                      className={`nfc-tag-card__favorite${tag.is_favorite ? ' nfc-tag-card__favorite--active' : ''}`}
                      type="button"
                      disabled={favoriteUpdatingId === tag.id || ordering || deletingId === tag.id}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleToggleFavorite(tag)
                      }}
                      aria-label={
                        tag.is_favorite
                          ? `Retirer ${tag.name} des favoris`
                          : `Ajouter ${tag.name} aux favoris`
                      }
                      aria-pressed={tag.is_favorite}
                      title={tag.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      {favoriteUpdatingId === tag.id ? '…' : tag.is_favorite ? '★' : '☆'}
                    </button>

                    <button
                      className="nfc-tag-card__delete"
                      type="button"
                      disabled={deletingId === tag.id || ordering || favoriteUpdatingId === tag.id}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(tag)
                      }}
                      aria-label={`Supprimer ${tag.name}`}
                      title="Supprimer"
                    >
                      {deletingId === tag.id ? '…' : '×'}
                    </button>

                    {manualOrderActive && (
                      <div className="nfc-tag-card__order-actions">
                        <button
                          type="button"
                          disabled={ordering || index === 0 || favoriteUpdatingId === tag.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleMoveTag(tag.id, 'up')
                          }}
                          aria-label={`Monter ${tag.name}`}
                          title="Monter"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          disabled={
                            ordering ||
                            index === visibleTags.length - 1 ||
                            favoriteUpdatingId === tag.id
                          }
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleMoveTag(tag.id, 'down')
                          }}
                          aria-label={`Descendre ${tag.name}`}
                          title="Descendre"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        </>
      )}

      {selectedTag && (
        <div
          className="nfc-modal-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedTag(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="nfc-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <NfcTagDetails
              tag={selectedTag}
              isSaved
              totalTags={tags.length}
              onClose={() => setSelectedTag(null)}
              onSavedChange={handleTagUpdate}
              onMoveToPosition={async (tagId, requestedPosition) => {
                const currentIndex = tags.findIndex((tag) => tag.id === tagId)

                if (currentIndex === -1) {
                  throw new Error('Tag introuvable dans la liste.')
                }

                const targetIndex = Math.max(
                  0,
                  Math.min(requestedPosition - 1, tags.length - 1),
                )

                const reordered = [...tags]
                const [movedTag] = reordered.splice(currentIndex, 1)

                if (!movedTag) {
                  throw new Error('Impossible de déplacer ce tag.')
                }

                reordered.splice(targetIndex, 0, movedTag)

                const normalizedOrder = reordered.map((tag, index) => ({
                  ...tag,
                  display_order: index + 1,
                }))

                const previousTags = tags
                setTags(normalizedOrder)
                setSelectedTag(
                  normalizedOrder.find((tag) => tag.id === tagId) ?? null,
                )

                try {
                  await updateNfcTagsOrder(normalizedOrder.map((tag) => tag.id))
                } catch (error) {
                  setTags(previousTags)
                  setSelectedTag(previousTags.find((tag) => tag.id === tagId) ?? null)
                  throw error
                }
              }}
            />
          </div>
        </div>
      )}

      {showManualModal && (
        <CreateManualTagModal
          onClose={() => setShowManualModal(false)}
          onCreated={(createdTag) => {
            const nextOrder =
              tags.length > 0
                ? Math.max(...tags.map((tag) => tag.display_order ?? 0)) + 1
                : 1

            setTags((currentTags) => [
              {
                ...createdTag,
                display_order: createdTag.display_order ?? nextOrder,
              },
              ...currentTags,
            ])

            setSelectedTag({
              ...createdTag,
              display_order: createdTag.display_order ?? nextOrder,
            })
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
              Le prochain tag physique approché sera effacé. Son contenu NDEF
              sera supprimé.
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