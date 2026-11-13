import { useState } from 'react';
import ProfileSettings from '../components/admin/ProfileSettings';
import WorkingHoursSettings from '../components/admin/WorkingHoursSettings';
import ReservationSettings from '../components/admin/ReservationSettings';
import ServicesPage from './ServicesPage';

const functionalSettingsItems = [
  {
    id: 'profile',
    title: 'Mi perfil',
    description: 'Administra tu identidad e información pública.',
  },
  {
    id: 'services',
    title: 'Servicios',
    description: 'Administra servicios, precios y disponibilidad.',
  },
  {
    id: 'hours',
    title: 'Horarios de atención',
    description: 'Define tu semana habitual y sus pausas.',
  },
  {
    id: 'bookings',
    title: 'Reservas',
    description: 'Configura la aprobación manual o automática.',
  },
]

function SettingsIcon({ section }) {
  const icons = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    services: (
      <>
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        <circle cx="8" cy="6.5" r="1.8" />
        <circle cx="15" cy="12" r="1.8" />
        <circle cx="10" cy="17.5" r="1.8" />
      </>
    ),
    hours: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    bookings: (
      <>
        <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16M8 14l2.2 2.2L16 13" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {icons[section]}
    </svg>
  )
}


export default function SettingsPage(props) {
 const [view,setView]=useState('overview');
 const childProps={...props,onBack:()=>setView('overview')};
 if(view==='profile')return <ProfileSettings {...childProps}/>;
 if(view==='services')return <ServicesPage {...childProps}/>;
 if(view==='hours')return <WorkingHoursSettings {...childProps}/>;
 if(view==='bookings')return <ReservationSettings {...childProps}/>;
 return <div className="admin-page settings-page settings-hub">
  <header className="admin-page__heading"><div><p className="eyebrow">Configuración profesional</p><h1>Ajustes</h1><p>Gestiona tu identidad y cómo funciona tu perfil.</p></div></header>
  <section className="settings-hub__grid" aria-label="Áreas de Ajustes">{functionalSettingsItems.map(item=><button className="settings-hub__option is-functional" type="button" onClick={()=>setView(item.id)} key={item.id}>
   <span className="settings-option__icon"><SettingsIcon section={item.id}/></span><span className="settings-hub__copy"><strong>{item.title}</strong><small>{item.description}</small></span><span className="settings-hub__arrow" aria-hidden="true">→</span>
  </button>)}</section>
 </div>;
}
