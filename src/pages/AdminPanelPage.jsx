import { useEffect, useMemo, useRef, useState } from 'react'
import { requestContext } from '../data/requests'
import {
  getAppointments, getRequestsSnapshot, subscribeBookings, undoBookingChange,
  updateBookingDetails, updateBookingStatus,
} from '../services/bookingService'
import {
  getCurrentPendingRequests,
  getDailyOperationsSummary,
  getNextConfirmedAppointment,
} from '../services/bookingInsightsService'
import { calculateFinancialSummary } from '../services/financialService'
import AdminLayout from '../layouts/AdminLayout'
import AdminDashboardPage from './AdminDashboardPage'
import AdminPlaceholderPage from './AdminPlaceholderPage'
import ClientsPage from './ClientsPage'
import FinancesPage from './FinancesPage'
import RequestsPage from './RequestsPage'
import SchedulePage from './SchedulePage'
import ServicesPage from './ServicesPage'
import SettingsPage from './SettingsPage'
import { getLocalDateId } from '../utils/requestUtils'

const requestStatusMessages = {
  confirmed: 'Reserva confirmada correctamente.',
  rejected: 'Solicitud rechazada.',
  pending: 'Reserva devuelta al estado pendiente.',
  cancelled: 'Reserva cancelada.',
}

function AdminPanelPage({ activeSection, navigationKey, onNavigate }) {
  const [requests, setRequests] = useState(getRequestsSnapshot)
  const [, refreshDashboardClock] = useState(0)
  const [requestFeedback, setRequestFeedback] = useState(null)
  const [requestFocus, setRequestFocus] = useState(null)
  const feedbackTimerRef = useRef(null)
  const feedbackRemovalTimerRef = useRef(null)
  useEffect(() => subscribeBookings(() => setRequests(getRequestsSnapshot())), [])
  const pendingRequests = useMemo(
    () => getCurrentPendingRequests(requests, requestContext).length,
    [requests],
  )
  const dashboardNow = new Date()
  const todayDateId = getLocalDateId(dashboardNow)
  const appointments = getAppointments()
  const dashboardSummary = {
    pendingRequests,
    todayDateId,
    nextAppointment: getNextConfirmedAppointment(appointments, dashboardNow),
    dailyOperations: getDailyOperationsSummary(appointments, todayDateId, dashboardNow),
    financial: calculateFinancialSummary(appointments, 'today', dashboardNow),
  }
  const nextAppointmentStartsAt = dashboardSummary.nextAppointment
    ? new Date(
      `${dashboardSummary.nextAppointment.dateId}T${dashboardSummary.nextAppointment.time}:00`,
    ).getTime()
    : Number.POSITIVE_INFINITY
  const nextLocalDayStartsAt = new Date(
    dashboardNow.getFullYear(),
    dashboardNow.getMonth(),
    dashboardNow.getDate() + 1,
  ).getTime()
  const dashboardRefreshAt = Math.min(
    Number.isFinite(nextAppointmentStartsAt)
      ? nextAppointmentStartsAt + 1000
      : Number.POSITIVE_INFINITY,
    nextLocalDayStartsAt,
  )

  useEffect(() => {
    const maximumTimeout = 2147483647
    const refreshDelay = Math.min(
      Math.max(dashboardRefreshAt - Date.now(), 0),
      maximumTimeout,
    )
    const refreshTimer = window.setTimeout(
      () => refreshDashboardClock((currentValue) => currentValue + 1),
      refreshDelay,
    )
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboardClock((currentValue) => currentValue + 1)
      }
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [dashboardRefreshAt])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeSection, navigationKey])

  useEffect(
    () => () => {
      window.clearTimeout(feedbackTimerRef.current)
      window.clearTimeout(feedbackRemovalTimerRef.current)
    },
    [],
  )

  const updateRequestStatus = async (requestId, status) => {
    const currentRequest = requests.find((request) => request.id === requestId)

    if (!currentRequest) {
      return { success: false, error: 'No encontramos esta solicitud.' }
    }

    if (currentRequest.status === status) {
      return { success: true, changed: false, booking: currentRequest }
    }

    const result = await updateBookingStatus(requestId, status)
    if (!result.success) {
      setRequestFeedback({ message: result.error })
      return result
    }

    window.clearTimeout(feedbackTimerRef.current)
    window.clearTimeout(feedbackRemovalTimerRef.current)
    setRequestFeedback({
      requestId,
      undoToken: result.undoToken,
      message: requestStatusMessages[status],
    })
    feedbackTimerRef.current = window.setTimeout(
      () => {
        setRequestFeedback((currentFeedback) =>
          currentFeedback ? { ...currentFeedback, isClosing: true } : null,
        )
        feedbackRemovalTimerRef.current = window.setTimeout(
          () => setRequestFeedback(null),
          280,
        )
      },
      5500,
    )
    return result
  }

  const undoRequestStatus = async () => {
    if (!requestFeedback?.undoToken) {
      return
    }

    const result = await undoBookingChange(requestFeedback.undoToken)
    if (!result.success) {
      setRequestFeedback({ message: result.error })
      return
    }
    window.clearTimeout(feedbackTimerRef.current)
    window.clearTimeout(feedbackRemovalTimerRef.current)
    setRequestFeedback(null)
  }

  const updateRequestDuration = async (requestId, duration) => {
    const result = await updateBookingDetails(requestId, { duration })
    if (!result.success) setRequestFeedback({ message: result.error })
  }

  const updateRequestTime = async (requestId, time) => {
    const result = await updateBookingDetails(requestId, { time })
    if (!result.success) setRequestFeedback({ message: result.error })
  }

  const renderSection = () => {
    if (activeSection === 'dashboard') {
      return <AdminDashboardPage dashboardSummary={dashboardSummary} />
    }

    if (activeSection === 'requests') {
      return (
        <RequestsPage
          requests={requests}
          initialFocus={requestFocus}
          onFocusConsumed={() => setRequestFocus(null)}
          feedback={requestFeedback}
          onUndo={undoRequestStatus}
          onStatusChange={updateRequestStatus}
          onDurationChange={updateRequestDuration}
          onTimeChange={updateRequestTime}
        />
      )
    }

    if (activeSection === 'schedule') {
      return (
        <SchedulePage
          requests={requests}
          pendingRequestCount={pendingRequests}
          onConfirmRequest={(requestId) =>
            updateRequestStatus(requestId, 'confirmed')
          }
          onViewRequests={(slot) => {
            setRequestFocus(slot)
            window.location.hash = '/panel/requests'
          }}
        />
      )
    }

    if (activeSection === 'clients') {
      return <ClientsPage />
    }

    if (activeSection === 'finances') {
      return <FinancesPage />
    }

    if (activeSection === 'services') {
      return <ServicesPage />
    }

    if (activeSection === 'settings') {
      return <SettingsPage />
    }

    return <AdminPlaceholderPage section={activeSection} />
  }

  return (
    <AdminLayout
      activeSection={activeSection}
      navigationKey={navigationKey}
      onNavigate={onNavigate}
    >
      {renderSection()}
    </AdminLayout>
  )
}

export default AdminPanelPage
