import { api } from './api'

// Types for GitHub API
export interface GitHubUser {
  id: string
  login: string
  name: string
  avatarUrl: string
  bio: string
  company?: string
  location?: string
  blog?: string
  twitterUsername?: string
  publicRepos: number
  publicGists: number
  followers: number
  following: number
  createdAt: string
  updatedAt: string
  hireable?: boolean
}

export interface GitHubRepo {
  id: string
  name: string
  fullName: string
  description: string
  owner: {
    login: string
    avatarUrl: string
  }
  htmlUrl: string
  language: string
  languageColor?: string
  stargazersCount: number
  forksCount: number
  watchersCount: number
  openIssuesCount: number
  topics: string[]
  visibility: 'public' | 'private'
  defaultBranch: string
  createdAt: string
  updatedAt: string
  pushedAt: string
  license?: {
    key: string
    name: string
  }
  isArchived: boolean
  isFork: boolean
}

export interface ContributionDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4 // 0 = no contributions, 4 = most
}

export interface ContributionStats {
  totalContributions: number
  currentStreak: number
  longestStreak: number
  weeks: ContributionDay[][]
}

export interface LanguageStats {
  language: string
  percentage: number
  color: string
  bytes: number
}

export interface GitHubActivity {
  id: string
  type: 'push' | 'pr' | 'issue' | 'star' | 'fork' | 'create' | 'review'
  repo: string
  repoUrl: string
  description: string
  createdAt: string
}

export interface GitHubConnectionStatus {
  isConnected: boolean
  githubUserId?: string
  username?: string
  avatarUrl?: string
  connectedAt?: string
  scopes?: string[]
}

// GitHub API endpoints - prepared for OAuth integration
export const githubAPI = {
  // OAuth flow
  initiateOAuth: () =>
    api.get<{ authUrl: string }>('/github/oauth/init'),
  
  handleCallback: (code: string) =>
    api.post<{ success: boolean; user: GitHubUser }>('/github/oauth/callback', { code }),
  
  disconnect: () =>
    api.delete('/github/disconnect'),
  
  // Connection status
  getConnectionStatus: () =>
    api.get<GitHubConnectionStatus>('/github/status'),
  
  // Profile
  getProfile: (username?: string) =>
    api.get<{ user: GitHubUser }>(`/github/profile${username ? `?username=${username}` : ''}`),
  
  // Repositories
  getRepos: (page = 1, limit = 20, sort: 'updated' | 'stars' | 'name' = 'updated') =>
    api.get<{ repos: GitHubRepo[]; total: number; hasMore: boolean }>(
      `/github/repos?page=${page}&limit=${limit}&sort=${sort}`
    ),
  
  getRepo: (owner: string, repo: string) =>
    api.get<{ repo: GitHubRepo }>(`/github/repos/${owner}/${repo}`),
  
  // Contributions
  getContributions: (year?: number) =>
    api.get<ContributionStats>(`/github/contributions${year ? `?year=${year}` : ''}`),
  
  // Activity
  getActivity: (page = 1, limit = 20) =>
    api.get<{ activities: GitHubActivity[]; hasMore: boolean }>(
      `/github/activity?page=${page}&limit=${limit}`
    ),
  
  // Language stats
  getLanguageStats: () =>
    api.get<{ languages: LanguageStats[] }>('/github/languages'),
  
  // Trending repos (for recommendations)
  getTrendingRepos: (language?: string, since: 'daily' | 'weekly' | 'monthly' = 'weekly') =>
    api.get<{ repos: GitHubRepo[] }>(
      `/github/trending?${language ? `language=${language}&` : ''}since=${since}`
    ),
  
  // Suggested contributors
  getSuggestedContributors: () =>
    api.get<{ users: GitHubUser[] }>('/github/suggested-contributors'),

  // AI repository assistant
  askAI: (owner: string, repo: string, question: string, filePath?: string) =>
    api.post<{ answer: string; suggested_files: string[]; repo: string; timestamp: string }>(
      `/github/repos/${owner}/${repo}/assistant`,
      { question, file_path: filePath }
    ),
}

export default githubAPI

