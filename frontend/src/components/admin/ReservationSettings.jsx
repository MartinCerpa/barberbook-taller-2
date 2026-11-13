import SettingsBackButton from './SettingsBackButton';

export default function ReservationSettings({ onBack, professional, busy, onApprovalChange }) {
  return <div className="admin-page settings-page settings-subview reservation-settings-page"><SettingsBackButton onBack={onBack} />
    <header className="admin-page__heading"><div><p className="eyebrow">Reglas de reserva</p><h1>Reservas</h1><p>Define cómo quieres recibir y gestionar nuevas reservas.</p></div></header>
    <form className="reservation-settings" onSubmit={(e) => e.preventDefault()}>
      <section className="reservation-settings__section" aria-labelledby="confirmation-title"><header><span>01</span><div><h2 id="confirmation-title">Confirmación</h2><p>Elige un modo global para todos tus servicios.</p></div></header>
        <fieldset className="reservation-mode-options" disabled={busy}><legend>Modo de confirmación</legend>
          <label className={!professional.automatic_approval ? 'is-selected' : ''}><input type="radio" name="confirmation-mode" value="manual" checked={!professional.automatic_approval} onChange={() => onApprovalChange(false)} /><span><strong>Manual</strong><small>Cada solicitud necesita tu aprobación antes de confirmarse.</small></span></label>
          <label className={professional.automatic_approval ? 'is-selected' : ''}><input type="radio" name="confirmation-mode" value="automatic" checked={professional.automatic_approval} onChange={() => onApprovalChange(true)} /><span><strong>Automática</strong><small>Confirma nuevas reservas si la hora está libre y se respeta la prioridad FIFO.</small></span></label>
        </fieldset><p className="reservation-settings__info">Cambiar el modo no confirma las solicitudes que ya están pendientes. Puedes revisarlas en Solicitudes.</p>
      </section>
    </form>
  </div>;
}
