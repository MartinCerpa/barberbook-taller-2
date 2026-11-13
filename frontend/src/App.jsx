import PublicBarberPage from './pages/PublicBarberPage';
import { useEffect, useState } from 'react';
import ProfessionalGate from './components/ProfessionalGate';
import ProfessionalPanel from './pages/ProfessionalPanel';

function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => { setHash(window.location.hash); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (hash.startsWith('#/panel')) {
    const requestedSection = hash.split('/')[2];
    const section = ['dashboard', 'requests', 'schedule', 'settings'].includes(requestedSection) ? requestedSection : 'dashboard';
    return <ProfessionalGate>{(professional, setProfessional) => <ProfessionalPanel section={section} professional={professional} onSessionChange={setProfessional} />}</ProfessionalGate>;
  }
  return <PublicBarberPage />;
}

export default App;
