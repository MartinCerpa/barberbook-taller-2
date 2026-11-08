import { getAppointments } from './bookingService.js'
import { calculateFinancialSummary } from '../../shared/financial.js'
export { FINANCIAL_PERIODS,getFinancialPeriodRange,calculateFinancialSummary } from '../../shared/financial.js'
export const getFinancialSummary=(periodId='today',now=new Date())=>calculateFinancialSummary(getAppointments(),periodId,now)
