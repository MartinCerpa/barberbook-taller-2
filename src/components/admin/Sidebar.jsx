const navigationItems = [
  { id: 'dashboard', label: 'Inicio' },
  { id: 'requests', label: 'Solicitudes' },
  { id: 'schedule', label: 'Agenda' },
  { id: 'clients', label: 'Clientes' },
  { id: 'settings', label: 'Configuración', mobileLabel: 'Ajustes' },
]

function NavigationIcon({ section }) {
  const icons = {
    dashboard: (
      <>
        <path d="m3.5 10.5 8.5-7 8.5 7" />
        <path d="M5.5 9.5v10h13v-10M9 19.5v-6h6v6" />
      </>
    ),
    requests: (
      <>
        <rect x="3.5" y="4" width="17" height="16" rx="2" />
        <path d="M3.5 14h4l1.7 2.5h5.6l1.7-2.5h4M8 8h8M8 11h5" />
      </>
    ),
    schedule: (
      <>
        <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
        <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
      </>
    ),
    clients: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20" />
        <path d="M15.5 5.3a3 3 0 0 1 0 5.4M17 14a5.5 5.5 0 0 1 3.5 5.1v.9" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h4M12 7h8M4 12h9M17 12h3M4 17h2M10 17h10" />
        <circle cx="10" cy="7" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
  }

  return (
    <svg
      className="admin-navigation__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {icons[section]}
    </svg>
  )
}

function Sidebar({ activeSection, mobile = false, onNavigate }) {
  return (
    <nav
      className={mobile ? 'admin-mobile-nav' : 'admin-navigation'}
      aria-label="Navegación del panel"
    >
      {navigationItems.map((item) => (
        <a
          href={`#/panel/${item.id}`}
          onClick={() => onNavigate?.(item.id)}
          aria-current={activeSection === item.id ? 'page' : undefined}
          aria-label={mobile && item.mobileLabel ? item.label : undefined}
          key={item.id}
        >
          <NavigationIcon section={item.id} />
          <strong>{mobile && item.mobileLabel ? item.mobileLabel : item.label}</strong>
        </a>
      ))}
    </nav>
  )
}

export default Sidebar
