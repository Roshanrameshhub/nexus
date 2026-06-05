'use client'

import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConnectButton } from '@/components/social/connect-button'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useConnections, useReceivedRequests, useSentRequests } from '@/lib/hooks/api/use-connections'
import { Users, Mail, Check, XCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function NetworkRequestsPage() {
  useProtectedRoute()
  const me = useAuthStore((s) => s.user)
  const { data: connections, isLoading: loadingConnections } = useConnections()
  const { data: received, isLoading: loadingReceived } = useReceivedRequests()
  const { data: sent, isLoading: loadingSent } = useSentRequests()

  return (
    <AppShell title="Connection Requests">
      <div className="max-w-6xl mx-auto space-y-8">
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="glass-card p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
            <h2 className="text-2xl font-semibold mt-3">Incoming Requests</h2>
            <p className="mt-3 text-sm text-muted-foreground">Review requests and grow your network.</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Sent</p>
            <h2 className="text-2xl font-semibold mt-3">Outgoing Requests</h2>
            <p className="mt-3 text-sm text-muted-foreground">Track pending invites and follow ups.</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Network</p>
            <h2 className="text-2xl font-semibold mt-3">Accepted Connections</h2>
            <p className="mt-3 text-sm text-muted-foreground">Your active relationship network.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Pending Requests</p>
                <h3 className="text-xl font-semibold">{received?.length ?? 0}</h3>
              </div>
              <Users className="w-6 h-6 text-primary" />
            </div>
            {loadingReceived && <CardSkeleton count={2} />}
            {!loadingReceived && (!received || received.length === 0) && (
              <EmptyState
                icon={Mail}
                title="No incoming requests"
                description="When someone sends a request, it will appear here."
                action={
                  <Link href="/discover">
                    <Button className="glow-primary">Discover people</Button>
                  </Link>
                }
              />
            )}
            <div className="space-y-3">
              {received?.map((request: any) => (
                <div key={request.id} className="glass-card p-4 flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={request.sender?.avatar || undefined} />
                    <AvatarFallback>{getInitials(request.sender?.name || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link href={`/users/${request.sender?.id}`} className="font-medium text-foreground hover:text-primary">
                      {request.sender?.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{roleLabel(request.sender?.role)}</p>
                  </div>
                  {request.sender?.id && <ConnectButton userId={request.sender.id} size="sm" />}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Sent Requests</p>
                <h3 className="text-xl font-semibold">{sent?.length ?? 0}</h3>
              </div>
              <Check className="w-6 h-6 text-accent" />
            </div>
            {loadingSent && <CardSkeleton count={2} />}
            {!loadingSent && (!sent || sent.length === 0) && (
              <p className="text-sm text-muted-foreground">You have not sent any connection requests.</p>
            )}
            <div className="space-y-3">
              {sent?.map((request: any) => (
                <div key={request.id} className="glass-card p-4 flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={request.receiver?.avatar || undefined} />
                    <AvatarFallback>{getInitials(request.receiver?.name || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link href={`/users/${request.receiver?.id}`} className="font-medium text-foreground hover:text-primary">
                      {request.receiver?.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{roleLabel(request.receiver?.role)}</p>
                  </div>
                  {request.receiver?.id && <ConnectButton userId={request.receiver.id} size="sm" />}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Accepted</p>
                <h3 className="text-xl font-semibold">{connections?.length ?? 0}</h3>
              </div>
              <XCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            {loadingConnections && <CardSkeleton count={2} />}
            {!loadingConnections && (!connections || connections.length === 0) && (
              <p className="text-sm text-muted-foreground">You have no active connections yet.</p>
            )}
            <div className="space-y-3">
              {connections?.map((connection: any) => {
                const other = connection.sender_id === me?.id ? connection.receiver : connection.sender
                if (!other) return null
                return (
                  <div key={connection.id} className="glass-card p-4 flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={other.avatar || undefined} />
                      <AvatarFallback>{getInitials(other.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link href={`/users/${other.id}`} className="font-medium text-foreground hover:text-primary">
                        {other.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{roleLabel(other.role)}</p>
                    </div>
                    <ConnectButton userId={other.id} size="sm" />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
