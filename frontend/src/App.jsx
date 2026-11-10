import { useEffect, useState } from 'react';
import { obtenerEstadoServidor } from './services/api';

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

  return (
    <main>
      <h1>BarberBook 💈</h1>
      <p>Estado del backend: {estado}</p>
    </main>
  );
}

export default App;