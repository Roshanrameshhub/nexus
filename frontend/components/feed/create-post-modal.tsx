'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImageUploader } from '@/components/social/image-uploader'
import { postsAPI } from '@/services/api'
import { POST_TYPE_LABELS } from '@/lib/mappers/posts'
import { toast } from 'sonner'

const createPostTypes = ['text', 'startup_update', 'funding', 'product_launch', 'poll', 'event'] as const

type CreatePostType = (typeof createPostTypes)[number]

interface CreatePostModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPosted: () => void
}

function emptyPollOptions() {
  return [
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
  ]
}

export function CreatePostModal({ open, onOpenChange, onPosted }: CreatePostModalProps) {
  const [postType, setPostType] = useState<CreatePostType>('text')
  const [postContent, setPostContent] = useState('')
  const [pollOptions, setPollOptions] = useState(emptyPollOptions)
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setPostType('text')
    setPostContent('')
    setPollOptions(emptyPollOptions())
    setUploadedMedia([])
  }

  const handleClose = (next: boolean) => {
    if (!submitting) onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!postContent.trim()) return
    if (postType === 'poll') {
      const options = pollOptions
        .filter((o) => o.text.trim())
        .map((o) => ({ id: o.id, text: o.text.trim() }))
      if (options.length < 2) {
        toast.error('Add at least 2 poll options')
        return
      }
    }

    setSubmitting(true)
    try {
      const options =
        postType === 'poll'
          ? pollOptions.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim() }))
          : undefined

      await postsAPI.createPost({
        content: postContent.trim(),
        media: uploadedMedia,
        post_type: postType,
        poll_details: options ? { options } : undefined,
      })

      resetForm()
      onOpenChange(false)
      onPosted()
      toast.success('Post published')
    } catch {
      toast.error('Could not publish post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create post</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value as CreatePostType)}
            className="w-full h-9 text-sm rounded-md border border-border/50 bg-secondary/30 px-2 text-foreground"
          >
            {createPostTypes.map((type) => (
              <option key={type} value={type}>
                {POST_TYPE_LABELS[type] || type.replace('_', ' ')}
              </option>
            ))}
          </select>

          <Textarea
            placeholder={
              postType === 'poll'
                ? 'Ask your poll question...'
                : postType === 'event'
                  ? 'Event name, date, location...'
                  : 'Share an update...'
            }
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="min-h-[100px] bg-secondary/30 border-border/50 resize-none text-sm"
          />

          {postType === 'poll' && (
            <div className="space-y-2">
              {pollOptions.map((opt, idx) => (
                <div key={opt.id} className="flex gap-2">
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    value={opt.text}
                    onChange={(e) =>
                      setPollOptions((prev) =>
                        prev.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o))
                      )
                    }
                    className="h-9 text-sm bg-secondary/30"
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 shrink-0"
                      onClick={() => setPollOptions((prev) => prev.filter((o) => o.id !== opt.id))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setPollOptions((prev) => [...prev, { id: crypto.randomUUID(), text: '' }])
                  }
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add option
                </Button>
              )}
            </div>
          )}

          {postType !== 'poll' && (
            <ImageUploader onUpload={setUploadedMedia} maxFiles={5} maxSizeMB={5} />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="glow-primary"
              disabled={!postContent.trim() || submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
