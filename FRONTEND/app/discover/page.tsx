'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageSquare, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useRecommendations, useUserSearch } from '@/lib/hooks/api/use-users'
import { useCreateConversation } from '@/lib/hooks/api/use-messages'
import { useAuthStore } from '@/lib/store'
import { ConnectButton } from '@/components/social/connect-button'
import { getInitials, roleLabel } from '@/lib/utils/format'

export default function DiscoverPage() {
  useProtectedRoute()
  const router = useRouter()
  const me = useAuthStore((s) => s.user)
  const [query, setQuery] = useState('')
  const { data: searchResults, isLoading: searching } = useUserSearch(query)
  const { data: recommendations, isLoading: loadingRec } = useRecommendations()
  const createConversation = useCreateConversation()

  const handleMessage = async (userId: string) => {
    if (!me?.id || userId === me.id) return
    try {
      const res = await createConversation.mutateAsync([userId])
      const convId = res.data.conversation?.id
      if (convId) router.push(`/messages?c=${convId}`)
      else router.push('/messages')
      toast.success('Conversation started')
    } catch {
      toast.error('Could not start conversation')
    }
  }

  const list = query.length >= 1 ? searchResults : recommendations
  const loading = query.length >= 1 ? searching : loadingRec

  return (
    <AppShell title="Discover People">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-12 bg-secondary/50"
          />
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4">
            {query ? 'Search results' : 'Recommended for you'}
          </h2>
          {loading && <CardSkeleton count={4} />}
          {!loading && (!list || list.length === 0) && (
            <EmptyState
              icon={UserPlus}
              title="No people found"
              description="Try a different search or check back later."
            />
          )}
          <div className="space-y-3">
            {list?.map((person: {
              id: string
              name: string
              avatar?: string | null
              role: string
              bio?: string | null
              skills?: string[]
              match?: string
            }) => (
              <div key={person.id} className="glass-card p-4 flex items-center gap-4">
                <Link href={`/users/${person.id}`}>
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={person.avatar || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {getInitials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${person.id}`} className="font-semibold hover:text-primary">
                    {person.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{roleLabel(person.role)}</p>
                  {person.bio && (
                    <p className="text-sm text-muted-foreground truncate mt-1">{person.bio}</p>
                  )}
                  {'match' in person && person.match && (
                    <span className="text-xs text-primary">{person.match} match</span>
                  )}
                </div>
                {me?.id !== person.id && (
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <ConnectButton userId={person.id} size="sm" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMessage(person.id)}
                      disabled={createConversation.isPending}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Message
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
