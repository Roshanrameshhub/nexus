'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  MessageSquare,
  Calendar,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/layout/app-shell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useConnections } from '@/lib/hooks/api/use-connections'
import { getConnectionPeer } from '@/lib/mappers/connections'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import { getMediaUrl } from '@/lib/config/api'
import { useAuthStore } from '@/lib/store'
import { messagesAPI } from '@/services/api'

export default function ConnectionsPage() {
  useProtectedRoute()
  const router = useRouter()
  const me = useAuthStore((s) => s.user)
  const { data: connections = [], isLoading } = useConnections()

  const connectedPeers = useMemo(
    () =>
      connections
        .map((connection) => {
          const peer = getConnectionPeer(connection, me?.id ?? '')
          if (!peer) return null
          return { connection, peer }
        })
        .filter(Boolean) as Array<{
        connection: (typeof connections)[number]
        peer: NonNullable<ReturnType<typeof getConnectionPeer>>
      }>,
    [connections, me?.id]
  )

  const handleMessage = async (userId: string) => {
    try {
      const { data } = await messagesAPI.createConversation([userId])
      const convId = data.conversation?.id
      router.push(convId ? `/messages?conversation=${convId}` : '/messages')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not start conversation')
    }
  }

  return (
    <AppShell title="My Connections">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {connections.length} active connection{connections.length === 1 ? '' : 's'}
          </p>
        </div>

        {isLoading && <CardSkeleton count={3} />}

        {!isLoading && connectedPeers.length === 0 && (
          <EmptyState
            icon={Users}
            title="No connections yet"
            description="Discover people on the Network and send connection requests."
            action={
              <Link href="/network">
                <Button className="glow-primary">Go to Network</Button>
              </Link>
            }
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {connectedPeers.map(({ connection, peer }) => (
            <div
              key={connection.id}
              className="glass-card p-5 flex flex-col justify-between hover:border-primary/40 transition-all border-border/50"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="w-12 h-12 border border-border/40 shrink-0">
                      <AvatarImage src={getMediaUrl(peer.avatar)} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                        {getInitials(peer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <Link
                        href={`/users/${peer.id}`}
                        className="hover:text-primary transition-colors block"
                      >
                        <UserNameWithBadge
                          name={peer.name}
                          verified={peer.is_verified}
                          role={peer.role}
                          layout="stacked"
                          nameClassName="font-bold text-base text-foreground"
                        />
                      </Link>
                      <p className="text-sm text-muted-foreground">{roleLabel(peer.role)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-primary">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleMessage(String(peer.id))}
                  className="w-full h-8 text-xs font-semibold"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  Message
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full h-8 text-xs font-semibold"
                >
                  <Link href={`/users/${peer.id}`}>View Profile</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/sessions?action=schedule&targetId=${peer.id}`)}
                  className="w-full text-xs h-8 text-primary hover:bg-primary/5 border border-primary/10 col-span-2 mt-1 justify-center"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  Schedule Meeting
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
