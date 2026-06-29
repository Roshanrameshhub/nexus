import type { SyntheticEvent } from 'react'

export const MEDIA_UNAVAILABLE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="20"%3EMedia unavailable%3C/text%3E%3C/svg%3E'

export function handleMediaImageError(event: SyntheticEvent<HTMLImageElement, Event>): void {
  const img = event.currentTarget
  if (img.src !== MEDIA_UNAVAILABLE_PLACEHOLDER) {
    img.src = MEDIA_UNAVAILABLE_PLACEHOLDER
  }
}
