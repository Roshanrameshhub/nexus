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
import { getInitials } from '@/lib/utils/format'
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
  Search,
} from 'lucide-react'

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'accepted', 'rescheduled'])
const HISTORY_STATUSES = new Set(['completed', 'cancelled'])

function isValidMeetLink(url: string | null | undefined): boolean {
  return (
    !!url &&
    url.startsWith('https://meet.google.com/') &&
    !url.includes('/tmp-')
  )
}

function formatScheduled(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    accepted: 'Confirmed',
    rescheduled: 'Rescheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

function getPeer(meeting: ApiMeeting, userId: string): ApiUser | undefined {
  if (meeting.organizer_id === userId) return meeting.invitee
  return meeting.organizer
}

function getPeerName(meeting: ApiMeeting, userId: string): string {
  const peer = getPeer(meeting, userId)
  return peer?.name ?? 'Participant'
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────

interface ScheduleModalProps {
  open: boolean
  onClose: () => void
  prefillUser: ApiUser | null
}

function ScheduleModal({ open, onClose, prefillUser }: ScheduleModalProps) {
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState('Mentorship Session')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [participant, setParticipant] = useState<ApiUser | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ApiUser[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDesc('')
      setType('Mentorship Session')
      setDate('')
      setTime('')
      setDuration('60')
      setParticipant(prefillUser)
      setSearchQuery('')
      setSearchResults([])
    }
  }, [open, prefillUser])

  useEffect(() => {
    if (!open || prefillUser) return
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(() => {
      setSearching(true)
      usersAPI
        .search(searchQuery.trim())
        .then(({ data }) => setSearchResults((data.users ?? []) as ApiUser[]))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, open, prefillUser])

  const create = useMutation({
    mutationFn: async () => {
      const selected = participant ?? prefillUser
      if (!selected) throw new Error('Select a participant')
      const scheduledAt = new Date(`${date}T${time}`)
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const { data } = await meetingsAPI.create({
        invitee_id: selected.id,
        title: title.trim(),
        description: desc.trim() || undefined,
        scheduled_at: scheduledAt.toISOString(),
        meeting_type: type,
        duration_minutes: Number(duration),
        user_time_zone: userTimeZone,
      })
      return data.meeting as ApiMeeting
    },
    onSuccess: (meeting) => {
      const peer = getPeerName(meeting, authUser?.id ?? '')
      toast.success(`Session scheduled with ${peer}`)
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      onClose()
    },
    onError: () => toast.error('Failed to schedule session. Please try again.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(participant ?? prefillUser) || !title.trim() || !date || !time) {
      toast.error('Please fill all required fields and select a participant.')
      return
    }
    create.mutate()
  }

  const selectedParticipant = participant ?? prefillUser

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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-lg glass-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Schedule a Session</h2>
                {selectedParticipant && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    with <span className="text-primary font-medium">{selectedParticipant.name}</span>
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {!prefillUser && (
              <div className="space-y-2 mb-5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Participant *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-secondary/30 border-border/40"
                  />
                </div>
                {searching && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/30">
                    {searchResults
                      .filter((u) => u.id !== authUser?.id)
                      .map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setParticipant(user)
                            setSearchQuery(user.name)
                            setSearchResults([])
                          }}
                          className={`w-full flex items-center gap-2 p-2 text-left hover:bg-secondary/50 ${
                            participant?.id === user.id ? 'bg-primary/10' : ''
                          }`}
                        >
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={user.avatar ?? undefined} />
                            <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {selectedParticipant && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 mb-5">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedParticipant.avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                    {getInitials(selectedParticipant.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedParticipant.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedParticipant.role}</p>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Date *
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-secondary/30 border-border/40"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Time *
                  </label>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-secondary/30 border-border/40"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Duration (minutes)
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full h-9 rounded-lg bg-secondary/30 border border-border/40 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">120 minutes</option>
                </select>
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
                <Button type="submit" className="flex-1 glow-primary" disabled={create.isPending}>
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const authUser = useAuthStore((s) => s.user)

  const [modalOpen, setModalOpen] = useState(false)
  const [prefillUser, setPrefillUser] = useState<ApiUser | null>(null)
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const { data: allMeetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data } = await meetingsAPI.list()
      return (data.meetings ?? []) as ApiMeeting[]
    },
    enabled: !!authUser?.id,
  })

  const now = new Date()
  const upcoming = allMeetings.filter(
    (m) =>
      new Date(m.scheduled_at) >= now &&
      ACTIVE_STATUSES.has(m.status) &&
      (m.status !== 'pending' || m.organizer_id === authUser?.id)
  )
  const pendingRequests = allMeetings.filter(
    (m) =>
      new Date(m.scheduled_at) >= now &&
      m.status === 'pending' &&
      m.invitee_id === authUser?.id
  )
  const history = allMeetings.filter(
    (m) =>
      HISTORY_STATUSES.has(m.status) ||
      (new Date(m.scheduled_at) < now && ACTIVE_STATUSES.has(m.status))
  )

  useEffect(() => {
    if (activeMeetingId) {
      const m = allMeetings.find((x) => x.id === activeMeetingId)
      setNotes(m?.notes ?? '')
    }
  }, [activeMeetingId, allMeetings])

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

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const acceptMeeting = useMutation({
    mutationFn: (id: string) => meetingsAPI.accept(id),
    onSuccess: () => {
      toast.success('Session accepted')
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Failed to accept session'),
  })

  const declineMeeting = useMutation({
    mutationFn: (id: string) => meetingsAPI.decline(id),
    onSuccess: () => {
      toast.success('Session declined')
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Failed to decline session'),
  })

  const cancelMeeting = useMutation({
    mutationFn: (id: string) => meetingsAPI.cancel(id),
    onSuccess: () => {
      toast.success('Session cancelled')
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Failed to cancel session'),
  })

  const rescheduleMeeting = useMutation({
    mutationFn: ({ id, scheduledAt, duration }: { id: string; scheduledAt: string; duration: number }) =>
      meetingsAPI.reschedule(id, {
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        user_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: () => {
      toast.success('Session rescheduled')
      setRescheduleId(null)
      setRescheduleDate('')
      setRescheduleTime('')
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
    },
    onError: () => toast.error('Failed to reschedule session'),
  })

  useEffect(() => {
    const action = searchParams.get('action')
    const targetId = searchParams.get('targetId')
    if (action === 'schedule' && targetId) {
      usersAPI
        .getProfile(targetId)
        .then(({ data }) => {
          const profile: ApiUser = data.user ?? data
          setPrefillUser(profile)
          setModalOpen(true)
        })
        .catch(() => setModalOpen(true))
      router.replace('/sessions', { scroll: false })
    }
  }, [searchParams, router])

  const handleRescheduleSubmit = (meeting: ApiMeeting) => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Select a new date and time')
      return
    }
    rescheduleMeeting.mutate({
      id: meeting.id,
      scheduledAt: new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString(),
      duration: meeting.duration_minutes ?? 60,
    })
  }

  return (
    <AppShell title="Sessions">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                <p className="text-xs text-muted-foreground/60 mt-1">Schedule a session to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((meeting) => {
                  const peerName = getPeerName(meeting, authUser?.id ?? '')
                  const canJoin = isValidMeetLink(meeting.meet_link)
                  const isRescheduling = rescheduleId === meeting.id

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
                            with {peerName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-accent font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {formatScheduled(meeting.scheduled_at)}
                          </div>
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {meeting.meeting_type} · {statusLabel(meeting.status)}
                          </span>
                        </div>
                      </div>

                      {isRescheduling && (
                        <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-2 items-end">
                          <Input
                            type="date"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            className="h-8 text-xs bg-secondary/30 flex-1 min-w-[120px]"
                          />
                          <Input
                            type="time"
                            value={rescheduleTime}
                            onChange={(e) => setRescheduleTime(e.target.value)}
                            className="h-8 text-xs bg-secondary/30 flex-1 min-w-[100px]"
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            disabled={rescheduleMeeting.isPending}
                            onClick={() => handleRescheduleSubmit(meeting)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => setRescheduleId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground h-7"
                          onClick={() => {
                            setRescheduleId(meeting.id)
                            const d = new Date(meeting.scheduled_at)
                            setRescheduleDate(d.toISOString().slice(0, 10))
                            setRescheduleTime(d.toTimeString().slice(0, 5))
                          }}
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7"
                          disabled={cancelMeeting.isPending}
                          onClick={() => cancelMeeting.mutate(meeting.id)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="ml-auto h-7 text-xs gap-1.5 glow-primary"
                          disabled={!canJoin}
                          title={canJoin ? 'Join Google Meet' : 'Meet link not available yet'}
                          onClick={() => window.open(meeting.meet_link, '_blank', 'noopener')}
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
                  const senderName = getPeerName(req, authUser?.id ?? '')
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
                            {formatScheduled(req.scheduled_at)}
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
                  const peerName = getPeerName(session, authUser?.id ?? '')
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
                            with {peerName} · {formatScheduled(session.scheduled_at)} · {statusLabel(session.status)}
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

      <ScheduleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setPrefillUser(null) }}
        prefillUser={prefillUser}
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
