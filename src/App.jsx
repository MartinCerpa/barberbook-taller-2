import { useEffect, useState } from 'react'
import AdminPanelPage from './pages/AdminPanelPage'
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

  if (area !== 'panel') {
    return null
  }

  return adminSections.has(section) ? section : 'dashboard'
}

function App() {
  const [adminSection, setAdminSection] = useState(getAdminSection)
  const [adminNavigationKey, setAdminNavigationKey] = useState(0)

  useEffect(() => {
    const syncRoute = () => setAdminSection(getAdminSection())

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
    return (
      <AdminPanelPage
        activeSection={adminSection}
        navigationKey={adminNavigationKey}
        onNavigate={navigateToAdminRoot}
      />
    )
  }

  return <PublicBarberPage />
}

export default App
