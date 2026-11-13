import DashboardCard from '../components/admin/DashboardCard';
import { adaptarReserva, etiquetaFecha, resumirJornada } from '../utils/panelData';

export default function AdminDashboardPage({ pending, confirmed, now }) {
  const summary = resumirJornada(pending, confirmed, now);
  const next = summary.next && adaptarReserva(summary.next);
  return <div className="admin-page dashboard-page">
    <header className="admin-page__heading"><div><p className="eyebrow">Resumen de hoy</p><h1>Tu jornada</h1></div></header>
    <section className="dashboard-grid" aria-label="Indicadores de hoy">
      <DashboardCard label="Solicitudes" value={summary.pendingCount} detail="solicitudes por revisar" tone="accent" href="#/panel/requests" />
      <DashboardCard label="Próxima atención" value={next?.time ?? '—'} tone="dark" href="#/panel/schedule"
        detail={next ? `${next.dateId === summary.today ? 'Hoy' : etiquetaFecha(next.dateId)} · ${next.customerName} · ${next.service}` : 'Sin reservas confirmadas próximas'} />
      <DashboardCard label="Reservas del día" value={summary.confirmedToday} detail="reservas confirmadas para hoy" />
      <DashboardCard label="Ingresos realizados" value="—" detail="No disponible: todavía no se registran resultados ni ingresos de atenciones." />
    </section>
    <section className="dashboard-focus"><div><p className="eyebrow">Agenda de hoy</p>
      <h2>{summary.confirmedToday} {summary.confirmedToday === 1 ? 'reserva confirmada' : 'reservas confirmadas'}</h2>
      <p>Horarios de America/Santiago. Resultados de atenciones no disponibles.</p></div>
      <div className="dashboard-focus__aside"><a href="#/panel/schedule">Abrir agenda <span aria-hidden="true">→</span></a></div>
    </section>
  </div>;
}
