'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Network,
  Rss,
  Globe2,
  Briefcase,
  Sparkles,
  Bell,
  MessageSquare,
  X,
  Check,
  CheckCheck,
  ChevronRight,
  Settings,
  Flame,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { LogoutButton } from '@/components/auth/logout-button'
import { useAuthStore } from '@/lib/store'
import { usePresence } from '@/lib/hooks/use-presence'
import { usePushNotifications } from '@/lib/hooks/use-push-notifications'
import { usePresenceStore } from '@/lib/presence-store'
import { getInitials, roleLabel, formatTimeAgo } from '@/lib/utils/format'
import { notificationsAPI, messagesAPI, usersAPI } from '@/services/api'
import { cn } from '@/lib/utils'
import {
  getLastMessagePreview,
  mapConversations,
  type ConversationView,
} from '@/lib/mappers/messages'
import { getMediaUrl } from '@/lib/config/api'
import { ConversationPresence } from '@/components/messaging/conversation-presence'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { readAndClearStreakEvent, type StreakEventPayload } from '@/lib/streak'

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',  href: '/dashboard' },
  { icon: Network,         label: 'Network',    href: '/network'   },
  { icon: Rss,             label: 'Feed',       href: '/feed'      },
  { icon: Globe2,          label: 'Ecosystem',  href: '/ecosystem' },
  { icon: Briefcase,       label: 'Sessions',   href: '/sessions'  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode
  title?: string
  header?: React.ReactNode
  mainClassName?: string
}

