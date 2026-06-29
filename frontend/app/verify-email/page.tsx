'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Sparkles, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authAPI, getErrorMessage } from '@/services/api'
import { EmailVerificationPrompt } from '@/components/auth/email-verification-prompt'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token. Use the link from your email.')
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const { data } = await authAPI.verifyEmail(token)
        if (!cancelled) {
          setStatus('success')
          setMessage(data.message || 'Email verified successfully.')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(getErrorMessage(err))
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="glass-card p-8 space-y-6">
      {status === 'loading' && (
        <div className="text-center space-y-4 py-4">
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying your email…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 mx-auto text-green-500" />
          <h2 className="text-xl font-semibold">Email verified</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button asChild className="w-full glow-primary">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <XCircle className="w-14 h-14 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Verification failed</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/signup">Create an account</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">RConnectX</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Verify your email</h1>
        </div>
        <Suspense
          fallback={
            <div className="glass-card p-8 text-center text-muted-foreground">Loading…</div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
