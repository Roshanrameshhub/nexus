import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CollaborationSubmission {
  id: string
  repoName: string
  repoUrl: string
  issueDescription: string
  tags: string[]
  userId: string
  username: string
  createdAt: string
}

interface PostBody {
  repoName?: unknown
  repoUrl?: unknown
  issueDescription?: unknown
  tags?: unknown
  userId?: unknown
  username?: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// In-process store (survives hot-reload in dev; swap for DB in production)
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __collaborationStore: CollaborationSubmission[] | undefined
}

// Persist across Next.js hot-module reloads in development
if (!globalThis.__collaborationStore) {
  globalThis.__collaborationStore = []
}

const store: CollaborationSubmission[] = globalThis.__collaborationStore

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/collaboration
// Body: { repoName, repoUrl, issueDescription, tags, userId, username }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: PostBody

    try {
      body = (await request.json()) as PostBody
    } catch {
      return json({ success: false, error: 'Invalid JSON body.' }, 400)
    }

    const { repoName, repoUrl, issueDescription, tags, userId, username } = body

    // ── Field validation ─────────────────────────────────────────────────────

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
          .slice(0, 10) // cap at 10 tags
      : []

    // ── Persist ──────────────────────────────────────────────────────────────

    const submission: CollaborationSubmission = {
      id: generateId(),
      repoName: (repoName as string).trim(),
      repoUrl: (repoUrl as string).trim(),
      issueDescription: (issueDescription as string).trim(),
      tags: normalizedTags,
      userId: (userId as string).trim(),
      username: (username as string).trim(),
      createdAt: new Date().toISOString(),
    }

    store.unshift(submission) // newest first, keep in sync with GET sort

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/collaboration
// Returns all submissions sorted newest → oldest
// Optional query params: ?userId=<id> to filter by a specific user
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const filterUserId = searchParams.get('userId')?.trim() || null

    const results: CollaborationSubmission[] = filterUserId
      ? store.filter((s) => s.userId === filterUserId)
      : [...store]

    // Ensure newest-first order (store.unshift keeps this invariant, but sort
    // defensively in case items were inserted out of order in the future)
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
