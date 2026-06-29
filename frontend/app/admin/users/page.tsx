'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { adminAPI, getErrorMessage } from '@/services/api'
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
  is_online?: boolean
  last_seen_at?: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [confirmEmail, setConfirmEmail] = useState('')

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
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const banUser = async (user: AdminUser) => {
    if (!window.confirm(`Ban ${user.name}? This will suspend their account permanently until manually reversed.`)) {
      return
    }
    try {
      await adminAPI.banUser(user.id)
      toast.success('User banned')
      void load(q)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const { data } = await adminAPI.deleteUser(deleteTarget.id, confirmEmail)
      toast.success(data.message || 'User deleted')
      setDeleteTarget(null)
      setConfirmEmail('')
      void load(q)
    } catch (err) {
      toast.error(getErrorMessage(err))
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
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <p className="font-medium text-white">{user.name}</p>
                <p className="text-sm text-slate-400">{user.email}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {user.role} · {user.platform_role}
                  {user.is_verified ? ' · Verified' : ''}
                  {user.is_suspended ? ' · Suspended' : ''}
                  {user.is_online ? ' · Online' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Last seen:{' '}
                  {user.is_online
                    ? 'Currently online'
                    : user.last_seen_at
                      ? new Date(user.last_seen_at).toLocaleString()
                      : user.last_active_at
                        ? new Date(user.last_active_at).toLocaleString()
                        : 'Unknown'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700"
                  onClick={() => void toggleSuspend(user)}
                >
                  {user.is_suspended ? 'Reactivate' : 'Suspend'}
                </Button>
                {user.platform_role !== 'SUPER_ADMIN' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-900 text-red-400"
                      onClick={() => void banUser(user)}
                    >
                      Ban
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget(user)
                        setConfirmEmail('')
                      }}
                    >
                      Delete Permanently
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Permanently</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The user account and associated data will be permanently
              removed. Type <strong>{deleteTarget?.email}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Confirm email address"
            className="bg-slate-900 border-slate-700"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmEmail.trim().toLowerCase() !== deleteTarget?.email.trim().toLowerCase()}
              onClick={() => void handleDelete()}
            >
              Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
