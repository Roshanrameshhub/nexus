'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return createElement(QueryClientProvider, { client: queryClient }, children)
}
