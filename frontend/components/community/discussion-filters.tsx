'use client'

import { Flame, Clock, TrendingUp, MessageCircle, HelpCircle, CheckCircle2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type DiscussionSort = 'hot' | 'new' | 'top' | 'trending' | 'most_liked' | 'most_commented' | 'unanswered' | 'solved'

export interface DiscussionFilters {
  unanswered: boolean
  solved: boolean
  pinnedOnly: boolean
}

interface DiscussionFiltersBarProps {
  sortBy: DiscussionSort
  onSortChange: (sort: DiscussionSort) => void
  filters: DiscussionFilters
  onFiltersChange: (filters: DiscussionFilters) => void
}

const SORT_OPTIONS: { id: DiscussionSort; label: string; icon: typeof Flame }[] = [
  { id: 'hot', label: 'Hot', icon: Flame },
  { id: 'new', label: 'Newest', icon: Clock },
  { id: 'top', label: 'Top', icon: TrendingUp },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'most_liked', label: 'Most Liked', icon: TrendingUp },
  { id: 'most_commented', label: 'Most Commented', icon: MessageCircle },
  { id: 'unanswered', label: 'Unanswered', icon: HelpCircle },
  { id: 'solved', label: 'Solved', icon: CheckCircle2 },
]

export function DiscussionFiltersBar({
  sortBy,
  onSortChange,
  filters,
  onFiltersChange,
}: DiscussionFiltersBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {SORT_OPTIONS.slice(0, 3).map((opt) => (
        <Button
          key={opt.id}
          variant={sortBy === opt.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange(opt.id)}
          className={sortBy === opt.id ? 'glow-primary' : ''}
        >
          <opt.icon className="mr-2 h-4 w-4" />
          {opt.label}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            More filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {SORT_OPTIONS.slice(3).map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.id}
              checked={sortBy === opt.id}
              onCheckedChange={() => onSortChange(opt.id)}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Filters</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={filters.unanswered}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, unanswered: checked })
            }
          >
            Unanswered only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.solved}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, solved: checked })
            }
          >
            Solved only
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filters.pinnedOnly}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, pinnedOnly: checked })
            }
          >
            Pinned only
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function sortDiscussions<T extends {
  created_at: string
  likes_count?: number
  comments_count?: number
  is_pinned?: boolean
  hot?: boolean
  solved?: boolean
}>(items: T[], sortBy: DiscussionSort): T[] {
  const copy = [...items]
  switch (sortBy) {
    case 'new':
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'top':
    case 'most_liked':
      return copy.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0))
    case 'most_commented':
      return copy.sort((a, b) => (b.comments_count ?? 0) - (a.comments_count ?? 0))
    case 'unanswered':
      return copy.filter((d) => (d.comments_count ?? 0) === 0)
    case 'solved':
      return copy.filter((d) => d.solved)
    case 'trending':
    case 'hot':
    default:
      return copy.sort((a, b) => {
        const scoreA = (a.likes_count ?? 0) + (a.comments_count ?? 0) * 2 + (a.hot ? 5 : 0)
        const scoreB = (b.likes_count ?? 0) + (b.comments_count ?? 0) * 2 + (b.hot ? 5 : 0)
        return scoreB - scoreA
      })
  }
}

export function applyDiscussionFilters<T extends {
  comments_count?: number
  is_pinned?: boolean
  solved?: boolean
}>(items: T[], filters: DiscussionFilters): T[] {
  return items.filter((d) => {
    if (filters.unanswered && (d.comments_count ?? 0) > 0) return false
    if (filters.solved && !d.solved) return false
    if (filters.pinnedOnly && !d.is_pinned) return false
    return true
  })
}
