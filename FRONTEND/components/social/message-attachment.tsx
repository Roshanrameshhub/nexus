'use client'

import { useState } from 'react'
import { FileText, Music, Video, Image as ImageIcon, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaViewer } from '@/components/ui/media-viewer'
import { getMediaUrl } from '@/lib/config/api'

interface MessageAttachmentProps {
  fileUrl: string
  fileName?: string
  fileType?: string
  messageType?: string
}

export function MessageAttachment({
  fileUrl,
  fileName,
  fileType,
  messageType,
}: MessageAttachmentProps) {
  const [showViewer, setShowViewer] = useState(false)
  const fullUrl = getMediaUrl(fileUrl)

  // Detect file type from URL or explicit type
  const getFileTypeFromUrl = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) return 'image'
    if (['pdf'].includes(extension)) return 'pdf'
    if (['mp4', 'webm', 'mov'].includes(extension)) return 'video'
    if (['mp3', 'wav', 'aac'].includes(extension)) return 'audio'
    return 'document'
  }

  const type = messageType || fileType || getFileTypeFromUrl(fileUrl)

  if (type === 'image') {
    return (
      <>
        <div
          className="mt-2 rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => setShowViewer(true)}
        >
          <img
            src={fullUrl}
            alt={fileName || 'Message image'}
            className="max-w-xs h-auto rounded-lg border border-border group-hover:border-primary/50 transition-all"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-image.png'
            }}
          />
        </div>
        <MediaViewer
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          src={fullUrl}
          alt={fileName || 'Message image'}
          fileName={fileName}
        />
      </>
    )
  }

  if (type === 'video') {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-border">
        <video
          src={fullUrl}
          controls
          className="max-w-xs h-auto rounded-lg"
          onError={(e) => {
            console.error('Video error:', e)
          }}
        />
      </div>
    )
  }

  if (type === 'audio') {
    return (
      <div className="mt-2 bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
        <Music className="w-5 h-5 text-primary shrink-0" />
        <audio
          src={fullUrl}
          controls
          className="flex-1"
          onError={(e) => {
            console.error('Audio error:', e)
          }}
        />
      </div>
    )
  }

  if (type === 'pdf') {
    return (
      <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-4">
        <FileText className="w-8 h-8 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {fileName || 'PDF Document'}
          </p>
          <p className="text-sm text-muted-foreground">PDF Document</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(fullUrl, '_blank')}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const a = document.createElement('a')
              a.href = fullUrl
              a.download = fileName || 'document.pdf'
              a.click()
            }}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
      </div>
    )
  }

  // Generic document
  return (
    <div className="mt-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-center gap-4">
      <FileText className="w-8 h-8 text-blue-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {fileName || 'Attachment'}
        </p>
        <p className="text-sm text-muted-foreground">File Attachment</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(fullUrl, '_blank')}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const a = document.createElement('a')
            a.href = fullUrl
            a.download = fileName || 'file'
            a.click()
          }}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
      </div>
    </div>
  )
}
