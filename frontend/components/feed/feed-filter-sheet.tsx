'use client'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'

export const FEED_POST_TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'text', label: 'Text' },
  { id: 'startup_update', label: 'Startup Update' },
  { id: 'funding', label: 'Funding' },
  { id: 'product_launch', label: 'Product Launch' },
  { id: 'poll', label: 'Poll' },
  { id: 'event', label: 'Event' },
] as const

export type FeedPostTypeFilter = (typeof FEED_POST_TYPE_FILTERS)[number]['id']

interface FeedFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: FeedPostTypeFilter
  onChange: (value: FeedPostTypeFilter) => void
}

export function FeedFilterSheet({ open, onOpenChange, value, onChange }: FeedFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Filter posts</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-1">
          {FEED_POST_TYPE_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id)
                onOpenChange(false)
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                value === opt.id
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-foreground hover:bg-secondary/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <SheetFooter className="border-t border-border pt-4">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
