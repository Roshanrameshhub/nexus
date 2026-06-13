export type PlatformRole = 'USER' | 'SUPER_ADMIN'

export function getPostLoginPath(user: {
  platform_role?: string | null
  country?: string | null
}): string {
  if (user.platform_role === 'SUPER_ADMIN') return '/admin'
  return '/dashboard'
}

export function getGooglePostLoginPath(user: {
  platform_role?: string | null
  country?: string | null
}): string {
  if (user.platform_role === 'SUPER_ADMIN') return '/admin'
  if (!user.country) return '/profile/complete'
  return '/dashboard'
}
