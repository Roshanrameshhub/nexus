'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import { useCreateStartup } from '@/lib/hooks/api/use-startups'

export default function NewEcosystemPage() {
  useProtectedRoute()
  const router = useRouter()
  const create = useCreateStartup()
  const [form, setForm] = useState({
    name: '',
    description: '',
    industry: '',
    stage: '',
    website: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await create.mutateAsync(form)
      const id = res.data.startup?.id
      toast.success('Ecosystem venture registered successfully')
      router.push(id ? `/ecosystem/${id}` : '/ecosystem')
    } catch {
      toast.error('Could not register venture')
    }
  }

  return (
    <AppShell title="Register Ecosystem Venture">
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto glass-card p-6 space-y-4">
        {(['name', 'industry', 'stage', 'website'] as const).map((field) => (
          <div key={field}>
            <Label htmlFor={field} className="capitalize">
              {field === 'name' ? 'Venture Name' : field}
            </Label>
            <Input
              id={field}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              required={field === 'name'}
              className="mt-1"
            />
          </div>
        ))}
        <div>
          <Label htmlFor="description">Venture Description / Vision</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 min-h-[100px]"
          />
        </div>
        <Button type="submit" className="w-full glow-primary" disabled={create.isPending}>
          {create.isPending ? 'Registering...' : 'Register Venture'}
        </Button>
      </form>
    </AppShell>
  )
}
