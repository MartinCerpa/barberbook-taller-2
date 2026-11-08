import { useEffect, useRef, useState } from 'react'
import BookingFlow from '../components/booking/BookingFlow'
import PortfolioSection from '../components/public/PortfolioSection'
import ProfileHero from '../components/public/ProfileHero'
import { business } from '../data/business'
import { professional } from '../data/professional'
import PublicLayout from '../layouts/PublicLayout'
import { getFeaturedPortfolioItems } from '../services/portfolioService'
import { api } from '../services/api.js'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

function PublicBarberPage() {
  const [isBooking, setIsBooking] = useState(false)
  const [showMobileCta, setShowMobileCta] = useState(false)
  const [publicProfile, setPublicProfile] = useState({ business, professional })
  const [featuredWork, setFeaturedWork] = useState([])
  const [bookingServices, setBookingServices] = useState([])
  const [professionals,setProfessionals] = useState([])
  const [selectedProfessional,setSelectedProfessional] = useState('')
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)
  const [retry,setRetry] = useState(0)
  const primaryCtaRef = useRef(null)

  useEffect(() => {
    let isActive = true

    const loadPublicProfile = async () => {
      setLoading(true)
      setError(null)
      const [people,branches,catalog] = await Promise.all([api('/professionals'),api('/branches'),api('/services')])
      const availablePeople = people.filter((p) => p.active && branches.some((b) => b.id === p.branchId && b.active))
      const person = availablePeople.find((p) => p.id === selectedProfessional) ?? availablePeople[0]
      if (!person) throw new Error('No hay profesionales disponibles en este momento.')
      const weekly = await api(`/availability/weekly?professionalId=${person.id}`)
      const weekdays = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
      const days = [...new Set(weekly.map((interval) => interval.weekday))].map((day) => weekdays[day]).join(', ')
      const address = branches.find((b) => b.id === person.branchId)?.address || business.location
      const profile = { business: { ...business,location: address,openingHours: { days: days || 'Sin jornada publicada',time: 'Consulta los intervalos al reservar' } },professional: { ...professional,...person,specialties: person.title ? [person.title] : [],location: address } }
      const [portfolio, activeServices] = await Promise.all([
        getFeaturedPortfolioItems(profile.professional.id),
        Promise.resolve(catalog.filter((s) => s.active && s.branchId === person.branchId)),
      ])

      if (isActive) {
        setPublicProfile(profile)
        setFeaturedWork(portfolio)
        setBookingServices(activeServices)
        setProfessionals(availablePeople)
        setLoading(false)
      }
    }

    loadPublicProfile().catch((error) => { if (isActive) { setError(error.message); setLoading(false) } })

    return () => {
      isActive = false
    }
  }, [selectedProfessional,retry])

  useEffect(() => {
    const primaryCta = primaryCtaRef.current

    if (isBooking || !primaryCta || !window.IntersectionObserver) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileCta(!entry.isIntersecting),
      { threshold: 0.35 },
    )

    observer.observe(primaryCta)
    return () => observer.disconnect()
  }, [isBooking])

  useEffect(() => {
    if (isBooking) {
      return undefined
    }

    const revealElements = document.querySelectorAll('[data-reveal]')

    if (!window.IntersectionObserver) {
      revealElements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px',
      },
    )

    revealElements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [featuredWork.length, isBooking])

  const changeView = (bookingIsOpen) => {
    setShowMobileCta(false)
    setIsBooking(bookingIsOpen)
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  if (isBooking) {
    return (
      <PublicLayout>
        <BookingFlow
          services={bookingServices}
          professionalId={publicProfile.professional.id}
          onExit={() => changeView(false)}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="container api-profile-controls">
        {loading && <p role="status">Cargando servicios y profesional…</p>}
        {error && <div role="alert"><p>{error}</p><button className="button button--secondary" onClick={() => setRetry((value) => value+1)}>Reintentar conexión</button></div>}
        {!loading && !error && <label>Profesional <select aria-label="Profesional" value={publicProfile.professional.id} onChange={(event) => setSelectedProfessional(event.target.value)}>{professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {!loading && !error && bookingServices.length === 0 && <p role="status">Este profesional aún no tiene servicios disponibles.</p>}
      </div>
      <ProfileHero
        business={publicProfile.business}
        professional={publicProfile.professional}
        onBook={() => { if (!loading && !error && bookingServices.length) changeView(true) }}
        canBook={!loading && !error && bookingServices.length > 0}
        primaryCtaRef={primaryCtaRef}
      />

      <PortfolioSection
        items={featuredWork}
        professionalName={publicProfile.professional.name}
      />

      {showMobileCta && !loading && !error && bookingServices.length > 0 && (
        <div className="mobile-booking-bar">
          <button type="button" onClick={() => changeView(true)}>
            <CalendarIcon />
            <span>Reservar ahora</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </PublicLayout>
  )
}

export default PublicBarberPage
