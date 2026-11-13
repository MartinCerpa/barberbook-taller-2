import { useCallback, useEffect, useState } from 'react';

// Lecturas privadas compartidas: abortar al salir y cerrar acceso si vence la sesión.
export default function useProfessionalResource(loader, onSessionExpired) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback((signal) => loader(signal)
    .then((result) => {
      if (!signal?.aborted) { setData(result); setError(''); setLoading(false); }
      return result;
    }).catch((cause) => {
      if (!signal?.aborted) {
        if (cause.status === 401) onSessionExpired();
        setError(cause.message); setLoading(false);
      }
      return null;
    }), [loader, onSessionExpired]);
  useEffect(() => {
    const controller = new AbortController();
    reload(controller.signal);
    const refresh = () => reload(controller.signal);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [reload]);
  return { data, error, loading, reload };
}
