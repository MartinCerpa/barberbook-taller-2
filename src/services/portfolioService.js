import { portfolioItems } from '../data/portfolio.js'

const copyPortfolioItem = (item) => ({ ...item })

export const getPortfolioItems = async (professionalId) =>
  portfolioItems
    .filter((item) => item.professionalId === professionalId)
    .map(copyPortfolioItem)

export const getFeaturedPortfolioItems = async (professionalId) =>
  portfolioItems
    .filter(
      (item) => item.professionalId === professionalId && item.featured,
    )
    .map(copyPortfolioItem)

export const portfolioService = {
  getPortfolioItems,
  getFeaturedPortfolioItems,
}
