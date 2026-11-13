function DashboardCard({ label, value, detail, tone = 'default', href }) {
  const content = (
    <>
      <span className="dashboard-card__label">{label}</span>
      <strong className="dashboard-card__value">{value}</strong>
      <p>{detail}</p>
    </>
  )

  if (href) {
    return (
      <a
        className={`dashboard-card dashboard-card--${tone} dashboard-card--link`}
        href={href}
        aria-label={`${label}: ${value}. ${detail}`}
      >
        {content}
      </a>
    )
  }

  return (
    <article className={`dashboard-card dashboard-card--${tone}`}>
      {content}
    </article>
  )
}

export default DashboardCard
