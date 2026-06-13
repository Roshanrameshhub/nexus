'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface PinnedPost {
  id: string
  content: string
  author_name: string
  pin_order?: number
}

export default function AdminPinnedPage() {
  const [posts, setPosts] = useState<PinnedPost[]>([])
  const [postId, setPostId] = useState('')

  const load = useCallback(async () => {
    const { data } = await adminAPI.pinnedPosts()
    setPosts(data.pinned_posts ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pin = async () => {
    if (!postId.trim()) return
    try {
      await adminAPI.pinPost(postId.trim())
      setPostId('')
      toast.success('Post pinned')
      void load()
    } catch {
      toast.error('Failed to pin post (max 5)')
    }
  }

  const unpin = async (id: string) => {
    try {
      await adminAPI.unpinPost(id)
      toast.success('Unpinned')
      void load()
    } catch {
      toast.error('Failed to unpin')
    }
  }

  return (
    <AdminShell title="Pinned Posts">
      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Post UUID to pin..."
          value={postId}
          onChange={(e) => setPostId(e.target.value)}
          className="max-w-md bg-slate-900 border-slate-700"
        />
        <Button onClick={() => void pin()}>Pin Post</Button>
      </div>
      <p className="text-xs text-slate-500 mb-4">Maximum 5 pinned posts.</p>
      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex justify-between gap-4">
            <div>
              <p className="text-sm text-white">{post.content}</p>
              <p className="text-xs text-slate-500 mt-1">
                {post.author_name} · order {post.pin_order ?? '-'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void unpin(post.id)}>
              Unpin
            </Button>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
