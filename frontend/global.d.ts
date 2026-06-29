/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL?: string
    NEXT_PUBLIC_APP_URL?: string
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string
    NEXT_PUBLIC_GNEWS_API_KEY?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    GOOGLE_REDIRECT_URI?: string
    GOOGLE_REFRESH_TOKEN?: string
    GOOGLE_ACCESS_TOKEN?: string
    NODE_ENV: 'development' | 'production' | 'test'
  }
}
