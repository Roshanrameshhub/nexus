export type IssueDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type IssueStatus = 'open' | 'claimed' | 'resolved'

export interface CollaborationIssue {
  id: string
  title: string
  repoName: string
  repoUrl: string
  issueDescription: string
  tags: string[]
  difficulty: IssueDifficulty
  screenshots: string[]
  userId: string
  username: string
  avatarUrl?: string
  status: IssueStatus
  claimerId?: string
  claimerUsername?: string
  createdAt: string
}

export interface CreateIssuePayload {
  title: string
  repoName: string
  repoUrl: string
  issueDescription: string
  tags: string[]
  difficulty: IssueDifficulty
  screenshots?: string[]
  userId: string
  username: string
  avatarUrl?: string
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = await res.json()
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || 'Request failed')
  }
  return json as T
}

export const collaborationAPI = {
  list: async (userId?: string) => {
    const url = userId ? `/api/collaboration?userId=${encodeURIComponent(userId)}` : '/api/collaboration'
    const res = await fetch(url)
    const json = await parseJson<{ success: boolean; data: CollaborationIssue[] }>(res)
    return json.data
  },

  get: async (id: string) => {
    const res = await fetch(`/api/collaboration/${id}`)
    const json = await parseJson<{ success: boolean; data: CollaborationIssue }>(res)
    return json.data
  },

  create: async (payload: CreateIssuePayload) => {
    const res = await fetch('/api/collaboration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await parseJson<{ success: boolean; data: CollaborationIssue }>(res)
    return json.data
  },

  claim: async (id: string, claimerId: string, claimerUsername: string) => {
    const res = await fetch(`/api/collaboration/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimerId, claimerUsername }),
    })
    const json = await parseJson<{ success: boolean; data: CollaborationIssue }>(res)
    return json.data
  },
}

export default collaborationAPI
