'use client'

import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { ReferralSection } from '@/components/profile/referral-section'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'

export default function ProfileReferralsPage() {
  useProtectedRoute()

  return (
    <AppShell title="Referrals">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to profile
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" />
            Referral Program
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share your referral code and track invites.
          </p>
        </div>

        <ReferralSection />
      </div>
    </AppShell>
  )
}
