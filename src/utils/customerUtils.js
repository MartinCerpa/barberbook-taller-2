// Identidad de celular chileno en el límite del servicio; el input conserva su formato visual.
export const normalizeCustomerPhone = (value) => {
  const digits = String(value ?? '').replace(/[\s()+.-]/g, '')
  if (/^\d{8}$/.test(digits)) return `+569${digits}`
  if (/^9\d{8}$/.test(digits)) return `+56${digits}`
  return /^569\d{8}$/.test(digits) ? `+${digits}` : null
}

export const formatCustomerPhone = (value) => {
  const phone = normalizeCustomerPhone(value)
  return phone ? `+56 9 ${phone.slice(4, 8)} ${phone.slice(8)}` : 'Sin teléfono registrado'
}
