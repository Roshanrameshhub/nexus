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
  startup_stage?: string
  looking_for?: string
  company_name?: string
  college_name?: string
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
  platform_role?: string
  is_verified?: boolean
  last_active_at?: string | null
  github_username?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  college?: string | null
  company?: string | null
  role_details?: ApiRoleDetails | null
  created_at?: string
  current_streak?: number
  longest_streak?: number
  last_active_date?: string | null
  streak_started_at?: string | null
  is_online?: boolean
  last_seen_at?: string | null
}

export interface ApiStreakSummary {
  current_streak: number
  longest_streak: number
  streak_started_at?: string | null
  last_active_date?: string | null
  days_active_this_month: number
  next_milestone: number
  days_to_next_milestone: number
}

export interface ApiUserRecommendation extends ApiUser {
  match?: string
  following?: boolean
  match_factors?: string[]
  is_connected?: boolean
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
  opportunity_details?: {
    title?: string
    organization?: string
    opportunity_type?: string
    location?: string
    work_mode?: string
    application_link?: string
    expiry_date?: string
  } | null
  liked?: boolean
  poll_details?: {
    options?: Array<{
      id: string
      text: string
      vote_count?: number
      percentage?: number
    }>
    total_votes?: number
    user_vote_option_id?: string | null
  } | null
  is_official?: boolean
  official_label?: string | null
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

export interface DashboardActivityItem {
  id: string
  type: string
  title: string
  description?: string | null
  occurred_at: string
  link?: string | null
}

export interface ApiDashboard {
  stats: {
    connections_count: number
    posts_count: number
    communities_count: number
    unread_notifications: number
  }
  pinned_posts?: ApiPost[]
  official_posts?: ApiPost[]
  announcements?: DashboardAnnouncement[]
  recommendations: ApiUserRecommendation[]
  recommendations_total?: number
  recommendations_has_more?: boolean
  trending_posts: ApiPost[]
  active_communities: ApiCommunity[]
  startup_suggestions: ApiStartup[]
  country_discovery?: ApiCountryDiscovery[]
  trending_opportunities?: ApiPost[]
  recent_activity?: DashboardActivityItem[]
}

export interface DashboardAnnouncement {
  id: string
  title: string
  content: string
  priority: string
  cta_label?: string | null
  cta_url?: string | null
  dismissible?: boolean
  created_at?: string | null
  created_by_name?: string | null
}

export interface AdminContentPost {
  id: string
  content: string
  image_url?: string | null
  media?: string[]
  post_type?: string
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  author_name: string
  author_verified: boolean
  author_avatar?: string | null
  is_pinned: boolean
  pinned_at?: string | null
  pinned_by_name?: string | null
  pin_expires_at?: string | null
  trending_score?: number | null
}

export interface AdminAnnouncement {
  id: string
  title: string
  content: string
  audience: string
  priority?: string
  expires_at?: string | null
  publish_at?: string | null
  cta_label?: string | null
  cta_url?: string | null
  view_count?: number
  click_count?: number
  dismiss_count?: number
  custom_audience?: string | null
  target_country?: string | null
  target_city?: string | null
  show_in_dashboard?: boolean
  show_in_notification_center?: boolean
  send_in_app_notification?: boolean
  send_browser_push?: boolean
  send_mobile_push?: boolean
  notification_open_count?: number
  push_delivery_count?: number
  created_at?: string
  updated_at?: string
}

export interface AdminBroadcast {
  id: string
  broadcast_type: string
  title: string
  content: string
  audience: string
  view_count?: number
  click_count?: number
  notification_open_count?: number
  push_delivery_count?: number
  announcement_id?: string | null
  post_id?: string | null
  created_at?: string | null
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
