'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { adminAPI } from '@/services/api'
import type { AdminBroadcast, AdminAnnouncement } from '@/lib/types/api'
import { toast } from 'sonner'
import { Megaphone, Pin, Bell } from 'lucide-react'

type BroadcastTab = 'announcement' | 'admin_post' | 'notification'

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'students', label: 'Students' },
  { value: 'developers', label: 'Developers' },
  { value: 'founders', label: 'Founders' },
  { value: 'executives', label: 'Executives' },
  { value: 'investors', label: 'Investors' },
  { value: 'verified', label: 'Verified Members' },
  { value: 'custom', label: 'Custom' },
]

const POST_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'poll', label: 'Poll' },
  { value: 'event', label: 'Event' },
  { value: 'product_update', label: 'Product Update' },
  { value: 'platform_update', label: 'Platform Update' },
]

const OFFICIAL_LABELS = ['RConnectX Team', 'Official Admin Post']

function DeliveryOptions({
  showDashboard,
  setShowDashboard,
  showNotificationCenter,
  setShowNotificationCenter,
  sendInApp,
  setSendInApp,
  sendBrowserPush,
  setSendBrowserPush,
  sendMobilePush,
  setSendMobilePush,
}: {
  showDashboard: boolean
  setShowDashboard: (v: boolean) => void
  showNotificationCenter: boolean
  setShowNotificationCenter: (v: boolean) => void
  sendInApp: boolean
  setSendInApp: (v: boolean) => void
  sendBrowserPush: boolean
  setSendBrowserPush: (v: boolean) => void
  sendMobilePush: boolean
  setSendMobilePush: (v: boolean) => void
}) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/50 p-3 space-y-2">
      <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">Delivery options</p>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={showDashboard} onChange={(e) => setShowDashboard(e.target.checked)} />
        Show in Dashboard
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={showNotificationCenter} onChange={(e) => setShowNotificationCenter(e.target.checked)} />
        Show in Notification Center
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={sendInApp} onChange={(e) => setSendInApp(e.target.checked)} />
        Send In-App Notification
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={sendBrowserPush} onChange={(e) => setSendBrowserPush(e.target.checked)} />
        Send Browser Push Notification
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={sendMobilePush} onChange={(e) => setSendMobilePush(e.target.checked)} />
        Send Mobile Push Notification
      </label>
    </div>
  )
}

