import { useEffect, useState } from 'react'
import AdminPanelPage from './pages/AdminPanelPage'
import ProfessionalGate from './components/ProfessionalGate.jsx'
import ApiAdminPanel from './pages/ApiAdminPanel.jsx'
import PublicBarberPage from './pages/PublicBarberPage'

const adminSections = new Set([
  'dashboard',
  'requests',
  'schedule',
  'clients',
  'finances',
  'services',
  'settings',
])

const getAdminSection = () => {
  const [area, section] = window.location.hash.replace(/^#\/?/, '').split('/')
  if (area === 'academic') return 'academic'

  if (area !== 'panel') {
    return null
  }

  return adminSections.has(section) ? section : 'dashboard'
}

function App() {
  const [adminSection, setAdminSection] = useState(getAdminSection)
  const [adminNavigationKey, setAdminNavigationKey] = useState(0)

  useEffect(() => {
    const syncRoute = () => {
      setAdminSection(getAdminSection())
      setAdminNavigationKey((key) => key + 1)
    }

    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const navigateToAdminRoot = (section) => {
    if (!adminSections.has(section)) {
      return
    }

    setAdminSection(section)
    setAdminNavigationKey((currentKey) => currentKey + 1)
  }

  if (adminSection) {
    if (adminSection === 'academic')
      return (
        <ProfessionalGate>
          {(user) =>
            user.isAdmin ? (
              <ApiAdminPanel
                academic
                activeSection={window.location.hash.split('/')[2] || 'queue'}
                navigationKey={adminNavigationKey}
              />
            ) : (
              <p>
                La extensión académica requiere acceso administrativo.{' '}
                <a href="#/panel/dashboard">Volver a tu jornada</a>
              </p>
            )
          }
        </ProfessionalGate>
      )
    return (
      <ProfessionalGate>
        <AdminPanelPage
          activeSection={adminSection}
          navigationKey={adminNavigationKey}
          onNavigate={navigateToAdminRoot}
        />
      </ProfessionalGate>
    )
  }

  return <PublicBarberPage />
}

export default App
