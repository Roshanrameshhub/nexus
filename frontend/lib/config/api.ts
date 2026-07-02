const DEV_API_BASE = 'http://localhost:8000/api'
const PROD_API_BASE = 'https://api.rconnectx.com/api'

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return configured
  if (process.env.NODE_ENV === 'development') return DEV_API_BASE
  return PROD_API_BASE
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
