'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ExternalLink, Bookmark } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { newsAPI, type NewsArticle } from '@/services/news-api'
import { queryKeys } from '@/lib/query-keys'

export default function NewsSearchPage() {
  useProtectedRoute()
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.news.search(submitted),
    queryFn: async () => {
      const { data: res } = await newsAPI.search(submitted)
      return res.articles as NewsArticle[]
    },
    enabled: submitted.length >= 2,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(q.trim())
  }

  const bookmark = async (id: string) => {
    try {
      await newsAPI.bookmarkArticle(id)
      toast.success('Bookmarked')
    } catch {
      toast.error('Could not bookmark')
    }
  }

  return (
    <AppShell title="Search News">
      <div className="max-w-3xl mx-auto space-y-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" className="glow-primary">
            Search
          </Button>
        </form>

        {isLoading && <CardSkeleton count={4} />}
        <div className="space-y-4">
          {data?.map((article) => (
            <article key={article.id} className="glass-card p-4">
              <Link href={`/news/articles/${article.id}`} className="font-semibold hover:text-primary">
                {article.title}
              </Link>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.description}</p>
              <div className="flex items-center gap-3 mt-3">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Source
                </a>
                <button
                  type="button"
                  onClick={() => bookmark(article.id)}
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary"
                >
                  <Bookmark className="w-3 h-3" /> Save
                </button>
              </div>
            </article>
          ))}
        </div>
        {submitted && !isLoading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">No articles found.</p>
        )}
      </div>
    </AppShell>
  )
}
