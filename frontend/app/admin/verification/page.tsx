'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface Verification {
  id: string
  user_name: string
  user_role: string
  verification_type: string
  document_type: string
  document_type_label: string
  document_url: string
  status: string
  created_at: string
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

  const viewDocument = async (id: string) => {
    try {
      const { data } = await adminAPI.verificationDocument(id)
      const url = URL.createObjectURL(data)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Document not found. Ask the user to resubmit.')
    }
  }

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
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-white">{item.user_name}</p>
                <p className="text-sm text-slate-400 capitalize">Role: {item.user_role}</p>
                <p className="text-sm text-slate-400">{item.verification_type}</p>
                <p className="text-sm text-slate-300">{item.document_type_label}</p>
                <p className="text-xs text-slate-500">
                  Submitted {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void viewDocument(item.id)}>
                Document Preview
              </Button>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => void approve(item.id)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reject(item.id)}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
