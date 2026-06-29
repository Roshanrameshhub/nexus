import type { ApiPost } from '@/lib/types/api'
import { formatTimeAgo, roleLabel } from '@/lib/utils/format'

export interface FeedPollOption {
  id: string
  text: string
  voteCount: number
  percentage: number
}

export interface FeedPollDetails {
  options: FeedPollOption[]
  totalVotes: number
  userVoteOptionId?: string | null
}

export interface FeedPostView {
  id: string
  postType: string
  isOfficial: boolean
  officialLabel?: string | null
  author: {
    id: string
    name: string
    role: string
    rawRole: string
    avatar?: string | null
    verified?: boolean
  }
  content: string
  time: string
  tags: string[]
  media: string[]
  liked: boolean
  likes: number
  comments: number
  shares: number
  poll?: FeedPollDetails | null
}

export function mapPostToFeedView(post: ApiPost): FeedPostView {
  // Single source of truth: prefer media array and only fallback to image_url.
  const sourceMedia = (post.media?.length ? post.media : post.image_url ? [post.image_url] : [])
  const media = Array.from(new Set(sourceMedia.filter(Boolean)))

  let poll: FeedPollDetails | null = null
  if (post.poll_details?.options?.length) {
    poll = {
      options: post.poll_details.options.map((o) => ({
        id: o.id,
        text: o.text,
        voteCount: o.vote_count ?? 0,
        percentage: o.percentage ?? 0,
      })),
      totalVotes: post.poll_details.total_votes ?? 0,
      userVoteOptionId: post.poll_details.user_vote_option_id,
    }
  }

  return {
    id: String(post.id),
    postType: post.post_type || 'text',
    isOfficial: Boolean(post.is_official),
    officialLabel: post.official_label,
    author: {
      id: String(post.author.id),
      name: post.author.name,
      role: roleLabel(post.author.role),
      rawRole: post.author.role,
      avatar: post.author.avatar,
      verified: post.author.is_verified ?? false,
    },
    content: post.content,
    time: formatTimeAgo(post.created_at),
    tags: post.hashtags ?? [],
    media,
    liked: post.liked ?? false,
    likes: post.likes_count ?? post.reactions_count ?? 0,
    comments: post.comments_count ?? 0,
    shares: post.shares_count ?? 0,
    poll,
  }
}

export const POST_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  startup_update: 'Startup Update',
  funding: 'Funding',
  product_launch: 'Product Launch',
  product_update: 'Product Update',
  platform_update: 'Platform Update',
  poll: 'Poll',
  event: 'Event',
  image: 'Image',
}
