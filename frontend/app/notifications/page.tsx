'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Heart,
  UserPlus,
  AtSign,
  MessageCircle,
  Award,
  Calendar,
  Check,
  X,
  Filter,
  CheckCheck,
  Inbox,
  TrendingUp
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { notificationsAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  useReceivedRequests,
  useAcceptConnection,
  useRejectConnection,
} from '@/lib/hooks/api/use-connections'
import { mapNotification, type NotificationView } from '@/lib/mappers/notifications'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  useProtectedRoute()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [notificationsList, setNotificationsList] = useState<NotificationView[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { data: connectionRequests = [] } = useReceivedRequests()
  const acceptConnection = useAcceptConnection()
  const rejectConnection = useRejectConnection()

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await notificationsAPI.getAll()
      setNotificationsList((data.notifications || []).map(mapNotification))
    } catch {
      setNotificationsList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotificationsList((list) => list.map((n) => ({ ...n, read: true })))
    } catch {
      setNotificationsList((list) => list.map((n) => ({ ...n, read: true })))
    }
  }

  const markOneRead = async (id: string, notif?: NotificationView) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotificationsList((list) =>
        list.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch {
      setNotificationsList((list) =>
        list.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    }
    if (notif?.linkUrl) {
      router.push(notif.linkUrl)
      return
    }
    if (notif?.targetType === 'post' && notif.targetId) {
      router.push(`/posts/${notif.targetId}`)
      return
    }
    if (notif?.targetType === 'announcement' && notif.targetId) {
      router.push('/dashboard')
    }
  }

  const unreadCount = notificationsList.filter(n => !n.read).length
  const filteredNotifications = notificationsList.filter(n => {
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && !n.read)
    const matchesSearch = searchQuery === '' || 
      n.content?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notif) => {
    let date = new Date(notif.timestamp)
    if (isNaN(date.getTime()) && notif.timestamp) {
      date = new Date(notif.timestamp.replace(' ', 'T'))
    }
    if (isNaN(date.getTime())) {
      date = new Date()
    }
    
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let group = 'Earlier'
    if (date.toDateString() === today.toDateString()) {
      group = 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Yesterday'
    }

    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(notif)
    return groups
  }, {} as Record<string, NotificationView[]>)

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500" />
      case 'follow':
        return <UserPlus className="w-5 h-5 text-blue-500" />
      case 'mention':
        return <AtSign className="w-5 h-5 text-purple-500" />
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-green-500" />
      case 'award':
        return <Award className="w-5 h-5 text-yellow-500" />
      case 'event':
        return <Calendar className="w-5 h-5 text-orange-500" />
      default:
        return <Inbox className="w-5 h-5 text-primary" />
    }
  }

  const filterOptions = [
    { label: 'All', value: 'all' as const },
    { label: 'Unread', value: 'unread' as const },
  ]

  return (
    <AppShell title="Notifications">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={markAllRead}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex gap-2">
            {filterOptions.map(option => (
              <Button
                key={option.value}
                variant={activeFilter === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 glass-card p-8">
            <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications).map(([group, notifs]) => (
              <div key={group}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  {group}
                </h2>
                <div className="space-y-2">
                  {notifs.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`glass-card p-4 flex items-start gap-3 hover:border-primary/40 transition-all cursor-pointer ${
                        !notif.read ? 'border-primary/30 bg-primary/5' : ''
                      }`}
                      onClick={() => void markOneRead(notif.id, notif)}
                    >
                      <div className="flex-shrink-0">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                            {getInitials(notif.content.split(' ')[0] || 'N')}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          {notif.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notif.time || 'Recently'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getNotificationIcon(notif.type)}
                        {!notif.read && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connection Requests */}
        {connectionRequests.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Connection Requests ({connectionRequests.length})
            </h2>
            <div className="space-y-3">
              {connectionRequests.map((request: any) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={getMediaUrl(request.sender?.avatar || '')} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {getInitials(request.sender?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {request.sender?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(request.sender?.role)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => acceptConnection.mutate(request.id)}
                      disabled={acceptConnection.isPending}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectConnection.mutate(request.id)}
                      disabled={rejectConnection.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
