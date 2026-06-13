'use client'

import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { adminAPI } from '@/services/api'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [logs, setLogs] = useState<Array<{ action: string; actor_name?: string; created_at: string }>>([])

  useEffect(() => {
    void adminAPI.settings().then((res) => setSettings(res.data))
    void adminAPI.auditLogs().then((res) => setLogs(res.data.audit_logs ?? []))
  }, [])

  return (
    <AdminShell title="Settings">
      {settings && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 mb-8">
          <p className="text-white font-medium">Platform: {String(settings.platform)}</p>
          <p className="text-sm text-slate-400 mt-1">Admin: {String(settings.admin_email)}</p>
          <p className="text-sm text-slate-400">Max pinned posts: {String(settings.max_pinned_posts)}</p>
        </div>
      )}
      <h3 className="text-sm font-medium text-slate-300 mb-3">Recent Audit Logs</h3>
      <div className="space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
            <p className="text-white">{log.action}</p>
            <p className="text-xs text-slate-500">
              {log.actor_name ?? 'System'} · {new Date(log.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
