'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bookmark, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/loading-skeleton'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { newsAPI } from '@/services/news-api'
import { queryKeys } from '@/lib/query-keys'

export default function NewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  useProtectedRoute()
  const { id } = use(params)

  const { data: article, isLoading } = useQuery({
    queryKey: queryKeys.news.article(id),
    queryFn: async () => {
      const { data } = await newsAPI.getArticle(id)
      return data.article
    },
  })

  const bookmark = async () => {
    try {
      await newsAPI.bookmarkArticle(id)
      toast.success('Bookmarked')
    } catch {
      toast.error('Could not bookmark')
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <CardSkeleton count={1} />
      </AppShell>
    )
  }

  if (!article) {
    return (
      <AppShell title="Article not found">
        <Link href="/news" className="text-primary text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> News
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <article className="max-w-3xl mx-auto">
        <Link href="/news" className="text-sm text-muted-foreground flex items-center gap-1 mb-6 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> News
        </Link>
        <div className="glass-card p-8">
          <span className="text-xs text-primary uppercase tracking-wide">{article.category}</span>
          <h1 className="text-2xl font-bold mt-2">{article.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {article.source?.name} · {article.author}
          </p>
          {article.imageUrl && (
            <img src={article.imageUrl} alt="" className="w-full rounded-xl mt-6 object-cover max-h-80" />
          )}
          <p className="mt-6 text-muted-foreground leading-relaxed">{article.description}</p>
          {article.content && (
            <p className="mt-4 text-muted-foreground leading-relaxed">{article.content}</p>
          )}
          <div className="flex gap-3 mt-8">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Read full article
              </Button>
            </a>
            <Button variant="outline" onClick={bookmark}>
              <Bookmark className="w-4 h-4 mr-2" /> Save
            </Button>
          </div>
        </div>
      </article>
    </AppShell>
  )
}
