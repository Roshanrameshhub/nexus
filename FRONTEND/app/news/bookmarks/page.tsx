'use client'

import Link from 'next/link'
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { newsAPI, type NewsArticle } from '@/services/news-api'
import { queryKeys } from '@/lib/query-keys'

export default function NewsBookmarksPage() {
  useProtectedRoute()
  const qc = useQueryClient()

  const { data: articles, isLoading } = useQuery({
    queryKey: queryKeys.news.bookmarks,
    queryFn: async () => {
      const { data } = await newsAPI.getBookmarks()
      return (data.articles ?? []) as NewsArticle[]
    },
  })

  const remove = async (id: string) => {
    try {
      await newsAPI.removeBookmark(id)
      qc.invalidateQueries({ queryKey: queryKeys.news.bookmarks })
      toast.success('Removed from bookmarks')
    } catch {
      toast.error('Could not remove bookmark')
    }
  }

  return (
    <AppShell title="Saved Articles">
      <div className="max-w-3xl mx-auto space-y-4">
        {isLoading && <CardSkeleton count={4} />}
        {!isLoading && articles?.length === 0 && (
          <EmptyState
            icon={Bookmark}
            title="No bookmarks yet"
            description="Save articles from the news feed to read later."
            action={
              <Link href="/news" className="text-primary text-sm hover:underline">
                Browse news →
              </Link>
            }
          />
        )}
        {articles?.map((article) => (
          <article key={article.id} className="glass-card p-4 flex justify-between gap-4">
            <div>
              <Link href={`/news/articles/${article.id}`} className="font-semibold hover:text-primary">
                {article.title}
              </Link>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.description}</p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary mt-2 inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Open original
              </a>
            </div>
            <button
              type="button"
              onClick={() => remove(article.id)}
              className="text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Remove bookmark"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </article>
        ))}
      </div>
    </AppShell>
  )
}
