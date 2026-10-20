import { useEffect, useRef, useState } from 'react'
import BookingFlow from '../components/booking/BookingFlow'
import PortfolioSection from '../components/public/PortfolioSection'
import ProfileHero from '../components/public/ProfileHero'
import { business } from '../data/business'
import { professional } from '../data/professional'
import PublicLayout from '../layouts/PublicLayout'
import { getFeaturedPortfolioItems } from '../services/portfolioService'
import { getPublicProfile } from '../services/professionalService'
import { getActiveServices } from '../services/serviceService'

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
  const primaryCtaRef = useRef(null)

  useEffect(() => {
    let isActive = true

    const loadPublicProfile = async () => {
      const profile = await getPublicProfile()
      const [portfolio, activeServices] = await Promise.all([
        getFeaturedPortfolioItems(profile.professional.id),
        getActiveServices(),
      ])

      if (isActive) {
        setPublicProfile(profile)
        setFeaturedWork(portfolio)
        setBookingServices(activeServices)
      }
    }

    loadPublicProfile()

    return () => {
      isActive = false
    }
  }, [])

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
          onExit={() => changeView(false)}
        />
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <ProfileHero
        business={publicProfile.business}
        professional={publicProfile.professional}
        onBook={() => changeView(true)}
        primaryCtaRef={primaryCtaRef}
      />

      <PortfolioSection
        items={featuredWork}
        professionalName={publicProfile.professional.name}
      />

      {showMobileCta && (
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
