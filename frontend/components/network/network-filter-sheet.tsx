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
import type { NetworkFilters } from '@/lib/network/filters'

interface NetworkFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: NetworkFilters
  onChange: (filters: NetworkFilters) => void
  onReset: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function NetworkFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  onReset,
}: NetworkFilterSheetProps) {
  const set = (patch: Partial<NetworkFilters>) => onChange({ ...filters, ...patch })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-4 pb-4">
          <Section title="Basic">
            <div className="space-y-3">
              <Field label="Name">
                <Input
                  placeholder="Search by name"
                  value={filters.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
              <Field label="Role">
                <select
                  value={filters.role}
                  onChange={(e) => set({ role: e.target.value })}
                  className="w-full h-9 bg-secondary/30 border border-border rounded-md px-2.5 text-sm"
                >
                  <option value="all">All roles</option>
                  <option value="student">Student</option>
                  <option value="developer">Developer</option>
                  <option value="founder">Founder</option>
                  <option value="executive">Executive</option>
                  <option value="investor">Investor</option>
                  <option value="mentor">Mentor</option>
                </select>
              </Field>
              <Field label="Skill">
                <Input
                  placeholder="e.g. React, Python"
                  value={filters.skill}
                  onChange={(e) => set({ skill: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
              <Field label="Location">
                <Input
                  placeholder="City, state, or country"
                  value={filters.location}
                  onChange={(e) => set({ location: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
            </div>
          </Section>

          <Section title="Students / Developers">
            <div className="space-y-3">
              <Field label="Institution">
                <Input
                  placeholder="College or university"
                  value={filters.institution}
                  onChange={(e) => set({ institution: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
              <Field label="Degree">
                <Input
                  placeholder="e.g. B.Tech, MBA"
                  value={filters.degree}
                  onChange={(e) => set({ degree: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
              <Field label="Graduation Year">
                <Input
                  placeholder="e.g. 2026"
                  value={filters.graduationYear}
                  onChange={(e) => set({ graduationYear: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
            </div>
          </Section>

          <Section title="Founder / Executive / Investor">
            <div className="space-y-3">
              <Field label="Organization">
                <Input
                  placeholder="Company or startup"
                  value={filters.organization}
                  onChange={(e) => set({ organization: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
              <Field label="Industry">
                <Input
                  placeholder="e.g. FinTech, AI"
                  value={filters.industry}
                  onChange={(e) => set({ industry: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
              <Field label="Startup Stage">
                <Input
                  placeholder="e.g. Seed, Series A"
                  value={filters.startupStage}
                  onChange={(e) => set({ startupStage: e.target.value })}
                  className="h-9 bg-secondary/30"
                />
              </Field>
            </div>
          </Section>

          <Section title="General">
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={filters.verifiedOnly}
                  onCheckedChange={(checked) => set({ verifiedOnly: checked === true })}
                />
                <span className="text-sm text-foreground">Verified only</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={filters.connectionsOnly}
                  onCheckedChange={(checked) => set({ connectionsOnly: checked === true })}
                />
                <span className="text-sm text-foreground">Connections only</span>
              </label>
            </div>
          </Section>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onReset} className="flex-1">
            Reset
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1">
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
