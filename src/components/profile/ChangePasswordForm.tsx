import { useState, type FormEvent } from 'react'
import { supabase } from '../../supabaseClient'

type PasswordValidation = {
  valid: boolean
  message: string
}

function validatePassword(password: string): PasswordValidation {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins 8 caractères.',
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Ajoute au moins une lettre minuscule.',
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Ajoute au moins une lettre majuscule.',
    }
  }

  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: 'Ajoute au moins un chiffre.',
    }
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Ajoute au moins un caractère spécial.',
    }
  }

  return {
    valid: true,
    message: '',
  }
}

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setMessage(null)

    const passwordValidation = validatePassword(newPassword)

    if (!passwordValidation.valid) {
      setError(passwordValidation.message)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }

    if (currentPassword === newPassword) {
      setError(
        'Le nouveau mot de passe doit être différent du mot de passe actuel.'
      )
      return
    }

    setIsSaving(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user?.email) {
        throw new Error(
          'Impossible de retrouver l’adresse email du compte connecté.'
        )
      }

      /*
       * Vérifie le mot de passe actuel.
       *
       * Cela protège même si ton GoTrue self-hosted n'a pas activé
       * l'option "current password required".
       *
       * Important : cette opération peut rafraîchir/remplacer la session.
       */
      const { error: currentPasswordError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        })

      if (currentPasswordError) {
        throw new Error('Le mot de passe actuel est incorrect.')
      }

      /*
       * Met à jour le mot de passe du compte actuellement connecté.
       * Ne jamais utiliser auth.admin.updateUserById dans l'application :
       * cette API exige une service_role_key, qui ne doit jamais être
       * exposée dans un bundle React / iOS.
       */
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        if (
          updateError.message.toLowerCase().includes('reauthentication') ||
          updateError.message.toLowerCase().includes('nonce')
        ) {
          throw new Error(
            'Une réauthentification est requise. Déconnecte-toi puis reconnecte-toi avant de modifier ton mot de passe.'
          )
        }

        throw updateError
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setMessage('Mot de passe modifié avec succès.')
    } catch (submitError) {
      console.error('Erreur changement mot de passe :', submitError)

      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Impossible de modifier le mot de passe. Réessaie.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          ⚠️ {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✅ {message}
        </div>
      )}

      <div>
        <label
          htmlFor="current-password"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Mot de passe actuel
        </label>

        <div className="relative">
          <input
            id="current-password"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={isSaving}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-24 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={() => setShowCurrentPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            {showCurrentPassword ? 'Masquer' : 'Voir'}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="new-password"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Nouveau mot de passe
        </label>

        <div className="relative">
          <input
            id="new-password"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            disabled={isSaving}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-24 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={() => setShowNewPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            {showNewPassword ? 'Masquer' : 'Voir'}
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Minimum 8 caractères, avec une majuscule, une minuscule, un chiffre
          et un caractère spécial.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Confirmer le nouveau mot de passe
        </label>

        <div className="relative">
          <input
            id="confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            disabled={isSaving}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-24 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />

          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            {showConfirmPassword ? 'Masquer' : 'Voir'}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? 'Modification en cours...' : 'Modifier le mot de passe'}
      </button>
    </form>
  )
}