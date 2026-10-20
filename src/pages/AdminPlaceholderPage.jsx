const placeholderContent = {
  clients: {
    eyebrow: 'Próxima etapa',
    title: 'Clientes',
    description:
      'Aquí podrás consultar el historial de visitas y reconocer a tus clientes recurrentes.',
    features: ['Historial de reservas', 'Servicios frecuentes', 'Datos de contacto'],
  },
}

function AdminPlaceholderPage({ section }) {
  const content = placeholderContent[section]

  return (
    <section className="admin-page admin-placeholder">
      <p className="eyebrow">{content.eyebrow}</p>
      <h1>{content.title}</h1>
      <p>{content.description}</p>
      <div className="placeholder-features">
        {content.features.map((feature) => (
          <div key={feature}>
            <span className="placeholder-feature__marker" aria-hidden="true" />
            <strong>{feature}</strong>
            <small>Disponible en una próxima etapa</small>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AdminPlaceholderPage
