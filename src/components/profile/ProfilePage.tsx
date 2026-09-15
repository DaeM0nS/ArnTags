import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabaseClient'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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