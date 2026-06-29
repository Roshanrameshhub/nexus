'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  useConnections,
  useReceivedRequests,
  useSentRequests,
  useAcceptConnection,
  useRejectConnection,
} from '@/lib/hooks/api/use-connections'
import { Users, Mail, Check, UserCheck, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'

function SummaryCard({
  label,
  title,
  count,
  description,
  icon: Icon,
}: {
  label: string
  title: string
  count: number
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="glass-card p-5 flex flex-col h-full min-h-[148px]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <h2 className="text-base font-semibold text-foreground mt-2 leading-snug">{title}</h2>
      <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">{count}</p>
      <p className="text-sm text-muted-foreground mt-auto pt-2 leading-relaxed">{description}</p>
    </div>
  )
}

function ColumnHeader({
  label,
  count,
  icon: Icon,
}: {
  label: string
  count: number
  icon: LucideIcon
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-border/40 shrink-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{count}</p>
      </div>
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
    </div>
  )
}

function CompactEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 px-3 rounded-lg border border-dashed border-border/40 bg-secondary/10 flex-1 min-h-[120px]">
      <Icon className="w-5 h-5 text-muted-foreground mb-2" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

function ConnectionUserRow({
  id,
  name,
  role,
  avatar,
}: {
  id: string
  name: string
  role?: string
  avatar?: string | null
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/10 p-3 flex items-center gap-3 min-h-[72px]">
      <Avatar className="w-11 h-11 shrink-0 border border-border/40">
        <AvatarImage src={avatar || undefined} />
        <AvatarFallback className="text-sm">{getInitials(name || '?')}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <Link href={`/users/${id}`} className="font-medium text-sm text-foreground hover:text-primary truncate block">
          {name}
        </Link>
        <p className="text-xs text-muted-foreground truncate">{roleLabel(role)}</p>
      </div>
    </div>
  )
}

function IncomingRequestRow({
  requestId,
  senderId,
  name,
  role,
  avatar,
}: {
  requestId: string
  senderId: string
  name: string
  role?: string
  avatar?: string | null
}) {
  const accept = useAcceptConnection()
  const reject = useRejectConnection()

  const handleAccept = async () => {
    try {
      await accept.mutateAsync(requestId)
      toast.success('Connection accepted')
    } catch {
      toast.error('Could not accept request')
    }
  }

  const handleDecline = async () => {
    try {
      await reject.mutateAsync(requestId)
      toast.success('Request declined')
    } catch {
      toast.error('Could not decline request')
    }
  }

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/10 p-3 flex flex-col sm:flex-row sm:items-center gap-3 min-h-[72px]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="w-11 h-11 shrink-0 border border-border/40">
          <AvatarImage src={avatar || undefined} />
          <AvatarFallback className="text-sm">{getInitials(name || '?')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <Link href={`/users/${senderId}`} className="font-medium text-sm text-foreground hover:text-primary truncate block">
            {name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{roleLabel(role)}</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          className="glow-primary h-8"
          onClick={() => void handleAccept()}
          disabled={accept.isPending || reject.isPending}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => void handleDecline()}
          disabled={accept.isPending || reject.isPending}
        >
          <X className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Decline</span>
        </Button>
      </div>
    </div>
  )
}

export default function NetworkRequestsPage() {
  useProtectedRoute()
  const me = useAuthStore((s) => s.user)
  const { data: connections, isLoading: loadingConnections } = useConnections()
  const { data: received, isLoading: loadingReceived } = useReceivedRequests()
  const { data: sent, isLoading: loadingSent } = useSentRequests()

  const incomingCount = received?.length ?? 0
  const outgoingCount = sent?.length ?? 0
  const acceptedCount = connections?.length ?? 0

  return (
    <AppShell title="Connection Requests">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <SummaryCard
            label="Pending"
            title="Incoming Requests"
            count={incomingCount}
            description="Review requests and grow your network."
            icon={Mail}
          />
          <SummaryCard
            label="Sent"
            title="Outgoing Requests"
            count={outgoingCount}
            description="Track pending invites and follow ups."
            icon={Check}
          />
          <SummaryCard
            label="Network"
            title="Accepted Connections"
            count={acceptedCount}
            description="Your active relationship network."
            icon={UserCheck}
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <div className="glass-card p-5 flex flex-col h-full min-h-[320px]">
            <ColumnHeader label="Pending Requests" count={incomingCount} icon={Mail} />
            <div className="flex flex-col flex-1 min-h-0 gap-3">
              {loadingReceived && <CardSkeleton count={2} />}
              {!loadingReceived && incomingCount === 0 && (
                <CompactEmpty
                  icon={Mail}
                  title="No incoming requests"
                  description="When someone sends a request, it will appear here."
                  action={
                    <Link href="/discover">
                      <Button size="sm" className="glow-primary">
                        Discover people
                      </Button>
                    </Link>
                  }
                />
              )}
              {!loadingReceived && incomingCount > 0 && (
                <div className="space-y-2 flex-1">
                  {received?.map((request) =>
                    request.sender?.id ? (
                      <IncomingRequestRow
                        key={request.id}
                        requestId={request.id}
                        senderId={request.sender.id}
                        name={request.sender.name || 'Unknown'}
                        role={request.sender.role}
                        avatar={request.sender.avatar}
                      />
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 flex flex-col h-full min-h-[320px]">
            <ColumnHeader label="Sent Requests" count={outgoingCount} icon={Check} />
            <div className="flex flex-col flex-1 min-h-0 gap-3">
              {loadingSent && <CardSkeleton count={2} />}
              {!loadingSent && outgoingCount === 0 && (
                <CompactEmpty
                  icon={Check}
                  title="No sent requests"
                  description="You have not sent any connection requests yet."
                />
              )}
              {!loadingSent && outgoingCount > 0 && (
                <div className="space-y-2 flex-1">
                  {sent?.map((request) =>
                    request.receiver?.id ? (
                      <ConnectionUserRow
                        key={request.id}
                        id={request.receiver.id}
                        name={request.receiver.name || 'Unknown'}
                        role={request.receiver.role}
                        avatar={request.receiver.avatar}
                      />
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 flex flex-col h-full min-h-[320px]">
            <ColumnHeader label="Accepted Connections" count={acceptedCount} icon={Users} />
            <div className="flex flex-col flex-1 min-h-0 gap-3">
              {loadingConnections && <CardSkeleton count={2} />}
              {!loadingConnections && acceptedCount === 0 && (
                <CompactEmpty
                  icon={Users}
                  title="No connections yet"
                  description="Accepted connections will appear here."
                  action={
                    <Link href="/network">
                      <Button size="sm" variant="outline">
                        Explore network
                      </Button>
                    </Link>
                  }
                />
              )}
              {!loadingConnections && acceptedCount > 0 && (
                <div className="space-y-2 flex-1">
                  {connections?.map((connection) => {
                    const other = connection.sender_id === me?.id ? connection.receiver : connection.sender
                    if (!other) return null
                    return (
                      <ConnectionUserRow
                        key={connection.id}
                        id={other.id}
                        name={other.name}
                        role={other.role}
                        avatar={other.avatar}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
