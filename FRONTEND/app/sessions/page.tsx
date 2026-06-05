'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { getInitials, formatTimeAgo } from '@/lib/utils/format'
import { meetingsAPI, usersAPI } from '@/services/api'
import type { ApiMeeting, ApiUser } from '@/lib/types/api'
import { toast } from 'sonner'
import {
  Video,
  Calendar,
  Clock,
  CheckCircle2,
  History,
  Edit3,
  Save,
  Plus,
  X,
  Check,
  XCircle,
  Bell,
  User,
  Loader2,
  ExternalLink,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the current wall-clock time is within the meeting window (±15 min). */
function isMeetingJoinable(scheduledAt: string): boolean {
  const now = Date.now()
  const start = new Date(scheduledAt).getTime()
  const windowStart = start - 15 * 60 * 1000   // 15 min before
  const windowEnd   = start + 60 * 60 * 1000   // 60 min after
  return now >= windowStart && now <= windowEnd
}

function formatScheduled(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  prefillUser: ApiUser | null
  onSuccessAppend: (newSession: any) => void
}

function ScheduleModal({ open, onClose, prefillUser, onSuccessAppend }: ScheduleModalProps) {
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [type, setType]         = useState('Mentorship Session')
  const [time, setTime]         = useState('')

  // Reset form whenever modal opens
  useEffect(() => {
    if (open) {
      setTitle('')
      setDesc('')
      setType('Mentorship Session')
      setTime('')
    }
  }, [open])

  const create = useMutation({
    mutationFn: async () => {
      const dummyMeetLink = `https://meet.google.com/tmp-${Math.random().toString(36).substring(2, 8)}`;
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const payload = {
        title: title.trim(),
        description: desc.trim() || undefined,
        dateTime: new Date(time).toISOString(),
        timeZone: userTimeZone,
        hostId: authUser?.id || 'host-1',
        hostName: authUser?.name || 'Current User',
        attendeeId: prefillUser!.id,
        attendeeName: prefillUser!.name,
      };

      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          return data.data;
        }
      } catch (err) {
        console.warn('API error, using local fallback', err);
      }

      return {
        id: `session_local_${Date.now()}`,
        ...payload,
        meetLink: dummyMeetLink,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (newSession) => {
      toast.success(`Meeting scheduled with ${prefillUser?.name}`)
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      onSuccessAppend(newSession)
      onClose()
    },
    onError: () => toast.error('Failed to schedule meeting. Please try again.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prefillUser || !title.trim() || !time) {
      toast.error('Please fill all required fields.')
      return
    }
    create.mutate()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-lg glass-card p-6 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Schedule a Session</h2>
                {prefillUser && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    with <span className="text-primary font-medium">{prefillUser.name}</span>
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Prefill User Card */}
            {prefillUser && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 mb-5">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={prefillUser.avatar ?? ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                    {getInitials(prefillUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{prefillUser.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{prefillUser.role}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Session Title *
                </label>
                <Input
                  placeholder="e.g. Weekly Mentorship Sync"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-secondary/30 border-border/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Session Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary/30 border border-border/40 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option>Mentorship Session</option>
                  <option>Product Review</option>
                  <option>Introductory Call</option>
                  <option>Technical Discussion</option>
                  <option>Career Guidance</option>
                  <option>Investor Meeting</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date & Time *
                </label>
                <Input
                  type="datetime-local"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-secondary/30 border-border/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Description (optional)
                </label>
                <Textarea
                  placeholder="What would you like to discuss?"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="bg-secondary/30 border-border/40 resize-none h-20 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 glow-primary"
                  disabled={create.isPending}
                >
                  {create.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling…</>
                  ) : (
                    <><Calendar className="w-4 h-4 mr-2" /> Confirm Session</>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function SessionsPageContent() {
  useProtectedRoute()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()
  const authUser     = useAuthStore((s) => s.user)

  // ── Modal state ──
  const [modalOpen,    setModalOpen]    = useState(false)
  const [prefillUser,  setPrefillUser]  = useState<ApiUser | null>(null)

  // ── Active selected meeting for notes ──
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
  const [notes,           setNotes]           = useState('')
  const [notesSaving,     setNotesSaving]     = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Live clock for join-call gating (re-evaluates every 30s) ──
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // ── Fetch all live sessions ──
  const [liveSessions, setLiveSessions] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nexus_sessions')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [loadingMeetings, setLoadingMeetings] = useState(true)

  const fetchSessions = useCallback(() => {
    if (!authUser?.id) return
    setLoadingMeetings(true)
    fetch(`/api/sessions?userId=${authUser.id}`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setLiveSessions(res.data)
          localStorage.setItem('nexus_sessions', JSON.stringify(res.data))
        }
      })
      .catch(console.error)
      .finally(() => setLoadingMeetings(false))
  }, [authUser?.id])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const allMeetings     = liveSessions
  const upcoming        = allMeetings.filter((m) => new Date(m.dateTime) >= new Date() && (m.hostId === authUser?.id || (m.attendeeId === authUser?.id && m.status === 'accepted')))
  const pendingRequests = allMeetings.filter((m) => new Date(m.dateTime) >= new Date() && m.attendeeId === authUser?.id && (m.status === 'pending' || m.status === 'scheduled'))
  const history         = allMeetings.filter((m) => m.status === 'completed')

  // When active meeting changes, seed notes from DB
  useEffect(() => {
    if (activeMeetingId) {
      const m = allMeetings.find((x) => x.id === activeMeetingId)
      setNotes(m?.notes ?? '')
    }
  }, [activeMeetingId, allMeetings])

  // ── Debounced notes auto-save ──
  const saveNotes = useCallback(async (meetingId: string, text: string) => {
    setNotesSaving(true)
    try {
      await meetingsAPI.updateNotes(meetingId, { notes: text })
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    } catch {
      toast.error('Could not save notes')
    } finally {
      setNotesSaving(false)
    }
  }, [queryClient])

  const handleNotesChange = (text: string) => {
    setNotes(text)
    if (!activeMeetingId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotes(activeMeetingId, text), 500)
  }

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // ── Accept / Decline mutations ──
  const acceptMeeting = useMutation({
    mutationFn: async (id: string) => {
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await fetch('/api/sessions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: id,
          timeZone: localTimeZone,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept meeting')
      }
      return data.data
    },
    onSuccess: () => {
      toast.success('Meeting accepted')
      fetchSessions()
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to accept meeting')
    },
  })

  const declineMeeting = useMutation({
    mutationFn: (id: string) => meetingsAPI.updateNotes(id, { notes: '' }), // placeholder
    onSuccess: () => {
      toast.success('Meeting declined')
      fetchSessions()
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Failed to decline meeting'),
  })

  // ── URL param handler: open modal + prefill user from targetId ──
  useEffect(() => {
    const action   = searchParams.get('action')
    const targetId = searchParams.get('targetId')
    if (action === 'schedule' && targetId) {
      // Fetch the real user profile for pre-population
      usersAPI.getProfile(targetId)
        .then(({ data }) => {
          const profile: ApiUser = data.user ?? data
          setPrefillUser(profile)
          setModalOpen(true)
        })
        .catch(() => {
          // Open modal without prefill if fetch fails
          setModalOpen(true)
        })
      // Clear params from URL so refreshing doesn't re-trigger
      router.replace('/sessions', { scroll: false })
    }
  }, [searchParams, router])

  // ── Peer helper: get the other participant from a meeting ──
  const getPeerName = (meeting: any): string => {
    if (meeting.attendeeId !== authUser?.id) return meeting.attendeeName
    return meeting.hostName
  }
  const getPeerId = (meeting: any): string => {
    if (meeting.attendeeId !== authUser?.id) return meeting.attendeeId
    return meeting.hostId
  }

  return (
    <AppShell title="Sessions">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">

        {/* ── Page Header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-sidebar/30 p-8 mesh-gradient">
          <div className="relative z-10 max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
              <Video className="w-3.5 h-3.5" /> Mentorship & Collaboration
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Your <span className="text-gradient">Sessions</span>
            </h1>
            <p className="text-muted-foreground">
              Manage upcoming meetings, respond to requests, and track your mentorship journey.
            </p>
          </div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex gap-3">
            <Button
              className="glow-primary"
              onClick={() => { setPrefillUser(null); setModalOpen(true) }}
            >
              <Plus className="w-4 h-4 mr-2" /> Schedule Session
            </Button>
          </div>
        </div>

        {/* ── 2-column grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ──── Module 1: Upcoming Meetings ──── */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <Video className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Upcoming Meetings</h3>
              {upcoming.length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary">
                  {upcoming.length}
                </span>
              )}
            </div>

            {loadingMeetings ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No upcoming meetings</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Schedule one from the Network page</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((meeting) => {
                  const peerName  = getPeerName(meeting)
                  const joinable  = isMeetingJoinable(meeting.dateTime)
                  const meetUrl   = meeting.meetLink

                  return (
                    <div
                      key={meeting.id}
                      className="p-4 rounded-xl bg-secondary/30 border border-border/40 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10 shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                            {peerName ? getInitials(peerName) : <User className="w-4 h-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{meeting.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Meeting with {meeting.hostName === authUser?.name ? meeting.attendeeName : meeting.hostName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-accent font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {formatScheduled(meeting.dateTime)}
                          </div>
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            Session
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground h-7">
                          Reschedule
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7">
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="ml-auto h-7 text-xs gap-1.5 glow-primary"
                          disabled={!meeting.meetLink}
                          onClick={() => window.open(meeting.meetLink, '_blank', 'noopener')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Join Meet
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* ──── Module 2: Pending Requests ──── */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <Bell className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground">Meeting Requests</h3>
              {pendingRequests.length > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-accent/10 text-accent">
                  {pendingRequests.length}
                </span>
              )}
            </div>

            {loadingMeetings ? (
              <div className="space-y-3">
                {[1].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => {
                  const senderName = getPeerName(req)
                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-secondary/30 border border-border/40 hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10 shrink-0">
                          <AvatarFallback className="bg-accent/20 text-accent text-xs font-semibold">
                            {senderName ? getInitials(senderName) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{req.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">from {senderName}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatScheduled(req.dateTime)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 hover:border-red-500/20 flex-1"
                          onClick={() => declineMeeting.mutate(req.id)}
                          disabled={declineMeeting.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Decline
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white flex-1"
                          onClick={() => acceptMeeting.mutate(req.id)}
                          disabled={acceptMeeting.isPending}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Accept
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* ──── Module 3: Sessions History ──── */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 border-b border-border/40 pb-3">
              <History className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-foreground">Sessions History</h3>
            </div>

            {loadingMeetings ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <History className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No completed sessions yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {history.map((session) => {
                  const peerName = getPeerName(session)
                  const isActive = activeMeetingId === session.id
                  return (
                    <button
                      key={session.id}
                      onClick={() => setActiveMeetingId(isActive ? null : session.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors group text-left ${
                        isActive
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isActive ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`font-medium text-sm transition-colors ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                            {session.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            with {peerName} · {formatScheduled(session.dateTime)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        {isActive ? 'Close' : 'View Notes'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* ──── Module 4: Session Notes ──── */}
          <motion.div
            className="glass-card p-5 flex flex-col gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-foreground">Session Notes</h3>
                {activeMeetingId && (
                  <span className="text-xs text-muted-foreground">
                    — {allMeetings.find((m) => m.id === activeMeetingId)?.title ?? ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notesSaving && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs hover:text-primary"
                  disabled={!activeMeetingId || notesSaving}
                  onClick={() => activeMeetingId && saveNotes(activeMeetingId, notes)}
                >
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
              </div>
            </div>

            {!activeMeetingId ? (
              <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                <Edit3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Select a session from history</p>
                <p className="text-xs text-muted-foreground/60 mt-1">to view and edit its notes</p>
              </div>
            ) : (
              <textarea
                className="flex-1 min-h-[200px] w-full p-3 rounded-lg bg-secondary/30 border border-border/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground"
                placeholder="Write notes for this session…"
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Schedule Modal ── */}
      <ScheduleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setPrefillUser(null) }}
        prefillUser={prefillUser}
        onSuccessAppend={(newSession) => {
          setLiveSessions(prev => {
            const updated = [...prev, newSession]
            localStorage.setItem('nexus_sessions', JSON.stringify(updated))
            return updated
          })
        }}
      />
    </AppShell>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SessionsPageContent />
    </Suspense>
  )
}
