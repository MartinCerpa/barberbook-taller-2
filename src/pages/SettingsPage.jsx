import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProfessional } from '../services/professionalService.js'
import {
  clearProfilePreferences,
  saveProfilePreferences,
} from '../services/profilePreferencesService.js'
import ServicesPage from './ServicesPage'
import WorkingHoursSettings from '../components/admin/WorkingHoursSettings'
import ReservationSettings from '../components/admin/ReservationSettings'

const functionalSettingsItems = [
  {
    id: 'profile',
    title: 'Mi perfil',
    description: 'Administra tu identidad e información pública.',
  },
  {
    id: 'services',
    title: 'Servicios',
    description: 'Administra servicios, precios y disponibilidad.',
  },
  {
    id: 'hours',
    title: 'Horarios de atención',
    description: 'Define tu semana habitual y sus pausas.',
  },
  {
    id: 'bookings',
    title: 'Reservas',
    description: 'Define reglas de reserva, anticipación y cancelaciones.',
  },
]

function SettingsIcon({ section }) {
  const icons = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    services: (
      <>
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
        <circle cx="8" cy="6.5" r="1.8" />
        <circle cx="15" cy="12" r="1.8" />
        <circle cx="10" cy="17.5" r="1.8" />
      </>
    ),
    hours: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    bookings: (
      <>
        <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16M8 14l2.2 2.2L16 13" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {icons[section]}
    </svg>
  )
}

const getEditableProfile = (professional) => ({
  name: professional.name,
  title: professional.title,
  bio: professional.bio,
  specialties: [...professional.specialties],
  location: professional.location,
  instagram: professional.instagram,
  whatsapp: professional.whatsapp,
})

function ProfileImagePreview({ label, name, src, variant }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const initial = name.trim().charAt(0) || 'B'

  return (
    <article className="profile-media-preview">
      <div
        className={`profile-media-preview__image profile-media-preview__image--${variant}${imageUnavailable || !src ? ' is-fallback' : ''}`}
      >
        <span aria-hidden="true">{initial}</span>
        {src && !imageUnavailable ? (
          <img
            src={src}
            alt={`${label} actual de ${name}`}
            onError={() => setImageUnavailable(true)}
          />
        ) : null}
      </div>
      <div>
        <strong>{label}</strong>
        <small>
          {imageUnavailable || !src
            ? 'Se está utilizando el fallback del perfil.'
            : 'Vista previa actual.'}
        </small>
      </div>
    </article>
  )
}

function SettingsBackButton({ onBack }) {
  return (
    <button className="settings-subview__back" type="button" onClick={onBack}>
      <span aria-hidden="true">←</span>
      Volver a Ajustes
    </button>
  )
}

