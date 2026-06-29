'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConnectButton } from '@/components/social/connect-button'
import { NetworkFilterSheet } from '@/components/network/network-filter-sheet'
import { usersAPI, messagesAPI, communitiesAPI } from '@/services/api'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { formatLocation } from '@/lib/utils/location'
import { normalizeLinkedIn, normalizeGitHub, normalizeWebsite } from '@/lib/utils/links'
import {
  EMPTY_NETWORK_FILTERS,
  countActiveFilters,
  filterNetworkMembers,
  type NetworkFilters,
} from '@/lib/network/filters'
import {
  Users,
  Search,
  Mail,
  Linkedin,
  Github,
  ExternalLink,
  MessageSquare,
  Calendar,
  Filter,
  Users2,
  MapPin,
} from 'lucide-react'
import { UserNameWithBadge } from '@/components/social/verified-badge'
import type { ApiUserRecommendation, ApiCommunity } from '@/lib/types/api'
import { openGmailCompose } from './email-actions'
import { toast } from 'sonner'

const PAGE_SIZE = 12

function orgSummary(user: ApiUserRecommendation): string {
  const rd = user.role_details || {}
  const role = user.role?.toLowerCase()
  if (role === 'student') return user.college || String(rd.college_name || '—')
  if (role === 'founder') return String(rd.startup_name || user.company || '—')
  if (role === 'investor' || role === 'mentor') return String(rd.organization || user.company || '—')
  return user.company || String(rd.company_name || '—')
}

export default function NetworkPage() {
  return (
    <Suspense fallback={<AppShell title="Network"><CardSkeleton count={PAGE_SIZE} /></AppShell>}>
      <NetworkPageContent />
    </Suspense>
  )
}

