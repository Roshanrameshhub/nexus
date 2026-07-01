'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const POPULAR_SEARCHES = ['React', 'AI', 'Startups', 'Funding', 'Remote', 'Open Source']
const RECENT_KEY = 'rconnectx_community_recent_searches'

interface CommunitySearchProps {
  value: string
  onChange: (value: string) => void
}

export function CommunitySearch({ value, onChange }: CommunitySearchProps) {
  const [recent, setRecent] = useState<string[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setRecent(JSON.parse(raw) as string[])
    } catch {
      setRecent([])
    }
  }, [])

  const saveRecent = (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    const next = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, 5)
    setRecent(next)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }

  const highlight = (text: string, query: string) => {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="rounded bg-primary/20 px-0.5 text-primary">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search discussions..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveRecent(value)
          }}
          className="border-border/50 bg-secondary/40 pl-10 pr-10 backdrop-blur-sm"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onChange('')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <AnimatePresence>
        {focused && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-20 mt-2 w-full rounded-xl border border-border/50 bg-background/95 p-3 shadow-xl backdrop-blur-xl"
          >
            {recent.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={() => onChange(term)}
                      className="rounded-full bg-secondary/60 px-2.5 py-1 text-xs hover:bg-primary/10 hover:text-primary"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Popular
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onMouseDown={() => onChange(term)}
                  className="rounded-full bg-secondary/60 px-2.5 py-1 text-xs hover:bg-primary/10 hover:text-primary"
                >
                  {term}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {value && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Highlighting matches for &ldquo;{highlight(value, value)}&rdquo;
        </p>
      )}
    </div>
  )
}

export function matchesSearch(text: string, query: string): boolean {
  if (!query.trim()) return true
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

export function highlightSearchText(text: string, query: string) {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-primary/20 px-0.5 text-primary">
        {part}
      </mark>
    ) : (
      part
    )
  )
}
