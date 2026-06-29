'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { githubAPI } from '@/services/github-api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'

function GitHubCallbackContent() {
  useProtectedRoute()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Connecting your GitHub account...')

  useEffect(() => {
    const code = searchParams.get('code')
    const err = searchParams.get('error')

    if (err) {
      setStatus('error')
      setMessage('GitHub authorization was cancelled or denied.')
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('Missing authorization code from GitHub.')
      return
    }

    githubAPI
      .handleCallback(code)
      .then(() => {
        setStatus('success')
        setMessage('GitHub connected successfully. Redirecting...')
        setTimeout(() => router.replace('/github?tab=account'), 1200)
      })
      .catch(() => {
        setStatus('error')
        setMessage('Failed to connect GitHub. Verify GITHUB_CLIENT_ID and redirect URI.')
      })
  }, [searchParams, router])

  return (
    <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
      <Link href="/github" className="inline-flex items-center gap-2 justify-center">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">GitHub Connect</span>
      </Link>
      <p className={status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{message}</p>
      {status === 'loading' && (
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
      )}
      {status === 'error' && (
        <Link href="/github" className="text-primary hover:underline text-sm">
          Back to GitHub page
        </Link>
      )}
    </div>
  )
}

export default function GitHubCallbackPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="glass-card p-8 max-w-md w-full text-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground mt-4">Connecting your GitHub account...</p>
          </div>
        }
      >
        <GitHubCallbackContent />
      </Suspense>
    </div>
  )
}
