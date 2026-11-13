export default function SettingsBackButton({ onBack }) {
  return <button className="settings-subview__back" type="button" onClick={onBack}><span aria-hidden="true">←</span> Volver a Ajustes</button>;
}
