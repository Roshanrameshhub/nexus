'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { Hash, Mail, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useCreateChannel, useInviteToTeam, useTeam, useTeamChannels } from '@/lib/hooks/api/use-teams'

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const { data: team, isLoading } = useTeam(id)
  const { data: channels, refetch } = useTeamChannels(id)
  const invite = useInviteToTeam(id)
  const createChannel = useCreateChannel(id)
  const [inviteEmail, setInviteEmail] = useState('')
  const [channelName, setChannelName] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await invite.mutateAsync(inviteEmail)
      setInviteEmail('')
      toast.success('Invitation sent')
    } catch {
      toast.error('Could not invite member')
    }
  }

  const handleChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createChannel.mutateAsync(channelName)
      setChannelName('')
      refetch()
      toast.success('Channel created')
    } catch {
      toast.error('Could not create channel')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={2} />
      </AppShell>
    )
  }

  return (
    <AppShell title={team?.name || 'Team'}>
      <div className="max-w-3xl mx-auto space-y-6">
        {team && (
          <div className="glass-card p-6">
            <p className="text-muted-foreground">{team.description}</p>
            <p className="text-sm text-muted-foreground mt-2">{team.member_count} members</p>
          </div>
        )}

        <form onSubmit={handleInvite} className="glass-card p-4 flex gap-2">
          <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-2.5" />
          <Input
            type="email"
            placeholder="Invite by email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="bg-secondary/50"
            required
          />
          <Button type="submit" disabled={invite.isPending}>
            Invite
          </Button>
        </form>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Hash className="w-5 h-5" /> Channels
          </h2>
          <form onSubmit={handleChannel} className="flex gap-2 mb-4">
            <Input
              placeholder="New channel name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="bg-secondary/50"
            />
            <Button type="submit" variant="outline" disabled={createChannel.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
          <div className="space-y-2">
            {channels?.map((ch: { id: string; name: string }) => (
              <div key={ch.id} className="glass-card px-4 py-3 flex items-center gap-2">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{ch.name}</span>
              </div>
            ))}
            {channels?.length === 0 && (
              <p className="text-sm text-muted-foreground">No channels yet.</p>
            )}
          </div>
        </div>

        <Link href="/workspace" className="text-sm text-primary">
          ← Workspace
        </Link>
      </div>
    </AppShell>
  )
}
