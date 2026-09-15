import { useState, type FormEvent, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../supabaseClient'

export default function UpdatePasswordPage(): JSX.Element {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'error' | 'success'>('error')

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      setMessageType('error')
      setMessage('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setMessageType('success')
      setMessage('Mot de passe mis à jour. Redirection vers la connexion…')
      window.setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Impossible de modifier le mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="update-password-title">
        <div className="auth-card__symbol" aria-hidden="true">⌁</div>
        <p className="app-eyebrow">ARNTAGS / ACCOUNT</p>
        <h1 id="update-password-title">Nouveau mot de passe</h1>
        <p className="auth-card__subtitle">Choisis un nouveau mot de passe pour ton compte.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="app-field">
            <span>Nouveau mot de passe</span>
            <input type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label className="app-field">
            <span>Confirmer le mot de passe</span>
            <input type="password" minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>
          {message && <p className={`app-message app-message--${messageType}`}>{message}</p>}
          <button className="app-button app-button--primary" type="submit" disabled={loading}>
            {loading ? 'Mise à jour…' : 'Mettre à jour'}
          </button>
        </form>
      </section>
    </main>
  )
}