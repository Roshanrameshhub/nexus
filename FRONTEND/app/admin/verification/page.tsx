'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface Verification {
  id: string
  user_name: string
  document_type: string
  document_url: string
  status: string
}

export default function AdminVerificationPage() {
  const [items, setItems] = useState<Verification[]>([])

  const load = useCallback(async () => {
    const { data } = await adminAPI.verifications('pending')
    setItems(data.verifications ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (id: string) => {
    try {
      await adminAPI.approveVerification(id)
      toast.success('Approved')
      void load()
    } catch {
      toast.error('Failed to approve')
    }
  }

  const reject = async (id: string) => {
    try {
      await adminAPI.rejectVerification(id)
      toast.success('Rejected')
      void load()
    } catch {
      toast.error('Failed to reject')
    }
  }

  return (
    <AdminShell title="Verification">
      <div className="space-y-3">
        {items.length === 0 && <p className="text-slate-400 text-sm">No pending verifications.</p>}
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="font-medium text-white">{item.user_name}</p>
            <p className="text-sm text-slate-400">{item.document_type}</p>
            <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400">
              View document
            </a>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => void approve(item.id)}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => void reject(item.id)}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
