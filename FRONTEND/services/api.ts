import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getApiBaseUrl } from '@/lib/config/api'
import { useAuthStore } from '@/lib/store'

export const API_BASE_URL = getApiBaseUrl()

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    '[Nexus] NEXT_PUBLIC_API_URL is not set. Using',
    API_BASE_URL,
    '— add NEXT_PUBLIC_API_URL to .env.local'
  )
}

function getStoredAuth(): { token?: string; refreshToken?: string } {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('auth-storage')
    if (!raw) return {}
    const { state } = JSON.parse(raw)
    return { token: state?.token, refreshToken: state?.refreshToken }
  } catch {
    return {}
  }
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredAuth()
  if (!refreshToken) return null
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    })
    const access = data.access_token as string
    const newRefresh = (data.refresh_token as string) || refreshToken
    useAuthStore.getState().setTokens(access, newRefresh)
    return access
  } catch {
    return null
  }
}

api.interceptors.request.use(
  (config) => {
    const { token } = getStoredAuth()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && original && !original._retry) {
      const path = typeof window !== 'undefined' ? window.location.pathname : ''
      if (
        path.startsWith('/login') ||
        path.startsWith('/signup') ||
        path.startsWith('/forgot-password') ||
        path.startsWith('/reset-password')
      ) {
        return Promise.reject(error)
      }
      original._retry = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      if (typeof window !== 'undefined') {
        useAuthStore.getState().logout()
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
    }
    
    // Log error details for debugging
    if (error.response?.status) {
      console.error(`[API Error] Status ${error.response.status}:`, {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response.status,
        data: error.response.data,
      })
    }
    
    return Promise.reject(error)
  }
)

/**
 * Format API error message based on status code and response data
 */
export function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected error occurred'
  }

  const err = error as AxiosError<{ detail?: string; message?: string }>

  // Check for specific error response structure
  const detail = err.response?.data?.detail || err.response?.data?.message || ''

  switch (err.response?.status) {
    case 400:
      return detail || 'Bad request. Please check your input.'
    case 401:
      return detail || 'Invalid email or password.'
    case 403:
      return detail || 'Access denied. You do not have permission.'
    case 404:
      return detail || 'Resource not found.'
    case 429:
      return detail || 'Too many requests. Please try again later.'
    case 500:
      return detail || 'Server error. Please try again later.'
    case 503:
      return detail || 'Authentication service temporarily unavailable. Please try again later.'
    default:
      if (err.message === 'Network Error') {
        return 'Network error. Please check your connection.'
      }
      return detail || err.message || 'An unexpected error occurred'
  }
}

