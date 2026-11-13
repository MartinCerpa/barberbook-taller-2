import Brand from '../components/Brand';
import Sidebar from '../components/admin/Sidebar';
import ThemeToggle from '../components/ThemeToggle';

const labels = { dashboard: 'Inicio', requests: 'Solicitudes', schedule: 'Agenda', settings: 'Configuración' };

export default function AdminLayout({ activeSection, professional, onLogout, busy, children }) {
  return <div className="admin-shell">
    <a className="skip-link" href="#panel-contenido" onClick={(event) => {
      event.preventDefault(); document.getElementById('panel-contenido').focus();
    }}>Saltar al contenido</a>
    <aside className="admin-sidebar">
      <div><Brand href="#/panel/dashboard" label="BarberBook, ir al inicio del panel" />
        <p className="admin-sidebar__caption">Espacio profesional</p></div>
      <Sidebar activeSection={activeSection} />
      <div className="admin-sidebar__footer">
        <span className="admin-avatar" aria-hidden="true">{professional.name.slice(0, 1)}</span>
        <div><strong>{professional.name}</strong><span>Profesional independiente</span></div>
        <a href="#inicio">Ver perfil público</a>
      </div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-header">
        <div><span>Panel profesional</span><strong>{labels[activeSection]}</strong></div>
        <div className="admin-header__actions">
          <a className="admin-public-link" href="#inicio">Ver perfil público</a>
          <ThemeToggle />
          <button className="professional-logout" type="button" disabled={busy} onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>
      <main className="admin-main" id="panel-contenido" tabIndex={-1}>{children}</main>
    </div>
    <Sidebar activeSection={activeSection} mobile />
  </div>;
}
