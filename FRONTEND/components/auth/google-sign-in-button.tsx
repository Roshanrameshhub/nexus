'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { authAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void
        }
      }
    }
  }
}

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const BUTTON_WIDTH = 360

interface GoogleSignInButtonProps {
  label?: string
}

export function GoogleSignInButton({ label = 'Continue with Google' }: GoogleSignInButtonProps) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [scriptFailed, setScriptFailed] = useState(false)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      setError('')
      try {
        const { data } = await authAPI.google(response.credential)
        const u = data.user
        setAuth(
          {
            id: String(u.id),
            name: u.name,
            email: u.email,
            avatar: u.avatar,
            role: u.role,
            skills: u.skills || [],
            bio: u.bio,
          },
          data.access_token,
          data.refresh_token
        )
        router.push(u.country ? '/dashboard' : '/profile/complete')
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const detail = err.response?.data?.detail
          setError(
            typeof detail === 'string'
              ? detail
              : 'Google sign-in failed. Check backend GOOGLE_CLIENT_ID and CORS.'
          )
        } else {
          setError('Google sign-in failed. Check your network connection.')
        }
      }
    },
    [router, setAuth]
  )

  const mountButton = useCallback(() => {
    if (!clientId || !buttonRef.current || !window.google?.accounts?.id) return
    buttonRef.current.innerHTML = ''
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    })
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      width: BUTTON_WIDTH,
      text: 'continue_with',
      shape: 'rectangular',
    })
    setReady(true)
  }, [clientId, handleCredential])

  useEffect(() => {
    if (!clientId) return

    if (window.google?.accounts?.id) {
      mountButton()
      return
    }

    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', mountButton)
      return () => existing.removeEventListener('load', mountButton)
    }

    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => mountButton()
    script.onerror = () => setScriptFailed(true)
    document.head.appendChild(script)

    return () => {
      script.onload = null
    }
  }, [clientId, mountButton])

  if (!clientId) {
    return (
      <div
        className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-3 text-center"
        data-testid="google-signin-missing-env"
      >
        <p className="text-sm text-amber-200">
          Google sign-in is disabled: set <code className="text-xs">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{' '}
          <code className="text-xs">.env.local</code> and restart <code className="text-xs">npm run dev</code>.
        </p>
      </div>
    )
  }

  if (scriptFailed) {
    return (
      <p className="text-sm text-destructive text-center" data-testid="google-signin-script-error">
        Could not load Google sign-in. Check your network or ad blocker.
      </p>
    )
  }

  return (
    <div className="space-y-2 w-full" data-testid="google-signin-container">
      <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <div
        className="w-full flex justify-center overflow-visible rounded-md bg-white p-1 min-h-[48px]"
        style={{ minWidth: BUTTON_WIDTH }}
      >
        <div ref={buttonRef} className="flex items-center justify-center" style={{ width: BUTTON_WIDTH, minHeight: 44 }} />
        {!ready && (
          <span className="absolute text-sm text-muted-foreground py-3">Loading Google…</span>
        )}
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  )
}
