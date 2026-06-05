import { NextResponse } from 'next/server'
import { createGoogleMeetEvent } from '../sessions/google-calendar'
import { POST as createSession, GET as getSessions } from '../sessions/route'

export async function GET() {
  const report = {
    environmentCheck: {
      hasClientId: false,
      hasClientSecret: false,
      hasRefreshToken: false,
      hasAccessToken: false,
    },
    databaseCheck: {
      insertSuccess: false,
      fetchSuccess: false,
      retrievedMatch: false,
      cleanupSuccess: false,
      error: null as string | null,
    },
    googleApiCheck: {
      attempted: false,
      success: false,
      hangoutLink: null as string | null,
      error: null as string | null,
    }
  }

  // 1. ENVIRONMENT KEY VERIFICATION
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    report.environmentCheck.hasClientId = !!clientId
    report.environmentCheck.hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET
    report.environmentCheck.hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN
    report.environmentCheck.hasAccessToken = !!process.env.GOOGLE_ACCESS_TOKEN
  } catch (e: any) {
    console.error('Env check failed', e)
  }

  // 2. PROGRAMMATIC DATABASE INSERT & FETCH TEST
  let createdSessionId: string | null = null
  try {
    const dummyPayload = {
      title: 'Workflow Verification Test',
      description: 'Automated test to verify session creation and google calendar integration',
      dateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      hostId: 'test_host_id',
      hostName: 'Test Host',
      attendeeId: 'test_attendee_id',
      attendeeName: 'Test Attendee'
    }

    // Mock the Request object for POST
    const mockPostRequest = new Request('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify(dummyPayload)
    })

    const postResponse = await createSession(mockPostRequest)
    const postData = await postResponse.json()

    if (postResponse.ok && postData.success) {
      report.databaseCheck.insertSuccess = true
      createdSessionId = postData.data.id

      // Fetch test
      const mockGetRequest = new Request(`http://localhost/api/sessions?userId=test_host_id`)
      const getResponse = await getSessions(mockGetRequest)
      const getData = await getResponse.json()

      if (getResponse.ok && getData.success) {
        report.databaseCheck.fetchSuccess = true
        const found = getData.data.find((s: any) => s.id === createdSessionId)
        if (found) {
          report.databaseCheck.retrievedMatch = true
        }
      } else {
        report.databaseCheck.error = getData.error || 'Failed to fetch sessions'
      }
    } else {
      report.databaseCheck.error = postData.error || 'Failed to insert session'
    }

  } catch (e: any) {
    report.databaseCheck.error = e.message || String(e)
  }

  // 3. GOOGLE CALENDAR & MEET DRY-RUN
  try {
    report.googleApiCheck.attempted = true
    const link = await createGoogleMeetEvent({
      title: 'Workflow Verification Test',
      description: 'Automated check',
      dateTime: new Date(Date.now() + 86400000).toISOString()
    })

    if (link) {
      report.googleApiCheck.success = true
      report.googleApiCheck.hangoutLink = link
    } else {
      report.googleApiCheck.success = false
      report.googleApiCheck.error = 'Returned null or failed to provision link (check server logs for Google API error)'
    }
  } catch (e: any) {
    report.googleApiCheck.success = false
    report.googleApiCheck.error = e.message || String(e)
  }

  // 4. CLEANUP
  try {
    if (createdSessionId && globalThis.__sessionsStore) {
      const initialLength = globalThis.__sessionsStore.length
      globalThis.__sessionsStore = globalThis.__sessionsStore.filter(s => s.id !== createdSessionId)
      if (globalThis.__sessionsStore.length < initialLength) {
        report.databaseCheck.cleanupSuccess = true
      }
    } else if (report.databaseCheck.insertSuccess && !createdSessionId) {
        report.databaseCheck.cleanupSuccess = false
        report.databaseCheck.error = (report.databaseCheck.error ? report.databaseCheck.error + ' | ' : '') + 'Could not access createdSessionId for cleanup'
    }
  } catch (e: any) {
     report.databaseCheck.cleanupSuccess = false
     report.databaseCheck.error = (report.databaseCheck.error ? report.databaseCheck.error + ' | ' : '') + 'Cleanup error: ' + (e.message || String(e))
  }

  return NextResponse.json(report, { status: 200 })
}
