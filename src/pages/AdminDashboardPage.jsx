import DashboardCard from '../components/admin/DashboardCard'
import { formatCurrency } from '../utils/formatters'

const shortDateFormatter = new Intl.DateTimeFormat('es-CL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const getNextAppointmentDetail = (appointment, todayDateId) => {
  if (!appointment) {
    return 'Sin reservas confirmadas próximas'
  }

  const dateLabel = appointment.dateId === todayDateId
    ? 'Hoy'
    : shortDateFormatter
      .format(new Date(`${appointment.dateId}T12:00:00`))
      .replace(/^./, (letter) => letter.toLocaleUpperCase('es-CL'))

  return `${dateLabel} · ${appointment.customerName} · ${appointment.service}`
}

const formatAttentionCount = (value) =>
  `${value} ${value === 1 ? 'atención' : 'atenciones'}`

function AdminDashboardPage({ dashboardSummary }) {
  const {
    dailyOperations,
    financial,
    nextAppointment,
    pendingRequests,
    todayDateId,
  } = dashboardSummary

  return (
    <div className="admin-page dashboard-page">
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Resumen de hoy</p>
          <h1>Tu jornada</h1>
        </div>
      </header>

      <section className="dashboard-grid" aria-label="Indicadores de hoy">
        <DashboardCard
          label="Solicitudes"
          value={pendingRequests}
          detail={pendingRequests === 1 ? 'solicitud por revisar' : 'solicitudes por revisar'}
          tone="accent"
          href="#/panel/requests"
        />
        <DashboardCard
          label="Próxima atención"
          value={nextAppointment?.time ?? '—'}
          detail={getNextAppointmentDetail(nextAppointment, todayDateId)}
          tone="dark"
          href="#/panel/schedule"
        />
        <DashboardCard
          label="Clientes del día"
          value={dailyOperations.clientsToday}
          detail={dailyOperations.clientsToday === 1
            ? 'cliente con atención hoy'
            : 'clientes con atención hoy'}
        />
        <DashboardCard
          label="Ingresos realizados"
          value={formatCurrency(financial.realizedIncome)}
          detail={financial.completedServices === 1
            ? '1 servicio completado hoy'
            : `${financial.completedServices} servicios completados hoy`}
          href="#/panel/finances"
        />
      </section>

      <section className="dashboard-focus">
        <div>
          <p className="eyebrow">Agenda de hoy</p>
          <h2>{formatAttentionCount(dailyOperations.totalAppointments)}</h2>
          <p>
            {dailyOperations.completedAppointments} completadas ·{' '}
            {dailyOperations.confirmedAppointments} por cerrar
          </p>
        </div>
        <div className="dashboard-focus__aside">
          <a href="#/panel/schedule">Abrir agenda <span aria-hidden="true">→</span></a>
        </div>
      </section>
    </div>
  )
}

export default AdminDashboardPage
