'use client'

import { useEffect, useState } from 'react'
import { AdminMetricCard, AdminShell } from '@/components/layout/admin-shell'
import { adminAPI } from '@/services/api'

interface Overview {
  total_users: number
  new_users_today: number
  active_users: number
  daily_active_users: number
  weekly_active_users: number
  monthly_active_users: number
  verified_users: number
  pending_verifications: number
  total_referrals: number
  total_posts: number
  total_sessions: number
  open_reports: number
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI
      .overview()
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminShell title="Overview">
      {loading && <p className="text-slate-400 text-sm">Loading metrics...</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AdminMetricCard label="Total Users" value={data.total_users} />
          <AdminMetricCard label="New Users Today" value={data.new_users_today} />
          <AdminMetricCard label="Active Now" value={data.active_users} />
          <AdminMetricCard label="Daily Active Users" value={data.daily_active_users} />
          <AdminMetricCard label="Weekly Active Users" value={data.weekly_active_users} />
          <AdminMetricCard label="Monthly Active Users" value={data.monthly_active_users} />
          <AdminMetricCard label="Verified Users" value={data.verified_users} />
          <AdminMetricCard label="Pending Verifications" value={data.pending_verifications} />
          <AdminMetricCard label="Total Referrals" value={data.total_referrals} />
          <AdminMetricCard label="Total Posts" value={data.total_posts} />
          <AdminMetricCard label="Total Sessions" value={data.total_sessions} />
          <AdminMetricCard label="Open Reports" value={data.open_reports} />
        </div>
      )}
    </AdminShell>
  )
}
