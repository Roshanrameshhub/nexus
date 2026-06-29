'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Pin,
  Radio,
  ShieldCheck,
  Share2,
  Flag,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store'
import { useLogout } from '@/lib/hooks/use-logout'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/broadcast', label: 'Broadcast Center', icon: Radio },
  { href: '/admin/content', label: 'Content Center', icon: Pin },
  { href: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { href: '/admin/referrals', label: 'Referrals', icon: Share2 },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/sessions', label: 'Sessions', icon: Calendar },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/streaks', label: 'Streak Leaderboard', icon: Flame },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/80 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">RConnectX</p>
          <h1 className="text-lg font-semibold text-white mt-1">Admin Console</h1>
          <p className="text-xs text-slate-500 mt-1 truncate">{user?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {ADMIN_NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-slate-700 text-slate-300"
            onClick={() => router.push('/dashboard')}
          >
            User App
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-slate-400 hover:text-white"
            onClick={() => void logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center px-6">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

export function AdminMetricCard({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-white mt-2">{value}</p>
    </div>
  )
}
