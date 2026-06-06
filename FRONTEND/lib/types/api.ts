export type UserRole =
  | 'founder'
  | 'developer'
  | 'mentor'
  | 'student'
  | 'executive'
  | 'investor'
  | 'recruiter'

export interface ApiRoleDetails {
  industry?: string
  preferred_industries?: string[] | string
  years_experience?: number
  investment_focus?: string
  degree?: string
  graduation_year?: string | number
  job_title?: string
  stage?: string
  team_size?: number
  startup_name?: string
  organization?: string
  website?: string
  linkedin?: string
  github?: string
  expertise?: string
  designation?: string
}

export type ReactionType =
  | 'like'
  | 'celebrate'
  | 'insightful'
  | 'innovative'
  | 'support'
  | 'useful'

export interface ApiUser {
  id: string
  name: string
  email?: string
  bio?: string | null
  skills?: string[]
  avatar?: string | null
  role: UserRole | string
  github_username?: string | null
  country?: string | null
  college?: string | null
  company?: string | null
  role_details?: ApiRoleDetails | null
  created_at?: string
}

export interface ApiUserRecommendation extends ApiUser {
  match?: string
  following?: boolean
  match_factors?: string[]
}

export interface ApiPost {
  id: string
  content: string
  image_url?: string | null
  media?: string[]
  post_type?: string
  hashtags?: string[] | null
  likes_count: number
  reactions_count?: number
  comments_count: number
  shares_count?: number
  created_at: string
  author: ApiUser
  liked?: boolean
}

export interface ApiComment {
  id: string
  content: string
  created_at: string
  author: ApiUser
  reactions_count?: number
  replies_count?: number
}

export interface ApiCommunity {
  id: string
  name: string
  description?: string | null
  tags?: string[]
  creator_id: string
  member_count: number
  is_member?: boolean
  created_at: string
  activity?: {
    total_discussions: number
    discussions_this_week: number
    total_likes: number
    total_comments: number
  }
}

export interface ApiDiscussion {
  id: string
  community_id: string
  title: string
  content: string
  created_at: string
  author: ApiUser
  likes_count?: number
  comments_count?: number
  views_count?: number
  shares_count?: number
  is_pinned?: boolean
  liked?: boolean
  community_name?: string
}

export interface ApiDiscussionComment {
  id: string
  content: string
  created_at: string
  author: ApiUser
  replies_count?: number
}

export interface ApiStartup {
  id: string
  name: string
  description?: string | null
  industry?: string | null
  stage?: string | null
  tags?: string[]
  logo_url?: string | null
  website?: string | null
  creator_id: string
  created_at: string
}

export interface ApiCountryDiscovery {
  country: string
  count: number
}

export interface ApiDashboard {
  stats: {
    connections_count: number
    posts_count: number
    communities_count: number
    unread_notifications: number
  }
  recommendations: ApiUserRecommendation[]
  trending_posts: ApiPost[]
  active_communities: ApiCommunity[]
  startup_suggestions: ApiStartup[]
  country_discovery?: ApiCountryDiscovery[]
}

export interface ApiMeeting {
  id: string
  organizer_id: string
  invitee_id: string
  title: string
  description?: string | null
  scheduled_at: string
  meeting_type: string
  duration_minutes: number
  meet_link: string
  meeting_provider: string
  calendar_event_id?: string | null
  notes?: string | null
  status: string
  created_at: string
  organizer?: ApiUser
  invitee?: ApiUser
}

export interface ApiConnectionRequest {
  id: string
  sender_id: string
  receiver_id: string
  status: string
  created_at: string
  sender?: ApiUser
  receiver?: ApiUser
}

export interface ApiConnectionStatus {
  status: 'none' | 'pending' | 'accepted' | 'rejected' | 'self'
  connection_id?: string | null
  is_sender?: boolean
}
