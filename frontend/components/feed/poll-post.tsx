'use client'

import { cn } from '@/lib/utils'
import type { FeedPollDetails } from '@/lib/mappers/posts'
import { Check } from 'lucide-react'

interface PollPostProps {
  poll: FeedPollDetails
  onVote: (optionId: string) => void
  voting?: boolean
}

export function PollPost({ poll, onVote, voting }: PollPostProps) {
  const hasVoted = Boolean(poll.userVoteOptionId)
  const showResults = hasVoted

  return (
    <div className="space-y-2 mb-3">
      {poll.options.map((option) => {
        const isSelected = poll.userVoteOptionId === option.id
        const pct = option.percentage ?? 0
        const count = option.voteCount ?? 0

        return (
          <button
            key={option.id}
            type="button"
            disabled={voting}
            onClick={() => !voting && onVote(option.id)}
            className={cn(
              'relative w-full text-left rounded-lg border overflow-hidden transition-colors',
              isSelected
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-secondary/20 hover:border-primary/40 hover:bg-secondary/30',
              voting && 'opacity-70 cursor-wait'
            )}
          >
            {showResults && (
              <span
                className="absolute inset-y-0 left-0 bg-primary/15 transition-all duration-500"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            )}
            <span className="relative z-10 flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                <span className={cn('truncate', isSelected && 'font-medium text-foreground')}>
                  {option.text}
                </span>
              </span>
              {showResults && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {count} · {pct}%
                </span>
              )}
            </span>
          </button>
        )
      })}
      <p className="text-[11px] text-muted-foreground pt-0.5">
        {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
        {!hasVoted && ' · Tap an option to vote'}
      </p>
    </div>
  )
}
