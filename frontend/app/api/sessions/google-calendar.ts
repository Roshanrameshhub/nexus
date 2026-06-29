export interface GoogleCalendarEventPayload {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  conferenceData: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: 'hangoutsMeet' };
    };
  };
}

export async function createGoogleMeetEvent(params: {
  title: string;
  description: string;
  dateTime: string;
}): Promise<string | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    let accessToken = process.env.GOOGLE_ACCESS_TOKEN;

    if (!accessToken && refreshToken && clientId && clientSecret) {
      // Attempt to get a new access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;
      }
    }

    if (!accessToken) {
      console.warn('No Google access token available to create Meet link.');
      return null;
    }

    // Calculate end time (assume 1 hour duration)
    const startDate = new Date(params.dateTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const eventPayload: GoogleCalendarEventPayload = {
      summary: params.title,
      description: params.description || '',
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'UTC',
      },
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Calendar API error:', errorText);
      return null;
    }

    const data = await response.json();
    return data.hangoutLink || null;
  } catch (error) {
    console.error('Failed to provision Google Meet event:', error);
    return null;
  }
}
