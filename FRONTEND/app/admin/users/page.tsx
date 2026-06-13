'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminAPI } from '@/services/api'
import { toast } from 'sonner'

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  platform_role: string
  is_suspended: boolean
  is_verified: boolean
  last_active_at?: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (search?: string) => {
    setLoading(true)
    try {
      const { data } = await adminAPI.users({ q: search || undefined, limit: 50 })
      setUsers(data.users ?? [])
    } catch {
      setUsers([])
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleSuspend = async (user: AdminUser) => {
    try {
      if (user.is_suspended) {
        await adminAPI.reactivateUser(user.id)
        toast.success('User reactivated')
      } else {
        await adminAPI.suspendUser(user.id)
        toast.success('User suspended')
      }
      void load(q)
    } catch {
      toast.error('Action failed')
    }
  }

  return (
    <AdminShell title="User Management">
      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Search by name or email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md bg-slate-900 border-slate-700"
        />
        <Button onClick={() => void load(q)}>Search</Button>
      </div>
      {loading ? (
        <p className="text-slate-400 text-sm">Loading users...</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium text-white">{user.name}</p>
                <p className="text-sm text-slate-400">{user.email}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {user.role} · {user.platform_role}
                  {user.is_verified ? ' · Verified' : ''}
                  {user.is_suspended ? ' · Suspended' : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700"
                onClick={() => void toggleSuspend(user)}
              >
                {user.is_suspended ? 'Reactivate' : 'Suspend'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  )
}
