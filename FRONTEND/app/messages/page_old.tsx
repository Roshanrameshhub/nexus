'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Search,
  MoreVertical,
  Paperclip,
  Pencil,
  Trash2,
  ThumbsUp,
  Heart,
  Flame,
  Rocket as RocketIcon,
  Hand,
  Send,
  Image as ImageIcon,
  File,
  Check,
  CheckCheck
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-button'
import { useMessageSocket } from '@/lib/hooks/use-message-socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { messagesAPI, uploadAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  mapConversation,
  mapMessage,
  type ConversationView,
  type MessageView,
} from '@/lib/mappers/messages'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { reactionsAPI } from '@/services/api'
import { toast } from 'sonner'

const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Network', href: '/feed' },
  { icon: MessageSquare, label: 'Messages', href: '/messages', active: true },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: Rocket, label: 'Startups', href: '/startups' },
  { icon: Briefcase, label: 'Workspace', href: '/workspace' },
]

export default function MessagesPage() {
  useProtectedRoute()
  const user = useAuthStore((s) => s.user)
  const [conversations, setConversations] = useState<ConversationView[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationView | null>(null)
  const [messages, setMessages] = useState<MessageView[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [typingText, setTypingText] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({})
  const [messageStatus, setMessageStatus] = useState<'sent' | 'delivered' | 'read'>('read')
  const attachInputRef = useRef<HTMLInputElement | null>(null)

  const loadConversations = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await messagesAPI.getConversations()
      const list = (data.conversations || []).map((c: Parameters<typeof mapConversation>[0]) =>
        mapConversation(c, user.id)
      )
      setConversations(list)
      setSelectedConversation((prev) => prev || list[0] || null)
    } catch {
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!selectedConversation || !user?.id) {
      setMessages([])
      return
    }
    messagesAPI
      .getMessages(selectedConversation.id)
      .then((res) => {
        setMessages((res.data.messages || []).map((m: Parameters<typeof mapMessage>[0]) => mapMessage(m, user.id)))
      })
      .catch(() => setMessages([]))
  }, [selectedConversation, user?.id])

  const handleSocketMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (!user?.id) return
      const mapped = mapMessage(payload as any, user.id)
      setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]))
      void loadConversations()
    },
    [user?.id, loadConversations]
  )

  useMessageSocket(selectedConversation?.id ?? null, handleSocketMessage)

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return
    const content = messageInput.trim()
    setMessageInput('')
    try {
      await messagesAPI.sendMessage(selectedConversation.id, content)
      setMessageStatus('delivered')
      const { data } = await messagesAPI.getMessages(selectedConversation.id)
      setMessages((data.messages || []).map((m: Parameters<typeof mapMessage>[0]) => mapMessage(m, user!.id)))
      await loadConversations()
      setTimeout(() => setMessageStatus('read'), 700)
    } catch {
      setMessageInput(content)
    }
  }

  const filteredConversations = conversations.filter((conv) =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const suggestions = [
    "Hi, I'd like to connect.",
    'Great profile. Let’s connect.',
    'Interested in collaborating?',
    'Would love to discuss opportunities.',
    'Thanks for connecting.',
    user?.role === 'founder'
      ? 'Congratulations on your startup launch.'
      : user?.role === 'recruiter'
      ? 'I am interested in the role you posted.'
      : 'Would love to learn more about your focus.',
  ]

  const addReactionToMessage = async (messageId: string, reaction: string) => {
    try {
      await reactionsAPI.reactToMessage(messageId, 'like')
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), reaction],
      }))
    } catch {
      toast.error('Could not react to message')
    }
  }

  const deleteOwnMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  const handleAttach = async (file: File | undefined) => {
    if (!file) return
    if (file.type.startsWith('image/')) {
      try {
        const res = await uploadAPI.uploadImages([file])
        const url = res.data.urls?.[0]
        if (url) {
          setMessageInput((prev) => `${prev}${prev ? '\n' : ''}${url}`)
          toast.success('Image attached')
        }
      } catch {
        toast.error('Image upload failed')
      }
      return
    }
    setMessageInput((prev) => `${prev}${prev ? '\n' : ''}[Attachment] ${file.name}`)
    toast.success('Attachment added')
  }

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
      <main className="flex-1 ml-64 flex">
        {/* Conversations List */}
        <motion.div 
          className="w-80 border-r border-border flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search conversations..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Loading conversations...</p>
            )}
            {!loading && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
            )}
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-start gap-3 hover:bg-secondary/50 transition-all border-b border-border/50 ${
                  selectedConversation?.id === conv.id ? 'bg-secondary/50' : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conv.user.avatar} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {conv.user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {conv.user.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground truncate">{conv.user.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{conv.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs text-primary-foreground font-medium">{conv.unread}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </motion.div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
          <>
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedConversation.user.avatar} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {getInitials(selectedConversation.user.name)}
                  </AvatarFallback>
                </Avatar>
                {selectedConversation.user.online && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{selectedConversation.user.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.user.role} · {selectedConversation.user.online ? 'Online' : `Last active ${selectedConversation.time}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${message.sender === 'me' ? 'order-2' : ''}`}>
                    <div
                      className={`p-4 rounded-2xl ${
                        message.sender === 'me'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-secondary text-foreground rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm">
                        {editingMessageId === message.id ? (
                          <input
                            className="bg-transparent border-b border-primary-foreground/50 outline-none text-sm w-full"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && messageInput.trim()) {
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === message.id ? { ...m, content: messageInput.trim() } : m
                                  )
                                )
                                setEditingMessageId(null)
                                setMessageInput('')
                              }
                            }}
                          />
                        ) : (
                          message.content
                        )}
                      </p>
                      {(messageReactions[message.id] || []).length > 0 && (
                        <p className="text-xs mt-1 opacity-80">{messageReactions[message.id].join(' ')}</p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${message.sender === 'me' ? 'justify-end' : ''}`}>
                      <span className="text-xs text-muted-foreground">{message.time}</span>
                      {message.sender === 'me' && (
                        (message.read || messageStatus === 'read') 
                          ? <CheckCheck className="w-3 h-3 text-primary" />
                          : <Check className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${message.sender === 'me' ? 'justify-end' : ''}`}>
                      <button onClick={() => void addReactionToMessage(message.id, '👍')} className="text-xs text-muted-foreground hover:text-foreground"><ThumbsUp className="w-3 h-3" /></button>
                      <button onClick={() => void addReactionToMessage(message.id, '❤️')} className="text-xs">❤️</button>
                      <button onClick={() => void addReactionToMessage(message.id, '🔥')} className="text-xs"><Flame className="w-3 h-3" /></button>
                      <button onClick={() => void addReactionToMessage(message.id, '🚀')} className="text-xs"><RocketIcon className="w-3 h-3" /></button>
                      <button onClick={() => void addReactionToMessage(message.id, '👏')} className="text-xs"><Hand className="w-3 h-3" /></button>
                      {message.sender === 'me' && (
                        <>
                          <button onClick={() => { setEditingMessageId(message.id); setMessageInput(message.content) }} className="text-xs text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => deleteOwnMessage(message.id)} className="text-xs text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {typingText && (
              <p className="text-xs text-muted-foreground px-2">{selectedConversation.user.name} is typing...</p>
            )}
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                <MessageSquare className="w-12 h-12 opacity-50" />
                <p className="font-medium">Start a meaningful conversation</p>
                <p className="text-sm">Introduce yourself • Ask about their startup • Discuss collaboration • Talk about funding</p>
              </div>
            )}
          </div>
          
          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <input
              ref={attachInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => void handleAttach(e.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setMessageInput(s)}
                  className="text-xs px-2 py-1 rounded-full border border-border hover:bg-secondary/60"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => attachInputRef.current?.click()}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => attachInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => attachInputRef.current?.click()}
                >
                  <File className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="pr-10 bg-secondary/50 border-border/50 h-12"
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value
                    setTypingText(val)
                    setTimeout(() => setTypingText(''), 900)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && messageInput.trim()) {
                      sendMessage()
                    }
                  }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button type="button" className="text-xs" onClick={() => setMessageInput((v) => `${v} 👍`)}>👍</button>
                  <button type="button" className="text-xs" onClick={() => setMessageInput((v) => `${v} ❤️`)}>❤️</button>
                </div>
              </div>
              <Button 
                className="glow-primary h-12 px-6"
                disabled={!messageInput.trim()}
                onClick={sendMessage}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
          </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
