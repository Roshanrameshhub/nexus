'use client'

import { useEffect, useState } from 'react'
import { AdminMetricCard, AdminShell } from '@/components/layout/admin-shell'
import { adminAPI } from '@/services/api'

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    adminAPI.analytics().then((res) => setData(res.data))
  }, [])

  const engagement = (data?.engagement as Record<string, number>) ?? {}
  const networking = (data?.networking as Record<string, number>) ?? {}
  const verification = (data?.verification as Record<string, number>) ?? {}

  return (
    <AdminShell title="Analytics">
      {data && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Engagement</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminMetricCard label="DAU" value={engagement.dau ?? 0} />
              <AdminMetricCard label="WAU" value={engagement.wau ?? 0} />
              <AdminMetricCard label="MAU" value={engagement.mau ?? 0} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Networking</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminMetricCard label="Connections" value={networking.connections ?? 0} />
              <AdminMetricCard label="Messages" value={networking.messages ?? 0} />
              <AdminMetricCard label="Referrals" value={networking.referrals ?? 0} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Verification</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminMetricCard label="Pending" value={verification.pending ?? 0} />
              <AdminMetricCard label="Approved" value={verification.approved ?? 0} />
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
