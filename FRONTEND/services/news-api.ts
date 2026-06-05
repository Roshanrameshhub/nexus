import { api } from './api'

// Types for News API
export interface NewsArticle {
  id: string
  title: string
  description: string
  content: string
  source: {
    name: string
    url: string
    icon?: string
  }
  author: string
  publishedAt: string
  imageUrl?: string
  url: string
  category: NewsCategory
  tags: string[]
  engagement: {
    views: number
    likes: number
    shares: number
    comments: number
  }
}

export type NewsCategory = 
  | 'ai'
  | 'startups'
  | 'web-development'
  | 'open-source'
  | 'cybersecurity'
  | 'cloud'
  | 'machine-learning'
  | 'funding'
  | 'product-launches'
  | 'technology'
  | 'saas'
  | 'programming'
  | 'product-management'
  | 'venture-capital'

export interface TrendingTopic {
  id: string
  name: string
  category: string
  mentions: number
  change: number // percentage change
  isHot: boolean
}

export interface NewsFilters {
  category?: NewsCategory
  search?: string
  source?: string
  dateRange?: 'today' | 'week' | 'month'
  page?: number
  limit?: number
}

// News API endpoints - prepared for Dev.to and GNews integration
export const newsAPI = {
  // Get trending news across all categories
  getTrending: (limit = 10) =>
    api.get<{ articles: NewsArticle[] }>(`/news/trending?limit=${limit}`),
  
  // Get news by category
  getByCategory: (category: NewsCategory, page = 1, limit = 20) =>
    api.get<{ articles: NewsArticle[]; total: number; hasMore: boolean }>(
      `/news/${category}?page=${page}&limit=${limit}`
    ),
  
  // Get AI-specific news
  getAINews: (page = 1, limit = 20) =>
    api.get<{ articles: NewsArticle[] }>(`/news/ai?page=${page}&limit=${limit}`),
  
  // Get startup news
  getStartupNews: (page = 1, limit = 20) =>
    api.get<{ articles: NewsArticle[] }>(`/news/startups?page=${page}&limit=${limit}`),
  
  // Get Dev.to articles (prepared for integration)
  getDevToArticles: (tag?: string, page = 1, limit = 20) =>
    api.get<{ articles: NewsArticle[] }>(
      `/news/devto?${tag ? `tag=${tag}&` : ''}page=${page}&limit=${limit}`
    ),
  
  // Search news
  search: (query: string, filters?: NewsFilters) =>
    api.get<{ articles: NewsArticle[]; total: number }>('/news/search', {
      params: { q: query, ...filters },
    }),
  
  // Get trending topics
  getTrendingTopics: () =>
    api.get<{ topics: TrendingTopic[] }>('/news/trending-topics'),
  
  // Get personalized recommendations
  getRecommendations: (userId?: string) =>
    api.get<{ articles: NewsArticle[] }>('/news/recommendations', {
      params: { userId },
    }),
  
  // Get single article
  getArticle: (id: string) =>
    api.get<{ article: NewsArticle }>(`/news/articles/${id}`),
  
  // Bookmark article
  bookmarkArticle: (id: string) =>
    api.post(`/news/articles/${id}/bookmark`),
  
  // Remove bookmark
  removeBookmark: (id: string) =>
    api.delete(`/news/articles/${id}/bookmark`),
  
  // Get bookmarked articles
  getBookmarks: () =>
    api.get<{ articles: NewsArticle[] }>('/news/bookmarks'),

  // Like article
  likeArticle: (id: string) =>
    api.post(`/news/articles/${id}/like`),

  // Unlike article
  unlikeArticle: (id: string) =>
    api.delete(`/news/articles/${id}/like`),

  // Get article likes count
  getArticleLikes: (id: string) =>
    api.get<{ article_id: string; likes_count: number }>(`/news/articles/${id}/likes`),

  // Get article comments
  getArticleComments: (id: string) =>
    api.get<{ comments: NewsComment[] }>(`/news/articles/${id}/comments`),

  // Comment on article
  createArticleComment: (id: string, content: string) =>
    api.post<{ message: string; comment: NewsComment }>(`/news/articles/${id}/comments`, { content }),
}

export interface NewsComment {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    name: string
    role: string
    avatar_url?: string | null
  }
}

export default newsAPI

