'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AdminShell } from '@/components/layout/admin-shell'
import { AdminPostCard } from '@/components/admin/admin-post-card'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/services/api'
import type { AdminContentPost } from '@/lib/types/api'
import { toast } from 'sonner'

const TABS = [
  { id: 'recent', label: 'Recent Posts' },
  { id: 'trending_week', label: 'Trending This Week' },
  { id: 'trending_month', label: 'Trending This Month' },
  { id: 'most_discussed', label: 'Most Discussed' },
  { id: 'most_liked', label: 'Most Liked' },
  { id: 'reported', label: 'Reported Content' },
  { id: 'pinned', label: 'Pinned Posts' },
] as const

type TabId = (typeof TABS)[number]['id']

const EXPIRY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 0, label: 'Never Expire' },
]

export default function AdminContentCenterPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading content center…</div>}>
      <AdminContentCenterContent />
    </Suspense>
  )
}

function AdminContentCenterContent() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId) || 'recent'
  const [tab, setTab] = useState<TabId>(initialTab)
  const [posts, setPosts] = useState<AdminContentPost[]>([])
  const [pinnedCount, setPinnedCount] = useState(0)
  const [maxPinned, setMaxPinned] = useState(10)
  const [loading, setLoading] = useState(true)
  const [pinning, setPinning] = useState(false)
  const [expiryDays, setExpiryDays] = useState(30)
  const [pinTarget, setPinTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminAPI.contentPosts(tab)
      setPosts(data.posts ?? [])
      setPinnedCount(data.pinned_count ?? 0)
      setMaxPinned(data.max_pinned ?? 10)
    } catch {
      toast.error('Failed to load content')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const confirmPin = async (postId: string) => {
    setPinning(true)
    try {
      await adminAPI.pinPost(postId, undefined, expiryDays === 0 ? undefined : expiryDays)
      toast.success('Post pinned')
      setPinTarget(null)
      void load()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to pin post')
    } finally {
      setPinning(false)
    }
  }

  const unpin = async (postId: string) => {
    setPinning(true)
    try {
      await adminAPI.unpinPost(postId)
      toast.success('Post unpinned')
      void load()
    } catch {
      toast.error('Failed to unpin')
    } finally {
      setPinning(false)
    }
  }

  return (
    <AdminShell title="Content Center">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Discover feed posts and manage pins without UUIDs. Pinned: {pinnedCount}/{maxPinned}
        </p>
        <Link
          href="/admin/broadcast"
          className="text-sm text-primary hover:underline font-medium"
        >
          Open Broadcast Center →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? 'default' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {pinTarget && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-300">Pin expiry:</span>
          <select
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button size="sm" disabled={pinning} onClick={() => void confirmPin(pinTarget)}>
            Confirm Pin
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPinTarget(null)}>Cancel</Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-slate-500">No posts in this view.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => (
            <AdminPostCard
              key={post.id}
              post={post}
              pinning={pinning}
              onPin={(id) => setPinTarget(id)}
              onUnpin={(id) => void unpin(id)}
            />
          ))}
        </div>
      )}
    </AdminShell>
  )
}