function NetworkPageContent() {
  useProtectedRoute()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<'people' | 'communities'>('people')
  const [members, setMembers] = useState<ApiUserRecommendation[]>([])
  const [communities, setCommunities] = useState<ApiCommunity[]>([])
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({})
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [loadingCommunities, setLoadingCommunities] = useState(false)
  const [filters, setFilters] = useState<NetworkFilters>(EMPTY_NETWORK_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [communitySearch, setCommunitySearch] = useState('')
  const [visibleCommunities, setVisibleCommunities] = useState(PAGE_SIZE)

  useEffect(() => {
    const country = searchParams.get('country')
    setFilters((prev) => ({
      ...prev,
      country: country?.trim() || '',
    }))
  }, [searchParams])

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const { data } = await usersAPI.getDirectory()
      setMembers(data.users || [])
    } catch {
      setMembers([])
      toast.error('Failed to load network members')
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  const loadCommunities = useCallback(async () => {
    setLoadingCommunities(true)
    try {
      const { data } = await communitiesAPI.getAll()
      setCommunities(data.communities || [])
    } catch {
      setCommunities([])
      toast.error('Failed to load communities')
    } finally {
      setLoadingCommunities(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
    loadCommunities()
  }, [loadMembers, loadCommunities])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filters])

  const filteredMembers = useMemo(
    () => filterNetworkMembers(members, filters),
    [members, filters]
  )

  const visibleMembers = filteredMembers.slice(0, visibleCount)
  const hasMoreMembers = visibleCount < filteredMembers.length

  const filteredCommunities = useMemo(() => {
    if (!communitySearch.trim()) return communities
    const q = communitySearch.toLowerCase()
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    )
  }, [communities, communitySearch])

  const visibleCommunityList = filteredCommunities.slice(0, visibleCommunities)
  const hasMoreCommunities = visibleCommunities < filteredCommunities.length

  const activeFilterCount = countActiveFilters(filters)

  const handleStartChat = async (userId: string) => {
    try {
      const { data } = await messagesAPI.createConversation([userId])
      const convId = data.conversation?.id
      router.push(convId ? `/messages?conversation=${convId}` : '/messages')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not start conversation')
    }
  }

  const handleJoinToggle = async (communityId: string) => {
    const isJoined = joinedCommunities[communityId]
    try {
      if (isJoined) {
        await communitiesAPI.leave(communityId)
        setJoinedCommunities((prev) => ({ ...prev, [communityId]: false }))
        toast.success('Left community')
      } else {
        await communitiesAPI.join(communityId)
        setJoinedCommunities((prev) => ({ ...prev, [communityId]: true }))
        toast.success('Joined community')
      }
      loadCommunities()
    } catch {
      toast.error('Failed to update community')
    }
  }

  const resetFilters = () => {
    setFilters(EMPTY_NETWORK_FILTERS)
    if (searchParams.get('country')) {
      router.push('/network')
    }
    toast.success('Filters reset')
  }

  return (
    <AppShell title="Network">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top navigation */}
        <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('people')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'people'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              People
            </button>
            <span className="text-border px-1">|</span>
            <button
              type="button"
              onClick={() => setActiveTab('communities')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'communities'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              Communities
            </button>
          </div>

          {activeTab === 'people' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(true)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[1.25rem]">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}

          {activeTab === 'communities' && (
            <Button size="sm" onClick={() => router.push('/communities/new')}>
              Create
            </Button>
          )}
        </div>

        {/* People */}
        {activeTab === 'people' && (
          <>
            {filters.country && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm text-foreground">
                  Showing members in <span className="font-semibold">{filters.country}</span>
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/network">All countries</Link>
                </Button>
              </div>
            )}
            {loadingMembers ? (
              <CardSkeleton count={PAGE_SIZE} />
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No matches"
                description="Try adjusting your filters."
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleMembers.map((member) => {
                    const location = formatLocation(member)
                    return (
                      <div
                        key={member.id}
                        className="glass-card p-4 flex flex-col gap-3 border-border/50 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="w-11 h-11 border border-border/40 shrink-0">
                            <AvatarImage src={member.avatar || ''} />
                            <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <Link href={`/users/${member.id}`} className="hover:text-primary transition-colors">
                              <UserNameWithBadge
                                name={member.name}
                                verified={member.is_verified}
                                role={member.role}
                                layout="stacked"
                                nameClassName="font-semibold text-sm text-foreground truncate"
                              />
                            </Link>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {roleLabel(member.role)}
                            </p>
                            {member.match_factors?.[0] && (
                              <p className="text-[10px] text-primary/80 mt-1 truncate">
                                {member.match_factors[0]}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="truncate">
                            <span className="text-foreground/80 font-medium">Org:</span> {orgSummary(member)}
                          </p>
                          {location && (
                            <p className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {location}
                            </p>
                          )}
                          {member.skills && member.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {member.skills.slice(0, 3).map((skill) => (
                                <span
                                  key={skill}
                                  className="text-[10px] bg-secondary/70 px-1.5 py-0.5 rounded border border-border/40"
                                >
                                  {skill}
                                </span>
                              ))}
                              {member.skills.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{member.skills.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-muted-foreground border-t border-border/30 pt-2">
                          <button
                            type="button"
                            title={member.email ? 'Email' : 'Email unavailable'}
                            disabled={!member.email}
                            onClick={() => member.email && openGmailCompose(member.email)}
                            className={member.email ? 'hover:text-primary' : 'opacity-40 cursor-not-allowed'}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                          {member.role_details?.linkedin && (
                            <a
                              href={normalizeLinkedIn(member.role_details.linkedin)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary"
                            >
                              <Linkedin className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {(member.role_details?.github || member.github_username) && (
                            <a
                              href={normalizeGitHub(member.role_details?.github || member.github_username)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary"
                            >
                              <Github className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {member.role_details?.website && (
                            <a
                              href={normalizeWebsite(member.role_details.website)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-auto">
                          <ConnectButton userId={member.id} size="sm" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartChat(member.id)}
                            className="h-8 text-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1" />
                            Message
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/sessions?action=schedule&targetId=${member.id}`)}
                            className="h-8 text-xs col-span-2"
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1" />
                            Schedule
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {hasMoreMembers && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Communities */}
        {activeTab === 'communities' && (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search communities"
                value={communitySearch}
                onChange={(e) => {
                  setCommunitySearch(e.target.value)
                  setVisibleCommunities(PAGE_SIZE)
                }}
                className="pl-9 h-9 bg-secondary/30"
              />
            </div>

            {loadingCommunities ? (
              <CardSkeleton count={6} />
            ) : filteredCommunities.length === 0 ? (
              <EmptyState
                icon={Users2}
                title="No communities"
                description="Try a different search or create one."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleCommunityList.map((community) => {
                    const isJoined = joinedCommunities[community.id]
                    return (
                      <div
                        key={community.id}
                        className="glass-card p-4 flex flex-col gap-3 border-border/50 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                            {community.name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{community.name}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {community.member_count} members
                            </p>
                          </div>
                        </div>
                        {community.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {community.description}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-border/30">
                          <Button
                            variant={isJoined ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleJoinToggle(community.id)}
                            className="text-xs h-8"
                          >
                            {isJoined ? 'Leave' : 'Join'}
                          </Button>
                          <Button variant="ghost" size="sm" asChild className="text-xs h-8 border border-border/40">
                            <Link href={`/communities/${community.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {hasMoreCommunities && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCommunities((n) => n + PAGE_SIZE)}
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <NetworkFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
      />
    </AppShell>
  )
}
