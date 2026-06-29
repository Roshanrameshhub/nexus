'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { STARTUP_STAGES } from '@/lib/ecosystem'

export interface EcosystemFilters {
  role: string
  location: string
  industry: string
  organization: string
  startupStage: string
  verifiedOnly: boolean
}

export const EMPTY_ECOSYSTEM_FILTERS: EcosystemFilters = {
  role: 'all',
  location: '',
  industry: '',
  organization: '',
  startupStage: 'all',
  verifiedOnly: false,
}

interface EcosystemFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: EcosystemFilters
  onChange: (filters: EcosystemFilters) => void
  onReset: () => void
}

export function EcosystemFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  onReset,
}: EcosystemFilterSheetProps) {
  const set = (patch: Partial<EcosystemFilters>) => onChange({ ...filters, ...patch })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filter showcase</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <select
              value={filters.role}
              onChange={(e) => set({ role: e.target.value })}
              className="w-full h-9 text-sm rounded-md border border-border bg-secondary/30 px-2"
            >
              <option value="all">All roles</option>
              <option value="founder">Founder</option>
              <option value="executive">Executive</option>
              <option value="investor">Investor</option>
              <option value="developer">Developer</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <Input
              placeholder="City, state, or country"
              value={filters.location}
              onChange={(e) => set({ location: e.target.value })}
              className="h-9 bg-secondary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Industry</Label>
            <Input
              placeholder="e.g. FinTech, AI"
              value={filters.industry}
              onChange={(e) => set({ industry: e.target.value })}
              className="h-9 bg-secondary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Organization</Label>
            <Input
              placeholder="Company or startup"
              value={filters.organization}
              onChange={(e) => set({ organization: e.target.value })}
              className="h-9 bg-secondary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Startup stage</Label>
            <select
              value={filters.startupStage}
              onChange={(e) => set({ startupStage: e.target.value })}
              className="w-full h-9 text-sm rounded-md border border-border bg-secondary/30 px-2"
            >
              <option value="all">All stages</option>
              {STARTUP_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <Checkbox
              checked={filters.verifiedOnly}
              onCheckedChange={(checked) => set({ verifiedOnly: checked === true })}
            />
            <span className="text-sm">Verified only</span>
          </label>
        </div>
        <SheetFooter className="flex-row gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onReset} className="flex-1">Reset</Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1">Apply</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
