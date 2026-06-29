const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  uae: 'United Arab Emirates',
}

export function normalizeCountryName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return COUNTRY_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

/** Returns true when a user's country matches a search/filter value (aliases, partial, case-insensitive). */
export function countriesMatch(userCountry: string | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true
  if (!userCountry?.trim()) return false

  const filterNorm = normalizeCountryName(filter).toLowerCase()
  const userNorm = normalizeCountryName(userCountry).toLowerCase()
  const filterRaw = filter.trim().toLowerCase()
  const userRaw = userCountry.trim().toLowerCase()

  if (userNorm === filterNorm) return true
  if (userNorm.includes(filterNorm) || filterNorm.includes(userNorm)) return true
  if (userRaw.includes(filterRaw) || filterRaw.includes(userRaw)) return true
  return false
}

export function getCountryFromSearchParams(search: string): string | null {
  if (!search) return null
  const value = new URLSearchParams(search).get('country')
  return value?.trim() || null
}
