'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { adminAPI, getErrorMessage } from '@/services/api'
import { REPORT_REASON_LABELS } from '@/lib/constants/report-reasons'
import { toast } from 'sonner'
import { AlertTriangle, Flag } from 'lucide-react'

interface ReporterInfo {
  id: string
  name: string
}

interface ReportGroup {
  target_type: string
  target_id: string
  reported_user_id?: string
  reported_user_name?: string
  content_preview?: string
  reasons: string[]
  report_count: number
  reporters: ReporterInfo[]
  is_high_priority: boolean
  status: string
  latest_report_at: string
  report_ids: string[]
}

const TABS = [
  { id: 'post', label: 'Reported Posts' },
  { id: 'comment', label: 'Reported Comments' },
  { id: 'profile', label: 'Reported Profiles' },
] as const

function formatType(type: string) {
  if (type === 'ecosystem_post') return 'Ecosystem Post'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('post')
  const [groups, setGroups] = useState<ReportGroup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminAPI.reports({ type: tab })
      setGroups(data.groups ?? [])
    } catch {
      setGroups([])
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (group: ReportGroup, action: string) => {
    try {
      const { data } = await adminAPI.moderateReport({
        target_type: group.target_type,
        target_id: group.target_id,
        action,
      })
      toast.success(data.message || 'Action completed')
      void load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const postActions = (group: ReportGroup) => (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button size="sm" variant="destructive" onClick={() => void act(group, 'remove_post')}>
        Remove Post
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'ignore')}>
        Ignore Report
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'warn')}>
        Warn User
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'suspend')}>
        Suspend User
      </Button>
    </div>
  )

  const commentActions = (group: ReportGroup) => (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button size="sm" variant="destructive" onClick={() => void act(group, 'delete_comment')}>
        Delete Comment
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'ignore')}>
        Ignore Report
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'warn')}>
        Warn User
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'suspend')}>
        Suspend User
      </Button>
    </div>
  )

  const profileActions = (group: ReportGroup) => (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button size="sm" variant="outline" onClick={() => void act(group, 'warn')}>
        Warn User
      </Button>
      <Button size="sm" variant="outline" onClick={() => void act(group, 'suspend')}>
        Suspend User
      </Button>
      <Button size="sm" variant="destructive" onClick={() => void act(group, 'ban')}>
        Ban User
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void act(group, 'ignore')}>
        Ignore Report
      </Button>
    </div>
  )

  return (
    <AdminShell title="Reports">
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? 'default' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading reports...</p>
      ) : groups.length === 0 ? (
        <p className="text-slate-400 text-sm">No active reports in this category.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={`${group.target_type}-${group.target_id}`}
              className={`rounded-lg border p-4 ${
                group.is_high_priority
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Flag className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-white">
                      {formatType(group.target_type)} · Reports: {group.report_count}
                    </span>
                    {group.is_high_priority && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        High Priority
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    Reasons:{' '}
                    {group.reasons.map((r) => REPORT_REASON_LABELS[r] || r).join(', ')}
                  </p>
                  <p className="text-sm text-slate-400">
                    Reporters: {group.reporters.map((r) => r.name).join(', ')}
                  </p>
                  {group.reported_user_name && (
                    <p className="text-sm text-slate-400">
                      Reported user: {group.reported_user_name}
                    </p>
                  )}
                  {group.content_preview && (
                    <p className="text-sm text-slate-300 mt-2 line-clamp-3 border-l-2 border-slate-700 pl-3">
                      {group.content_preview}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Last reported {new Date(group.latest_report_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {tab === 'post' && postActions(group)}
              {tab === 'comment' && commentActions(group)}
              {tab === 'profile' && profileActions(group)}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
