'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Sparkles, 
  Home,
  Users,
  MessageSquare,
  Bell,
  Settings,
  Rocket,
  Briefcase,
  Heart,
  UserPlus,
  AtSign,
  MessageCircle,
  Award,
  Calendar,
  Check,
  X,
  MoreHorizontal,
  Filter,
  CheckCheck
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Network', href: '/feed' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Bell, label: 'Notifications', href: '/notifications', active: true },
  { icon: Rocket, label: 'Startups', href: '/startups' },
  { icon: Briefcase, label: 'Workspace', href: '/workspace' },
]

export default function NotificationsPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState('all')
  const [notificationsList, setNotificationsList] = useState<NotificationView[]>([])
  const [loading, setLoading] = useState(true)
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

  const markOneRead = async (id: string) => {
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
  }

  const unreadCount = notificationsList.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.aside 
        className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col h-full p-4">
          <Link href="/dashboard" className="flex items-center gap-2 mb-8 px-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Nexus</span>
          </Link>
          
          <nav className="space-y-1 flex-1">
            {sidebarItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  item.active 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.label === 'Notifications' && unreadCount > 0 && (
                  <span className="ml-auto w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          
          <div className="border-t border-sidebar-border pt-4 mt-4">
            <Link href="/profile" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-sidebar-accent/50 transition-all">
              <Avatar className="w-10 h-10">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/20 text-primary">{user ? getInitials(user.name) : 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{user?.name || 'User'}</div>
                <div className="text-xs text-muted-foreground truncate">{user ? roleLabel(user.role) : ''}</div>
              </div>
            </Link>
            
            <div className="flex items-center gap-2 mt-2">
              <Link href="/settings" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </motion.aside>
      
      {/* Main Content */}
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
              <Button variant="ghost" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="max-w-4xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notifications List */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6 bg-secondary/50">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="mentions">Mentions</TabsTrigger>
                  <TabsTrigger value="likes">Likes</TabsTrigger>
                  <TabsTrigger value="follows">Follows</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-2">
                  {loading && notificationsList.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4">Loading notifications...</p>
                  )}
                  {!loading && notificationsList.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4">No notifications yet.</p>
                  )}
                  {notificationsList.map((notification, index) => (
                    <motion.div
                      key={notification.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => !notification.read && markOneRead(notification.id)}
                      onKeyDown={(e) => e.key === 'Enter' && !notification.read && markOneRead(notification.id)}
                      className={`glass-card p-4 flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer ${
                        !notification.read ? 'bg-primary/5 border-primary/20' : ''
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <div className={`w-10 h-10 rounded-full ${notification.iconBg} flex items-center justify-center shrink-0`}>
                        <notification.icon className={`w-5 h-5 ${notification.iconColor}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-foreground">
                            {notification.user && (
                              <span className="font-semibold">{notification.user.name} </span>
                            )}
                            {notification.content}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                      </div>
                      
                      <Button variant="ghost" size="sm" className="p-1 h-auto shrink-0">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </motion.div>
                  ))}
                </TabsContent>
                
                <TabsContent value="mentions" className="space-y-2">
                  {notificationsList
                    .filter(n => n.type === 'mention')
                    .map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        className={`glass-card p-4 flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer ${
                          !notification.read ? 'bg-primary/5 border-primary/20' : ''
                        }`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <div className={`w-10 h-10 rounded-full ${notification.iconBg} flex items-center justify-center shrink-0`}>
                          <notification.icon className={`w-5 h-5 ${notification.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {notification.user && (
                              <span className="font-semibold">{notification.user.name} </span>
                            )}
                            {notification.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      </motion.div>
                    ))}
                </TabsContent>
                
                <TabsContent value="likes" className="space-y-2">
                  {notificationsList
                    .filter(n => n.type === 'like')
                    .map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        className={`glass-card p-4 flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer ${
                          !notification.read ? 'bg-primary/5 border-primary/20' : ''
                        }`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <div className={`w-10 h-10 rounded-full ${notification.iconBg} flex items-center justify-center shrink-0`}>
                          <notification.icon className={`w-5 h-5 ${notification.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {notification.user && (
                              <span className="font-semibold">{notification.user.name} </span>
                            )}
                            {notification.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      </motion.div>
                    ))}
                </TabsContent>
                
                <TabsContent value="follows" className="space-y-2">
                  {notificationsList
                    .filter(n => n.type === 'follow')
                    .map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        className={`glass-card p-4 flex items-start gap-4 hover:border-primary/30 transition-all cursor-pointer ${
                          !notification.read ? 'bg-primary/5 border-primary/20' : ''
                        }`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <div className={`w-10 h-10 rounded-full ${notification.iconBg} flex items-center justify-center shrink-0`}>
                          <notification.icon className={`w-5 h-5 ${notification.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {notification.user && (
                              <span className="font-semibold">{notification.user.name} </span>
                            )}
                            {notification.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      </motion.div>
                    ))}
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Right Sidebar - Connection Requests */}
            <div className="space-y-6">
              <motion.div 
                className="glass-card p-5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Connection Requests</h3>
                  <span className="text-xs text-muted-foreground">{connectionRequests.length} pending</span>
                </div>
                
                <div className="space-y-4">
                  {connectionRequests.length === 0 && (
                    <p className="text-sm text-muted-foreground">No pending connection requests.</p>
                  )}
                  {connectionRequests.map((request: {
                    id: string
                    sender?: { name: string; avatar?: string | null; role: string }
                  }) => (
                    <div key={request.id} className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={request.sender?.avatar || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {(request.sender?.name || '?').split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground text-sm truncate">
                            {request.sender?.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {request.sender?.role}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1 glow-primary"
                          disabled={acceptConnection.isPending}
                          onClick={() => acceptConnection.mutate(request.id)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={rejectConnection.isPending}
                          onClick={() => rejectConnection.mutate(request.id)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button variant="ghost" className="w-full mt-4 text-primary">
                  View All Requests
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