function ProfileSettingsView({ onBack }) {
  const [formData, setFormData] = useState(null)
  const [savedData, setSavedData] = useState(null)
  const [profileMedia, setProfileMedia] = useState(null)
  const [specialtyDraft, setSpecialtyDraft] = useState('')
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false)
  const [isConfirmingNavigation, setIsConfirmingNavigation] = useState(false)
  const pendingNavigationRef = useRef(null)
  const allowNextNavigationRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const loadProfessional = async () => {
      const professional = await getProfessional()

      if (!isMounted) {
        return
      }

      const editableProfile = getEditableProfile(professional)
      setFormData(editableProfile)
      setSavedData(editableProfile)
      setProfileMedia({
        profileImage: professional.profileImage,
        coverImage: professional.coverImage,
      })
    }

    loadProfessional()

    return () => {
      isMounted = false
    }
  }, [])

  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        formData &&
          savedData &&
          JSON.stringify(formData) !== JSON.stringify(savedData),
      ),
    [formData, savedData],
  )

  const saveProfileChanges = useCallback(() => {
    if (!formData.name.trim()) {
      setErrors({ name: 'Ingresa el nombre que verán tus clientes.' })
      return false
    }

    const result = saveProfilePreferences(formData)

    if (!result.success) {
      setFeedback({
        type: 'error',
        message: 'No pudimos guardar los cambios en este navegador.',
      })
      return false
    }

    setFormData(result.preferences)
    setSavedData(result.preferences)
    setErrors({})
    setFeedback({ type: 'success', message: 'Perfil actualizado.' })
    return true
  }, [formData])

  const requestNavigation = useCallback((navigate) => {
    if (!hasUnsavedChanges) {
      navigate()
      return
    }

    pendingNavigationRef.current = navigate
    setIsConfirmingRestore(false)
    setIsConfirmingNavigation(true)
  }, [hasUnsavedChanges])

  const continueEditing = useCallback(() => {
    pendingNavigationRef.current = null
    setIsConfirmingNavigation(false)
  }, [])

  const completePendingNavigation = useCallback(() => {
    const navigate = pendingNavigationRef.current
    pendingNavigationRef.current = null
    setIsConfirmingNavigation(false)
    navigate?.()
  }, [])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined
    }

    const protectReload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', protectReload)
    return () => window.removeEventListener('beforeunload', protectReload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    const protectInternalNavigation = (event) => {
      const link = event.target.closest?.('a[href^="#"]')

      if (!link) {
        return
      }

      if (allowNextNavigationRef.current) {
        allowNextNavigationRef.current = false
        return
      }

      if (!hasUnsavedChanges) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      requestNavigation(() => {
        allowNextNavigationRef.current = true
        link.click()
      })
    }

    document.addEventListener('click', protectInternalNavigation, true)
    return () => document.removeEventListener('click', protectInternalNavigation, true)
  }, [hasUnsavedChanges, requestNavigation])

  const updateField = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({ ...current, [name]: value }))
    setFeedback(null)

    if (name === 'name' && errors.name) {
      setErrors((current) => ({ ...current, name: null }))
    }
  }

  const addSpecialty = () => {
    const specialty = specialtyDraft.trim()

    if (!specialty) {
      return
    }

    const exists = formData.specialties.some(
      (item) =>
        item.toLocaleLowerCase('es-CL') ===
        specialty.toLocaleLowerCase('es-CL'),
    )

    if (exists) {
      setSpecialtyDraft('')
      return
    }

    setFormData((current) => ({
      ...current,
      specialties: [...current.specialties, specialty],
    }))
    setSpecialtyDraft('')
    setFeedback(null)
  }

  const handleSpecialtyKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addSpecialty()
    }
  }

  const removeSpecialty = (specialty) => {
    setFormData((current) => ({
      ...current,
      specialties: current.specialties.filter((item) => item !== specialty),
    }))
    setFeedback(null)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    saveProfileChanges()
  }

  const saveAndNavigate = () => {
    if (saveProfileChanges()) {
      completePendingNavigation()
    }
  }

  const discardAndNavigate = () => {
    setFormData(savedData)
    setSpecialtyDraft('')
    setErrors({})
    setFeedback(null)
    completePendingNavigation()
  }

  const handleNavigationDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      continueEditing()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
    const firstControl = controls[0]
    const lastControl = controls.at(-1)

    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault()
      lastControl.focus()
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault()
      firstControl.focus()
    }
  }

  const restoreOriginalProfile = async () => {
    if (!clearProfilePreferences()) {
      setFeedback({
        type: 'error',
        message: 'No pudimos restaurar el perfil en este navegador.',
      })
      return
    }

    const professional = await getProfessional()
    const editableProfile = getEditableProfile(professional)

    setFormData(editableProfile)
    setSavedData(editableProfile)
    setSpecialtyDraft('')
    setErrors({})
    setIsConfirmingRestore(false)
    setFeedback({
      type: 'success',
      message: 'Información original restaurada.',
    })
  }

  if (!formData) {
    return (
      <div className="admin-page settings-page settings-subview">
        <SettingsBackButton onBack={() => requestNavigation(onBack)} />
        <p className="profile-settings__loading">Cargando perfil…</p>
      </div>
    )
  }

  return (
    <div className="admin-page settings-page settings-subview">
      <SettingsBackButton onBack={() => requestNavigation(onBack)} />

      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Identidad profesional</p>
          <h1>Mi perfil</h1>
          <p>Administra la información que ven tus clientes.</p>
        </div>
      </header>

      <form className="profile-settings" onSubmit={handleSubmit}>
        <section className="profile-settings__section" aria-labelledby="profile-identity-title">
          <div className="profile-settings__section-heading">
            <span>01</span>
            <div>
              <h2 id="profile-identity-title">Identidad</h2>
              <p>La presentación principal de tu perfil público.</p>
            </div>
          </div>

          <div className="profile-settings__fields profile-settings__fields--two-columns">
            <label className="profile-field">
              <span>Nombre profesional</span>
              <input
                name="name"
                type="text"
                value={formData.name}
                onChange={updateField}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'profile-name-error' : undefined}
              />
              {errors.name ? (
                <small className="profile-field__error" id="profile-name-error">
                  {errors.name}
                </small>
              ) : null}
            </label>

            <label className="profile-field">
              <span>Título profesional</span>
              <input
                name="title"
                type="text"
                value={formData.title}
                onChange={updateField}
              />
            </label>
          </div>
        </section>

        <section className="profile-settings__section" aria-labelledby="profile-presentation-title">
          <div className="profile-settings__section-heading">
            <span>02</span>
            <div>
              <h2 id="profile-presentation-title">Presentación</h2>
              <p>Cuenta brevemente qué distingue tu trabajo.</p>
            </div>
          </div>

          <div className="profile-settings__fields">
            <label className="profile-field">
              <span>Biografía</span>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={updateField}
                rows="4"
              />
              <small>Esta descripción aparecerá en tu perfil público.</small>
            </label>

            <div className="profile-field">
              <span id="specialties-label">Especialidades</span>
              <div className="specialties-editor" aria-labelledby="specialties-label">
                {formData.specialties.length ? (
                  <ul className="specialties-editor__list">
                    {formData.specialties.map((specialty) => (
                      <li key={specialty}>
                        <span>{specialty}</span>
                        <button
                          type="button"
                          onClick={() => removeSpecialty(specialty)}
                          aria-label={`Eliminar ${specialty}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="specialties-editor__empty">Aún no agregas especialidades.</p>
                )}

                <div className="specialties-editor__add">
                  <input
                    type="text"
                    value={specialtyDraft}
                    onChange={(event) => setSpecialtyDraft(event.target.value)}
                    onKeyDown={handleSpecialtyKeyDown}
                    placeholder="Ej. Fade clásico"
                    aria-label="Nueva especialidad"
                  />
                  <button type="button" onClick={addSpecialty} disabled={!specialtyDraft.trim()}>
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-settings__section" aria-labelledby="profile-contact-title">
          <div className="profile-settings__section-heading">
            <span>03</span>
            <div>
              <h2 id="profile-contact-title">Contacto</h2>
              <p>Canales que tus clientes pueden usar desde el perfil.</p>
            </div>
          </div>

          <div className="profile-settings__fields profile-settings__fields--two-columns">
            <label className="profile-field profile-field--wide">
              <span>Ubicación</span>
              <input
                name="location"
                type="text"
                value={formData.location}
                onChange={updateField}
              />
            </label>

            <label className="profile-field">
              <span>Instagram</span>
              <input
                name="instagram"
                type="text"
                value={formData.instagram}
                onChange={updateField}
                placeholder="@usuario"
              />
            </label>

            <label className="profile-field">
              <span>WhatsApp</span>
              <input
                name="whatsapp"
                type="tel"
                value={formData.whatsapp}
                onChange={updateField}
                placeholder="+56912345678"
              />
            </label>
          </div>
        </section>

        <section className="profile-settings__section" aria-labelledby="profile-media-title">
          <div className="profile-settings__section-heading">
            <span>04</span>
            <div>
              <h2 id="profile-media-title">Imágenes del perfil</h2>
              <p>Vista previa de la foto y la portada que ven tus clientes.</p>
            </div>
          </div>

          <div className="profile-media-grid">
            <ProfileImagePreview
              label="Foto de perfil"
              name={formData.name}
              src={profileMedia?.profileImage}
              variant="avatar"
            />
            <ProfileImagePreview
              label="Imagen de portada"
              name={formData.name}
              src={profileMedia?.coverImage}
              variant="cover"
            />
          </div>
          <p className="profile-media-note">
            La carga de imágenes estará disponible en una próxima etapa.
          </p>
        </section>

        {isConfirmingRestore ? (
          <div className="profile-settings__restore-confirmation" role="alert">
            <div>
              <strong>¿Restaurar la información original?</strong>
              <p>Se descartarán los cambios locales guardados para este perfil.</p>
            </div>
            <div>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setIsConfirmingRestore(false)}
              >
                Cancelar
              </button>
              <button
                className="profile-settings__restore-action"
                type="button"
                onClick={restoreOriginalProfile}
              >
                Sí, restaurar
              </button>
            </div>
          </div>
        ) : null}

        <footer className="profile-settings__actions">
          <button
            className="profile-settings__restore-trigger"
            type="button"
            onClick={() => {
              setIsConfirmingRestore(true)
              setFeedback(null)
            }}
          >
            Restaurar información original
          </button>
          <div className="profile-settings__feedback" aria-live="polite">
            {feedback ? (
              <p data-type={feedback.type}>{feedback.message}</p>
            ) : hasUnsavedChanges ? (
              <p>Tienes cambios sin guardar.</p>
            ) : null}
          </div>
          <button
            className="button button--primary"
            type="submit"
            disabled={!hasUnsavedChanges}
          >
            Guardar cambios
          </button>
        </footer>
      </form>

      {isConfirmingNavigation ? (
        <div className="unsaved-changes-dialog" role="presentation">
          <section
            className="unsaved-changes-dialog__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-changes-title"
            aria-describedby="unsaved-changes-description"
            onKeyDown={handleNavigationDialogKeyDown}
          >
            <p className="eyebrow">Cambios pendientes</p>
            <h2 id="unsaved-changes-title">¿Qué quieres hacer?</h2>
            <p id="unsaved-changes-description">
              Tu perfil tiene cambios que todavía no se han guardado.
            </p>
            <div className="unsaved-changes-dialog__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={saveAndNavigate}
              >
                Guardar cambios
              </button>
              <button
                className="unsaved-changes-dialog__discard"
                type="button"
                onClick={discardAndNavigate}
              >
                Descartar cambios
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={continueEditing}
                autoFocus
              >
                Seguir editando
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function SettingsOverview({ onSelect }) {
  return (
    <div className="admin-page settings-page settings-hub">
      <header className="admin-page__heading">
        <div>
          <p className="eyebrow">Configuración profesional</p>
          <h1>Ajustes</h1>
          <p>Gestiona tu identidad y cómo funciona tu perfil.</p>
        </div>
      </header>

      <section className="settings-hub__grid" aria-label="Áreas de Ajustes">
        {functionalSettingsItems.map((item) => (
          <button
            className="settings-hub__option is-functional"
            type="button"
            onClick={() => onSelect(item.id)}
            key={item.id}
          >
            <span className="settings-option__icon">
              <SettingsIcon section={item.id} />
            </span>
            <span className="settings-hub__copy">
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
            <span className="settings-hub__arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </section>
    </div>
  )
}

function SettingsPage() {
  const [activeView, setActiveView] = useState('overview')

  if (activeView === 'hours') {
    return <WorkingHoursSettings onBack={() => setActiveView('overview')} />
  }

  if (activeView === 'bookings') {
    return <ReservationSettings onBack={() => setActiveView('overview')} />
  }

  if (activeView === 'profile') {
    return <ProfileSettingsView onBack={() => setActiveView('overview')} />
  }

  if (activeView === 'services') {
    return (
      <ServicesPage embedded onBack={() => setActiveView('overview')} />
    )
  }

  return <SettingsOverview onSelect={setActiveView} />
}

export default SettingsPage
