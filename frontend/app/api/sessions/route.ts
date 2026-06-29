import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export interface SessionRecord {
  id: string
  title: string
  description: string
  dateTime: string
  timeZone?: string
  hostId: string
  hostName: string
  attendeeId: string
  attendeeName: string
  meetLink: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending' | 'accepted'
  createdAt: string
}

// In-memory store for development (persists across hot reloads)
declare global {
  var __sessionsStore: SessionRecord[] | undefined
}

if (!globalThis.__sessionsStore) {
  globalThis.__sessionsStore = []
}

function getGoogleRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (appUrl) {
    return `${appUrl}/api/auth/callback/google`
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/api/auth/callback/google'
  }
  throw new Error('Set GOOGLE_REDIRECT_URI or NEXT_PUBLIC_APP_URL for Google Calendar OAuth')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, description, dateTime, timeZone, hostId, hostName, attendeeId, attendeeName } = body

    // Validate required fields explicitly
    if (!title || !dateTime) {
      return NextResponse.json(
        { success: false, error: 'Missing meeting title or date' },
        { status: 400 }
      )
    }

    if (!hostId || !hostName) {
      return NextResponse.json(
        { success: false, error: 'Missing host identity profile' },
        { status: 400 }
      )
    }

    if (!attendeeId || !attendeeName) {
      return NextResponse.json(
        { success: false, error: 'Missing attendee identity profile' },
        { status: 400 }
      )
    }

    // Provision a temporary production-safe placeholder link slot
    let meetLink = `https://meet.google.com/tmp-${Math.random().toString(36).substring(2, 8)}`

    // --- Live Google Calendar & Meet Creation ---
    try {
      // Setup OAuth2 client using saved credentials from env or mock for development
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
        process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
        getGoogleRedirectUri()
      );
      
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || 'dummy_refresh_token';
      const accessToken = process.env.GOOGLE_ACCESS_TOKEN || 'dummy_access_token';
      
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
        access_token: accessToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const startISOString = new Date(dateTime).toISOString();
      // Assume default duration of 1 hour
      const endISOString = new Date(new Date(dateTime).getTime() + 60 * 60 * 1000).toISOString();
      const userTimeZone = timeZone || 'UTC';

      // Execute API call only if credentials seem real to prevent crashing in dummy setup
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          requestBody: {
            summary: title,
            description: description || `Meeting with ${attendeeName}`,
            start: { dateTime: startISOString, timeZone: userTimeZone },
            end: { dateTime: endISOString, timeZone: userTimeZone },
            conferenceData: {
              createRequest: {
                requestId: `nexus-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutMeeting' }
              }
            }
          }
        });
        
        const generatedLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;
        if (generatedLink) {
          meetLink = generatedLink;
        }
      } else {
         console.warn("Skipping Google Calendar API call (GOOGLE_CLIENT_ID or GOOGLE_REFRESH_TOKEN not set). Using fallback meetLink.");
      }
    } catch (apiError) {
      console.error('Google Calendar API Error: token expiration or missing scope:', apiError);
      // Fallback to placeholder without crashing
    }

    const newSession: SessionRecord = {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title,
      description: description || '',
      dateTime,
      timeZone,
      hostId,
      hostName,
      attendeeId,
      attendeeName,
      meetLink,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    globalThis.__sessionsStore!.push(newSession)

    return NextResponse.json(
      { success: true, data: newSession },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error while processing session request' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: missing userId query parameter' },
        { status: 401 }
      )
    }

    // Query records where user is EITHER the hostId OR the attendeeId
    const userSessions = globalThis.__sessionsStore!.filter(
      (session) => session.hostId === userId || session.attendeeId === userId
    )

    // Sort the payload array chronologically (nearest upcoming events first)
    userSessions.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())

    return NextResponse.json(
      { success: true, data: userSessions },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to retrieve sessions:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching sessions' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { sessionId, timeZone } = body

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    if (!globalThis.__sessionsStore) {
      globalThis.__sessionsStore = []
    }

    const session = globalThis.__sessionsStore.find((s) => s.id === sessionId)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Provision a temporary production-safe placeholder link slot if needed
    let meetLink = session.meetLink || `https://meet.google.com/tmp-${Math.random().toString(36).substring(2, 8)}`

    // --- Live Google Calendar & Meet Creation ---
    try {
      // Setup OAuth2 client using saved credentials from env or mock for development
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
        process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
        getGoogleRedirectUri()
      );
      
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || 'dummy_refresh_token';
      const accessToken = process.env.GOOGLE_ACCESS_TOKEN || 'dummy_access_token';
      
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
        access_token: accessToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const startISOString = new Date(session.dateTime).toISOString();
      const endISOString = new Date(new Date(session.dateTime).getTime() + 60 * 60 * 1000).toISOString();
      const userTimeZone = timeZone || session.timeZone || 'UTC';

      // Execute API call only if credentials seem real to prevent crashing in dummy setup
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          requestBody: {
            summary: session.title,
            description: session.description || `Meeting with ${session.attendeeName}`,
            start: { dateTime: startISOString, timeZone: userTimeZone },
            end: { dateTime: endISOString, timeZone: userTimeZone },
            conferenceData: {
              createRequest: {
                requestId: `nexus-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutMeeting' }
              }
            }
          }
        });
        
        const generatedLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;
        if (generatedLink) {
          meetLink = generatedLink;
        }
      } else {
        console.warn("Skipping Google Calendar API call (GOOGLE_CLIENT_ID or GOOGLE_REFRESH_TOKEN not set). Using fallback meetLink.");
      }
    } catch (apiError) {
      console.error('Google Calendar API Error during acceptance:', apiError);
      // Fallback to placeholder without crashing the request
    }

    // Update the record's properties
    session.status = 'accepted'
    session.meetLink = meetLink
    if (timeZone) {
      session.timeZone = timeZone
    }

    return NextResponse.json(
      { success: true, data: session },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to accept session:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error while accepting session' },
      { status: 500 }
    )
  }
}