export const authAPI = {
  signup: (data: {
    email: string
    password: string
    name: string
    role?: string
    skills?: string[]
  }) => api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: (refresh_token: string) => api.post('/auth/refresh', { refresh_token }),
  me: () => api.get('/users/me'),
  google: (id_token: string) => api.post('/auth/google', { id_token }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

export const dashboardAPI = {
  get: () => api.get('/dashboard'),
}

export const searchAPI = {
  search: (query: string) => api.get(`/search?q=${encodeURIComponent(query)}`),
}

export const usersAPI = {
  getProfile: (id: string) => api.get(`/users/${id}`),
  updateProfile: (id: string, data: Record<string, unknown>) =>
    api.patch(`/users/${id}`, data),
  getRecommendations: (roles?: string[], country?: string) => {
    const params = new URLSearchParams()
    if (roles?.length) {
      roles.forEach((r) => params.append('role', r))
    }
    if (country?.trim()) {
      params.set('country', country.trim())
    }
    const qs = params.toString()
    return api.get(`/users/recommendations${qs ? `?${qs}` : ''}`)
  },
  search: (query: string) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  follow: (userId: string) => api.post(`/users/${userId}/follow`),
  unfollow: (userId: string) => api.delete(`/users/${userId}/follow`),
}

export const connectionsAPI = {
  list: () => api.get('/connections'),
  received: () => api.get('/connections/received'),
  sent: () => api.get('/connections/sent'),
  status: (userId: string) => api.get(`/connections/status/${userId}`),
  request: (userId: string) => api.post(`/connections/request/${userId}`),
  accept: (requestId: string) => api.post(`/connections/accept/${requestId}`),
  reject: (requestId: string) => api.post(`/connections/reject/${requestId}`),
  cancel: (requestId: string) => api.delete(`/connections/request/${requestId}`),
  remove: (connectionId: string) => api.delete(`/connections/${connectionId}`),
}

export const postsAPI = {
  getFeed: (page = 1, limit = 20, filter?: string) => 
    api.get(`/posts?page=${page}&limit=${limit}${filter ? `&filter=${filter}` : ''}`),
  getPost: (id: string) => api.get(`/posts/${id}`),
  createPost: (data: { content: string; media?: string[]; post_type?: string }) => api.post('/posts', data),
  updatePost: (id: string, data: { content?: string; media?: string[] }) =>
    api.patch(`/posts/${id}`, data),
  deletePost: (id: string) => api.delete(`/posts/${id}`),
  likePost: (id: string) => api.post(`/posts/${id}/like`),
  commentOnPost: (id: string, content: string) =>
    api.post(`/posts/${id}/comments`, { content }),
}

export interface MessageSendPayload {
  content?: string
  message_type?: 'text' | 'file' | 'image'
  file_name?: string
  file_url?: string
  file_size?: number
  mime_type?: string
}

export const messagesAPI = {
  getConversations: () => api.get('/conversations'),
  getConversation: (conversationId: string) => api.get(`/conversations/${conversationId}`),
  deleteConversation: (conversationId: string) => api.delete(`/conversations/${conversationId}`),
  getMessages: (conversationId: string) =>
    api.get(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, payload: string | MessageSendPayload) =>
    api.post(
      `/conversations/${conversationId}/messages`,
      typeof payload === 'string' ? { content: payload } : payload
    ),
  createConversation: (participantIds: string[]) =>
    api.post('/conversations', { participant_ids: participantIds }),
}

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
}

export const communitiesAPI = {
  getAll: () => api.get('/communities'),
  create: (data: { name: string; description?: string; tags?: string[] }) => api.post('/communities', data),
  get: (id: string) => api.get(`/communities/${id}`),
  getDiscussions: (communityId: string, sort = 'recent') =>
    api.get(`/communities/${communityId}/discussions?sort=${sort}`),
  createDiscussion: (communityId: string, data: { title: string; content: string }) =>
    api.post(`/communities/${communityId}/discussions`, data),
  join: (id: string) => api.post(`/communities/${id}/join`),
  leave: (id: string) => api.post(`/communities/${id}/leave`),
  getDiscussion: (id: string) => api.get(`/communities/discussions/${id}`),
  likeDiscussion: (id: string) => api.post(`/communities/discussions/${id}/like`),
  shareDiscussion: (id: string) => api.post(`/communities/discussions/${id}/share`),
  getDiscussionComments: (discussionId: string, sort = 'recent', page = 1, limit = 20) =>
    api.get(`/communities/discussions/${discussionId}/comments?sort=${sort}&page=${page}&limit=${limit}`),
  commentOnDiscussion: (discussionId: string, content: string) =>
    api.post(`/communities/discussions/${discussionId}/comments`, { content }),
  replyToDiscussionComment: (commentId: string, content: string) =>
    api.post(`/communities/discussion-comments/${commentId}/replies`, { content }),
  getDiscussionCommentReplies: (commentId: string, page = 1, limit = 10) =>
    api.get(`/communities/discussion-comments/${commentId}/replies?page=${page}&limit=${limit}`),
}

export const teamsAPI = {
  getMyTeams: () => api.get('/teams'),
  get: (id: string) => api.get(`/teams/${id}`),
  create: (data: { name: string; description?: string }) => api.post('/teams', data),
  invite: (teamId: string, email: string) => api.post(`/teams/${teamId}/invite`, { email }),
  getChannels: (teamId: string) => api.get(`/teams/${teamId}/channels`),
  createChannel: (teamId: string, name: string) =>
    api.post(`/teams/${teamId}/channels`, { name }),
}

export const workspacesAPI = {
  list: () => api.get('/workspaces'),
  get: (id: string) => api.get(`/workspaces/${id}`),
  create: (data: { name: string; description?: string; team_id?: string }) =>
    api.post('/workspaces', data),
  listTasks: (workspaceId: string) =>
    api.get(`/tasks?workspace_id=${workspaceId}`),
  createTask: (data: Record<string, unknown>) => api.post('/tasks', data),
  updateTask: (id: string, data: Record<string, unknown>) => api.patch(`/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),
  listMilestones: (workspaceId: string) =>
    api.get(`/milestones?workspace_id=${workspaceId}`),
  createMilestone: (data: Record<string, unknown>) => api.post('/milestones', data),
  addFile: (workspaceId: string, data: { name: string; file_url: string; size_bytes?: number }) =>
    api.post(`/workspaces/${workspaceId}/files`, data),
}

export const startupsAPI = {
  getAll: (page = 1, limit = 20) => api.get(`/startups?page=${page}&limit=${limit}`),
  get: (id: string) => api.get(`/startups/${id}`),
  create: (data: Record<string, unknown>) => api.post('/startups', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/startups/${id}`, data),
  getOpenPositions: (id: string) => api.get(`/startups/${id}/positions`),
  createPosition: (id: string, data: Record<string, unknown>) => api.post(`/startups/${id}/positions`, data),
}

export const reactionsAPI = {
  reactToPost: (postId: string, reactionType: string) =>
    api.post(`/reactions/posts/${postId}`, { reaction_type: reactionType }),
  removePostReaction: (postId: string) =>
    api.delete(`/reactions/posts/${postId}`),
  getPostReactions: (postId: string) =>
    api.get(`/reactions/posts/${postId}`),
  reactToComment: (commentId: string, reactionType: string) =>
    api.post(`/reactions/comments/${commentId}`, { reaction_type: reactionType }),
  removeCommentReaction: (commentId: string) =>
    api.delete(`/reactions/comments/${commentId}`),
  reactToMessage: (messageId: string, reactionType: string) =>
    api.post(`/reactions/messages/${messageId}`, { reaction_type: reactionType }),
  removeMessageReaction: (messageId: string) =>
    api.delete(`/reactions/messages/${messageId}`),
}

export const bookmarksAPI = {
  savePost: (postId: string) =>
    api.post('/bookmarks', { post_id: postId }),
  unsavePost: (postId: string) =>
    api.delete(`/bookmarks/${postId}`),
  getSavedPosts: (page = 1, limit = 20) =>
    api.get(`/bookmarks?page=${page}&limit=${limit}`),
  createRepost: (postId: string, caption?: string) =>
    api.post('/bookmarks/reposts', { post_id: postId, caption }),
  getReposts: (postId: string) =>
    api.get(`/bookmarks/reposts/${postId}`),
}

export const commentsAPI = {
  getComments: (postId: string, sort = 'recent', page = 1, limit = 20) =>
    api.get(`/comments/posts/${postId}?sort=${sort}&page=${page}&limit=${limit}`),
  replyToComment: (commentId: string, content: string) =>
    api.post(`/comments/${commentId}/replies`, { content }),
  getReplies: (commentId: string, page = 1, limit = 10) =>
    api.get(`/comments/${commentId}/replies?page=${page}&limit=${limit}`),
  editComment: (commentId: string, content: string) =>
    api.put(`/comments/${commentId}`, { content }),
  deleteComment: (commentId: string) =>
    api.delete(`/comments/${commentId}`),
}

export const uploadAPI = {
  uploadImages: (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    return api.post('/upload/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('files', file)
    return api.post('/upload/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export const newsAPI = {
  getTrendingTopics: () => api.get('/news/trending-topics'),
  getTopicPosts: (topic: string, page = 1, limit = 20) =>
    api.get(`/news/topics/${encodeURIComponent(topic)}?page=${page}&limit=${limit}`),
}

export const meetingsAPI = {
  create: (data: {
    invitee_id: string
    title: string
    description?: string
    scheduled_at: string
    meeting_type: string
    duration_minutes?: number
    user_time_zone?: string
  }) => api.post('/meetings', data),
  list: () => api.get('/meetings'),
  accept: (id: string) => {
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return api.patch(`/meetings/${id}/accept`, { user_time_zone: userTimeZone })
  },
  decline: (id: string) => api.patch(`/meetings/${id}/decline`),
  cancel: (id: string) => api.patch(`/meetings/${id}/cancel`),
  reschedule: (
    id: string,
    data: {
      scheduled_at: string
      duration_minutes?: number
      title?: string
      description?: string
      user_time_zone?: string
    }
  ) => api.patch(`/meetings/${id}/reschedule`, data),
  updateNotes: (id: string, data: { notes: string }) => api.patch(`/meetings/${id}/notes`, data),
}

export const verificationAPI = {
  getStatus: () => api.get('/verification/me'),
  getDocument: () => api.get('/verification/document', { responseType: 'blob' }),
  submit: (documentType: 'college_id' | 'company_id', file: File) => {
    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('file', file)
    return api.post('/verification', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const adminAPI = {
  overview: () => api.get('/admin/overview'),
  users: (params?: { q?: string; suspended?: boolean; limit?: number; offset?: number }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.suspended !== undefined) search.set('suspended', String(params.suspended))
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.offset) search.set('offset', String(params.offset))
    const qs = search.toString()
    return api.get(`/admin/users${qs ? `?${qs}` : ''}`)
  },
  userDetail: (id: string) => api.get(`/admin/users/${id}`),
  suspendUser: (id: string) => api.post(`/admin/users/${id}/suspend`),
  reactivateUser: (id: string) => api.post(`/admin/users/${id}/reactivate`),
  announcements: () => api.get('/admin/announcements'),
  createAnnouncement: (data: { title: string; content: string; audience: string }) =>
    api.post('/admin/announcements', data),
  updateAnnouncement: (id: string, data: Record<string, string>) =>
    api.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`),
  pinnedPosts: () => api.get('/admin/pinned'),
  pinPost: (post_id: string, pin_order?: number) =>
    api.post('/admin/pinned', { post_id, pin_order }),
  unpinPost: (postId: string) => api.delete(`/admin/pinned/${postId}`),
  verifications: (status?: string) =>
    api.get(`/admin/verification${status ? `?status=${status}` : ''}`),
  verificationDocument: (id: string) =>
    api.get(`/admin/verification/${id}/document`, { responseType: 'blob' }),
  approveVerification: (id: string, note?: string) =>
    api.post(`/admin/verification/${id}/approve`, { note }),
  rejectVerification: (id: string, note?: string) =>
    api.post(`/admin/verification/${id}/reject`, { note }),
  referrals: () => api.get('/admin/referrals'),
  reports: (status = 'open') => api.get(`/admin/reports?status=${status}`),
  resolveReport: (id: string, data: { resolution_note?: string; remove_content?: boolean }) =>
    api.post(`/admin/reports/${id}/resolve`, data),
  sessions: () => api.get('/admin/sessions'),
  createSession: (data: Record<string, unknown>) => api.post('/admin/sessions', data),
  updateSession: (id: string, data: Record<string, unknown>) =>
    api.patch(`/admin/sessions/${id}`, data),
  cancelSession: (id: string) => api.delete(`/admin/sessions/${id}`),
  analytics: () => api.get('/admin/analytics'),
  auditLogs: () => api.get('/admin/audit-logs'),
  settings: () => api.get('/admin/settings'),
}

export default api
