import { Fragment } from 'react'
import Brand from '../components/Brand'
import Sidebar from '../components/admin/Sidebar'
import ThemeToggle from '../components/ThemeToggle'

const sectionLabels = {
  dashboard: 'Inicio',
  requests: 'Solicitudes',
  schedule: 'Agenda',
  clients: 'Clientes',
  finances: 'Finanzas',
  services: 'Servicios',
  settings: 'Configuración',
}

function AdminLayout({ activeSection, children, navigationKey, onNavigate }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <Brand
            href="#/panel/dashboard"
            label="BarberBook, ir al inicio del panel"
          />
          <p className="admin-sidebar__caption">Espacio profesional</p>
        </div>

        <Sidebar activeSection={activeSection} onNavigate={onNavigate} />

        <div className="admin-sidebar__footer">
          <span className="admin-avatar" aria-hidden="true">M</span>
          <div>
            <strong>Matías</strong>
            <span>Profesional independiente</span>
          </div>
          <a href="#inicio">Ver perfil público</a>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-header">
          <div>
            <span>Panel profesional</span>
            <strong>{sectionLabels[activeSection]}</strong>
          </div>
          <div className="admin-header__actions">
            <a className="admin-public-link" href="#inicio">
              Ver perfil público
            </a>
            <ThemeToggle />
          </div>
        </header>

        <main className="admin-main">
          <Fragment key={navigationKey}>{children}</Fragment>
        </main>
      </div>

      <Sidebar
        activeSection={activeSection}
        mobile
        onNavigate={onNavigate}
      />
    </div>
  )
}

export default AdminLayout
