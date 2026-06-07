'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, MapPin, ExternalLink, Github, Linkedin, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useUser } from '@/lib/hooks/api/use-users'
import { useCreateConversation } from '@/lib/hooks/api/use-messages'
import { useConnectionStatus } from '@/lib/hooks/api/use-connections'
import { useAuthStore } from '@/lib/store'
import { ConnectButton } from '@/components/social/connect-button'
import { getInitials, roleLabel } from '@/lib/utils/format'
import {
  getOrganizationSectionTitle,
  getProfileHeadline,
  getPublicProfileUrl,
  getRoleDetailRows,
  getSocialLinks,
} from '@/app/profile/utils'

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)
  const router = useRouter()
  const me = useAuthStore((s) => s.user)
  const { data: profile, isLoading } = useUser(id)
  const createConversation = useCreateConversation()
  const { data: connectionStatus } = useConnectionStatus(id)

  const handleMessage = async () => {
    if (connectionStatus?.status !== 'accepted') {
      toast.error('Connect with them to start a conversation')
      return
    }
    try {
      const res = await createConversation.mutateAsync([id])
      const convId = res.data.conversation?.id
      router.push(convId ? `/messages?conversation=${convId}` : '/messages')
      toast.success('Conversation started')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not start conversation')
    }
  }

  const handleShare = async () => {
    const url = getPublicProfileUrl(id)
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile?.name} on Nexus`, url })
        return
      }
    } catch {
      /* copy fallback */
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Profile link copied')
    } catch {
      toast.error('Could not copy link')
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
        <Link href="/network" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Network
        </Link>
      </AppShell>
    )
  }

  const isOwn = me?.id === String(profile.id)
  const headline = getProfileHeadline(profile)
  const orgTitle = getOrganizationSectionTitle(profile.role)
  const detailRows = getRoleDetailRows(profile)
  const social = getSocialLinks(profile)

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/network" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Network
        </Link>

        <div className="glass-card p-8">
          <div className="text-center">
            <Avatar className="w-24 h-24 mx-auto mb-4">
              <AvatarImage src={profile.avatar || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <p className="text-muted-foreground">{headline}</p>
            <p className="text-xs text-muted-foreground mt-1">{roleLabel(profile.role)}</p>
            {profile.country && (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-2">
                <MapPin className="w-3.5 h-3.5" /> {profile.country}
              </p>
            )}
            {profile.bio && <p className="mt-4 text-muted-foreground text-left">{profile.bio}</p>}
          </div>

          {(profile.skills?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {(profile.skills ?? []).map((s: string) => (
                <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3 mt-4">
            {social.github && (
              <a href={social.github} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                <Github className="w-5 h-5" />
              </a>
            )}
            {social.linkedin && (
              <a href={social.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                <Linkedin className="w-5 h-5" />
              </a>
            )}
            {social.website && (
              <a href={social.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>

          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            {isOwn ? (
              <>
                <Link href="/profile/complete">
                  <Button className="glow-primary">Edit Profile</Button>
                </Link>
                <Button variant="outline" onClick={() => void handleShare()}>
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </>
            ) : (
              <>
                <ConnectButton userId={id} />
                {connectionStatus?.status === 'accepted' ? (
                  <Button variant="outline" onClick={handleMessage}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground self-center">
                    Connect first to start a conversation.
                  </p>
                )}
                <Button variant="outline" onClick={() => void handleShare()}>
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </>
            )}
          </div>
        </div>

        {detailRows.length > 0 && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-foreground">{orgTitle}</h2>
            {detailRows.map((row) => (
              <div key={row.label}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{row.label}</p>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{row.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
