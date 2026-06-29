'use client'

import { useState } from 'react'
import { Copy, Flag, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ReportModal } from '@/components/moderation/report-modal'
import type { ReportType } from '@/lib/constants/report-reasons'
import { toast } from 'sonner'

interface ContentOptionsMenuProps {
  reportType: ReportType
  contentId: string
  reportLabel?: string
  copyLink?: string
  className?: string
  size?: 'sm' | 'default'
}

export function ContentOptionsMenu({
  reportType,
  contentId,
  reportLabel = 'Report',
  copyLink,
  className,
  size = 'sm',
}: ContentOptionsMenuProps) {
  const [reportOpen, setReportOpen] = useState(false)

  const handleCopy = async () => {
    if (!copyLink) return
    try {
      await navigator.clipboard.writeText(copyLink)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={size === 'sm' ? 'icon' : 'default'} className={className}>
            <MoreHorizontal className="w-4 h-4" />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {copyLink && (
            <DropdownMenuItem onClick={() => void handleCopy()}>
              <Copy className="w-4 h-4 mr-2" />
              Copy link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setReportOpen(true)}>
            <Flag className="w-4 h-4 mr-2" />
            {reportLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportType={reportType}
        contentId={contentId}
        title={reportLabel}
      />
    </>
  )
}
