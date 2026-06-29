'use client'

import { useState } from 'react'
import { Mail, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authAPI, getErrorMessage } from '@/services/api'
import { toast } from 'sonner'

interface EmailVerificationPromptProps {
  email: string
  title?: string
  description?: string
}

export function EmailVerificationPrompt({
  email,
  title = 'Check your email to verify your account.',
  description = 'We sent a verification link to your inbox. The link expires in 24 hours.',
}: EmailVerificationPromptProps) {
  const [resending, setResending] = useState(false)

  const handleResend = async () => {
    if (!email.trim()) return
    setResending(true)
    try {
      await authAPI.resendVerification(email)
      toast.success('Verification email sent. Please check your inbox.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
        <Mail className="w-7 h-7 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {email && (
          <p className="text-sm font-medium text-foreground break-all">{email}</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => void handleResend()}
        disabled={resending || !email.trim()}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${resending ? 'animate-spin' : ''}`} />
        {resending ? 'Sending…' : 'Resend verification email'}
      </Button>
    </div>
  )
}
