'use client'

import { useEffect, useState } from 'react'
import { AdminMetricCard, AdminShell } from '@/components/layout/admin-shell'
import { adminAPI } from '@/services/api'

export default function AdminReferralsPage() {
  const [data, setData] = useState<{
    total_referrals: number
    growth_last_30_days: number
    top_referrers: Array<{ name: string; count: number }>
  } | null>(null)

  useEffect(() => {
    adminAPI.referrals().then((res) => setData(res.data))
  }, [])

  return (
    <AdminShell title="Referrals">
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <AdminMetricCard label="Total Referrals" value={data.total_referrals} />
            <AdminMetricCard label="Growth (30 days)" value={data.growth_last_30_days} />
          </div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Top Referrers</h3>
          <div className="space-y-2">
            {data.top_referrers.map((r) => (
              <div key={r.name} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 flex justify-between">
                <span className="text-white">{r.name}</span>
                <span className="text-slate-400">{r.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  )
}
