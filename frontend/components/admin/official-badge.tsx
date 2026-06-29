'use client'

import { cn } from '@/lib/utils'

export function OfficialBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold',
        'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        className,
      )}
    >
      Official
    </span>
  )
}
