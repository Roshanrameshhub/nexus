'use client'

import { Copy, Linkedin, Mail, X as XIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export interface SharePayload {
  title: string
  text: string
  url: string
  modalTitle: string
  modalDescription: string
}

interface ProfileShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  /** Profile share — uses name for modal copy when payload fields are omitted */
  name?: string
  title?: string
  text?: string
  modalTitle?: string
  modalDescription?: string
}

export function ProfileShareModal({
  open,
  onOpenChange,
  name,
  url,
  title,
  text,
  modalTitle,
  modalDescription,
}: ProfileShareModalProps) {
  const shareTitle = title ?? `${name ?? 'User'} on RConnectX`
  const shareText = text ?? 'Check out this profile on RConnectX'
  const dialogTitle = modalTitle ?? 'Share Profile'
  const dialogDescription = modalDescription ?? `Share ${name ?? 'this user'}'s public profile`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const openShare = (shareUrl: string) => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/50">
            <img src={qrUrl} alt="Share QR code" className="w-40 h-40 rounded-lg border border-border/40 bg-white p-2" />
            <p className="text-xs text-muted-foreground text-center break-all">{url}</p>
          </div>

          <Button className="w-full" onClick={() => void copyLink()}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                openShare(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`)
              }
            >
              WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                openShare(
                  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
                )
              }
            >
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                openShare(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
                )
              }
            >
              <XIcon className="w-4 h-4 mr-2" />
              X / Twitter
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                openShare(
                  `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`
                )
              }
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export async function shareLink(payload: SharePayload): Promise<'shared' | 'modal'> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
      return 'shared'
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return 'shared'
  }
  return 'modal'
}

export async function shareProfileLink(name: string, url: string): Promise<'shared' | 'modal'> {
  return shareLink({
    title: `${name} on RConnectX`,
    text: 'Check out this profile on RConnectX',
    url,
    modalTitle: 'Share Profile',
    modalDescription: `Share ${name}'s public profile`,
  })
}

export function getPostSharePayload(postId: string): SharePayload {
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/posts/${postId}`
  return {
    title: 'Post from RConnectX',
    text: 'Check out this post on RConnectX',
    url,
    modalTitle: 'Share Post',
    modalDescription: 'Share this post with your network',
  }
}

export async function sharePostLink(postId: string): Promise<'shared' | 'modal'> {
  return shareLink(getPostSharePayload(postId))
}
