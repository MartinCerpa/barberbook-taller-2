function Brand({ href = '#inicio', label = 'BarberBook, volver al inicio' }) {
  return (
    <a className="brand" href={href} aria-label={label}>
      <span className="brand__mark" aria-hidden="true">
        BB
      </span>
      <span className="brand__name">BarberBook</span>
    </a>
  )
}

export default Brand
