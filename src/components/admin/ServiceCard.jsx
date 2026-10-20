import { formatCurrency } from '../../utils/formatters'

function ServiceToggle({ checked, description, disabled, label, onChange }) {
  return (
    <label className={`service-toggle${disabled ? ' is-disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="service-toggle__control" aria-hidden="true" />
    </label>
  )
}

function QuickStateControl({
  active,
  disabled = false,
  label,
  onClick,
  state,
  title,
}) {
  return (
    <button
      className="service-card__state"
      type="button"
      data-state={state}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function ServiceCard({
  error,
  isConfirmingDelete,
  isEditing,
  isSaving,
  onCancelDelete,
  onChange,
  onConfirmDelete,
  onDiscard,
  onQuickToggle,
  onRequestDelete,
  onSave,
  onToggleEditor,
  quickControlsDisabled,
  service,
}) {
  const safePrice = Number.isFinite(Number(service.price))
    ? Number(service.price)
    : 0
  const effectivePublicPrice =
    service.publicVisible && service.publicPriceVisible

  return (
    <article
      className={`service-card${service.active ? '' : ' is-inactive'}${
        isEditing ? ' is-editing' : ''
      }`}
      aria-busy={isSaving || undefined}
    >
      <header className="service-card__heading">
        <div>
          <span>{service.isCustom ? 'Servicio personalizado' : 'Servicio base'}</span>
          <h2>{service.name || 'Nuevo servicio'}</h2>
        </div>
        <button type="button" onClick={onToggleEditor} aria-expanded={isEditing}>
          {isEditing ? 'Cerrar' : 'Editar'}
        </button>
      </header>

      <div className="service-card__details" aria-label="Detalle del servicio">
        <span>
          <small>Duración</small>
          <strong>{service.duration || '—'} min</strong>
        </span>
        <span>
          <small>Precio</small>
          <strong>{formatCurrency(safePrice)}</strong>
        </span>
      </div>

      <div className="service-card__states" aria-label="Acciones rápidas del servicio">
        <QuickStateControl
          label={service.active ? 'Disponible' : 'No disponible'}
          active={service.active}
          state={service.active ? 'active' : 'inactive'}
          disabled={quickControlsDisabled}
          title={
            quickControlsDisabled
              ? 'Guarda primero el servicio para usar esta acción.'
              : 'Cambiar disponibilidad para reservas'
          }
          onClick={() => onQuickToggle('active')}
        />
        <QuickStateControl
          label={service.publicVisible ? 'Visible en perfil' : 'Oculto en perfil'}
          active={service.publicVisible}
          state={service.publicVisible ? 'active' : 'neutral'}
          disabled={quickControlsDisabled}
          title={
            quickControlsDisabled
              ? 'Guarda primero el servicio para usar esta acción.'
              : 'Cambiar visibilidad en el perfil'
          }
          onClick={() => onQuickToggle('publicVisible')}
        />
        <QuickStateControl
          label={effectivePublicPrice ? 'Precio público' : 'Precio privado'}
          active={effectivePublicPrice}
          state={effectivePublicPrice ? 'active' : 'neutral'}
          disabled={quickControlsDisabled || !service.publicVisible}
          title={
            !service.publicVisible
              ? 'Muestra primero el servicio en tu perfil.'
              : quickControlsDisabled
                ? 'Guarda primero el servicio para usar esta acción.'
                : 'Cambiar visibilidad pública del precio'
          }
          onClick={() => onQuickToggle('publicPriceVisible')}
        />
      </div>

      {isEditing ? (
        <div className="service-card__editor">
          <div className="service-card__fields">
            <label className="service-field service-field--wide">
              <span>Nombre del servicio</span>
              <input
                type="text"
                value={service.name}
                maxLength="80"
                onChange={(event) => onChange('name', event.target.value)}
                aria-invalid={Boolean(error)}
              />
            </label>

            <label className="service-field">
              <span>Duración en minutos</span>
              <input
                type="number"
                inputMode="numeric"
                min="5"
                max="480"
                step="5"
                value={service.duration}
                onChange={(event) => onChange('duration', event.target.value)}
              />
            </label>

            <label className="service-field">
              <span>Precio</span>
              <div className="service-field__price">
                <span aria-hidden="true">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100000000"
                  step="500"
                  value={service.price}
                  onChange={(event) => onChange('price', event.target.value)}
                />
              </div>
            </label>
          </div>

          <div className="service-card__toggles">
            <ServiceToggle
              label="Disponible para reservas"
              description="Puede elegirse al solicitar una hora."
              checked={service.active}
              disabled={isSaving}
              onChange={(checked) => onChange('active', checked)}
            />
            <ServiceToggle
              label="Mostrar en mi perfil"
              description="Queda preparado para una sección pública futura."
              checked={service.publicVisible}
              disabled={isSaving}
              onChange={(checked) => onChange('publicVisible', checked)}
            />
            <ServiceToggle
              label="Mostrar precio públicamente"
              description={
                service.publicVisible
                  ? 'Permite publicar el valor del servicio.'
                  : 'Activa primero la visibilidad del servicio.'
              }
              checked={service.publicPriceVisible}
              disabled={isSaving || !service.publicVisible}
              onChange={(checked) => onChange('publicPriceVisible', checked)}
            />
          </div>

          {error ? (
            <p className="service-card__error" role="alert">
              {error}
            </p>
          ) : null}

          {isConfirmingDelete ? (
            <div className="service-card__delete-confirmation" role="alert">
              <p>
                <strong>¿Eliminar este servicio?</strong>
                Se quitará de tus servicios guardados.
              </p>
              <div>
                <button type="button" onClick={onCancelDelete} disabled={isSaving}>
                  Cancelar
                </button>
                <button type="button" onClick={onConfirmDelete} disabled={isSaving}>
                  {isSaving ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="service-card__editor-actions">
              {service.isCustom ? (
                <button
                  className="service-card__delete-trigger"
                  type="button"
                  onClick={onRequestDelete}
                  disabled={isSaving}
                >
                  Eliminar servicio
                </button>
              ) : (
                <small>
                  Los servicios base pueden desactivarse, pero no se eliminan.
                </small>
              )}
              <div className="service-card__save-actions">
                <button type="button" onClick={onDiscard} disabled={isSaving}>
                  Descartar cambios
                </button>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </article>
  )
}

export default ServiceCard
