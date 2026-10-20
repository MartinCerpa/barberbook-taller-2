/**
 * Representa la identidad publica y los datos de contacto de un profesional.
 * `businessId` es opcional para admitir profesionales independientes.
 */
export class Professional {
  constructor({
    id = '',
    slug = '',
    name = '',
    profileImage = '',
    coverImage = '',
    role = '',
    title = '',
    bio = '',
    specialties = [],
    location = '',
    instagram = '',
    whatsapp = '',
    businessId = null,
  } = {}) {
    this.id = id
    this.slug = slug
    this.name = name
    this.profileImage = profileImage
    this.coverImage = coverImage
    this.role = role
    this.title = title
    this.bio = bio
    this.specialties = [...specialties]
    this.location = location
    this.instagram = instagram
    this.whatsapp = whatsapp
    this.businessId = businessId
  }
}
