'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { getApiBaseUrl } from '@/lib/config/api'

interface Meeting {
  id: string
  title: string
  description: string
  status: string
  start_time: string
  meeting_link: string
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const storeToken = useAuthStore((s) => s.token)

  // 👇 this is the key fix — get token directly from localStorage as fallback
  const getToken = () => {
    if (storeToken) return storeToken
    try {
      const stored = localStorage.getItem('auth-storage')
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed?.state?.token || null
      }
    } catch (e) {}
    return null
  }

  const fetchMeetings = async () => {
    const token = getToken()
    console.log('Token being used:', token ? 'EXISTS' : 'NULL')
    
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/meetings/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      console.log('Response status:', res.status)
      if (res.ok) {
        const data = await res.json()
        console.log('Meetings:', data)
        setMeetings(data.meetings || [])
      } else {
        console.error('Error:', await res.text())
      }
    } catch (err) {
      console.error('Fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // small delay to let zustand rehydrate
    const timer = setTimeout(() => {
      fetchMeetings()
    }, 300)
    return () => clearTimeout(timer)
  }, [storeToken])

  const createMeeting = async () => {
    if (!title.trim()) return alert('Enter a title!')
    const token = getToken()
    if (!token) return alert('Not logged in!')

    setCreating(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/meetings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || 'No description' })
      })
      if (res.ok) {
        alert('Meeting created!')
        setTitle('')
        setDescription('')
        await fetchMeetings()
      } else {
        alert('Error: ' + await res.text())
      }
    } catch (err) {
      alert('Error creating meeting')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Live Meetings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Create Meeting</h2>
          <input
            type="text"
            placeholder="Meeting title"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 mb-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 mb-3 min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            onClick={createMeeting}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create Meeting'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Join Meeting</h2>
          <input
            type="text"
            placeholder="Enter meeting link code"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            id="meetingLinkInput"
          />
          <button
            className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            onClick={() => {
              const input = document.getElementById('meetingLinkInput') as HTMLInputElement
              if (input?.value) window.open(`/meeting?link=${input.value}`, '_blank')
              else alert('Enter a meeting link!')
            }}
          >
            Join Meeting
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Your Meetings ({meetings.length})</h2>
        {loading ? (
          <p className="text-gray-500">Loading meetings...</p>
        ) : meetings.length === 0 ? (
          <p className="text-gray-500">No meetings yet. Create one above!</p>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{meeting.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{meeting.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        meeting.status === 'live' ? 'bg-green-100 text-green-700' :
                        meeting.status === 'ended' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {meeting.status || 'scheduled'}
                      </span>
                      {meeting.start_time && (
                        <span className="text-xs text-gray-500">
                          {new Date(meeting.start_time).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {meeting.meeting_link && (
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      onClick={() => window.open(`/meeting?link=${meeting.meeting_link}`, '_blank')}
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}