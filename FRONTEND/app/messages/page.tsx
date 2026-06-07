'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { 
  MoreVertical,
  Paperclip,
  Send,
  Search,
  Check,
  CheckCheck,
  ThumbsUp,
  Heart,
  Flame,
  MessageSquare,
  X
} from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { MessageAttachment } from '@/components/social/message-attachment'
import { TypingIndicator } from '@/components/social/typing-indicator'
import { useMessageSocket } from '@/lib/hooks/use-message-socket'
import { messagesAPI, uploadAPI, reactionsAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import {
  getLastMessagePreview,
  mapConversation,
  mapConversations,
  mapMessage,
  type ConversationView,
  type MessageView,
} from '@/lib/mappers/messages'
import { getInitials, roleLabel } from '@/lib/utils/format'
import { getMediaUrl } from '@/lib/config/api'
import { toast } from 'sonner'

function MessagesPageContent() {
  useProtectedRoute()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [conversations, setConversations] = useState<ConversationView[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationView | null>(null)
  const [messages, setMessages] = useState<MessageView[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({})
  const [isTyping, setIsTyping] = useState(false)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConversations = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await messagesAPI.getConversations()
      setConversations(mapConversations(data.conversations || [], user.id))
      setLoading(false)
    } catch {
      setConversations([])
      setLoading(false)
      toast.error('Could not load conversations')
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    void loadConversations()
  }, [loadConversations, user?.id])

  useEffect(() => {
    const conversationId =
      searchParams.get('conversation') ||
      searchParams.get('c') ||
      searchParams.get('convId')
    if (!conversationId || !user?.id) return

    const match = conversations.find((c) => c.id === conversationId)
    if (match) {
      setSelectedConversation(match)
      return
    }

    let cancelled = false
    messagesAPI
      .getConversation(conversationId)
      .then((res) => {
        if (cancelled) return
        const raw = res.data.conversation
        if (raw) setSelectedConversation(mapConversation(raw, user.id))
      })
      .catch(() => {
        if (!cancelled) toast.error('Conversation not found')
      })

    return () => {
      cancelled = true
    }
  }, [searchParams, conversations, user?.id])

  const loadMessages = useCallback(() => {
    if (!selectedConversation) return
    setMessagesLoading(true)
    messagesAPI
      .getMessages(selectedConversation.id)
      .then((res) => {
        setMessages((res.data.messages || []).map((m: any) => mapMessage(m, user!.id)))
        setMessagesLoading(false)
      })
      .catch(() => {
        setMessages([])
        setMessagesLoading(false)
      })
  }, [selectedConversation, user?.id])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const handleSocketMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (!user?.id) return
      const mapped = mapMessage(payload as any, user.id)
      setMessages((prev) => (prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped]))
      void loadConversations()
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    [user?.id, loadConversations, queryClient]
  )

  const handleReadReceipt = useCallback(
    (payload: { conversation_id?: string; message_ids?: string[] }) => {
      if (payload.conversation_id && payload.conversation_id !== selectedConversation?.id) {
        return
      }
      const ids = new Set(payload.message_ids ?? [])
      if (ids.size === 0) return
      setMessages((prev) =>
        prev.map((m) => (ids.has(m.id) && m.sender === 'me' ? { ...m, read: true } : m))
      )
    },
    [selectedConversation?.id]
  )

  useMessageSocket(selectedConversation?.id ?? null, handleSocketMessage, handleReadReceipt)

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return
    const content = messageInput.trim()
    setMessageInput('')
    setIsTyping(false)
    try {
      await messagesAPI.sendMessage(selectedConversation.id, content)
      const { data } = await messagesAPI.getMessages(selectedConversation.id)
      setMessages((data.messages || []).map((m: any) => mapMessage(m, user!.id)))
      await loadConversations()
    } catch {
      setMessageInput(content)
      toast.error('Failed to send message')
    }
  }

  const filteredConversations = conversations.filter((conv) =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const suggestions = [
    "Hi, I'd like to connect.",
    "Great profile. Let's connect.",
    'Interested in collaborating?',
    'Would love to discuss opportunities.',
    'Thanks for connecting.',
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

  const sendAttachmentMessage = async (file: File) => {
    if (!selectedConversation) return
    setUploadingAttachment(true)
    try {
      const { data } = await uploadAPI.uploadFile(file)
      const uploaded = data.file as {
        file_name: string
        file_url: string
        file_size: number
        mime_type: string
      }
      const isImage = uploaded.mime_type.startsWith('image/')
      await messagesAPI.sendMessage(selectedConversation.id, {
        content: '',
        message_type: isImage ? 'image' : 'file',
        file_name: uploaded.file_name,
        file_url: uploaded.file_url,
        file_size: uploaded.file_size,
        mime_type: uploaded.mime_type,
      })
      const { data: msgData } = await messagesAPI.getMessages(selectedConversation.id)
      setMessages((msgData.messages || []).map((m: any) => mapMessage(m, user!.id)))
      await loadConversations()
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(isImage ? 'Image sent' : 'File sent')
    } catch {
      toast.error('Failed to send attachment')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const handleAttach = async (file: File | undefined) => {
    if (!file || !selectedConversation) return
    await sendAttachmentMessage(file)
  }

  return (
    <AppShell title="Messages" hideSearchAndTheme>
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-120px)] overflow-hidden">
        {/* Conversations List */}
        {!selectedConversation ? (
          <motion.div
            className="w-full glass-card flex flex-col shrink-0 flex-1 overflow-hidden"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="p-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground mb-4">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50"
                />
              </div>
            </div>

            <div className="flex-1 h-[calc(100vh-140px)] min-h-0 overflow-y-auto w-full">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading conversations...</p>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Connect with people to start messaging</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No matching conversations</p>
              ) : (
                <div className="flex-1 overflow-y-auto w-full">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`w-full p-4 flex items-start gap-3 hover:bg-secondary/50 transition-all border-b border-border/50 ${
                        (selectedConversation as any)?.id === conv.id ? 'bg-secondary/50' : ''
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={getMediaUrl(conv.user.avatar)} />
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
                        <p className="text-sm text-muted-foreground truncate">
                          {getLastMessagePreview(conv.lastMessage)}
                        </p>
                      </div>
                      {conv.unread > 0 && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs text-primary-foreground font-medium">{conv.unread}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="flex-1 glass-card flex flex-col min-w-0 overflow-hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Top Header Action Layer */}
            <div className="px-4 py-2 border-b border-border/50 bg-secondary/20 flex items-center justify-between shrink-0">
              <Link href="/messages" className="text-xs text-primary hover:underline font-medium">
                Open full view
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSelectedConversation(null)}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={getMediaUrl(selectedConversation.user.avatar)} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {getInitials(selectedConversation.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  {selectedConversation.user.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{selectedConversation.user.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConversation.user.role} · {selectedConversation.user.online ? 'Online' : `Last active ${selectedConversation.time}`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0">
                <MoreVertical className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Start the conversation</p>
                </div>
              ) : (
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
                        {message.messageType === 'image' || message.messageType === 'file' ? (
                          message.fileUrl ? (
                            <MessageAttachment
                              fileUrl={message.fileUrl}
                              fileName={message.fileName}
                              messageType={message.messageType}
                              mimeType={message.mimeType}
                              fileSize={message.fileSize}
                            />
                          ) : (
                            <p className="text-sm">{message.content}</p>
                          )
                        ) : (
                          <p className="text-sm whitespace-pre-line">{message.content}</p>
                        )}
                        {(messageReactions[message.id] || []).length > 0 && (
                          <p className="text-xs mt-1 opacity-80">{messageReactions[message.id].join(' ')}</p>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${message.sender === 'me' ? 'justify-end' : ''}`}>
                        <span className="text-xs text-muted-foreground">{message.time}</span>
                        {message.sender === 'me' && (
                          message.read
                            ? <CheckCheck className="w-3 h-3 text-primary" />
                            : <Check className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${message.sender === 'me' ? 'justify-end' : ''}`}>
                        <button
                          onClick={() => void addReactionToMessage(message.id, '👍')}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => void addReactionToMessage(message.id, '❤️')}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          ❤️
                        </button>
                        <button
                          onClick={() => void addReactionToMessage(message.id, '🔥')}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Flame className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {isTyping && typingUser && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <TypingIndicator userName={typingUser} />
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border space-y-3 shrink-0">
              <div className="flex items-center gap-2">
                <Textarea
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value)
                    setIsTyping(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  className="resize-none min-h-[44px] max-h-[120px]"
                />
                <label className={`cursor-pointer shrink-0 ${uploadingAttachment ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Paperclip className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.zip,image/*"
                    onChange={(e) => {
                      void handleAttach(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <Button
                  onClick={() => void sendMessage()}
                  disabled={!messageInput.trim()}
                  size="sm"
                  className="gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>

              {/* Suggestions */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMessageInput(suggestion)
                      }}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Messages" hideSearchAndTheme>
          <div className="flex h-[60vh] items-center justify-center text-muted-foreground text-sm">
            Loading messages…
          </div>
        </AppShell>
      }
    >
      <MessagesPageContent />
    </Suspense>
  )
}
