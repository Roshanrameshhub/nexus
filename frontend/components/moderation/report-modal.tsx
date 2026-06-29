'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { REPORT_REASONS, type ReportType } from '@/lib/constants/report-reasons'
import { reportsAPI, getErrorMessage } from '@/services/api'
import { toast } from 'sonner'

interface ReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType: ReportType
  contentId: string
  title?: string
}

export function ReportModal({
  open,
  onOpenChange,
  reportType,
  contentId,
  title = 'Report Content',
}: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setReason('')
    setNotes('')
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason')
      return
    }
    setSubmitting(true)
    try {
      await reportsAPI.submit({
        report_type: reportType,
        content_id: contentId,
        reason,
        notes: notes.trim() || undefined,
      })
      toast.success('Report submitted. Our team will review it.')
      handleClose(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Help us understand what is wrong. Reports are reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-notes">Additional notes (optional)</Label>
            <Textarea
              id="report-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting || !reason}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
