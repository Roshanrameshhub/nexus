import { formatTimeAgo, roleLabel } from '@/lib/utils/format'
import type { ApiUser } from '@/lib/types/api'

export interface ConversationView {
  id: string
  peerId?: string
  user: {
    name: string
    avatar?: string | null
    role?: string
    online?: boolean
    lastSeenAt?: string | null
  }
  lastMessage: string | { content?: string }
  time: string
  unread: number
}

export interface MessageView {
  id: string
  content: string
  sender: 'me' | 'other'
  time: string
  read?: boolean
  messageType: 'text' | 'file' | 'image'
  fileName?: string
  fileUrl?: string
  mimeType?: string
  fileSize?: number
}

interface BackendConversation {
  id: string
  participants?: ApiUser[]
  last_message?: string | { content?: string } | null
  last_message_at?: string | null
  unread?: number
}

interface BackendMessage {
  id: string
  content: string
  sender_id: string
  timestamp: string
  sender?: ApiUser
  message_type?: string
  file_name?: string
  file_url?: string
  mime_type?: string
  file_size?: number
  is_read?: boolean
}

export function getLastMessagePreview(
  lastMessage: string | { content?: string } | null | undefined
): string {
  if (!lastMessage) return ''
  if (typeof lastMessage === 'string') return lastMessage.trim()
  return (lastMessage.content ?? '').trim()
}

export function hasConversationMessages(raw: BackendConversation): boolean {
  return getLastMessagePreview(raw.last_message) !== ''
}

export function sortConversations(conversations: ConversationView[]): ConversationView[] {
  return [...conversations].sort((a, b) => {
    if (b.unread !== a.unread) return b.unread - a.unread
    return 0
  })
}

export function mapConversations(
  rawList: BackendConversation[],
  currentUserId: string
): ConversationView[] {
  if (!currentUserId) return []
  return sortConversations(
    rawList.map((raw) => mapConversation(raw, currentUserId))
  )
}

export function mapConversation(
  raw: BackendConversation,
  currentUserId: string
): ConversationView {
  const participants = raw.participants ?? []
  const other = participants.find((p) => String(p.id) !== String(currentUserId))

  const preview = getLastMessagePreview(raw.last_message)
  const lastMessage: string | { content?: string } = preview

  return {
    id: String(raw.id),
    peerId: other?.id ? String(other.id) : undefined,
    user: {
      name: other?.name ?? 'Unknown',
      avatar: other?.avatar,
      role: other?.role ? roleLabel(other.role) : undefined,
      online: Boolean(other?.is_online),
      lastSeenAt: other?.last_seen_at ?? null,
    },
    lastMessage,
    time: formatTimeAgo(raw.last_message_at),
    unread: raw.unread ?? 0,
  }
}

export function resolveAttachmentMessageType(
  messageType?: string,
  mimeType?: string
): 'text' | 'file' | 'image' {
  const type = (messageType || 'text').toLowerCase()
  if (type === 'image' || mimeType?.startsWith('image/')) return 'image'
  if (type === 'file') return 'file'
  return 'text'
}

export function mapMessage(
  raw: BackendMessage | Record<string, unknown>,
  currentUserId: string
): MessageView {
  const message = raw as BackendMessage
  const messageType = resolveAttachmentMessageType(message.message_type, message.mime_type)
  const isOwnMessage = String(message.sender_id) === String(currentUserId)
  return {
    id: String(message.id),
    content: message.content ?? '',
    sender: isOwnMessage ? 'me' : 'other',
    time: formatTimeAgo(message.timestamp),
    read: isOwnMessage ? Boolean(message.is_read) : undefined,
    messageType,
    fileName: message.file_name,
    fileUrl: message.file_url,
    mimeType: message.mime_type,
    fileSize: message.file_size,
  }
}
