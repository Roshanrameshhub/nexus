export const ECOSYSTEM_CREATOR_ROLES = ['founder', 'executive', 'investor', 'developer'] as const
export const OPPORTUNITY_CREATOR_ROLES = ['founder', 'executive', 'investor', 'developer'] as const
export const ECOSYSTEM_VIEWER_ROLES = ['student', 'developer', 'founder', 'executive', 'investor', 'mentor'] as const

export const FEED_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'startup_milestones', label: 'Startup Milestones' },
  { id: 'product_launches', label: 'Product Launches' },
  { id: 'funding', label: 'Funding' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'partnerships', label: 'Partnerships' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'developer_showcases', label: 'Developer Showcases' },
  { id: 'industry_insights', label: 'Industry Insights' },
  { id: 'events', label: 'Events' },
] as const

export type FeedCategoryId = (typeof FEED_CATEGORIES)[number]['id']

export const STARTUP_STAGES = [
  'Ideation',
  'Pre-Seed',
  'Seed',
  'Series A',
  'Series B+',
] as const

export const OPPORTUNITY_TYPES = [
  { id: 'job_opening', label: 'Job Opening' },
  { id: 'internship', label: 'Internship' },
  { id: 'co_founder_search', label: 'Co-Founder Search' },
  { id: 'investment_opportunity', label: 'Investment Opportunity' },
  { id: 'partnership_opportunity', label: 'Partnership Opportunity' },
  { id: 'event_invitation', label: 'Event Invitation' },
  { id: 'project_showcase', label: 'Project Showcase' },
  { id: 'portfolio_showcase', label: 'Portfolio Showcase' },
  { id: 'open_source_launch', label: 'Open Source Launch' },
  { id: 'freelance_availability', label: 'Freelance Availability' },
  { id: 'technical_achievement', label: 'Technical Achievement' },
  { id: 'looking_for_opportunity', label: 'Looking for Opportunities' },
  { id: 'beta_tester_recruitment', label: 'Beta Tester Recruitment' },
] as const

export const WORK_MODES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'Onsite' },
] as const

export function opportunityTypeLabel(type?: string): string {
  return OPPORTUNITY_TYPES.find((t) => t.id === type)?.label ?? type ?? 'Opportunity'
}

export function canCreateEcosystemUpdates(role?: string | null): boolean {
  return ECOSYSTEM_CREATOR_ROLES.includes((role || '') as (typeof ECOSYSTEM_CREATOR_ROLES)[number])
}

export function canCreateOpportunities(role?: string | null): boolean {
  return OPPORTUNITY_CREATOR_ROLES.includes((role || '') as (typeof OPPORTUNITY_CREATOR_ROLES)[number])
}

export function opportunityTypesForRole(role?: string | null) {
  const r = (role || '').toLowerCase()
  if (r === 'developer') {
    return OPPORTUNITY_TYPES.filter((t) =>
      ['project_showcase', 'portfolio_showcase', 'open_source_launch', 'freelance_availability', 'technical_achievement', 'looking_for_opportunity'].includes(t.id)
    )
  }
  if (r === 'investor') {
    return OPPORTUNITY_TYPES.filter((t) =>
      ['investment_opportunity', 'partnership_opportunity', 'event_invitation'].includes(t.id)
    )
  }
  if (r === 'executive') {
    return OPPORTUNITY_TYPES.filter((t) =>
      ['job_opening', 'internship', 'partnership_opportunity', 'event_invitation'].includes(t.id)
    )
  }
  return OPPORTUNITY_TYPES.filter((t) =>
    ['job_opening', 'internship', 'co_founder_search', 'investment_opportunity', 'partnership_opportunity', 'event_invitation', 'beta_tester_recruitment'].includes(t.id)
  )
}

export function updatePostTypesForRole(role?: string | null) {
  const r = (role || '').toLowerCase()
  if (r === 'developer') {
    return [
      { id: 'text', label: 'Technical Achievement' },
      { id: 'product_launch', label: 'Project / Product Showcase' },
      { id: 'startup_update', label: 'Open Source Launch' },
    ]
  }
  if (r === 'executive') {
    return [
      { id: 'text', label: 'Industry Insight' },
      { id: 'startup_update', label: 'Company Achievement' },
      { id: 'product_launch', label: 'Leadership Update' },
    ]
  }
  if (r === 'investor') {
    return [
      { id: 'text', label: 'Portfolio Announcement' },
      { id: 'funding', label: 'Funding Interest' },
      { id: 'startup_update', label: 'Startup Scouting' },
    ]
  }
  return [
    { id: 'startup_update', label: 'Startup Milestone' },
    { id: 'funding', label: 'Funding Update' },
    { id: 'product_launch', label: 'Product Launch' },
    { id: 'text', label: 'Founder Update' },
  ]
}
