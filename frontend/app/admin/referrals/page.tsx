'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { getApiBaseUrl } from '@/lib/config/api'

interface Referral {
  id: string
  referrer: { id: string; name: string; email: string }
  referred_user: { id: string; name: string; email: string; joined_at: string }
  referral_code: string
  status: string
  referred_at: string
}

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const token = useAuthStore((s) => s.token)
  const baseUrl = getApiBaseUrl()

  useEffect(() => {
    if (token) {
      fetchData()
    }
  }, [token])

  const fetchData = async () => {
    try {
      // Get all referrals
      const refsRes = await fetch(`${baseUrl}/referrals/admin/all-referrals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (refsRes.ok) {
        const data = await refsRes.json()
        setReferrals(data.referrals || [])
      }

      // Get analytics
      const analyticsRes = await fetch(`${baseUrl}/referrals/admin/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      rewarded: 'bg-blue-100 text-blue-700',
      expired: 'bg-red-100 text-red-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return <div className="p-8 text-center">Loading referrals...</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">📊 Referral Analytics</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500">Total Referrals</p>
          <p className="text-3xl font-bold text-blue-600">{analytics?.total || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold text-green-600">{analytics?.completed || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">{analytics?.pending || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500">Conversion Rate</p>
          <p className="text-3xl font-bold text-purple-600">{analytics?.conversion_rate || 0}%</p>
        </div>
      </div>

      {/* Top Referrers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border mb-8">
        <div className="p-4 border-b">
          <h2 className="font-semibold">🏆 Top Referrers</h2>
        </div>
        <div className="divide-y">
          {analytics?.top_referrers?.map((r: any, i: number) => (
            <div key={r.user_id} className="p-4 flex justify-between items-center">
              <div>
                <span className="font-medium">{i + 1}. {r.name}</span>
                <p className="text-sm text-gray-500">{r.email}</p>
              </div>
              <span className="text-lg font-bold text-blue-600">{r.count} referrals</span>
            </div>
          ))}
          {(!analytics?.top_referrers || analytics.top_referrers.length === 0) && (
            <div className="p-4 text-gray-500 text-center">No referrals yet</div>
          )}
        </div>
      </div>

      {/* All Referrals Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">📋 All Referrals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Referrer</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Referred User</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {referrals.map((ref) => (
                <tr key={ref.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{ref.referrer?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{ref.referrer?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{ref.referred_user?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{ref.referred_user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {ref.referral_code}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(ref.status)}`}>
                      {ref.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(ref.referred_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No referrals yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
