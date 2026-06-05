'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  useCommunity,
  useCreateDiscussion,
  useDiscussions,
  useJoinCommunity,
  useLeaveCommunity,
} from '@/lib/hooks/api/use-communities'
import { formatTimeAgo } from '@/lib/utils/format'

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const { data: community, isLoading } = useCommunity(id)
  const { data: discussions, refetch } = useDiscussions(id)
  const join = useJoinCommunity()
  const leave = useLeaveCommunity()
  const createDiscussion = useCreateDiscussion(id)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleJoin = async () => {
    try {
      await join.mutateAsync(id)
      toast.success('Joined community')
    } catch {
      toast.error('Could not join')
    }
  }

  const handleLeave = async () => {
    try {
      await leave.mutateAsync(id)
      toast.success('Left community')
    } catch {
      toast.error('Could not leave')
    }
  }

  const handleDiscussion = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createDiscussion.mutateAsync({ title, content })
      setTitle('')
      setContent('')
      setShowForm(false)
      refetch()
      toast.success('Discussion created')
    } catch {
      toast.error('Could not create discussion')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={3} />
      </AppShell>
    )
  }

  return (
    <AppShell title={community?.name || 'Community'}>
      <div className="max-w-3xl mx-auto space-y-6">
        {community && (
          <div className="glass-card p-6">
            <p className="text-muted-foreground">{community.description}</p>
            <p className="text-sm text-muted-foreground mt-2">{community.member_count} members</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleJoin} disabled={join.isPending}>
                Join
              </Button>
              <Button size="sm" variant="outline" onClick={handleLeave} disabled={leave.isPending}>
                Leave
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                <Plus className="w-4 h-4 mr-1" /> New discussion
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleDiscussion} className="glass-card p-4 space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Textarea placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} required />
            <Button type="submit" className="glow-primary" disabled={createDiscussion.isPending}>
              Post discussion
            </Button>
          </form>
        )}

        <h2 className="text-lg font-semibold">Discussions</h2>
        <div className="space-y-3">
          {discussions?.map((d: {
            id: string
            title: string
            content: string
            created_at: string
            author?: { name: string }
          }) => (
            <div key={d.id} className="glass-card p-4">
              <h3 className="font-semibold">{d.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {d.author?.name} · {formatTimeAgo(d.created_at)}
              </p>
              <p className="mt-2 text-muted-foreground">{d.content}</p>
            </div>
          ))}
          {discussions?.length === 0 && (
            <p className="text-sm text-muted-foreground">No discussions yet.</p>
          )}
        </div>

        <Link href="/community" className="text-sm text-primary">
          ← All communities
        </Link>
      </div>
    </AppShell>
  )
}
