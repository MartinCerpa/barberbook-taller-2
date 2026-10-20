import { useEffect, useMemo, useState } from 'react'
import RequestCard from '../components/admin/RequestCard'
import RequestHistoryCard from '../components/admin/RequestHistoryCard'
import { requestContext } from '../data/requests'
import { getCurrentPendingRequests } from '../services/bookingInsightsService.js'
import {
  formatRequestDateId,
  getRequestDateId,
  groupRequestsByDate,
  isHistoricalRequest,
  isPastRequest,
  sortHistoryRequests,
  sortUpcomingRequests,
  splitDateLabel,
} from '../utils/requestUtils'

const historyFilters = [
  { id: 'all', label: 'Todas' },
  { id: 'past', label: 'Pasadas' },
  { id: 'cancelled', label: 'Canceladas' },
  { id: 'completed', label: 'Completadas' },
  { id: 'no_show', label: 'No asistió' },
]

function RequestsPage({
  requests,
  initialFocus,
  onFocusConsumed,
  feedback,
  onUndo,
  onStatusChange,
  onDurationChange,
  onTimeChange,
}) {
  const [activeView, setActiveView] = useState('upcoming')
  const [activeFilter, setActiveFilter] = useState('all')
  const [focusedSlot, setFocusedSlot] = useState(initialFocus ?? null)

  useEffect(() => {
    if (initialFocus) {
      onFocusConsumed()
    }
  }, [initialFocus, onFocusConsumed])

  const upcomingRequests = useMemo(
    () => getCurrentPendingRequests(requests, requestContext),
    [requests],
  )

  const rejectedRequests = useMemo(
    () =>
      sortHistoryRequests(
        requests.filter((request) => request.status === 'rejected'),
      ),
    [requests],
  )

  const historyRequests = useMemo(
    () =>
      sortHistoryRequests(
        requests.filter(
          (request) =>
            request.status !== 'rejected' &&
            isHistoricalRequest(request, requestContext),
        ),
      ),
    [requests],
  )

  const activeRequests =
    activeView === 'upcoming'
      ? upcomingRequests
      : activeView === 'rejected'
        ? rejectedRequests
        : historyRequests
  const filters = activeView === 'history' ? historyFilters : []
  const visibleRequests = focusedSlot
    ? sortUpcomingRequests(
        requests.filter((request) =>
          getRequestDateId(request, focusedSlot.referenceDateId, requestContext) === focusedSlot.dateId &&
          request.time === focusedSlot.time,
        ),
      ).map((request) => ({
        ...request,
        date: formatRequestDateId(focusedSlot.dateId),
      }))
    : activeRequests.filter((request) => {
        if (activeFilter === 'all') {
          return true
        }

        if (activeFilter === 'past') {
          return isPastRequest(request, requestContext)
        }

        return request.status === activeFilter
      })
  const groupedRequests = groupRequestsByDate(visibleRequests)
  const pendingCount = upcomingRequests.length
  const viewHeading = {
    upcoming: {
      eyebrow: 'Por resolver',
      title: 'Solicitudes pendientes',
    },
    rejected: {
      eyebrow: 'Sin acciones pendientes',
      title: 'Solicitudes rechazadas',
    },
    history: {
      eyebrow: 'Registro reciente',
      title: 'Historial de solicitudes',
    },
  }[activeView]

  const getCount = (filterId) => {
    if (filterId === 'all') {
      return activeRequests.length
    }

    if (filterId === 'past') {
      return activeRequests.filter((request) =>
        isPastRequest(request, requestContext),
      ).length
    }

    return activeRequests.filter((request) => request.status === filterId).length
  }

  const selectView = (view) => {
    setFocusedSlot(null)
    setActiveView(view)
    setActiveFilter('all')
  }

  return (
    <div className="admin-page requests-page">
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Gestión de reservas</p>
          <h1>Solicitudes</h1>
        </div>
        <div className="requests-page__pending-count">
          <strong>{pendingCount}</strong>
          <span>por revisar</span>
        </div>
      </header>

      {focusedSlot && (
        <div className="request-slot-focus" role="status">
          <div>
            <span>
              Desde Agenda · {visibleRequests.length} {visibleRequests.length === 1 ? 'solicitud' : 'solicitudes'}
            </span>
            <strong>{formatRequestDateId(focusedSlot.dateId)} · {focusedSlot.time}</strong>
          </div>
          <button type="button" onClick={() => setFocusedSlot(null)}>
            Ver todas las solicitudes
          </button>
        </div>
      )}

      <div
        className="request-view-switcher"
        role="tablist"
        aria-label="Vistas de solicitudes"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'upcoming'}
          onClick={() => selectView('upcoming')}
        >
          <span>Solicitudes próximas</span>
          <strong>{upcomingRequests.length}</strong>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'rejected'}
          onClick={() => selectView('rejected')}
        >
          <span>Rechazadas</span>
          <strong>{rejectedRequests.length}</strong>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'history'}
          onClick={() => selectView('history')}
        >
          <span>Historial</span>
          <strong>{historyRequests.length}</strong>
        </button>
      </div>

      <div className="request-list-heading">
        <div>
          <p className="eyebrow">{viewHeading.eyebrow}</p>
          <h2>{focusedSlot ? 'Solicitudes de este horario' : viewHeading.title}</h2>
        </div>
        {activeView === 'upcoming' && !focusedSlot && (
          <p>
            Según la fecha y hora actual de este dispositivo.
          </p>
        )}
      </div>

      {!focusedSlot && filters.length > 0 && (
        <div
          className="request-filters"
          role="group"
          aria-label="Filtrar solicitudes"
        >
          {filters.map((filter) => (
            <button
              type="button"
              aria-pressed={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
              key={filter.id}
            >
              {filter.label}
              <span>{getCount(filter.id)}</span>
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <div
          className={`request-feedback${
            feedback.isClosing ? ' request-feedback--closing' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <span>{feedback.message}</span>
          {feedback.undoToken && <button type="button" onClick={onUndo}>
            Deshacer
          </button>}
        </div>
      )}

      {visibleRequests.length > 0 ? (
        <div className="request-groups" role="tabpanel">
          {focusedSlot || activeView === 'upcoming'
            ? groupedRequests.map((group) => {
                const { dayLabel, dateLabel } = splitDateLabel(group.date)

                return (
                  <section className="request-day-group" key={group.date}>
                    <header className="request-day-group__heading">
                      <h3>{dayLabel}</h3>
                      <span>{dateLabel}</span>
                    </header>
                    <div
                      className="requests-grid"
                      aria-label={`Solicitudes para ${group.date}`}
                    >
                      {group.requests.map((request) =>
                        focusedSlot && request.status !== 'confirmed' && isHistoricalRequest(request, requestContext) ? (
                          <RequestHistoryCard
                            request={request}
                            context={requestContext}
                            key={request.id}
                          />
                        ) : (
                        <RequestCard
                          request={request}
                          onStatusChange={onStatusChange}
                          onDurationChange={onDurationChange}
                          onTimeChange={onTimeChange}
                          key={request.id}
                        />
                      ))}
                    </div>
                  </section>
                )
              })
            : (
                <section
                  className="request-history-grid"
                  aria-label={
                    activeView === 'rejected'
                      ? 'Solicitudes rechazadas'
                      : 'Historial de solicitudes'
                  }
                >
                  {visibleRequests.map((request) => (
                    <RequestHistoryCard
                      request={request}
                      context={requestContext}
                      key={request.id}
                    />
                  ))}
                </section>
              )}
        </div>
      ) : (
        <div className="requests-empty" role="status">
          <strong>{focusedSlot ? 'No hay solicitudes para este horario' : 'No hay solicitudes en esta categoría'}</strong>
          <p>{focusedSlot ? 'Puedes volver a todas las solicitudes o revisar otro horario en Agenda.' : 'Puedes revisar otra vista o cambiar el filtro seleccionado.'}</p>
        </div>
      )}
    </div>
  )
}

export default RequestsPage
