import type { ApiUser, UserRole } from '@/lib/types/api'
import { formatLocation } from '@/lib/utils/location'
import { normalizeLinkedIn, normalizeGitHub, normalizeWebsite } from '@/lib/utils/links'

export interface ExperienceEntry {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  description: string
  current?: boolean
}

export type ProfileRoleDetails = Record<string, unknown>

export function getOrganizationSectionTitle(role?: string): string {
  switch (role?.toLowerCase()) {
    case 'founder':
      return 'Startup Details'
    case 'investor':
      return 'Investment Firm'
    case 'developer':
      return 'Company Details'
    case 'student':
      return 'Academic Details'
    case 'mentor':
      return 'Organization Details'
    case 'executive':
      return 'Company Details'
    default:
      return 'Organization Details'
  }
}

export function getProfileHeadline(user: ApiUser): string {
  const rd = (user.role_details || {}) as ProfileRoleDetails
  if (typeof rd.headline === 'string' && rd.headline.trim()) {
    return rd.headline.trim()
  }

  const role = user.role?.toLowerCase()
  if (role === 'student') {
    const college = user.college || rd.college_name || 'University'
    const degree = rd.degree || 'Student'
    return `${degree} · ${college}`
  }
  if (role === 'developer') {
    const title = rd.job_title || 'Developer'
    const company = user.company || rd.company_name || 'Tech Company'
    return `${title} at ${company}`
  }
  if (role === 'founder') {
    const org = rd.startup_name || user.company || 'Startup'
    return `Founder · ${org}`
  }
  if (role === 'investor') {
    const firm = rd.organization_name || rd.organization || user.company || 'Investment Firm'
    return `Investor · ${firm}`
  }
  if (role === 'mentor') {
    const expertise = rd.domain_expertise || rd.expertise || 'Mentor'
    return `Mentor · ${expertise}`
  }
  if (role === 'executive') {
    const title = rd.designation || 'Executive'
    const company = user.company || rd.company_name || 'Organization'
    return `${title} at ${company}`
  }
  return user.role || 'RConnectX Member'
}

export function parseExperience(roleDetails?: ProfileRoleDetails | null): ExperienceEntry[] {
  const raw = roleDetails?.experience
  if (!Array.isArray(raw)) return []

  return raw
    .map((item, index) => {
      const entry = item as Record<string, unknown>
      return {
        id: String(entry.id || `exp_${index}`),
        company: String(entry.company || entry.organization || ''),
        position: String(entry.position || entry.role || ''),
        startDate: String(entry.startDate || entry.start_date || ''),
        endDate: String(entry.endDate || entry.end_date || ''),
        description: String(entry.description || ''),
        current: Boolean(entry.current),
      }
    })
    .filter((e) => e.company || e.position)
}

export function formatExperiencePeriod(entry: ExperienceEntry): string {
  const start = entry.startDate || '—'
  const end = entry.current ? 'Present' : entry.endDate || '—'
  return `${start} – ${end}`
}

export interface ProfileDetailRow {
  label: string
  value: string
}

function asString(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return String(value).trim()
}

export function getRoleDetailRows(user: ApiUser): ProfileDetailRow[] {
  const rd = (user.role_details || {}) as ProfileRoleDetails
  const role = user.role?.toLowerCase()

  switch (role) {
    case 'student':
      return [
        { label: 'College / University', value: user.college || asString(rd.college_name) },
        { label: 'Degree', value: asString(rd.degree) },
        { label: 'Graduation Year', value: asString(rd.graduation_year) },
        { label: 'Certifications', value: asString(rd.certifications) },
        { label: 'Projects', value: asString(rd.projects) },
      ].filter((r) => r.value)
    case 'developer':
      return [
        { label: 'Company', value: user.company || asString(rd.company_name) },
        { label: 'Role', value: asString(rd.job_title) },
        { label: 'Experience', value: asString(rd.years_experience) ? `${asString(rd.years_experience)} years` : '' },
        { label: 'GitHub', value: user.github_username || asString(rd.github) },
        { label: 'Tech Stack', value: (user.skills || []).join(', ') || asString(rd.tech_stack) },
        { label: 'Projects', value: asString(rd.projects) },
      ].filter((r) => r.value)
    case 'founder':
      return [
        { label: 'Organization Name', value: asString(rd.startup_name) || user.company || '' },
        { label: 'Role', value: 'Founder' },
        { label: 'Description', value: asString(rd.vision) || asString(rd.organization_description) },
        { label: 'Team Size', value: asString(rd.team_size) },
        { label: 'Industry', value: asString(rd.industry) },
        { label: 'Stage', value: asString(rd.startup_stage) || asString(rd.stage) },
        { label: 'Website', value: asString(rd.website) },
      ].filter((r) => r.value)
    case 'investor':
      return [
        { label: 'Firm Name', value: asString(rd.organization_name) || user.company || '' },
        { label: 'Investment Focus', value: asString(rd.investment_focus) },
        { label: 'Portfolio Highlights', value: asString(rd.portfolio_highlights) },
        { label: 'Industries', value: asString(rd.preferred_industries) },
        { label: 'Ticket Size', value: asString(rd.ticket_size) },
      ].filter((r) => r.value)
    case 'mentor':
      return [
        { label: 'Organization', value: asString(rd.organization) || user.company || '' },
        { label: 'Expertise', value: asString(rd.domain_expertise) || asString(rd.expertise) },
        { label: 'Years of Experience', value: asString(rd.years_of_experience) || asString(rd.years_experience) },
        { label: 'Mentorship Areas', value: asString(rd.mentorship_areas) },
      ].filter((r) => r.value)
    case 'executive':
      return [
        { label: 'Organization', value: user.company || asString(rd.company_name) || '' },
        { label: 'Position', value: asString(rd.designation) },
        { label: 'Industry', value: asString(rd.industry) },
        { label: 'Experience', value: asString(rd.years_experience) ? `${asString(rd.years_experience)} years` : '' },
      ].filter((r) => r.value)
    default:
      return [
        { label: 'Organization', value: user.company || '' },
        { label: 'Location', value: formatLocation(user) },
      ].filter((r) => r.value)
  }
}

export function getSocialLinks(user: ApiUser) {
  const rd = (user.role_details || {}) as ProfileRoleDetails
  return {
    github: normalizeGitHub(user.github_username || asString(rd.github)),
    linkedin: normalizeLinkedIn(asString(rd.linkedin)),
    website: normalizeWebsite(
      asString(rd.website) || asString(rd.portfolio_website) || asString(rd.company_website)
    ),
  }
}

export function getPublicProfileUrl(userId: string): string {
  if (typeof window === 'undefined') return `/users/${userId}`
  return `${window.location.origin}/users/${userId}`
}

export function createEmptyExperience(): ExperienceEntry {
  return {
    id: `exp_${Date.now()}`,
    company: '',
    position: '',
    startDate: '',
    endDate: '',
    description: '',
    current: false,
  }
}

export const PROFILE_ROLES: { id: UserRole; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'developer', label: 'Developer' },
  { id: 'founder', label: 'Founder' },
  { id: 'investor', label: 'Investor' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'executive', label: 'Executive' },
]
