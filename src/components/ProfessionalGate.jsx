import { useEffect, useState } from 'react'
import PublicLayout from '../layouts/PublicLayout.jsx'
import { api } from '../services/api.js'
import {
  setProfessionalSession,
  refreshProfessional,
  clearProfessional,
} from '../services/remoteState.js'

export default function ProfessionalGate({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null)
  const [email, setEmail] = useState('matiasbarber@gmail.com'),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const current = await api('/auth/session')
        setProfessionalSession(current)
        await refreshProfessional()
        if (active) {
          setUser(current)
          setError(null)
        }
      } catch (e) {
        if (e.status !== 401 && active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    const timer = setTimeout(load, 0)
    const expired = () => {
      clearProfessional()
      setUser(null)
    }
    window.addEventListener('barberbook:auth-expired', expired)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('barberbook:auth-expired', expired)
    }
  }, [])
  useEffect(() => {
    if (!user) return
    const timer = setInterval(
      () => refreshProfessional().catch((e) => setError(e.message)),
      15000,
    )
    return () => clearInterval(timer)
  }, [user])
  const login = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const current = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      setProfessionalSession(current)
      await refreshProfessional()
      setPassword('')
      setUser(current)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  if (loading)
    return (
      <PublicLayout>
        <div className="container login-shell" role="status">
          Comprobando sesión…
        </div>
      </PublicLayout>
    )
  if (user)
    return (
      <>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {typeof children === 'function' ? children(user) : children}
      </>
    )
  return (
    <PublicLayout>
      <section className="container login-shell">
        <div className="booking-card">
          <p className="eyebrow">Espacio profesional</p>
          <h1>Inicia sesión</h1>
          <p>Accede a tu jornada, solicitudes y agenda.</p>
          <form onSubmit={login}>
            <label className="profile-field">
              <span>Correo electrónico</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="profile-field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button--primary"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
          <a href="#inicio">Volver al perfil público</a>
        </div>
      </section>
    </PublicLayout>
  )
}
