const currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const bookingDateFormatter = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export const formatCurrency = (value) => currencyFormatter.format(value)

export const formatBookingDate = (dateId) => {
  const formattedDate = bookingDateFormatter.format(
    new Date(`${dateId}T12:00:00`),
  )

  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
}
