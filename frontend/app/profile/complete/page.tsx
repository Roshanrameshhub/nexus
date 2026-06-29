'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Save, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { authAPI, usersAPI } from '@/services/api'
import { useAuthStore } from '@/lib/store'
import { useProtectedRoute } from '@/lib/hooks/use-protected-route'
import type { ApiUser, UserRole } from '@/lib/types/api'
import {
  PROFILE_ROLES,
  createEmptyExperience,
  parseExperience,
  type ExperienceEntry,
  type ProfileRoleDetails,
} from '../utils'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export default function CompleteProfilePage() {
  useProtectedRoute()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '',
    bio: '',
    headline: '',
    city: '',
    state: '',
    country: '',
    skills: '',
    role: 'developer' as UserRole,
    github_username: '',
    avatar: '',
    banner: '',
    college: '',
    company: '',
    linkedin: '',
    website: '',
    roleDetails: {} as ProfileRoleDetails,
    experience: [] as ExperienceEntry[],
  })

  const applyUser = (u: ApiUser) => {
    const rd = (u.role_details || {}) as ProfileRoleDetails
    setForm({
      name: u.name || '',
      bio: u.bio || '',
      headline: String(rd.headline || ''),
      city: u.city || '',
      state: u.state || '',
      country: u.country || '',
      skills: (u.skills || []).join(', '),
      role: (u.role as UserRole) || 'developer',
      github_username: u.github_username || String(rd.github || ''),
      avatar: u.avatar || '',
      banner: String(rd.banner_url || ''),
      college: u.college || String(rd.college_name || ''),
      company: u.company || '',
      linkedin: String(rd.linkedin || ''),
      website: String(rd.website || rd.portfolio_website || rd.company_website || ''),
      roleDetails: { ...rd },
      experience: parseExperience(rd),
    })
  }

  useEffect(() => {
    authAPI
      .me()
      .then((res) => applyUser(res.data.user))
      .catch(() => {
        if (user) {
          applyUser({
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            skills: user.skills,
            role: user.role as UserRole,
            avatar: user.avatar,
          })
        }
      })
  }, [user])

  const updateRoleDetail = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      roleDetails: { ...prev.roleDetails, [key]: value },
    }))
  }

  const updateExperience = (id: string, patch: Partial<ExperienceEntry>) => {
    setForm((prev) => ({
      ...prev,
      experience: prev.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  }

  const addExperience = () => {
    setForm((prev) => ({
      ...prev,
      experience: [...prev.experience, createEmptyExperience()],
    }))
  }

  const removeExperience = (id: string) => {
    setForm((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }))
  }

  const buildRoleDetailsPayload = (): ProfileRoleDetails => {
    const skillsList = form.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const base: ProfileRoleDetails = {
      ...form.roleDetails,
      headline: form.headline || undefined,
      banner_url: form.banner || undefined,
      linkedin: form.linkedin || undefined,
      website: form.website || undefined,
      github: form.github_username || undefined,
      experience: form.experience,
    }

    const role = form.role
    if (role === 'student') {
      base.college_name = form.college
      base.degree = String(form.roleDetails.degree || '')
      base.graduation_year = form.roleDetails.graduation_year
      base.certifications = form.roleDetails.certifications
      base.projects = form.roleDetails.projects
    } else if (role === 'developer') {
      base.company_name = form.company
      base.job_title = String(form.roleDetails.job_title || '')
      base.years_experience = form.roleDetails.years_experience
      base.tech_stack = skillsList.join(', ')
      base.projects = form.roleDetails.projects
      base.portfolio_website = form.website || undefined
    } else if (role === 'founder') {
      base.startup_name = String(form.roleDetails.startup_name || form.company || '')
      base.organization_description = String(form.roleDetails.organization_description || form.roleDetails.vision || '')
      base.vision = String(form.roleDetails.vision || form.roleDetails.organization_description || '')
      base.team_size = form.roleDetails.team_size
      base.industry = form.roleDetails.industry
      base.startup_stage = form.roleDetails.startup_stage || form.roleDetails.stage
      base.stage = form.roleDetails.startup_stage || form.roleDetails.stage
    } else if (role === 'investor') {
      base.organization_name = String(form.roleDetails.organization_name || form.company || '')
      base.investment_focus = form.roleDetails.investment_focus
      base.portfolio_highlights = form.roleDetails.portfolio_highlights
      base.preferred_industries = form.roleDetails.preferred_industries
      base.ticket_size = form.roleDetails.ticket_size
    } else if (role === 'mentor') {
      base.organization = String(form.roleDetails.organization || form.company || '')
      base.domain_expertise = String(form.roleDetails.domain_expertise || form.roleDetails.expertise || '')
      base.expertise = String(form.roleDetails.domain_expertise || form.roleDetails.expertise || '')
      base.years_of_experience = form.roleDetails.years_of_experience || form.roleDetails.years_experience
      base.mentorship_areas = form.roleDetails.mentorship_areas
    } else if (role === 'executive') {
      base.company_name = form.company
      base.designation = form.roleDetails.designation
      base.industry = form.roleDetails.industry
      base.years_experience = form.roleDetails.years_experience
      base.company_website = form.website || undefined
    }

    return base
  }

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
        country: form.country || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        college: form.college || undefined,
        company: form.company || undefined,
        github_username: form.github_username || undefined,
        avatar: form.avatar || undefined,
        role_details: buildRoleDetailsPayload(),
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
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSuccess(true)
      setTimeout(() => router.push('/profile'), 800)
    } catch {
      setError('Could not save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const role = form.role

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="fixed inset-0 mesh-gradient opacity-60" />
      <motion.div
        className="w-full max-w-2xl relative z-10 glass-card p-8 max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link href="/profile" className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Edit Profile</span>
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-primary">Profile saved successfully.</p>}

          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Common</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-secondary/50" />
              </Field>
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full h-10 rounded-md border border-border bg-secondary/50 px-3 text-sm"
                >
                  {PROFILE_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Headline">
              <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="e.g. Full-stack Developer at Acme" className="bg-secondary/50" />
            </Field>
            <Field label="Bio">
              <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="bg-secondary/50 min-h-[90px]" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="City">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className="bg-secondary/50" />
              </Field>
              <Field label="State / Province">
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required className="bg-secondary/50" />
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required className="bg-secondary/50" />
              </Field>
            </div>
            <Field label="Skills (comma-separated)">
              <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="bg-secondary/50" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Profile photo URL">
                <Input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="bg-secondary/50" />
              </Field>
              <Field label="Cover banner URL">
                <Input value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} className="bg-secondary/50" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="LinkedIn">
                <Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} className="bg-secondary/50" />
              </Field>
              <Field label="Website">
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="bg-secondary/50" />
              </Field>
              <Field label="GitHub username">
                <Input value={form.github_username} onChange={(e) => setForm({ ...form, github_username: e.target.value })} className="bg-secondary/50" />
              </Field>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-border/50">
            <h3 className="font-semibold text-foreground">Role-specific details</h3>

            {role === 'student' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="College / University">
                  <Input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} className="bg-secondary/50" />
                </Field>
                <Field label="Degree">
                  <Input value={String(form.roleDetails.degree || '')} onChange={(e) => updateRoleDetail('degree', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Graduation Year">
                  <Input value={String(form.roleDetails.graduation_year || '')} onChange={(e) => updateRoleDetail('graduation_year', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Certifications">
                  <Input value={String(form.roleDetails.certifications || '')} onChange={(e) => updateRoleDetail('certifications', e.target.value)} placeholder="AWS, Google Cloud..." className="bg-secondary/50" />
                </Field>
                <Field label="Projects">
                  <Textarea value={String(form.roleDetails.projects || '')} onChange={(e) => updateRoleDetail('projects', e.target.value)} className="bg-secondary/50 min-h-[80px]" />
                </Field>
              </div>
            )}

            {role === 'developer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Company">
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="bg-secondary/50" />
                </Field>
                <Field label="Job Title">
                  <Input value={String(form.roleDetails.job_title || '')} onChange={(e) => updateRoleDetail('job_title', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Years of Experience">
                  <Input value={String(form.roleDetails.years_experience || '')} onChange={(e) => updateRoleDetail('years_experience', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Projects">
                  <Textarea value={String(form.roleDetails.projects || '')} onChange={(e) => updateRoleDetail('projects', e.target.value)} className="bg-secondary/50 min-h-[80px]" />
                </Field>
              </div>
            )}

            {role === 'founder' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Organization Name">
                  <Input value={String(form.roleDetails.startup_name || form.company)} onChange={(e) => { setForm({ ...form, company: e.target.value }); updateRoleDetail('startup_name', e.target.value) }} className="bg-secondary/50" />
                </Field>
                <Field label="Industry">
                  <Input value={String(form.roleDetails.industry || '')} onChange={(e) => updateRoleDetail('industry', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Stage">
                  <Input value={String(form.roleDetails.startup_stage || form.roleDetails.stage || '')} onChange={(e) => updateRoleDetail('startup_stage', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Team Size">
                  <Input value={String(form.roleDetails.team_size || '')} onChange={(e) => updateRoleDetail('team_size', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Organization Description">
                  <Textarea value={String(form.roleDetails.organization_description || form.roleDetails.vision || '')} onChange={(e) => updateRoleDetail('organization_description', e.target.value)} className="bg-secondary/50 min-h-[90px]" />
                </Field>
              </div>
            )}

            {role === 'investor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Firm Name">
                  <Input value={String(form.roleDetails.organization_name || form.company)} onChange={(e) => { setForm({ ...form, company: e.target.value }); updateRoleDetail('organization_name', e.target.value) }} className="bg-secondary/50" />
                </Field>
                <Field label="Investment Focus">
                  <Input value={String(form.roleDetails.investment_focus || '')} onChange={(e) => updateRoleDetail('investment_focus', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Portfolio Highlights">
                  <Textarea value={String(form.roleDetails.portfolio_highlights || '')} onChange={(e) => updateRoleDetail('portfolio_highlights', e.target.value)} className="bg-secondary/50 min-h-[80px]" />
                </Field>
                <Field label="Industries">
                  <Input value={String(form.roleDetails.preferred_industries || '')} onChange={(e) => updateRoleDetail('preferred_industries', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Ticket Size">
                  <Input value={String(form.roleDetails.ticket_size || '')} onChange={(e) => updateRoleDetail('ticket_size', e.target.value)} className="bg-secondary/50" />
                </Field>
              </div>
            )}

            {role === 'mentor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Organization">
                  <Input value={String(form.roleDetails.organization || form.company)} onChange={(e) => { setForm({ ...form, company: e.target.value }); updateRoleDetail('organization', e.target.value) }} className="bg-secondary/50" />
                </Field>
                <Field label="Expertise">
                  <Input value={String(form.roleDetails.domain_expertise || form.roleDetails.expertise || '')} onChange={(e) => updateRoleDetail('domain_expertise', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Years of Experience">
                  <Input value={String(form.roleDetails.years_of_experience || form.roleDetails.years_experience || '')} onChange={(e) => updateRoleDetail('years_of_experience', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Mentorship Areas">
                  <Textarea value={String(form.roleDetails.mentorship_areas || '')} onChange={(e) => updateRoleDetail('mentorship_areas', e.target.value)} className="bg-secondary/50 min-h-[80px]" />
                </Field>
              </div>
            )}

            {role === 'executive' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Organization">
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="bg-secondary/50" />
                </Field>
                <Field label="Position">
                  <Input value={String(form.roleDetails.designation || '')} onChange={(e) => updateRoleDetail('designation', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Industry">
                  <Input value={String(form.roleDetails.industry || '')} onChange={(e) => updateRoleDetail('industry', e.target.value)} className="bg-secondary/50" />
                </Field>
                <Field label="Years of Experience">
                  <Input value={String(form.roleDetails.years_experience || '')} onChange={(e) => updateRoleDetail('years_experience', e.target.value)} className="bg-secondary/50" />
                </Field>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Experience</h3>
              <Button type="button" variant="outline" size="sm" onClick={addExperience}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {form.experience.length === 0 && (
              <p className="text-sm text-muted-foreground">No experience entries yet.</p>
            )}
            {form.experience.map((exp) => (
              <div key={exp.id} className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-3">
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeExperience(exp.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input placeholder="Company / Organization" value={exp.company} onChange={(e) => updateExperience(exp.id, { company: e.target.value })} className="bg-secondary/50" />
                  <Input placeholder="Position" value={exp.position} onChange={(e) => updateExperience(exp.id, { position: e.target.value })} className="bg-secondary/50" />
                  <Input type="month" placeholder="Start" value={exp.startDate} onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })} className="bg-secondary/50" />
                  <Input type="month" placeholder="End" value={exp.endDate} disabled={exp.current} onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })} className="bg-secondary/50" />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={!!exp.current} onChange={(e) => updateExperience(exp.id, { current: e.target.checked, endDate: e.target.checked ? '' : exp.endDate })} />
                  Current role
                </label>
                <Textarea placeholder="Description" value={exp.description} onChange={(e) => updateExperience(exp.id, { description: e.target.value })} className="bg-secondary/50 min-h-[70px]" />
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full h-12 glow-primary" disabled={loading}>
            {loading ? 'Saving...' : (
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
