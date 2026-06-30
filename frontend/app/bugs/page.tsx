'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { getApiBaseUrl } from '@/lib/config/api'

interface Bug {
  id: string
  title: string
  description: string
  status: string
  priority: string
  created_at: string
}

export default function BugTrackerPage() {
  const [bugs, setBugs] = useState<Bug[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all')
  const token = useAuthStore((s) => s.token)
  const baseUrl = getApiBaseUrl()

  // Fetch bugs
  const fetchBugs = async () => {
    if (!token) return
    setLoading(true)
    try {
      const url = activeTab === 'all' 
        ? `${baseUrl}/bugs` 
        : `${baseUrl}/bugs/my-bugs`
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setBugs(data.bugs || [])
      }
    } catch (error) {
      console.error('Error fetching bugs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBugs()
  }, [activeTab, token])

  // Submit bug
  const submitBug = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please fill in title and description')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${baseUrl}/bugs/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority: priority
        })
      })

      if (res.ok) {
        alert('✅ Bug reported successfully!')
        setTitle('')
        setDescription('')
        setPriority('medium')
        await fetchBugs()
      } else {
        const error = await res.json()
        alert('❌ Error reporting bug: ' + (error.detail || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error:', error)
      alert('❌ Error reporting bug. Make sure backend is running.')
    } finally {
      setSubmitting(false)
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      reported: 'bg-gray-200 text-gray-700',
      in_progress: 'bg-yellow-200 text-yellow-700',
      fixed: 'bg-green-200 text-green-700',
      verified: 'bg-blue-200 text-blue-700',
      closed: 'bg-gray-300 text-gray-600'
    }
    return colors[status] || 'bg-gray-200 text-gray-700'
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    }
    return colors[priority] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">🐛 Bug Tracker</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          All Bugs ({bugs.length})
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'my'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          My Bugs
        </button>
      </div>

      {/* Report Bug Form */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">📝 Report a Bug</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            placeholder="Bug title"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">🟢 Low</option>
            <option value="medium">🟡 Medium</option>
            <option value="high">🟠 High</option>
            <option value="critical">🔴 Critical</option>
          </select>
        </div>
        <textarea
          placeholder="Describe the bug in detail..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          onClick={submitBug}
          disabled={submitting}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : '🐛 Report Bug'}
        </button>
      </div>

      {/* Bug List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Bug List</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading bugs...</div>
        ) : bugs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No bugs reported yet. Be the first to report one!
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {bugs.map((bug) => (
              <div key={bug.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{bug.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{bug.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {new Date(bug.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(bug.status)}`}>
                      {bug.status}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(bug.priority)}`}>
                      {bug.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}