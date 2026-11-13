export default function ResourceState({ loading, error, onRetry }) {
  if (loading) return <p role="status">Cargando información…</p>;
  if (error) return <div className="panel-message" role="alert"><p>{error}</p><button type="button" onClick={() => onRetry()}>Reintentar</button></div>;
  return null;
}
