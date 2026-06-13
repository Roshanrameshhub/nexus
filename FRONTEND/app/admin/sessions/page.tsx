'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface Session {
  id: string
  title: string
  status: string
  scheduled_at: string
  organizer?: string
  invitee?: string
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])

  const load = useCallback(async () => {
    const { data } = await adminAPI.sessions()
    setSessions(data.sessions ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = async (id: string) => {
    try {
      await adminAPI.cancelSession(id)
      toast.success('Session cancelled')
      void load()
    } catch {
      toast.error('Failed to cancel')
    }
  }

  return (
    <AdminShell title="Sessions">
      <div className="space-y-3">
        {sessions.map((session) => (
          <div key={session.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex justify-between gap-4">
            <div>
              <p className="font-medium text-white">{session.title}</p>
              <p className="text-sm text-slate-400">
                {session.organizer} → {session.invitee}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(session.scheduled_at).toLocaleString()} · {session.status}
              </p>
            </div>
            {session.status !== 'cancelled' && (
              <Button variant="outline" size="sm" onClick={() => void cancel(session.id)}>
                Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
