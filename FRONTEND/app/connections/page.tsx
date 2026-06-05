'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConnectButton } from '@/components/social/connect-button'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useConnections, useReceivedRequests } from '@/lib/hooks/api/use-connections'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { useAuthStore } from '@/lib/store'

export default function ConnectionsPage() {
  useProtectedRoute()
  const me = useAuthStore((s) => s.user)
  const { data: connections, isLoading } = useConnections()
  const { data: received, isLoading: loadingReceived } = useReceivedRequests()

  return (
    <AppShell title="My Network">
      <div className="max-w-3xl mx-auto space-y-10">
        <section>
          <h2 className="text-lg font-semibold mb-4">Pending requests</h2>
          {loadingReceived && <CardSkeleton count={2} />}
          {!loadingReceived && (!received || received.length === 0) && (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          )}
          <div className="space-y-3">
            {received?.map((req: {
              id: string
              sender?: { id: string; name: string; avatar?: string | null; role: string }
            }) => (
              <div key={req.id} className="glass-card p-4 flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={req.sender?.avatar || undefined} />
                  <AvatarFallback>{getInitials(req.sender?.name || '?')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${req.sender?.id}`} className="font-medium hover:text-primary">
                    {req.sender?.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{roleLabel(req.sender?.role || '')}</p>
                </div>
                {req.sender?.id && <ConnectButton userId={req.sender.id} size="sm" />}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Connections ({connections?.length ?? 0})</h2>
          {isLoading && <CardSkeleton count={4} />}
          {!isLoading && (!connections || connections.length === 0) && (
            <EmptyState
              icon={Users}
              title="No connections yet"
              description="Discover people and send connection requests."
              action={
                <Link href="/discover">
                  <Button className="glow-primary">Discover people</Button>
                </Link>
              }
            />
          )}
          <div className="space-y-3">
            {connections?.map((conn: {
              id: string
              sender_id: string
              receiver_id: string
              sender?: { id: string; name: string; avatar?: string | null; role: string }
              receiver?: { id: string; name: string; avatar?: string | null; role: string }
            }) => {
              const other =
                conn.sender_id === me?.id ? conn.receiver : conn.sender
              if (!other) return null
              return (
                <div key={conn.id} className="glass-card p-4 flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={other.avatar || undefined} />
                    <AvatarFallback>{getInitials(other.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link href={`/users/${other.id}`} className="font-medium hover:text-primary">
                      {other.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{roleLabel(other.role)}</p>
                  </div>
                  <Link href="/messages">
                    <span className="text-sm text-primary">Message</span>
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
