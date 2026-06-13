'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface Announcement {
  id: string
  title: string
  content: string
  audience: string
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('all')

  const load = useCallback(async () => {
    const { data } = await adminAPI.announcements()
    setItems(data.announcements ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!title.trim() || !content.trim()) return
    try {
      await adminAPI.createAnnouncement({ title, content, audience })
      setTitle('')
      setContent('')
      toast.success('Announcement created')
      void load()
    } catch {
      toast.error('Failed to create announcement')
    }
  }

  const remove = async (id: string) => {
    try {
      await adminAPI.deleteAnnouncement(id)
      toast.success('Deleted')
      void load()
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <AdminShell title="Announcements">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 mb-6 space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-slate-950 border-slate-700"
        />
        <Textarea
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="bg-slate-950 border-slate-700"
        />
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="all">All Users</option>
          <option value="students">Students</option>
          <option value="founders">Founders</option>
          <option value="verified">Verified Users</option>
        </select>
        <Button onClick={() => void create()}>Create Announcement</Button>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-sm text-slate-400 mt-1">{item.content}</p>
                <p className="text-xs text-slate-500 mt-2">Audience: {item.audience}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void remove(item.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
