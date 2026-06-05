'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { authAPI, usersAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import type { UserRole } from '@/lib/types/api'

const roles: { id: UserRole; label: string }[] = [
  { id: 'founder', label: 'Founder' },
  { id: 'developer', label: 'Developer' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'student', label: 'Student' },
  { id: 'recruiter', label: 'Recruiter' },
]

export default function CompleteProfilePage() {
  useProtectedRoute()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    name: '',
    bio: '',
    skills: '',
    role: 'developer' as UserRole,
    github_username: '',
    avatar: '',
  })

  useEffect(() => {
    authAPI
      .me()
      .then((res) => {
        const u = res.data.user
        setForm({
          name: u.name || '',
          bio: u.bio || '',
          skills: (u.skills || []).join(', '),
          role: u.role,
          github_username: u.github_username || '',
          avatar: u.avatar || '',
        })
      })
      .catch(() => {
        if (user) {
          setForm({
            name: user.name || '',
            bio: user.bio || '',
            skills: (user.skills || []).join(', '),
            role: user.role,
            github_username: '',
            avatar: user.avatar || '',
          })
        }
      })
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const skills = form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const { data } = await usersAPI.updateProfile(user.id, {
        name: form.name,
        bio: form.bio,
        skills,
        role: form.role,
        github_username: form.github_username || undefined,
        avatar: form.avatar || undefined,
      })
      const updated = data.user
      setUser({
        id: String(updated.id),
        name: updated.name,
        email: updated.email,
        avatar: updated.avatar,
        role: updated.role,
        skills: updated.skills || [],
        bio: updated.bio,
      })
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 800)
    } catch {
      setError('Could not save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="fixed inset-0 mesh-gradient opacity-60" />
      <motion.div
        className="w-full max-w-lg relative z-10 glass-card p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link href="/dashboard" className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Complete Profile</span>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-primary">Profile saved successfully.</p>}

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="bg-secondary/50 min-h-[100px]"
              placeholder="Tell the community about yourself..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="w-full h-10 rounded-md border border-border bg-secondary/50 px-3 text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Skills (comma-separated)</Label>
            <Input
              id="skills"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="React, Python, AI/ML"
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github">GitHub username</Label>
            <Input
              id="github"
              value={form.github_username}
              onChange={(e) => setForm({ ...form, github_username: e.target.value })}
              placeholder="your-github-handle"
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">Profile image URL</Label>
            <Input
              id="avatar"
              value={form.avatar}
              onChange={(e) => setForm({ ...form, avatar: e.target.value })}
              placeholder="https://..."
              className="bg-secondary/50"
            />
          </div>

          <Button type="submit" className="w-full h-12 glow-primary" disabled={loading}>
            {loading ? (
              'Saving...'
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save profile
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
