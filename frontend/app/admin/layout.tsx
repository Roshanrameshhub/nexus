'use client'

import { AdminShell } from '@/components/layout/admin-shell'
import { useSuperAdminRoute } from '@/lib/hooks/use-super-admin-route'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useSuperAdminRoute()
  return children
}
