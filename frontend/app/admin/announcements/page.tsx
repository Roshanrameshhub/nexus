'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { adminAPI } from '@/services/api'
import type { AdminAnnouncement } from '@/lib/types/api'
import { toast } from 'sonner'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const AUDIENCES = [
  { value: 'all', label: 'All Users' },
  { value: 'students', label: 'Students' },
  { value: 'founders', label: 'Founders' },
  { value: 'investors', label: 'Investors' },
  { value: 'mentors', label: 'Mentors' },
  { value: 'recruiters', label: 'Recruiters' },
  { value: 'verified', label: 'Verified Members' },
  { value: 'custom', label: 'Custom Audience' },
]
const CTA_LABELS = ['Apply Now', 'Join Session', 'Read More', 'Visit Website', 'Register']
const EXPIRY_PRESETS = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
]

function addDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AdminAnnouncement[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('all')
  const [priority, setPriority] = useState('medium')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [customAudience, setCustomAudience] = useState('')
  const [expiryDays, setExpiryDays] = useState(7)
  const [useCustomExpiry, setUseCustomExpiry] = useState(false)
  const [customExpiry, setCustomExpiry] = useState('')
  const [scheduleLater, setScheduleLater] = useState(false)
  const [publishAt, setPublishAt] = useState('')

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
      await adminAPI.createAnnouncement({
        title: title.trim(),
        content: content.trim(),
        audience,
        priority,
        cta_label: ctaLabel || undefined,
        cta_url: ctaUrl || undefined,
        custom_audience: audience === 'custom' ? customAudience : undefined,
        expires_at: useCustomExpiry && customExpiry ? new Date(customExpiry).toISOString() : addDays(expiryDays),
        publish_at: scheduleLater && publishAt ? new Date(publishAt).toISOString() : new Date().toISOString(),
      })
      setTitle('')
      setContent('')
      setCtaLabel('')
      setCtaUrl('')
      setCustomAudience('')
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

  const ctr = (item: AdminAnnouncement) => {
    const views = item.view_count || 0
    const clicks = item.click_count || 0
    if (!views) return '0%'
    return `${Math.round((clicks / views) * 100)}%`
  }

  const priorityClass = (p: string) => {
    switch (p) {
      case 'critical': return 'border-red-500/40 bg-red-500/10'
      case 'high': return 'border-orange-500/40 bg-orange-500/10'
      case 'medium': return 'border-blue-500/40 bg-blue-500/10'
      default: return 'border-slate-700 bg-slate-900/60'
    }
  }

  return (
    <AdminShell title="Announcements">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 mb-6 space-y-3">
        <h3 className="font-semibold text-white">Create Announcement</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-slate-950 border-slate-700" />
        <Textarea placeholder="Message" value={content} onChange={(e) => setContent(e.target.value)} className="bg-slate-950 border-slate-700" />
        <div className="grid gap-3 md:grid-cols-2">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        {audience === 'custom' && (
          <Input placeholder='Custom audience JSON e.g. ["founder","user-uuid"]' value={customAudience} onChange={(e) => setCustomAudience(e.target.value)} className="bg-slate-950 border-slate-700" />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <select value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="">No CTA</option>
            {CTA_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <Input placeholder="CTA URL (optional)" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="bg-slate-950 border-slate-700" />
        </div>
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={scheduleLater} onChange={(e) => setScheduleLater(e.target.checked)} />
            Schedule publish
          </label>
          {scheduleLater && (
            <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="bg-slate-950 border-slate-700 max-w-xs" />
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <label className="flex items-center gap-2 text-slate-300">
            <input type="checkbox" checked={useCustomExpiry} onChange={(e) => setUseCustomExpiry(e.target.checked)} />
            Custom expiry date
          </label>
          {!useCustomExpiry ? (
            <select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {EXPIRY_PRESETS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
          ) : (
            <Input type="datetime-local" value={customExpiry} onChange={(e) => setCustomExpiry(e.target.value)} className="bg-slate-950 border-slate-700 max-w-xs" />
          )}
        </div>
        <Button onClick={() => void create()}>Publish Announcement</Button>
      </div>

      <h3 className="text-lg font-semibold text-white mb-3">Announcement Performance</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`rounded-lg border p-4 ${priorityClass(item.priority ?? 'medium')}`}>
            <div className="flex justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-sm text-slate-400 mt-1">{item.content}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {item.priority?.toUpperCase()} · Audience: {item.audience}
                  {item.expires_at && ` · Expires ${new Date(item.expires_at).toLocaleString()}`}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Views: {item.view_count ?? 0} · Clicks: {item.click_count ?? 0} · CTR: {ctr(item)} · Dismissals: {item.dismiss_count ?? 0}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void remove(item.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
