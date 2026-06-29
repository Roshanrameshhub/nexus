import { NextRequest, NextResponse } from 'next/server'
import type { CollaborationSubmission } from '../route'

declare global {
  // eslint-disable-next-line no-var
  var __collaborationStore: CollaborationSubmission[] | undefined
}

function getStore(): CollaborationSubmission[] {
  if (!globalThis.__collaborationStore) {
    globalThis.__collaborationStore = []
  }
  return globalThis.__collaborationStore
}

function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const issue = getStore().find((item) => item.id === id)
  if (!issue) {
    return json({ success: false, error: 'Issue not found.' }, 404)
  }
  return json({ success: true, data: issue })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const store = getStore()
    const issue = store.find((item) => item.id === id)
    if (!issue) {
      return json({ success: false, error: 'Issue not found.' }, 404)
    }

    const body = (await request.json()) as {
      claimerId?: unknown
      claimerUsername?: unknown
    }

    const claimerId = typeof body.claimerId === 'string' ? body.claimerId.trim() : ''
    const claimerUsername =
      typeof body.claimerUsername === 'string' ? body.claimerUsername.trim() : ''

    if (!claimerId || !claimerUsername) {
      return json({ success: false, error: 'claimerId and claimerUsername are required.' }, 422)
    }

    if (issue.status === 'claimed' && issue.claimerId !== claimerId) {
      return json({ success: false, error: 'This issue has already been claimed.' }, 409)
    }

    issue.status = 'claimed'
    issue.claimerId = claimerId
    issue.claimerUsername = claimerUsername

    return json({ success: true, data: issue })
  } catch (err) {
    console.error('[PATCH /api/collaboration/:id] Unexpected error:', err)
    return json({ success: false, error: 'Internal server error.' }, 500)
  }
}
