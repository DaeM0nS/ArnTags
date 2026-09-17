import type { ArntrealProfileData } from '../../types/nfc'

interface Props {
  profile: ArntrealProfileData
  onClick: (profile: ArntrealProfileData) => void
  onRefresh?: (profile: ArntrealProfileData) => void
  refreshing?: boolean
}

export function ArntrealProfileCard({
  profile,
  onClick,
  onRefresh,
  refreshing,
}: Props) {
  const {
    owner,
    clothingName,
    clothingImageUrl,
    clothingLevel,
    clothingXp,
    sourceUrl,
  } = profile

  const initials = owner
    ? owner
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const progress =
    clothingXp.current !== null && clothingXp.required !== null && clothingXp.required > 0
      ? (clothingXp.current / clothingXp.required) * 100
      : 0

  return (
    <article
      className="arntreal-profile-card app-surface"
      role="button"
      tabIndex={0}
      onClick={() => onClick(profile)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick(profile)
        }
      }}
      aria-label={`Voir le profil Arntreal : ${clothingName ?? 'Vêtement connecté'}`}
    >
      <header className="arntreal-profile-card__header">
        <div className="arntreal-profile-card__owner">
          {clothingImageUrl ? (
            <img
              src={clothingImageUrl}
              alt={clothingName ?? 'Vêtement Arntreal'}
              className="arntreal-profile-card__image"
            />
          ) : (
            <div className="arntreal-profile-card__placeholder">
              <span className="arntreal-profile-card__initials">{initials}</span>
            </div>
          )}

          <div className="arntreal-profile-card__meta">
            <p className="arntreal-profile-card__eyebrow">ARNTREAL</p>
            <h3 className="arntreal-profile-card__title">
              {clothingName ?? 'Vêtement connecté'}
            </h3>
            {owner && (
              <p className="arntreal-profile-card__owner-name">{owner}</p>
            )}
            {sourceUrl && (
              <a
                className="arntreal-profile-card__link"
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Voir le profil
              </a>
            )}
          </div>
        </div>

        <div className="arntreal-profile-card__actions">
          {onRefresh && (
            <button
              type="button"
              className="arntreal-profile-card__refresh"
              onClick={(event) => {
                event.stopPropagation()
                onRefresh(profile)
              }}
              disabled={refreshing}
              aria-label="Actualiser le profil Arntreal"
            >
              {refreshing ? '…' : '⟳'}
            </button>
          )}

          <div className="arntreal-profile-card__level">
            <span className="arntreal-profile-card__level-label">Niveau</span>
            <strong className="arntreal-profile-card__level-value">
              {clothingLevel ?? '—'}
            </strong>
          </div>
        </div>
      </header>

      <div className="arntreal-profile-card__xp">
        <div className="arntreal-profile-card__xp-labels">
          <span className="arntreal-profile-card__xp-label">XP niveau</span>
          <span className="arntreal-profile-card__xp-value">
            {clothingXp.current !== null && clothingXp.required !== null
              ? `${clothingXp.current.toLocaleString('fr-FR')} / ${clothingXp.required.toLocaleString('fr-FR')}`
              : '—'}
          </span>
        </div>

        <div className="arntreal-profile-card__bar">
          <div
            className="arntreal-profile-card__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="arntreal-profile-card__xp-total">
          <span className="arntreal-profile-card__xp-total-label">XP totale</span>
          <strong className="arntreal-profile-card__xp-total-value">
            {clothingXp.total !== null
              ? clothingXp.total.toLocaleString('fr-FR')
              : '—'}
          </strong>
        </div>
      </div>

      <div className="arntreal-profile-card__footer">
        <span
          className={`arntreal-profile-card__status ${
            profile.connected ? 'arntreal-profile-card__status--active' : ''
          }`}
        >
          {profile.connected ? 'Actif' : 'Inactif'}
        </span>

        <span className="arntreal-profile-card__hint">
          Appuie pour ouvrir les détails
        </span>
      </div>
    </article>
  )
}