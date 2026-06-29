import type { ApiUserRecommendation } from '@/lib/types/api'
import { countriesMatch } from '@/lib/utils/country'
import { locationSearchMatches } from '@/lib/utils/location'

export interface NetworkFilters {
  name: string
  role: string
  skill: string
  location: string
  country: string
  institution: string
  degree: string
  graduationYear: string
  organization: string
  industry: string
  startupStage: string
  verifiedOnly: boolean
  connectionsOnly: boolean
}

export const EMPTY_NETWORK_FILTERS: NetworkFilters = {
  name: '',
  role: 'all',
  skill: '',
  location: '',
  country: '',
  institution: '',
  degree: '',
  graduationYear: '',
  organization: '',
  industry: '',
  startupStage: '',
  verifiedOnly: false,
  connectionsOnly: false,
}

function includes(haystack: string | null | undefined, needle: string): boolean {
  if (!needle.trim()) return true
  if (!haystack?.trim()) return false
  const h = haystack.trim().toLowerCase()
  const n = needle.trim().toLowerCase()
  return h.includes(n) || n.includes(h)
}

function organizationLabel(user: ApiUserRecommendation): string {
  const rd = user.role_details || {}
  const role = user.role?.toLowerCase()
  if (role === 'student') return user.college || String(rd.college_name || '')
  if (role === 'founder') return String(rd.startup_name || user.company || '')
  if (role === 'investor' || role === 'mentor') {
    return String(rd.organization || user.company || '')
  }
  return user.company || String(rd.company_name || '')
}

function institutionLabel(user: ApiUserRecommendation): string {
  const rd = user.role_details || {}
  return user.college || String(rd.college_name || '')
}

function industryLabel(user: ApiUserRecommendation): string {
  const rd = user.role_details || {}
  const preferred = rd.preferred_industries
  const preferredText = Array.isArray(preferred)
    ? preferred.join(', ')
    : typeof preferred === 'string'
      ? preferred
      : ''
  return [rd.industry, preferredText].filter(Boolean).join(', ')
}

function startupStageLabel(user: ApiUserRecommendation): string {
  const rd = user.role_details || {}
  return String(rd.stage || rd.startup_stage || '')
}

export function countActiveFilters(filters: NetworkFilters): number {
  let count = 0
  if (filters.name.trim()) count++
  if (filters.role !== 'all') count++
  if (filters.skill.trim()) count++
  if (filters.location.trim()) count++
  if (filters.country.trim()) count++
  if (filters.institution.trim()) count++
  if (filters.degree.trim()) count++
  if (filters.graduationYear.trim()) count++
  if (filters.organization.trim()) count++
  if (filters.industry.trim()) count++
  if (filters.startupStage.trim()) count++
  if (filters.verifiedOnly) count++
  if (filters.connectionsOnly) count++
  return count
}

export function filterNetworkMembers(
  members: ApiUserRecommendation[],
  filters: NetworkFilters
): ApiUserRecommendation[] {
  return members.filter((user) => {
    if (filters.name.trim()) {
      const q = filters.name.trim().toLowerCase()
      const matchesName = user.name?.toLowerCase().includes(q)
      const matchesBio = user.bio?.toLowerCase().includes(q)
      if (!matchesName && !matchesBio) return false
    }

    if (filters.role !== 'all' && user.role?.toLowerCase() !== filters.role.toLowerCase()) {
      return false
    }

    if (filters.skill.trim()) {
      const q = filters.skill.trim().toLowerCase()
      const matchesSkills = user.skills?.some((s) => s.toLowerCase().includes(q))
      if (!matchesSkills) return false
    }

    if (filters.country.trim() && !countriesMatch(user.country, filters.country)) {
      return false
    }

    if (!locationSearchMatches(user, filters.location)) return false

    if (filters.institution.trim() && !includes(institutionLabel(user), filters.institution)) {
      return false
    }

    if (filters.degree.trim()) {
      const degree = user.role_details?.degree
      if (!includes(degree, filters.degree)) return false
    }

    if (filters.graduationYear.trim()) {
      const year = String(user.role_details?.graduation_year || '')
      if (!includes(year, filters.graduationYear)) return false
    }

    if (filters.organization.trim() && !includes(organizationLabel(user), filters.organization)) {
      return false
    }

    if (filters.industry.trim() && !includes(industryLabel(user), filters.industry)) {
      return false
    }

    if (filters.startupStage.trim() && !includes(startupStageLabel(user), filters.startupStage)) {
      return false
    }

    if (filters.verifiedOnly && !user.is_verified) return false

    if (filters.connectionsOnly && !user.is_connected) return false

    return true
  })
}
