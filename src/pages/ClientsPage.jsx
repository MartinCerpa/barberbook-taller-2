import { useEffect, useMemo, useState } from 'react'
import ClientCard from '../components/admin/ClientCard'
import { getCustomersSnapshot, setClientTrustStatus, subscribeCustomers } from '../services/customerService'

const isNewThisMonth = (client) => {
  const referenceDate = new Date()
  const createdAt = new Date(`${client.createdAt}T12:00:00`)

  return (
    createdAt.getFullYear() === referenceDate.getFullYear() &&
    createdAt.getMonth() === referenceDate.getMonth()
  )
}

const clientFilters = [
  { id: 'all', label: 'Total clientes', matches: () => true },
  {
    id: 'recurring',
    label: 'Recurrentes',
    matches: (client) => client.completedAppointments > 1,
  },
  {
    id: 'new-this-month',
    label: 'Nuevos este mes',
    matches: isNewThisMonth,
  },
]

const clientSortOptions = [
  { id: 'recent-activity', label: 'Actividad reciente' },
  { id: 'most-frequent', label: 'Más frecuentes' },
  { id: 'newest', label: 'Nuevos primero' },
  { id: 'name-asc', label: 'Nombre A-Z' },
  { id: 'name-desc', label: 'Nombre Z-A' },
]

const nameCollator = new Intl.Collator('es-CL', { sensitivity: 'base' })
const compareNames = (first, second) => nameCollator.compare(first.name, second.name)
const compareDatesDescending = (firstDate, secondDate) =>
  (secondDate ?? '').localeCompare(firstDate ?? '')

const compareRecentActivity = (first, second) => {
  if (first.nextAppointment && second.nextAppointment) {
    const firstAppointment = `${first.nextAppointment.date}T${first.nextAppointment.time}`
    const secondAppointment = `${second.nextAppointment.date}T${second.nextAppointment.time}`
    const appointmentDifference = firstAppointment.localeCompare(secondAppointment)

    if (appointmentDifference) return appointmentDifference
  } else if (first.nextAppointment) {
    return -1
  } else if (second.nextAppointment) {
    return 1
  }

  return compareDatesDescending(first.lastVisit, second.lastVisit) || compareNames(first, second)
}

const clientSorters = {
  'recent-activity': compareRecentActivity,
  'most-frequent': (first, second) =>
    second.completedAppointments - first.completedAppointments ||
    compareDatesDescending(first.lastVisit, second.lastVisit) ||
    compareNames(first, second),
  newest: (first, second) =>
    compareDatesDescending(first.createdAt, second.createdAt) || compareNames(first, second),
  'name-asc': compareNames,
  'name-desc': (first, second) => compareNames(second, first),
}

const normalizeText = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .trim()

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function ClientsPage() {
  const [clients, setClients] = useState(getCustomersSnapshot)
  const [feedback, setFeedback] = useState(null)
  useEffect(() => subscribeCustomers(() => setClients(getCustomersSnapshot())), [])
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('recent-activity')
  const [expandedClientId, setExpandedClientId] = useState(null)

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        clientFilters.map((filter) => [
          filter.id,
          clients.filter(filter.matches).length,
        ]),
      ),
    [clients],
  )

  const visibleClients = useMemo(() => {
    const selectedFilter = clientFilters.find(
      (filter) => filter.id === activeFilter,
    )
    const clientsInFilter = clients.filter(selectedFilter.matches)
    const normalizedQuery = normalizeText(query)
    const phoneQuery = query.replace(/\D/g, '')

    const matchingClients = normalizedQuery
      ? clientsInFilter.filter(
          (client) =>
            normalizeText(client.name).includes(normalizedQuery) ||
            (phoneQuery.length > 0 &&
              client.phone.replace(/\D/g, '').includes(phoneQuery)),
        )
      : clientsInFilter

    return [...matchingClients].sort(clientSorters[sortOrder])
  }, [activeFilter, query, clients, sortOrder])

  const clearSearch = () => {
    setQuery('')
    setExpandedClientId(null)
  }

  return (
    <div className="admin-page clients-page">
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Relaciones con clientes</p>
          <h1>Clientes</h1>
          <p>Consulta visitas, preferencias y próximas atenciones.</p>
        </div>
      </header>

      <div className="clients-filter-group">
        <span className="clients-control-label">Filtrar</span>
        <section className="clients-summary" aria-label="Filtrar clientes">
          {clientFilters.map((filter) => (
            <button
              type="button"
              aria-pressed={activeFilter === filter.id}
              onClick={() => {
                setActiveFilter(filter.id)
                setExpandedClientId(null)
              }}
              key={filter.id}
            >
              <strong>{filterCounts[filter.id]}</strong>
              <span>{filter.label}</span>
            </button>
          ))}
        </section>
      </div>

      <div className="clients-toolbar">
        <label className="clients-search">
          <span className="sr-only">Buscar clientes por nombre o teléfono</span>
          <SearchIcon />
          <input
            type="search"
            value={query}
            placeholder="Buscar por nombre o teléfono"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" onClick={clearSearch} aria-label="Limpiar búsqueda">
              ×
            </button>
          )}
        </label>
        <div className="clients-toolbar__secondary">
          <label className="clients-sort">
            <span>Ordenar por</span>
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value)
                setExpandedClientId(null)
              }}
            >
              {clientSortOptions.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <p aria-live="polite">
            {visibleClients.length}{' '}
            {visibleClients.length === 1 ? 'cliente' : 'clientes'}
          </p>
        </div>
      </div>

      {feedback && <p className="clients-feedback" role="status">{feedback}</p>}

      {visibleClients.length > 0 ? (
        <section className="clients-list" aria-label="Listado de clientes">
          {visibleClients.map((client) => (
            <ClientCard
              client={client}
              isExpanded={expandedClientId === client.id}
              onRestoreTrust={async () => {
                const result = await setClientTrustStatus(client.id, 'normal')
                setFeedback(result.success ? `${client.name} vuelve a estado normal. Su historial se conserva.`
                  : 'No pudimos guardar el cambio en este navegador.')
              }}
              onToggle={() =>
                setExpandedClientId((currentId) =>
                  currentId === client.id ? null : client.id,
                )
              }
              key={client.id}
            />
          ))}
        </section>
      ) : (
        <div className="clients-empty" role="status">
          <span aria-hidden="true">BB</span>
          <strong>No encontramos clientes con esa búsqueda.</strong>
          <p>Prueba con otro nombre o con algunos dígitos del teléfono.</p>
          <button type="button" onClick={clearSearch}>
            Limpiar búsqueda
          </button>
        </div>
      )}
    </div>
  )
}

export default ClientsPage
