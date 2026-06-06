export const queryKeys = {
  dashboard: {
    main: ['dashboard', 'country-discovery'] as const,
  },
  search: (q: string) => ['search', q] as const,
  news: {
    bookmarks: ['news', 'bookmarks'] as const,
    search: (q: string) => ['news', 'search', q] as const,
    article: (id: string) => ['news', 'article', id] as const,
  },
}
