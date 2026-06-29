/**
 * Normalize social profile links to ensure they are always valid external URLs.
 */

/**
 * Normalize a LinkedIn profile link.
 * Handles:
 * - Username only: "adsjahs" -> "https://linkedin.com/in/adsjahs"
 * - linkedin.com/in/user: "linkedin.com/in/adsjahs" -> "https://linkedin.com/in/adsjahs"
 * - https://linkedin.com/in/user: Already valid
 */
export function normalizeLinkedIn(value: string | undefined | null): string {
  if (!value?.trim()) return ''
  
  const trimmed = value.trim()
  
  // Already a full URL with https
  if (trimmed.startsWith('https://')) {
    return trimmed
  }
  
  // Has http but not https
  if (trimmed.startsWith('http://')) {
    return trimmed.replace('http://', 'https://')
  }
  
  // Already has linkedin.com domain
  if (trimmed.includes('linkedin.com')) {
    return `https://${trimmed.replace(/^https?:\/\//, '')}`
  }
  
  // Username only - assume it's a profile
  return `https://linkedin.com/in/${trimmed}`
}

/**
 * Normalize a GitHub profile link.
 * Handles:
 * - Username only: "username" -> "https://github.com/username"
 * - github.com/user: "github.com/username" -> "https://github.com/username"
 * - https://github.com/user: Already valid
 */
export function normalizeGitHub(value: string | undefined | null): string {
  if (!value?.trim()) return ''
  
  const trimmed = value.trim()
  
  // Already a full URL with https
  if (trimmed.startsWith('https://')) {
    return trimmed
  }
  
  // Has http but not https
  if (trimmed.startsWith('http://')) {
    return trimmed.replace('http://', 'https://')
  }
  
  // Already has github.com domain
  if (trimmed.includes('github.com')) {
    return `https://${trimmed.replace(/^https?:\/\//, '')}`
  }
  
  // Username only
  return `https://github.com/${trimmed}`
}

/**
 * Normalize a website/portfolio link.
 * Handles:
 * - Already has http/https: Use as-is
 * - No protocol: Prepend https://
 */
export function normalizeWebsite(value: string | undefined | null): string {
  if (!value?.trim()) return ''
  
  const trimmed = value.trim()
  
  // Already has a protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  
  // Prepend https://
  return `https://${trimmed}`
}

/**
 * Normalize a Twitter/X profile link.
 * Handles:
 * - Username only: "username" -> "https://x.com/username"
 * - x.com/user: "x.com/username" -> "https://x.com/username"
 * - twitter.com/user: "twitter.com/username" -> "https://x.com/username"
 * - https://x.com/user or https://twitter.com/user: Already valid
 */
export function normalizeTwitter(value: string | undefined | null): string {
  if (!value?.trim()) return ''
  
  const trimmed = value.trim()
  
  // Already a full URL with https
  if (trimmed.startsWith('https://')) {
    // Convert twitter.com to x.com
    if (trimmed.includes('twitter.com')) {
      return trimmed.replace('twitter.com', 'x.com')
    }
    return trimmed
  }
  
  // Has http but not https
  if (trimmed.startsWith('http://')) {
    const https = trimmed.replace('http://', 'https://')
    if (https.includes('twitter.com')) {
      return https.replace('twitter.com', 'x.com')
    }
    return https
  }
  
  // Already has x.com or twitter.com domain
  if (trimmed.includes('x.com')) {
    return `https://${trimmed.replace(/^https?:\/\//, '')}`
  }
  
  if (trimmed.includes('twitter.com')) {
    return `https://${trimmed.replace(/^https?:\/\//, '').replace('twitter.com', 'x.com')}`
  }
  
  // Username only
  return `https://x.com/${trimmed}`
}
