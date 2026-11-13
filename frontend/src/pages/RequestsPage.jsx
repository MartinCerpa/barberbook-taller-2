import { useState } from 'react';
import RequestCard from '../components/admin/RequestCard';
import { adaptarReserva } from '../utils/panelData';

export default function RequestsPage({ pending, rejected, busy, onStatusChange }) {
  const [view, setView] = useState('pending');
  const rows = view === 'pending' ? pending : rejected;
  return <div className="admin-page requests-page">
    <header className="admin-page__heading"><div><p className="eyebrow">Gestión de reservas</p><h1>Solicitudes</h1></div>
      <div className="requests-page__pending-count"><strong>{pending.length}</strong><span>por revisar</span></div></header>
    <div className="request-view-switcher" role="group" aria-label="Vistas de solicitudes">
      <button type="button" aria-pressed={view === 'pending'} onClick={() => setView('pending')}><span>Solicitudes pendientes</span><strong>{pending.length}</strong></button>
      <button type="button" aria-pressed={view === 'rejected'} onClick={() => setView('rejected')}><span>Rechazadas</span><strong>{rejected.length}</strong></button>
    </div>
    <div className="request-list-heading"><div><p className="eyebrow">{view === 'pending' ? 'Por revisar' : 'Registro de decisiones'}</p><h2>{view === 'pending' ? 'Solicitudes recibidas' : 'Solicitudes rechazadas'}</h2></div>
      {view === 'pending' && <p>Orden de recepción. Las solicitudes que compiten por una hora respetan FIFO.</p>}</div>
    {rows.length ? <div className="requests-grid">{rows.map((row) => <RequestCard key={row.id} request={adaptarReserva(row)} onStatusChange={onStatusChange} busy={busy} />)}</div>
      : <p className="panel-empty" role="status">{view === 'pending' ? 'No tienes solicitudes pendientes.' : 'No hay solicitudes rechazadas.'}</p>}
  </div>;
}
