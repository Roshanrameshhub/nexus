'use client'

import { useState } from 'react'
import { FileText, FileArchive, FileSpreadsheet, Presentation, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaViewer } from '@/components/ui/media-viewer'
import { getMediaUrl } from '@/lib/config/api'

interface MessageAttachmentProps {
  fileUrl: string
  fileName?: string
  fileType?: string
  messageType?: string
  mimeType?: string
  fileSize?: number
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function resolveType(
  messageType?: string,
  mimeType?: string,
  fileName?: string,
  fileUrl?: string
): string {
  if (messageType === 'image' || mimeType?.startsWith('image/')) return 'image'
  const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase() || ''
  if (mimeType?.includes('pdf') || ext === 'pdf') return 'pdf'
  if (ext === 'zip' || mimeType?.includes('zip')) return 'zip'
  if (ext === 'docx' || mimeType?.includes('wordprocessingml')) return 'docx'
  if (ext === 'pptx' || mimeType?.includes('presentationml')) return 'pptx'
  if (ext === 'xlsx' || mimeType?.includes('spreadsheetml')) return 'xlsx'
  if (ext === 'txt' || mimeType === 'text/plain') return 'txt'
  return messageType || 'document'
}

function AttachmentIcon({ type }: { type: string }) {
  if (type === 'zip') return <FileArchive className="w-8 h-8 text-amber-500 shrink-0" />
  if (type === 'xlsx') return <FileSpreadsheet className="w-8 h-8 text-emerald-500 shrink-0" />
  if (type === 'pptx') return <Presentation className="w-8 h-8 text-orange-500 shrink-0" />
  return <FileText className="w-8 h-8 text-blue-500 shrink-0" />
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    pdf: 'PDF Document',
    docx: 'Word Document',
    pptx: 'PowerPoint Presentation',
    xlsx: 'Excel Spreadsheet',
    txt: 'Text File',
    zip: 'ZIP Archive',
    document: 'File Attachment',
  }
  return labels[type] || labels.document
}

export function MessageAttachment({
  fileUrl,
  fileName,
  fileType,
  messageType,
  mimeType,
  fileSize,
}: MessageAttachmentProps) {
  const [showViewer, setShowViewer] = useState(false)
  const fullUrl = getMediaUrl(fileUrl)
  const type = resolveType(messageType, mimeType, fileName, fileUrl)
  const sizeLabel = formatFileSize(fileSize)

  if (type === 'image') {
    return (
      <>
        <div
          className="rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => setShowViewer(true)}
        >
          <img
            src={fullUrl}
            alt={fileName || 'Message image'}
            className="max-w-xs h-auto rounded-lg border border-border/50 group-hover:border-primary/50 transition-all"
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

  const cardColor =
    type === 'pdf'
      ? 'bg-red-500/10 border-red-500/20'
      : type === 'zip'
        ? 'bg-amber-500/10 border-amber-500/20'
        : 'bg-blue-500/10 border-blue-500/20'

  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${cardColor}`}>
      <AttachmentIcon type={type} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{fileName || 'Attachment'}</p>
        <p className="text-xs text-muted-foreground">
          {typeLabel(type)}
          {sizeLabel ? ` · ${sizeLabel}` : ''}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        {type !== 'zip' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(fullUrl, '_blank')}
            className="gap-1 h-8"
          >
            <Eye className="w-3.5 h-3.5" />
            Open
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const a = document.createElement('a')
            a.href = fullUrl
            a.download = fileName || 'download'
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.click()
          }}
          className="gap-1 h-8"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
      </div>
    </div>
  )
}
