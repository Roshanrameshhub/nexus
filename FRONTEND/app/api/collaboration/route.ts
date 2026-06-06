import { NextRequest, NextResponse } from 'next/server'

export type IssueDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type IssueStatus = 'open' | 'claimed' | 'resolved'

export interface CollaborationSubmission {
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

interface PostBody {
  title?: unknown
  repoName?: unknown
  repoUrl?: unknown
  issueDescription?: unknown
  tags?: unknown
  difficulty?: unknown
  screenshots?: unknown
  userId?: unknown
  username?: unknown
  avatarUrl?: unknown
}

declare global {
  // eslint-disable-next-line no-var
  var __collaborationStore: CollaborationSubmission[] | undefined
}

if (!globalThis.__collaborationStore) {
  globalThis.__collaborationStore = []
}

const store: CollaborationSubmission[] = globalThis.__collaborationStore

function generateId(): string {
  return `collab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function normalizeDifficulty(value: unknown): IssueDifficulty {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value
  }
  return 'intermediate'
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: PostBody

    try {
      body = (await request.json()) as PostBody
    } catch {
      return json({ success: false, error: 'Invalid JSON body.' }, 400)
    }

    const {
      title,
      repoName,
      repoUrl,
      issueDescription,
      tags,
      difficulty,
      screenshots,
      userId,
      username,
      avatarUrl,
    } = body

    if (!repoName || typeof repoName !== 'string' || !repoName.trim()) {
      return json({ success: false, error: 'repoName is required and must be a non-empty string.' }, 422)
    }

    if (!repoUrl || typeof repoUrl !== 'string' || !isValidUrl(repoUrl)) {
      return json({ success: false, error: 'repoUrl is required and must be a valid URL.' }, 422)
    }

    if (!issueDescription || typeof issueDescription !== 'string' || !issueDescription.trim()) {
      return json({ success: false, error: 'issueDescription is required and must be a non-empty string.' }, 422)
    }

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return json({ success: false, error: 'userId is required and must be a non-empty string.' }, 422)
    }

    if (!username || typeof username !== 'string' || !username.trim()) {
      return json({ success: false, error: 'username is required and must be a non-empty string.' }, 422)
    }

    const normalizedTags: string[] = Array.isArray(tags)
      ? (tags as unknown[])
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim().toLowerCase())
          .slice(0, 10)
      : []

    const normalizedScreenshots: string[] = Array.isArray(screenshots)
      ? (screenshots as unknown[])
          .filter((s): s is string => typeof s === 'string' && isValidUrl(s.trim()))
          .map((s) => s.trim())
          .slice(0, 5)
      : []

    const resolvedTitle =
      typeof title === 'string' && title.trim()
        ? title.trim()
        : (issueDescription as string).trim().split('\n')[0].slice(0, 200)

    const submission: CollaborationSubmission = {
      id: generateId(),
      title: resolvedTitle,
      repoName: repoName.trim(),
      repoUrl: repoUrl.trim(),
      issueDescription: issueDescription.trim(),
      tags: normalizedTags,
      difficulty: normalizeDifficulty(difficulty),
      screenshots: normalizedScreenshots,
      userId: userId.trim(),
      username: username.trim(),
      avatarUrl: typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : undefined,
      status: 'open',
      createdAt: new Date().toISOString(),
    }

    store.unshift(submission)

    return json(
      {
        success: true,
        data: submission,
        message: 'Collaboration submission created successfully.',
      },
      201
    )
  } catch (err) {
    console.error('[POST /api/collaboration] Unexpected error:', err)
    return json({ success: false, error: 'Internal server error. Please try again.' }, 500)
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const filterUserId = searchParams.get('userId')?.trim() || null

    const results: CollaborationSubmission[] = filterUserId
      ? store.filter((s) => s.userId === filterUserId)
      : [...store]

    results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return json({
      success: true,
      data: results,
      total: results.length,
      message: `Returned ${results.length} collaboration submission${results.length !== 1 ? 's' : ''}.`,
    })
  } catch (err) {
    console.error('[GET /api/collaboration] Unexpected error:', err)
    return json({ success: false, error: 'Internal server error. Please try again.' }, 500)
  }
}
