'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { getApiBaseUrl } from '@/lib/config/api'
import { Users, TrendingUp, Award, Copy, Check, Share2, Gift, UserPlus } from 'lucide-react'

interface ReferralStats {
  total: number
  completed: number
  pending: number
  growth_rate: number
  current_period: number
  previous_period: number
  referral_code: string
}

interface ReferralItem {
  referral_id: string
  user: {
    id: string
    name: string
    email: string
    joined_at: string
  }
  status: string
  referred_at: string
  completed_at: string | null
  source: string
}

export default function ReferralPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [referrals, setReferrals] = useState<ReferralItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const baseUrl = getApiBaseUrl()
  const frontendUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://www.rconnectx.com')

  useEffect(() => {
    if (token) {
      fetchReferralData()
    }
  }, [token])

  const fetchReferralData = async () => {
    try {
      const statsRes = await fetch(`${baseUrl}/referrals/my-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      const refsRes = await fetch(`${baseUrl}/referrals/my-referrals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (refsRes.ok) {
        const refsData = await refsRes.json()
        setReferrals(refsData.referrals || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (stats?.referral_code) {
      navigator.clipboard.writeText(stats.referral_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const shareReferral = () => {
    if (stats?.referral_code) {
      const text = `Join RConnectX using my referral code: ${stats.referral_code}\nSign up at: ${frontendUrl}/signup?ref=${stats.referral_code}`
      if (navigator.share) {
        navigator.share({ title: 'Join RConnectX', text })
      } else {
        navigator.clipboard.writeText(text)
        alert('Referral link copied to clipboard!')
      }
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
      completed: 'bg-green-500/10 text-green-600 border-green-200',
      rewarded: 'bg-blue-500/10 text-blue-600 border-blue-200',
      expired: 'bg-red-500/10 text-red-600 border-red-200'
    }
    return colors[status] || 'bg-gray-500/10 text-gray-600 border-gray-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading your referral data...</p>
        </div>
      </div>
    )
  }

  // Check if user is admin
  if (user?.platform_role === 'SUPER_ADMIN') {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center mt-20">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8">
          <Award className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Admin Account</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Admins don't have referral codes. Only regular users can refer others.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            👉 Switch to a regular user account to see your referral code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🎯 Referral Program</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Refer friends and earn rewards together</p>
      </div>

      {/* Referral Code Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white mb-8 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5" />
              <span className="text-sm font-medium text-blue-100">Your Referral Code</span>
            </div>
            <div className="flex items-center gap-4 bg-white/20 backdrop-blur rounded-xl p-4">
              <code className="text-3xl font-mono font-bold tracking-wider">
                {stats?.referral_code || 'No code'}
              </code>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <button
            onClick={shareReferral}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
        <p className="text-sm text-blue-100 mt-4 opacity-80">
          🔗 Share this code with friends and earn rewards when they join!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.completed || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <UserPlus className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.pending || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Growth</p>
              <p className={`text-2xl font-bold ${(stats?.growth_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats?.growth_rate || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            People You've Referred
          </h2>
          <span className="text-sm text-gray-500">{referrals.length} referrals</span>
        </div>
        {referrals.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">No referrals yet</p>
            <p className="text-sm text-gray-400 mt-1">Share your code and get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {referrals.map((ref) => (
              <div key={ref.referral_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-semibold">
                      {ref.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{ref.user.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{ref.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(ref.status)}`}>
                      {ref.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(ref.referred_at).toLocaleDateString()}
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
