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
import { useCreateCommunity } from '@/lib/hooks/api/use-communities'

export default function NewCommunityPage() {
  useProtectedRoute()
  const router = useRouter()
  const create = useCreateCommunity()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await create.mutateAsync({ name, description })
      const id = res.data.community?.id
      toast.success('Community created')
      router.push(id ? `/communities/${id}` : '/community')
    } catch {
      toast.error('Could not create community')
    }
  }

  return (
    <AppShell title="Create Community">
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto glass-card p-6 space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-[120px]"
          />
        </div>
        <Button type="submit" className="w-full glow-primary" disabled={create.isPending}>
          {create.isPending ? 'Creating...' : 'Create Community'}
        </Button>
      </form>
    </AppShell>
  )
}
