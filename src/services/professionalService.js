import { business } from '../data/business.js'
import { professional } from '../data/professional.js'
import { getProfilePreferences } from './profilePreferencesService.js'

const editableProfileFields = [
  'name',
  'title',
  'bio',
  'specialties',
  'location',
  'instagram',
  'whatsapp',
]

const copyBusiness = () => ({
  ...business,
  openingHours: { ...business.openingHours },
})

const copyProfessional = (value = professional) => ({
  ...value,
  specialties: [...value.specialties],
})

const getCurrentProfessional = () => {
  const preferences = getProfilePreferences()
  const currentProfessional = copyProfessional()

  if (!preferences) {
    return currentProfessional
  }

  editableProfileFields.forEach((field) => {
    if (field in preferences) {
      currentProfessional[field] =
        field === 'specialties'
          ? [...preferences.specialties]
          : preferences[field]
    }
  })

  return currentProfessional
}

export const getBusiness = async () => copyBusiness()

export const getProfessional = async () => getCurrentProfessional()

export const getProfessionalBySlug = async (slug) => {
  if (professional.slug !== slug) {
    return null
  }

  return getCurrentProfessional()
}

export const getPublicProfile = async () => ({
  business: copyBusiness(),
  professional: getCurrentProfessional(),
})

export const professionalService = {
  getBusiness,
  getProfessional,
  getProfessionalBySlug,
  getPublicProfile,
}
