import { useEffect, useState } from 'react';
import Brand from './Brand';
import ThemeToggle from './ThemeToggle';
import { iniciarSesion, obtenerSesion } from '../services/professionalApi';

export default function ProfessionalGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    obtenerSesion(controller.signal).then(setUser).catch((cause) => {
      if (!controller.signal.aborted && cause.status !== 401) setError(cause.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function login(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { setUser(await iniciarSesion(email, password)); }
    catch (cause) { setError(cause.message); }
    finally { setPassword(''); setBusy(false); }
  }

  // Identidad y CSRF viven solo en memoria. La sesión HttpOnly la administra el navegador.
  if (user) return children(user, setUser);
  return <div className="site-shell">
    <header className="site-header"><div className="container site-header__content"><Brand /><ThemeToggle /></div></header>
    <main className="container login-shell">
      {loading ? <p role="status">Comprobando sesión…</p> : <section className="booking-card">
        <p className="eyebrow">Espacio profesional</p><h1>Inicia sesión</h1><p>Accede a tu jornada, solicitudes y agenda.</p>
        <form onSubmit={login}>
          <label className="profile-field"><span>Correo electrónico</span><input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="profile-field"><span>Contraseña</span><input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        <a href="#inicio">Volver al perfil público</a>
      </section>}
    </main>
  </div>;
}
