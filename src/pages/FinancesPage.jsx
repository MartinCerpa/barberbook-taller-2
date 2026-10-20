import { useState } from 'react'
import {
  FINANCIAL_PERIODS,
  getFinancialSummary,
} from '../services/financialService'
import { formatCurrency } from '../utils/formatters'

const formatCount = (value, singular, plural) =>
  `${value} ${value === 1 ? singular : plural}`

function FinancesPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const summary = getFinancialSummary(selectedPeriod)
  const hasCompletedServices = summary.completedServices > 0

  return (
    <div className="admin-page finances-page">
      <a className="finance-back-link" href="#/panel/dashboard">
        <span aria-hidden="true">←</span>
        Volver a Inicio
      </a>

      <header className="finance-heading">
        <p className="eyebrow">Finanzas beta</p>
        <h1>Ingresos</h1>
        <p>
          Revisa el rendimiento real de las atenciones que ya completaste.
        </p>
      </header>

      <div
        className="finance-periods"
        role="group"
        aria-label="Período del resumen financiero"
      >
        {FINANCIAL_PERIODS.map((period) => (
          <button
            type="button"
            aria-pressed={selectedPeriod === period.id}
            onClick={() => setSelectedPeriod(period.id)}
            key={period.id}
          >
            {period.label}
          </button>
        ))}
      </div>

      <section
        className="finance-revenue"
        aria-labelledby="finance-revenue-title"
      >
        <div>
          <span id="finance-revenue-title">Ingresos realizados</span>
          <strong>{formatCurrency(summary.realizedIncome)}</strong>
        </div>
        <p>{summary.period.label}</p>
      </section>

      {!hasCompletedServices && (
        <p className="finance-empty-note" role="status">
          Tus ingresos aparecerán aquí cuando marques atenciones como
          completadas en Agenda.
        </p>
      )}

      <section className="finance-metrics" aria-label="Resumen del período">
        <article>
          <span>Servicios completados</span>
          <strong>{summary.completedServices}</strong>
        </article>
        <article>
          <span>Reservas confirmadas</span>
          <strong>{summary.confirmedBookings}</strong>
        </article>
        <article>
          <span>Ticket promedio</span>
          <strong>{formatCurrency(summary.averageTicket)}</strong>
        </article>
        <article>
          <span>Clientes atendidos</span>
          <strong>{summary.attendedClients}</strong>
        </article>
      </section>

      <section className="finance-top-service" aria-labelledby="finance-top-service-title">
        <div>
          <span id="finance-top-service-title">Servicio más realizado</span>
          <strong>{summary.topService?.name ?? 'Aún sin datos'}</strong>
        </div>
        <p>
          {summary.topService
            ? formatCount(summary.topService.count, 'atención', 'atenciones')
            : 'Se mostrará al completar tu primera atención.'}
        </p>
      </section>

      <p className="finance-disclaimer">
        Este resumen considera únicamente atenciones completadas y sus valores
        registrados.
      </p>
    </div>
  )
}

export default FinancesPage
