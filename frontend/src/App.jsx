import { useEffect, useState } from 'react';
import { obtenerEstadoServidor } from './services/api';
import PublicBarberPage from './pages/PublicBarberPage';

function App() {
  const [estado, setEstado] = useState('Cargando...');

  useEffect(() => {
    obtenerEstadoServidor()
      .then((datos) => {
        setEstado(datos.status);
      })
      .catch(() => {
        setEstado('Error de conexión');
      });
  }, []);

  return <PublicBarberPage estado={estado} />;
}

export default App;