import { useEffect, useState } from 'react';

// Preferencia visual únicamente: las reservas nunca se guardan en localStorage.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('barberbook-taller-3-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* La preferencia visual es opcional. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('barberbook-taller-3-theme', theme); } catch { /* Sin almacenamiento sigue funcionando. */ }
  }, [theme]);
  return <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{theme === 'dark'
      ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>
      : <path d="M20.5 15.1A8.5 8.5 0 0 1 8.9 3.5 8.5 8.5 0 1 0 20.5 15.1Z" />}</svg>
    <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
  </button>;
}
