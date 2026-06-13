'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Link2, Share2, Users, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { referralsAPI } from '@/services/api'
import { toast } from 'sonner'

interface ReferralInfo {
  referral_code: string
  referral_count: number
  referral_link: string
}

export function ReferralSection() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await referralsAPI.getMe()
      setInfo(data as ReferralInfo)
    } catch {
      toast.error('Could not load referral info')
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[160px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!info) return null

  return (
    <motion.section
      className="glass-card p-6 space-y-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Share2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Referral Program</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite others to Nexus with your personal link. When they sign up, your referral count increases.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
        <Users className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Referrals</p>
          <p className="text-2xl font-bold text-foreground">{info.referral_count}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Referral code</p>
        <div className="flex gap-2">
          <Input readOnly value={info.referral_code} className="bg-secondary/30 font-mono" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyText('Referral code', info.referral_code)}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Code
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Referral link</p>
        <div className="flex gap-2">
          <Input readOnly value={info.referral_link} className="bg-secondary/30 text-sm" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyText('Referral link', info.referral_link)}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
