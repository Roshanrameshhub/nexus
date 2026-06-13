'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface Report {
  id: string
  reporter_name: string
  target_type: string
  target_id: string
  reason: string
  details?: string
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])

  const load = useCallback(async () => {
    const { data } = await adminAPI.reports('open')
    setReports(data.reports ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = async (id: string) => {
    try {
      await adminAPI.resolveReport(id, { resolution_note: 'Resolved by admin' })
      toast.success('Report resolved')
      void load()
    } catch {
      toast.error('Failed to resolve')
    }
  }

  return (
    <AdminShell title="Reports">
      <div className="space-y-3">
        {reports.length === 0 && <p className="text-slate-400 text-sm">No open reports.</p>}
        {reports.map((report) => (
          <div key={report.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-medium text-white">{report.reason}</p>
            <p className="text-sm text-slate-400">
              {report.target_type} · {report.target_id} · by {report.reporter_name}
            </p>
            {report.details && <p className="text-xs text-slate-500 mt-1">{report.details}</p>}
            <Button size="sm" className="mt-3" onClick={() => void resolve(report.id)}>
              Resolve
            </Button>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
