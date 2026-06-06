'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useUser } from '@/lib/hooks/api/use-users'
import { useCreateConversation } from '@/lib/hooks/api/use-messages'
import { useAuthStore } from '@/lib/store'
import { ConnectButton } from '@/components/social/connect-button'
import { getInitials, roleLabel } from '@/lib/utils/format'

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const router = useRouter()
  const me = useAuthStore((s) => s.user)
  const { data: profile, isLoading } = useUser(id)
  const createConversation = useCreateConversation()

  const handleMessage = async () => {
    try {
      const res = await createConversation.mutateAsync([id])
      const convId = res.data.conversation?.id
      router.push(convId ? `/messages?c=${convId}` : '/messages')
      toast.success('Conversation started')
    } catch {
      toast.error('Could not start conversation')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={2} />
      </AppShell>
    )
  }

  if (!profile) {
    return (
      <AppShell title="User not found">
        <Link href="/discover" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Discover
        </Link>
      </AppShell>
    )
  }

  const isOwn = me?.id === String(profile.id)

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Link href="/discover" className="text-sm text-muted-foreground flex items-center gap-1 mb-6 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Discover
        </Link>
        <div className="glass-card p-8 text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4">
            <AvatarImage src={profile.avatar || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <p className="text-muted-foreground">{roleLabel(profile.role)}</p>
          {profile.bio && <p className="mt-4 text-muted-foreground">{profile.bio}</p>}
          {(profile.skills?.length ?? 0) > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {(profile.skills ?? []).map((s: string) => (
                <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3 mt-6">
            {isOwn ? (
              <Link href="/profile/complete">
                <Button className="glow-primary">Edit Profile</Button>
              </Link>
            ) : (
              <>
                <ConnectButton userId={id} />
                <Button variant="outline" onClick={handleMessage}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
