export default function PublicBarberPage({ estado }) {
  return (
    <main className="app-shell">
      <header className="public-header">
        <div className="brand-logo">BB</div>
        <strong>BarberBook</strong>
        <span className="server-status">API: {estado}</span>
      </header>

      <section className="public-profile" id="inicio">
        <div className="public-profile__cover">
          <span>Tu estilo, tu hora.</span>
        </div>

        <div className="public-profile__content">
          <p className="profile-label">Perfil profesional</p>
          <h1>Matías</h1>
          <p>Encuentra tu próximo horario y reserva tu atención.</p>

          <button type="button" disabled>
            Reservas próximamente
          </button>
        </div>
      </section>
    </main>
  );
}