function AudienceFields({
  audience,
  setAudience,
  customAudience,
  setCustomAudience,
  targetCountry,
  setTargetCountry,
  targetCity,
  setTargetCity,
}: {
  audience: string
  setAudience: (v: string) => void
  customAudience: string
  setCustomAudience: (v: string) => void
  targetCountry: string
  setTargetCountry: (v: string) => void
  targetCity: string
  setTargetCity: (v: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <select
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
        className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm"
      >
        {AUDIENCES.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>
      <Input
        placeholder="Target country (optional)"
        value={targetCountry}
        onChange={(e) => setTargetCountry(e.target.value)}
        className="bg-slate-950 border-slate-700"
      />
      <Input
        placeholder="Target city (optional)"
        value={targetCity}
        onChange={(e) => setTargetCity(e.target.value)}
        className="bg-slate-950 border-slate-700"
      />
      {audience === 'custom' && (
        <Input
          placeholder='Custom audience JSON e.g. ["founder","student"]'
          value={customAudience}
          onChange={(e) => setCustomAudience(e.target.value)}
          className="bg-slate-950 border-slate-700 md:col-span-2"
        />
      )}
    </div>
  )
}

export default function AdminBroadcastPage() {
  const [tab, setTab] = useState<BroadcastTab>('announcement')
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([])
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('all')
  const [customAudience, setCustomAudience] = useState('')
  const [targetCountry, setTargetCountry] = useState('')
  const [targetCity, setTargetCity] = useState('')
  const [priority, setPriority] = useState('medium')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [postType, setPostType] = useState('text')
  const [mediaUrl, setMediaUrl] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [officialLabel, setOfficialLabel] = useState('RConnectX Team')
  const [showInAnnouncementsHub, setShowInAnnouncementsHub] = useState(false)

  const [showDashboard, setShowDashboard] = useState(true)
  const [showNotificationCenter, setShowNotificationCenter] = useState(true)
  const [sendInApp, setSendInApp] = useState(true)
  const [sendBrowserPush, setSendBrowserPush] = useState(true)
  const [sendMobilePush, setSendMobilePush] = useState(false)

  const deliveryPayload = {
    show_in_dashboard: showDashboard,
    show_in_notification_center: showNotificationCenter,
    send_in_app_notification: sendInApp,
    send_browser_push: sendBrowserPush,
    send_mobile_push: sendMobilePush,
  }

  const audiencePayload = {
    audience,
    custom_audience: audience === 'custom' ? customAudience : undefined,
    target_country: targetCountry || undefined,
    target_city: targetCity || undefined,
  }

  const load = useCallback(async () => {
    const [broadcastRes, annRes] = await Promise.all([
      adminAPI.broadcasts(),
      adminAPI.announcements(),
    ])
    setBroadcasts(broadcastRes.data.broadcasts ?? [])
    setAnnouncements(annRes.data.announcements ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setTitle('')
    setContent('')
    setCtaLabel('')
    setCtaUrl('')
    setLinkUrl('')
    setMediaUrl('')
    setPollOptions(['', ''])
    setCustomAudience('')
    setTargetCountry('')
    setTargetCity('')
  }

  const publish = async () => {
    if (!content.trim() || (tab !== 'admin_post' && !title.trim())) {
      toast.error('Title and content are required')
      return
    }
    setSubmitting(true)
    try {
      if (tab === 'announcement') {
        await adminAPI.broadcastAnnouncement({
          title: title.trim(),
          content: content.trim(),
          priority,
          cta_label: ctaLabel || undefined,
          cta_url: ctaUrl || undefined,
          ...audiencePayload,
          ...deliveryPayload,
        })
        toast.success('Announcement published')
      } else if (tab === 'admin_post') {
        const { data } = await adminAPI.broadcastAdminPost({
          title: title.trim() || content.trim().slice(0, 80),
          content: content.trim(),
          post_type: postType,
          media: mediaUrl ? [mediaUrl] : undefined,
          poll_options: postType === 'poll' ? pollOptions.filter(Boolean) : undefined,
          official_label: officialLabel,
          show_in_announcements_hub: showInAnnouncementsHub,
          ...audiencePayload,
          ...deliveryPayload,
        })
        toast.success(`Official post published (${data.recipients_notified ?? 0} notified)`)
      } else {
        const { data } = await adminAPI.broadcastNotification({
          title: title.trim(),
          content: content.trim(),
          link_url: linkUrl || undefined,
          ...audiencePayload,
          ...deliveryPayload,
        })
        toast.success(`Notification sent (${data.recipients_notified ?? 0} users)`)
      }
      resetForm()
      void load()
    } catch {
      toast.error('Failed to publish')
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { id: BroadcastTab; label: string; icon: typeof Megaphone }[] = [
    { id: 'announcement', label: 'Announcement', icon: Megaphone },
    { id: 'admin_post', label: 'Admin Post', icon: Pin },
    { id: 'notification', label: 'Send Notification', icon: Bell },
  ]

  return (
    <AdminShell title="Broadcast Center">
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={tab === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(id)}
            className={tab === id ? '' : 'border-slate-700 text-slate-300'}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 mb-6 space-y-4">
        <h3 className="font-semibold text-white">
          {tab === 'announcement' && 'Create Announcement'}
          {tab === 'admin_post' && 'Create Official Admin Post'}
          {tab === 'notification' && 'Send Notification'}
        </h3>

        {tab !== 'admin_post' && (
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-950 border-slate-700"
          />
        )}

        {tab === 'admin_post' && (
          <Input
            placeholder="Headline (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-950 border-slate-700"
          />
        )}

        <Textarea
          placeholder="Message content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="bg-slate-950 border-slate-700 min-h-[120px]"
        />

        {tab === 'announcement' && (
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm"
            >
              {['low', 'medium', 'high', 'critical'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <Input placeholder="CTA label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="bg-slate-950 border-slate-700" />
            <Input placeholder="CTA URL" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className="bg-slate-950 border-slate-700 md:col-span-2" />
          </div>
        )}

        {tab === 'admin_post' && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                {POST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={officialLabel}
                onChange={(e) => setOfficialLabel(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm"
              >
                {OFFICIAL_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            {postType === 'image' && (
              <Input placeholder="Image URL" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className="bg-slate-950 border-slate-700" />
            )}
            {postType === 'poll' && (
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <Input
                    key={i}
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions]
                      next[i] = e.target.value
                      setPollOptions(next)
                    }}
                    className="bg-slate-950 border-slate-700"
                  />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setPollOptions([...pollOptions, ''])}>
                  Add option
                </Button>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={showInAnnouncementsHub} onChange={(e) => setShowInAnnouncementsHub(e.target.checked)} />
              Show in Announcements Hub
            </label>
          </div>
        )}

        {tab === 'notification' && (
          <Input placeholder="Link URL (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="bg-slate-950 border-slate-700" />
        )}

        <AudienceFields
          audience={audience}
          setAudience={setAudience}
          customAudience={customAudience}
          setCustomAudience={setCustomAudience}
          targetCountry={targetCountry}
          setTargetCountry={setTargetCountry}
          targetCity={targetCity}
          setTargetCity={setTargetCity}
        />

        <DeliveryOptions
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          showNotificationCenter={showNotificationCenter}
          setShowNotificationCenter={setShowNotificationCenter}
          sendInApp={sendInApp}
          setSendInApp={setSendInApp}
          sendBrowserPush={sendBrowserPush}
          setSendBrowserPush={setSendBrowserPush}
          sendMobilePush={sendMobilePush}
          setSendMobilePush={setSendMobilePush}
        />

        <Button onClick={() => void publish()} disabled={submitting}>
          {submitting ? 'Publishing…' : 'Publish'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold text-white mb-3">Recent Broadcasts</h3>
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div key={b.id} className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-white">{b.title}</span>
                  <span className="text-xs text-slate-500 uppercase">{b.broadcast_type}</span>
                </div>
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{b.content}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                  <span>Views {b.view_count ?? 0}</span>
                  <span>Clicks {b.click_count ?? 0}</span>
                  <span>Opens {b.notification_open_count ?? 0}</span>
                  <span>Push {b.push_delivery_count ?? 0}</span>
                </div>
              </div>
            ))}
            {broadcasts.length === 0 && <p className="text-slate-500 text-sm">No broadcasts yet.</p>}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-white mb-3">Announcements Analytics</h3>
          <div className="space-y-2">
            {announcements.slice(0, 8).map((a) => (
              <div key={a.id} className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm">
                <p className="font-medium text-white">{a.title}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                  <span>Views {a.view_count ?? 0}</span>
                  <span>Clicks {a.click_count ?? 0}</span>
                  <span>Push {a.push_delivery_count ?? 0}</span>
                  <span>Opens {a.notification_open_count ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
