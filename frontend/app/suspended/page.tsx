'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Account Suspended</h1>
          <p className="text-muted-foreground">
            Your account has been suspended. Please contact support.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <a href="mailto:support@nexus.dev">
            <Button className="w-full">Contact Support</Button>
          </a>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