function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t border-sidebar-border bg-sidebar/95 backdrop-blur-md"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-1 min-w-0 flex-1 text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  return (
    <motion.aside
      className="fixed left-0 top-0 h-full w-60 flex-col hidden lg:flex z-40"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 h-14 shrink-0 border-b border-sidebar-border"
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary shrink-0">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="leading-none">
          <p className="text-sm font-bold text-foreground tracking-wide">RConnectX</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Startup Ecosystem</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span>{label}</span>
              {active && (
                <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border px-3 py-3 shrink-0">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all group"
        >
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {user ? getInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-none">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {user ? roleLabel(user.role) : ''}
            </p>
          </div>
          <Settings className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </Link>
        <div className="mt-1 px-1">
          <LogoutButton />
        </div>
      </div>
    </motion.aside>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

interface TopbarProps {
  title?: string
  header?: React.ReactNode
  onOpenNotifications: () => void
  onOpenMessages: () => void
  unreadNotifications: number
  unreadMessages: number
  streakCount: number
  onOpenStreak: () => void
}

function Topbar({
  title,
  header,
  onOpenNotifications,
  onOpenMessages,
  unreadNotifications,
  unreadMessages,
  streakCount,
  onOpenStreak,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
      {/* Page title or custom header — left side */}
      <div className="flex-1 min-w-0">
        {header ? (
          header
        ) : title ? (
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
        ) : null}
      </div>

      {/* Messages trigger */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5"
        onClick={onOpenStreak}
        aria-label="Open streak details"
        id="topbar-streak-btn"
      >
        <Flame className="w-4 h-4 text-orange-500" />
        <span className="text-xs font-semibold">{streakCount}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        onClick={onOpenMessages}
        aria-label="Open messages"
        id="topbar-messages-btn"
      >
        <MessageSquare className="w-4 h-4" />
        {unreadMessages > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
            {unreadMessages > 9 ? '9+' : unreadMessages}
          </span>
        )}
      </Button>

      {/* Notifications trigger */}
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        onClick={onOpenNotifications}
        aria-label="Open notifications"
        id="topbar-notifications-btn"
      >
        <Bell className="w-4 h-4" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </Button>
    </header>
  )
}

// ─── Notifications Drawer ─────────────────────────────────────────────────────

function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async () => {
      const { data } = await notificationsAPI.getAll()
      return (data.notifications ?? []) as Array<Record<string, unknown>>
    },
    enabled: open,
    staleTime: 1000 * 60,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsAPI.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsAPI.markAllAsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data ?? []
  const unread = notifications.filter((n) => !n.read_status)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] p-0 flex flex-col gap-0 bg-background border-l border-border"
      >
        <SheetHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
            {unread.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                {unread.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {isLoading && (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground/60 mt-1">No new notifications</p>
              </div>
            )}

            {notifications.map((n) => (
              <div
                key={n.id as string}
                className={cn(
                  'group relative flex items-start gap-3 rounded-lg p-3 transition-colors',
                  !n.read_status
                    ? 'bg-primary/5 border border-primary/15 hover:bg-primary/8'
                    : 'hover:bg-muted/50',
                )}
              >
                {!n.read_status && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0 pl-2">
                  <p className="text-sm text-foreground leading-snug">{n.content as string}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(n.created_at as string)}
                  </p>
                </div>
                {!n.read_status && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0 hover:bg-primary/20 hover:text-primary"
                    title="Mark as read"
                    onClick={() => markRead.mutate(n.id as string)}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Messages Drawer ──────────────────────────────────────────────────────────

function MessagesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useQuery<ConversationView[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await messagesAPI.getConversations()
      const rawList = data.conversations ?? []
      const peers = rawList.flatMap((conversation: { participants?: Array<{ id: string; is_online?: boolean; last_seen_at?: string | null }> }) =>
        (conversation.participants ?? []).filter((participant) => String(participant.id) !== String(user?.id))
      )
      usePresenceStore.getState().mergeFromUsers(
        peers.map((participant: { id: string; is_online?: boolean; last_seen_at?: string | null }) => ({
          id: String(participant.id),
          is_online: participant.is_online,
          last_seen_at: participant.last_seen_at,
        }))
      )
      return mapConversations(rawList, user?.id ?? '')
    },
    enabled: open && !!user?.id,
    staleTime: 1000 * 30,
  })

  const conversations = data ?? []

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[380px] p-0 flex flex-col gap-0 bg-background border-l border-border"
      >
        <SheetHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">Messages</SheetTitle>
          <div className="flex items-center gap-2">
            <Link href="/messages" onClick={onClose} className="text-xs text-primary hover:underline font-medium">
              Open full view
            </Link>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto w-full">
            <div className="p-3 space-y-1">
              {isLoading && (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              )}

              {!isLoading && conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Send a message to start a conversation
                  </p>
                  <Link href="/messages" onClick={onClose}>
                    <Button size="sm" variant="outline" className="mt-4 text-xs">
                      Go to Messages
                    </Button>
                  </Link>
                </div>
              )}

              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/messages?conversation=${conv.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={getMediaUrl(conv.user.avatar)} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                      {getInitials(conv.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm truncate',
                          conv.unread > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                        )}
                      >
                        {conv.user.name}
                      </p>
                      {conv.time && (
                        <p className="text-[10px] text-muted-foreground shrink-0">{conv.time}</p>
                      )}
                    </div>
                    <ConversationPresence
                      peerId={conv.peerId}
                      fallbackOnline={conv.user.online}
                      fallbackLastSeenAt={conv.user.lastSeenAt}
                    />
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {getLastMessagePreview(conv.lastMessage)}
                    </p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="min-w-[18px] h-4.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1 shrink-0">
                      {conv.unread > 9 ? '9+' : conv.unread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StreakDetailsModal({
  open,
  onOpenChange,
  currentStreak,
  longestStreak,
  streakStartedAt,
  daysActiveThisMonth,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStreak: number
  longestStreak: number
  streakStartedAt?: string | null
  daysActiveThisMonth: number
}) {
  const nextMilestone = useMemo(() => {
    const targets = [3, 7, 14, 30, 60, 100, 180, 365]
    for (const value of targets) {
      if (currentStreak < value) return value
    }
    return (Math.floor(currentStreak / 100) + 1) * 100
  }, [currentStreak])
  const remaining = Math.max(0, nextMilestone - currentStreak)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Streak Progress</DialogTitle>
          <DialogDescription>Stay active daily to keep your streak alive.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="glass-card p-3">
            <p className="text-muted-foreground">Current Streak</p>
            <p className="text-xl font-semibold">{currentStreak} Days</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3">
              <p className="text-muted-foreground">Longest Streak</p>
              <p className="font-semibold">{longestStreak} Days</p>
            </div>
            <div className="glass-card p-3">
              <p className="text-muted-foreground">Active This Month</p>
              <p className="font-semibold">{daysActiveThisMonth} Days</p>
            </div>
          </div>
          <div className="glass-card p-3">
            <p className="text-muted-foreground">Streak Start Date</p>
            <p className="font-semibold">
              {streakStartedAt ? new Date(streakStartedAt).toLocaleDateString() : 'Not available'}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className="text-muted-foreground">Next Milestone</p>
            <p className="font-semibold">{nextMilestone} Days</p>
            <p className="text-muted-foreground mt-1">{remaining} more days to go 🚀</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StreakCelebrationModal({
  event,
  onClose,
}: {
  event: StreakEventPayload | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{event?.title ?? 'Streak'}</DialogTitle>
          <DialogDescription>{event?.message ?? ''}</DialogDescription>
        </DialogHeader>
        <Button className="w-full" onClick={onClose}>Continue</Button>
      </DialogContent>
    </Dialog>
  )
}

// ─── AppShell (root export) ───────────────────────────────────────────────────

export function AppShell({ children, title, header, mainClassName }: AppShellProps) {
  const user = useAuthStore((s) => s.user)
  usePresence()
  usePushNotifications(Boolean(user))
  const [notifOpen, setNotifOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const [streakOpen, setStreakOpen] = useState(false)
  const [streakEvent, setStreakEvent] = useState<StreakEventPayload | null>(null)

  // Prefetch counts for badge display
  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async () => {
      const { data } = await notificationsAPI.getAll()
      return (data.notifications ?? []) as Array<Record<string, unknown>>
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 2,
  })

  const { data: convData } = useQuery<ConversationView[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await messagesAPI.getConversations()
      return mapConversations(data.conversations ?? [], user?.id ?? '')
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  })

  const { data: streakData } = useQuery({
    queryKey: ['users', 'streak'],
    queryFn: async () => {
      const { data } = await usersAPI.streak()
      return data as {
        current_streak: number
        longest_streak: number
        streak_started_at?: string | null
        days_active_this_month: number
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 2,
  })

  useEffect(() => {
    setStreakEvent(readAndClearStreakEvent())
  }, [])

  const unreadNotifications = (notifData ?? []).filter((n) => !n.read_status).length
  const unreadMessages = (convData ?? []).reduce((sum, c) => sum + (c.unread ?? 0), 0)
  const currentStreak = streakData?.current_streak ?? user?.current_streak ?? 0

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Sticky Topbar */}
        <Topbar
          title={title}
          header={header}
          onOpenNotifications={() => setNotifOpen(true)}
          onOpenMessages={() => setMsgOpen(true)}
          onOpenStreak={() => setStreakOpen(true)}
          unreadNotifications={unreadNotifications}
          unreadMessages={unreadMessages}
          streakCount={currentStreak}
        />

        {/* Page body */}
        <main className={cn('flex-1 p-6 pb-24 lg:pb-6', mainClassName)}>
          {children}
        </main>
      </div>

      <MobileNav />

      {/* Slide-over drawers */}
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <MessagesDrawer open={msgOpen} onClose={() => setMsgOpen(false)} />
      <StreakDetailsModal
        open={streakOpen}
        onOpenChange={setStreakOpen}
        currentStreak={currentStreak}
        longestStreak={streakData?.longest_streak ?? user?.longest_streak ?? 0}
        streakStartedAt={streakData?.streak_started_at ?? user?.streak_started_at}
        daysActiveThisMonth={streakData?.days_active_this_month ?? 0}
      />
      <StreakCelebrationModal event={streakEvent} onClose={() => setStreakEvent(null)} />
    </div>
  )
}
