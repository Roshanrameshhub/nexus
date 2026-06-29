'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { postsAPI } from '@/services/api'
import {
  WORK_MODES,
  canCreateEcosystemUpdates,
  canCreateOpportunities,
  opportunityTypesForRole,
  updatePostTypesForRole,
} from '@/lib/ecosystem'
import { toast } from 'sonner'

interface EcosystemCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole?: string | null
  onPublished: () => void
}

export function EcosystemCreateModal({
  open,
  onOpenChange,
  userRole,
  onPublished,
}: EcosystemCreateModalProps) {
  const canUpdates = canCreateEcosystemUpdates(userRole)
  const canOpps = canCreateOpportunities(userRole)
  const [createMode, setCreateMode] = useState<'update' | 'opportunity'>('update')
  const [postType, setPostType] = useState('startup_update')
  const [postContent, setPostContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [oppTitle, setOppTitle] = useState('')
  const [oppOrg, setOppOrg] = useState('')
  const [oppType, setOppType] = useState('job_opening')
  const [oppLocation, setOppLocation] = useState('')
  const [oppWorkMode, setOppWorkMode] = useState('remote')
  const [oppLink, setOppLink] = useState('')
  const [oppExpiry, setOppExpiry] = useState('')

  const postTypes = useMemo(() => updatePostTypesForRole(userRole), [userRole])
  const oppTypes = useMemo(() => opportunityTypesForRole(userRole), [userRole])

  useEffect(() => {
    if (!open) return
    if (canUpdates) setCreateMode('update')
    else if (canOpps) setCreateMode('opportunity')
    if (postTypes[0]) setPostType(postTypes[0].id)
    if (oppTypes[0]) setOppType(oppTypes[0].id)
  }, [open, canUpdates, canOpps, postTypes, oppTypes])

  const reset = () => {
    setPostContent('')
    setOppTitle('')
    setOppOrg('')
    setOppLocation('')
    setOppLink('')
    setOppExpiry('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (createMode === 'opportunity' && canOpps) {
        if (!oppTitle.trim() || !oppOrg.trim() || !postContent.trim()) {
          toast.error('Title, organization, and description are required')
          return
        }
        await postsAPI.createPost({
          content: postContent.trim(),
          post_type: 'opportunity',
          opportunity_details: {
            title: oppTitle.trim(),
            organization: oppOrg.trim(),
            opportunity_type: oppType,
            location: oppLocation.trim() || undefined,
            work_mode: oppWorkMode,
            application_link: oppLink.trim() || undefined,
            expiry_date: oppExpiry || undefined,
          },
        })
      } else if (canUpdates) {
        if (!postContent.trim()) return
        await postsAPI.createPost({
          content: postContent.trim(),
          post_type: postType,
        })
      }
      reset()
      onOpenChange(false)
      onPublished()
      toast.success('Published to ecosystem')
    } catch {
      toast.error('Could not publish')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canUpdates && !canOpps) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish to ecosystem</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {canUpdates && canOpps && (
            <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setCreateMode('update')}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  createMode === 'update' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                Update
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('opportunity')}
                className={`px-3 py-1 text-xs font-semibold rounded-md ${
                  createMode === 'opportunity' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                Opportunity
              </button>
            </div>
          )}

          {createMode === 'update' && canUpdates ? (
            <>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-border bg-secondary/30 px-2"
              >
                {postTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <Textarea
                placeholder="Share your milestone, launch, or professional update..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                required
                className="min-h-[100px] bg-secondary/30 resize-none"
              />
            </>
          ) : canOpps ? (
            <div className="space-y-2">
              <Input placeholder="Title *" value={oppTitle} onChange={(e) => setOppTitle(e.target.value)} required className="bg-secondary/30" />
              <Input placeholder="Organization *" value={oppOrg} onChange={(e) => setOppOrg(e.target.value)} required className="bg-secondary/30" />
              <select value={oppType} onChange={(e) => setOppType(e.target.value)} className="w-full h-9 bg-secondary/30 border border-border rounded-md px-2 text-sm">
                {oppTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Location" value={oppLocation} onChange={(e) => setOppLocation(e.target.value)} className="bg-secondary/30 text-sm" />
                <select value={oppWorkMode} onChange={(e) => setOppWorkMode(e.target.value)} className="h-9 bg-secondary/30 border border-border rounded-md px-2 text-sm">
                  {WORK_MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <Input placeholder="Link (optional)" value={oppLink} onChange={(e) => setOppLink(e.target.value)} className="bg-secondary/30 text-sm" />
              <Input type="date" value={oppExpiry} onChange={(e) => setOppExpiry(e.target.value)} className="bg-secondary/30 text-sm" />
              <Textarea
                placeholder="Description *"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                required
                className="min-h-[80px] bg-secondary/30 resize-none"
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="glow-primary" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
