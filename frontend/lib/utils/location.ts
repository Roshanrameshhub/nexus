import { countriesMatch, normalizeCountryName } from '@/lib/utils/country'

export interface LocationFields {
  city?: string | null
  state?: string | null
  country?: string | null
}

/** Format as "Chennai, Tamil Nadu, India" */
export function formatLocation({ city, state, country }: LocationFields): string {
  const parts: string[] = []
  if (city?.trim()) parts.push(city.trim())
  if (state?.trim()) parts.push(state.trim())
  if (country?.trim()) parts.push(normalizeCountryName(country) || country.trim())
  return parts.join(', ')
}

export function hasCompleteLocation({ city, state, country }: LocationFields): boolean {
  return Boolean(city?.trim() && state?.trim() && country?.trim())
}

function fieldMatches(userValue: string | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true
  if (!userValue?.trim()) return false
  const u = userValue.trim().toLowerCase()
  const f = filter.trim().toLowerCase()
  return u === f || u.includes(f) || f.includes(u)
}

export function locationMatches(
  user: LocationFields,
  filters: { city?: string; state?: string; country?: string }
): boolean {
  if (filters.city?.trim() && !fieldMatches(user.city, filters.city)) return false
  if (filters.state?.trim() && !fieldMatches(user.state, filters.state)) return false
  if (filters.country?.trim() && !countriesMatch(user.country, filters.country)) return false
  return true
}

/** Single search box matching city, state, country, or formatted label. */
export function locationSearchMatches(user: LocationFields, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  const fields = [user.city, user.state, user.country, formatLocation(user)]
  return fields.some((value) => {
    if (!value?.trim()) return false
    const v = value.trim().toLowerCase()
    return v.includes(q) || q.includes(v)
  })
}
