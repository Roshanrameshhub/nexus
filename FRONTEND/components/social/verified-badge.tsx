import { BadgeCheck, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VerifiedBadgeVariant = 'icon' | 'inline' | 'badge'

interface VerifiedBadgeProps {
  verified?: boolean
  variant?: VerifiedBadgeVariant
  label?: string
  className?: string
}

export function VerifiedBadge({
  verified,
  variant = 'inline',
  label,
  className,
}: VerifiedBadgeProps) {
  if (!verified) return null

  if (variant === 'icon') {
    return (
      <BadgeCheck
        className={cn('w-4 h-4 text-emerald-500 shrink-0', className)}
        aria-label="Verified"
      />
    )
  }

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
          'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
          className
        )}
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {label ?? 'Verified Member'}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400',
        className
      )}
    >
      <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
      {label ?? 'Verified'}
    </span>
  )
}

interface UserNameWithBadgeProps {
  name: string
  verified?: boolean
  badgeVariant?: VerifiedBadgeVariant
  badgeLabel?: string
  layout?: 'inline' | 'stacked'
  className?: string
  nameClassName?: string
}

export function UserNameWithBadge({
  name,
  verified,
  badgeVariant = 'icon',
  badgeLabel,
  layout = 'inline',
  className,
  nameClassName,
}: UserNameWithBadgeProps) {
  if (layout === 'stacked') {
    return (
      <div className={cn('min-w-0', className)}>
        <span className={cn('block truncate', nameClassName)}>{name}</span>
        <VerifiedBadge
          verified={verified}
          variant="inline"
          label={badgeLabel ?? 'Verified Member'}
          className="mt-0.5"
        />
      </div>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
      <span className={cn('truncate', nameClassName)}>{name}</span>
      <VerifiedBadge verified={verified} variant={badgeVariant} label={badgeLabel} />
    </span>
  )
}
