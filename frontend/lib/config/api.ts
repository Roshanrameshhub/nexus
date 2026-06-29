const DEV_API_BASE = 'https://nexus-4ygl.onrender.com/api'

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'development') return DEV_API_BASE
  throw new Error(
    'NEXT_PUBLIC_API_URL is required in production. Set it to your deployed backend URL (e.g. https://your-api.onrender.com/api).'
  )
}

export function getMediaUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const base = getApiBaseUrl().replace(/\/api\/?$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}
