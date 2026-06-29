'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flame, Crown, Rocket } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { adminAPI } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortTab = 'current' | 'longest' | 'monthly' | 'all_time'

interface StreakRow {
  rank: number
  id: string
  name: string
  role: string
  current_streak: number
  longest_streak: number
  country?: string | null
  state?: string | null
  city?: string | null
  connections_count: number
  posts_count: number
  last_active_at?: string | null
  is_verified: boolean
  streak_started_at?: string | null
  days_active_this_month: number
}

interface TopCards {
  highest_current_streak?: StreakRow
  highest_longest_streak?: StreakRow
  most_active_this_month?: StreakRow
}

export default function AdminStreaksPage() {
  const [rows, setRows] = useState<StreakRow[]>([])
  const [topCards, setTopCards] = useState<TopCards>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SortTab>('current')
  const [role, setRole] = useState('')
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await adminAPI.streaks({
        sort_by: tab,
        role: role || undefined,
        country: country || undefined,
        state: state || undefined,
        city: city || undefined,
        verified_only: verifiedOnly,
        limit: 100,
      })
      setRows((data.leaderboard ?? []) as StreakRow[])
      setTopCards((data.top_cards ?? {}) as TopCards)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [tab])

  const openUserDetail = async (userId: string) => {
    const { data } = await adminAPI.userDetail(userId)
    setSelectedUser(data)
  }

  const roleOptions = useMemo(
    () => ['student', 'developer', 'founder', 'executive', 'investor'],
    []
  )

  return (
    <AdminShell title="Streak Leaderboard">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'current', label: 'Current Streak' },
            { id: 'longest', label: 'Longest Streak' },
            { id: 'monthly', label: 'Monthly Activity' },
            { id: 'all_time', label: 'All Time' },
          ].map((item) => (
            <Button
              key={item.id}
              variant={tab === item.id ? 'default' : 'outline'}
              onClick={() => setTab(item.id as SortTab)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> Highest Current Streak</p>
            <p className="text-lg font-semibold mt-1">{topCards.highest_current_streak?.name ?? '-'}</p>
            <p className="text-sm text-slate-400">{topCards.highest_current_streak?.current_streak ?? 0} Days</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Highest Longest Streak</p>
            <p className="text-lg font-semibold mt-1">{topCards.highest_longest_streak?.name ?? '-'}</p>
            <p className="text-sm text-slate-400">{topCards.highest_longest_streak?.longest_streak ?? 0} Days</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 flex items-center gap-2"><Rocket className="w-4 h-4 text-cyan-400" /> Most Active This Month</p>
            <p className="text-lg font-semibold mt-1">{topCards.most_active_this_month?.name ?? '-'}</p>
            <p className="text-sm text-slate-400">{topCards.most_active_this_month?.days_active_this_month ?? 0} Days</p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-6">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
            <option value="">All Roles</option>
            {roleOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="bg-slate-900 border-slate-700" />
          <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className="bg-slate-900 border-slate-700" />
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="bg-slate-900 border-slate-700" />
          <label className="flex items-center gap-2 text-sm text-slate-300 px-2">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            Verified Only
          </label>
          <Button onClick={() => void load()}>Apply Filters</Button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading streak leaderboard...</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  {['Rank', 'User', 'Role', 'Current Streak', 'Longest Streak', 'Location', 'Connections', 'Posts', 'Last Active'].map((h) => (
                    <th key={h} className="text-left px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                    <td className="px-3 py-2">#{row.rank}</td>
                    <td className="px-3 py-2">
                      <button className="text-cyan-300 hover:underline" onClick={() => void openUserDetail(row.id)}>{row.name}</button>
                    </td>
                    <td className="px-3 py-2">{row.role}</td>
                    <td className="px-3 py-2">{row.current_streak}</td>
                    <td className="px-3 py-2">{row.longest_streak}</td>
                    <td className="px-3 py-2">{[row.city, row.state, row.country].filter(Boolean).join(', ') || '-'}</td>
                    <td className="px-3 py-2">{row.connections_count}</td>
                    <td className="px-3 py-2">{row.posts_count}</td>
                    <td className="px-3 py-2">{row.last_active_at ? new Date(row.last_active_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.name ?? 'User'} Streak Details</DialogTitle>
            <DialogDescription>Detailed streak and engagement stats.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Current Streak:</span> {selectedUser.current_streak}</div>
              <div><span className="text-muted-foreground">Longest Streak:</span> {selectedUser.longest_streak}</div>
              <div><span className="text-muted-foreground">Last Active:</span> {selectedUser.last_active_at ? new Date(selectedUser.last_active_at).toLocaleDateString() : '-'}</div>
              <div><span className="text-muted-foreground">Streak Started:</span> {selectedUser.streak_started_at ? new Date(selectedUser.streak_started_at).toLocaleDateString() : '-'}</div>
              <div><span className="text-muted-foreground">Posts:</span> {selectedUser.posts_count}</div>
              <div><span className="text-muted-foreground">Connections:</span> {selectedUser.connections_count}</div>
              <div><span className="text-muted-foreground">Verified:</span> {selectedUser.is_verified ? 'Yes' : 'No'}</div>
              <div><span className="text-muted-foreground">Active This Month:</span> {selectedUser.days_active_this_month}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
