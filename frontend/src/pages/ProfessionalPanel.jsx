import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import AdminDashboardPage from './AdminDashboardPage';
import RequestsPage from './RequestsPage';
import SchedulePage from './SchedulePage';
import SettingsPage from './SettingsPage';
import { cambiarEstado, cerrarSesion, guardarAprobacion, obtenerReservas, obtenerSesion } from '../services/professionalApi';

export default function ProfessionalPanel({ section, professional, onSessionChange }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const load = useCallback(async (signal) => {
    const [pending, confirmed, rejected, session] = await Promise.all([
      obtenerReservas('pending', signal), obtenerReservas('confirmed', signal),
      obtenerReservas('rejected', signal), obtenerSesion(signal),
    ]);
    if (!signal?.aborted) {
      setSnapshot({ pending, confirmed, rejected });
      onSessionChange(session);
      setNow(new Date());
    }
  }, [onSessionChange]);

  const reportError = useCallback((cause) => {
    if (cause.status === 401) onSessionChange(null);
    else setError(cause.message);
  }, [onSessionChange]);
  const expireSession = useCallback(() => onSessionChange(null), [onSessionChange]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => load(controller.signal).catch((cause) => {
      if (!controller.signal.aborted) { setSnapshot(null); reportError(cause); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    refresh();
    window.addEventListener('focus', refresh);
    const clock = window.setInterval(() => setNow(new Date()), 60000);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); window.clearInterval(clock); };
  }, [load, reportError, section]);

  async function perform(action, message) {
    if (busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await action();
      await load();
      setFeedback(message);
    } catch (cause) { reportError(cause); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (busy) return;
    setBusy(true); setError('');
    try { await cerrarSesion(professional.csrfToken); onSessionChange(null); }
    catch (cause) { reportError(cause); setBusy(false); }
  }

  async function retry() {
    setLoading(true); setError('');
    try { await load(); } catch (cause) { reportError(cause); }
    finally { setLoading(false); }
  }

  return <AdminLayout activeSection={section} professional={professional} onLogout={logout} busy={busy}>
    {error && <div className="panel-message" role="alert"><p>{error}</p><button type="button" onClick={retry} disabled={busy || loading}>Actualizar información</button></div>}
    {feedback && <p className="request-feedback" role="status">{feedback}</p>}
    {loading && <p role="status">Cargando información del panel…</p>}
    {!loading && snapshot && <div key={section} aria-busy={busy}>
      {section === 'dashboard' && <AdminDashboardPage {...snapshot} now={now} />}
      {section === 'requests' && <RequestsPage {...snapshot} busy={busy} onStatusChange={(id, status) => perform(
        () => cambiarEstado(id, status, professional.csrfToken), status === 'confirmed' ? 'Reserva confirmada e incorporada a Agenda.' : 'Solicitud rechazada.',
      )} />}
      {section === 'schedule' && <SchedulePage {...snapshot} now={now} onSessionExpired={expireSession} />}
      {section === 'settings' && <SettingsPage professional={professional} busy={busy} onSaved={load} onSessionExpired={expireSession} onApprovalChange={(value) => perform(
        () => guardarAprobacion(value, professional.csrfToken), 'Modo de aprobación guardado. Las solicitudes anteriores mantienen su estado.',
      )} />}
    </div>}
  </AdminLayout>;
}
