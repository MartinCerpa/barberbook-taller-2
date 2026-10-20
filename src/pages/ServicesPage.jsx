import { useEffect, useMemo, useState } from 'react'
import ServiceCard from '../components/admin/ServiceCard'
import {
  createLocalService,
  getServices,
  restoreOriginalServices,
  saveServices,
} from '../services/serviceService.js'

const copyServices = (services) => services.map((service) => ({ ...service }))

function ServicesPage({ embedded = false, onBack }) {
  const [currentServices, setCurrentServices] = useState(null)
  const [savedServices, setSavedServices] = useState(null)
  const [editingServiceId, setEditingServiceId] = useState(null)
  const [deleteServiceId, setDeleteServiceId] = useState(null)
  const [savingServiceId, setSavingServiceId] = useState(null)
  const [quickSavingServiceId, setQuickSavingServiceId] = useState(null)
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false)
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadServices = async () => {
      const loadedServices = await getServices()

      if (!isMounted) {
        return
      }

      setCurrentServices(copyServices(loadedServices))
      setSavedServices(copyServices(loadedServices))
    }

    loadServices()

    return () => {
      isMounted = false
    }
  }, [])

  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        currentServices &&
          savedServices &&
          JSON.stringify(currentServices) !== JSON.stringify(savedServices),
      ),
    [currentServices, savedServices],
  )

  const summary = useMemo(() => {
    const services = currentServices ?? []

    return {
      total: services.length,
      active: services.filter((service) => service.active).length,
      public: services.filter(
        (service) => service.active && service.publicVisible,
      ).length,
    }
  }, [currentServices])

  const updateService = (serviceId, field, value) => {
    setCurrentServices((services) =>
      services.map((service) =>
        service.id === serviceId ? { ...service, [field]: value } : service,
      ),
    )
    setErrors((current) => ({ ...current, [serviceId]: null }))
    setFeedback(null)
  }

  const addService = () => {
    const incompleteDraft = currentServices.find(
      (service) => service.isCustom && !service.name.trim(),
    )

    if (incompleteDraft) {
      setEditingServiceId(incompleteDraft.id)
      setErrors((current) => ({
        ...current,
        [incompleteDraft.id]: 'Completa este servicio antes de agregar otro.',
      }))
      setFeedback({
        type: 'error',
        message: 'Ya tienes un servicio nuevo pendiente de completar.',
      })
      return
    }

    const service = createLocalService()

    setCurrentServices((services) => [...services, service])
    setEditingServiceId(service.id)
    setDeleteServiceId(null)
    setFeedback(null)
  }

  const toggleEditor = (serviceId) => {
    setEditingServiceId((currentId) =>
      currentId === serviceId ? null : serviceId,
    )
    setDeleteServiceId(null)
    setFeedback(null)
  }

  const discardServiceChanges = (serviceId) => {
    const savedService = savedServices.find((service) => service.id === serviceId)

    setCurrentServices((services) =>
      savedService
        ? services.map((service) =>
            service.id === serviceId ? { ...savedService } : service,
          )
        : services.filter((service) => service.id !== serviceId),
    )
    setEditingServiceId(null)
    setDeleteServiceId(null)
    setErrors((current) => ({ ...current, [serviceId]: null }))
    setFeedback({ type: 'neutral', message: 'Cambios descartados.' })
  }

  const saveService = async (serviceId) => {
    const draft = currentServices.find((service) => service.id === serviceId)

    if (!draft) {
      return
    }

    const exists = savedServices.some((service) => service.id === serviceId)
    const nextSavedServices = exists
      ? savedServices.map((service) =>
          service.id === serviceId ? { ...draft } : service,
        )
      : [...savedServices, { ...draft }]

    setSavingServiceId(serviceId)
    const result = await saveServices(nextSavedServices)
    setSavingServiceId(null)

    if (!result.success) {
      const nextErrors = result.errors ?? {}

      setErrors((current) => ({
        ...current,
        [serviceId]:
          nextErrors[serviceId] ??
          'No pudimos guardar este servicio en el navegador.',
      }))
      setFeedback({
        type: 'error',
        message: 'Revisa los datos del servicio antes de guardar.',
      })
      return
    }

    const persistedService = result.services.find(
      (service) => service.id === serviceId,
    )

    setSavedServices(copyServices(result.services))
    setCurrentServices((services) =>
      services.map((service) =>
        service.id === serviceId ? { ...persistedService } : service,
      ),
    )
    setEditingServiceId(null)
    setDeleteServiceId(null)
    setErrors((current) => ({ ...current, [serviceId]: null }))
    setFeedback({ type: 'success', message: 'Servicio actualizado.' })
  }

  const persistQuickChange = async (serviceId, field) => {
    const currentService = currentServices.find(
      (service) => service.id === serviceId,
    )
    const savedService = savedServices.find(
      (service) => service.id === serviceId,
    )

    if (
      !currentService ||
      !savedService ||
      quickSavingServiceId ||
      (field === 'publicPriceVisible' && !currentService.publicVisible)
    ) {
      return
    }

    const nextValue = !currentService[field]
    const nextSavedServices = savedServices.map((service) =>
      service.id === serviceId ? { ...service, [field]: nextValue } : service,
    )

    setCurrentServices((services) =>
      services.map((service) =>
        service.id === serviceId
          ? { ...service, [field]: nextValue }
          : service,
      ),
    )
    setQuickSavingServiceId(serviceId)
    setFeedback(null)

    const result = await saveServices(nextSavedServices)
    setQuickSavingServiceId(null)

    if (!result.success) {
      setCurrentServices((services) =>
        services.map((service) =>
          service.id === serviceId
            ? { ...service, [field]: currentService[field] }
            : service,
        ),
      )
      setFeedback({
        type: 'error',
        message: 'No pudimos actualizar el estado del servicio.',
      })
      return
    }

    setSavedServices(copyServices(result.services))
    setFeedback({ type: 'success', message: 'Estado actualizado.' })
  }

  const deleteLocalService = async (serviceId) => {
    const wasPersisted = savedServices.some(
      (service) => service.id === serviceId,
    )

    if (!wasPersisted) {
      setCurrentServices((services) =>
        services.filter((service) => service.id !== serviceId),
      )
      setEditingServiceId(null)
      setDeleteServiceId(null)
      setFeedback({ type: 'neutral', message: 'Borrador eliminado.' })
      return
    }

    setSavingServiceId(serviceId)
    const result = await saveServices(
      savedServices.filter((service) => service.id !== serviceId),
    )
    setSavingServiceId(null)

    if (!result.success) {
      setFeedback({
        type: 'error',
        message: 'No pudimos eliminar el servicio en este navegador.',
      })
      return
    }

    setSavedServices(copyServices(result.services))
    setCurrentServices((services) =>
      services.filter((service) => service.id !== serviceId),
    )
    setEditingServiceId(null)
    setDeleteServiceId(null)
    setFeedback({ type: 'success', message: 'Servicio eliminado.' })
  }

  const handleRestore = async () => {
    const result = await restoreOriginalServices()

    if (!result.success) {
      setFeedback({
        type: 'error',
        message: 'No pudimos restaurar los servicios en este navegador.',
      })
      return
    }

    setCurrentServices(copyServices(result.services))
    setSavedServices(copyServices(result.services))
    setEditingServiceId(null)
    setDeleteServiceId(null)
    setIsConfirmingRestore(false)
    setErrors({})
    setFeedback({
      type: 'success',
      message: 'Servicios originales restaurados.',
    })
  }

  const backControl = onBack ? (
    <button className="settings-subview__back" type="button" onClick={onBack}>
      <span aria-hidden="true">←</span>
      Volver a Ajustes
    </button>
  ) : (
    <a className="settings-subview__back" href="#/panel/settings">
      <span aria-hidden="true">←</span>
      Volver a Ajustes
    </a>
  )

  if (!currentServices) {
    return (
      <div className="admin-page services-page" data-embedded={embedded}>
        {backControl}
        <p className="services-page__loading">Cargando servicios…</p>
      </div>
    )
  }

  return (
    <div className="admin-page services-page" data-embedded={embedded}>
      {backControl}

      <header className="admin-page__heading services-page__heading">
        <div>
          <p className="eyebrow">Oferta profesional</p>
          <h1>Servicios</h1>
          <p>Administra lo que ofreces y cómo lo ven tus clientes.</p>
        </div>
        <button className="button button--primary" type="button" onClick={addService}>
          Agregar servicio
        </button>
      </header>

      <section className="services-summary" aria-label="Resumen de servicios">
        <div>
          <strong>{summary.total}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{summary.active}</strong>
          <span>Activos</span>
        </div>
        <div>
          <strong>{summary.public}</strong>
          <span>Visibles</span>
        </div>
      </section>

      <div className="services-page__feedback" aria-live="polite">
        {feedback ? (
          <p data-type={feedback.type}>{feedback.message}</p>
        ) : hasUnsavedChanges ? (
          <p>Hay cambios sin guardar. Abre el servicio para guardarlos o descartarlos.</p>
        ) : null}
      </div>

      <section className="services-list" aria-label="Servicios administrables">
        {currentServices.map((service) => {
          const isPersisted = savedServices.some(
            (savedService) => savedService.id === service.id,
          )

          return (
            <ServiceCard
              service={service}
              error={errors[service.id]}
              isEditing={editingServiceId === service.id}
              isConfirmingDelete={deleteServiceId === service.id}
              isSaving={savingServiceId === service.id}
              quickControlsDisabled={
                !isPersisted || Boolean(quickSavingServiceId)
              }
              onToggleEditor={() => toggleEditor(service.id)}
              onQuickToggle={(field) => persistQuickChange(service.id, field)}
              onChange={(field, value) => updateService(service.id, field, value)}
              onSave={() => saveService(service.id)}
              onDiscard={() => discardServiceChanges(service.id)}
              onRequestDelete={() => setDeleteServiceId(service.id)}
              onCancelDelete={() => setDeleteServiceId(null)}
              onConfirmDelete={() => deleteLocalService(service.id)}
              key={service.id}
            />
          )
        })}
      </section>

      {isConfirmingRestore ? (
        <div className="services-restore-confirmation" role="alert">
          <div>
            <strong>¿Restaurar los servicios originales?</strong>
            <p>Solo se eliminarán los cambios de servicios guardados localmente.</p>
          </div>
          <div>
            <button type="button" onClick={() => setIsConfirmingRestore(false)}>
              Cancelar
            </button>
            <button type="button" onClick={handleRestore}>
              Sí, restaurar
            </button>
          </div>
        </div>
      ) : null}

      <footer className="services-actions">
        <button
          className="services-actions__restore"
          type="button"
          onClick={() => {
            setIsConfirmingRestore(true)
            setFeedback(null)
          }}
        >
          Restaurar servicios originales
        </button>
      </footer>
    </div>
  )
}

export default ServicesPage
