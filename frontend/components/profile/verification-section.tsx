'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Upload,
  FileText,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { verificationAPI } from '@/services/api'
import { getErrorMessage } from '@/services/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import {
  getDocumentOptionsForRole,
  getDocumentTypeLabel,
  getVerificationTypeLabel,
  getVerifiedBadgeLabel,
  LEGACY_DOCUMENT_OPTIONS,
  usesDropdownDocumentPicker,
  usesLegacyCardPicker,
} from '@/lib/constants/verification'

type VerificationStatus = 'not_verified' | 'pending' | 'verified' | 'rejected'

interface VerificationRequest {
  id: string
  document_type: string
  document_url: string
  status: string
  review_note?: string | null
  created_at: string
}

interface VerificationState {
  is_verified: boolean
  status: VerificationStatus
  verification_type?: string
  latest_request: VerificationRequest | null
  can_submit: boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf']
const MAX_SIZE_MB = 15

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  not_verified: {
    label: 'Not Verified',
    className: 'bg-secondary/80 text-muted-foreground border-border/60',
    icon: ShieldCheck,
  },
  pending: {
    label: 'Pending Review',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  verified: {
    label: 'Verified',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Verification Rejected',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: AlertCircle,
  },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only JPG, PNG, and PDF files are allowed'
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File must be under ${MAX_SIZE_MB}MB`
  }
  return null
}

export function VerificationSection() {
  const userRole = useAuthStore((s) => s.user?.role)
  const documentOptions = useMemo(() => getDocumentOptionsForRole(userRole), [userRole])
  const verificationTypeLabel = useMemo(
    () => getVerificationTypeLabel(userRole),
    [userRole]
  )
  const verifiedBadgeLabel = useMemo(() => getVerifiedBadgeLabel(userRole), [userRole])

  const [state, setState] = useState<VerificationState | null>(null)
  const [loading, setLoading] = useState(true)
  const [documentType, setDocumentType] = useState(documentOptions[0]?.value ?? 'college_id')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (documentOptions.length > 0) {
      setDocumentType(documentOptions[0].value)
    }
  }, [documentOptions])

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await verificationAPI.getStatus()
      setState(data as VerificationState)
    } catch {
      toast.error('Could not load verification status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const clearFile = () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadProgress('idle')
  }

  const handleFile = (file: File) => {
    const error = validateFile(file)
    if (error) {
      toast.error(error)
      return
    }
    clearFile()
    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a document to upload')
      return
    }
    setSubmitting(true)
    try {
      setUploadProgress('uploading')
      await verificationAPI.submit(documentType, selectedFile)
      setUploadProgress('done')
      toast.success('Verification submitted for review')
      clearFile()
      await loadStatus()
    } catch (err) {
      setUploadProgress('idle')
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const viewMyDocument = async () => {
    try {
      const { data } = await verificationAPI.getDocument()
      const url = URL.createObjectURL(data)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Could not open document')
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const status = state?.status ?? 'not_verified'
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon
  const showUpload = state?.can_submit && status !== 'verified'
  const showDropdown = usesDropdownDocumentPicker(userRole)
  const showLegacyCards = usesLegacyCardPicker(userRole)

  return (
    <motion.section
      className="glass-card p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Verification</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Optional identity verification helps build trust on RConnectX. Upload a supporting
            document for admin review.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0',
            config.className
          )}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {status === 'verified' ? verifiedBadgeLabel : config.label}
        </span>
      </div>

      {status === 'verified' && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">You are {verifiedBadgeLabel.toLowerCase()}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your identity has been confirmed by the RConnectX team.
            </p>
          </div>
        </div>
      )}

      {status === 'pending' && state?.latest_request && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <p className="font-medium text-foreground">Under review</p>
          <p className="text-sm text-muted-foreground mt-1">
            Submitted{' '}
            {new Intl.DateTimeFormat('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(state.latest_request.created_at))}
            {' · '}
            {getDocumentTypeLabel(state.latest_request.document_type)}
          </p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <p className="font-medium text-foreground">Verification rejected</p>
          {state?.latest_request?.review_note ? (
            <p className="text-sm text-muted-foreground mt-1">
              Reason: {state.latest_request.review_note}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Please upload a clearer document and try again.
            </p>
          )}
        </div>
      )}

      {showUpload && (
        <div className="space-y-5 pt-2 border-t border-border/50">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Verification Type</p>
            <p className="text-sm text-muted-foreground">
              {state?.verification_type ?? verificationTypeLabel}
            </p>
          </div>

          {showDropdown && (
            <div className="space-y-2">
              <Label htmlFor="verification-document-type">Document Type</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="verification-document-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showLegacyCards && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Document type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LEGACY_DOCUMENT_OPTIONS.filter((opt) =>
                  documentOptions.some((d) => d.value === opt.value)
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDocumentType(opt.value)}
                    className={cn(
                      'text-left rounded-xl border p-4 transition-all',
                      documentType === opt.value
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border/60 bg-secondary/30 hover:border-primary/40'
                    )}
                  >
                    <p className="font-medium text-foreground text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Upload document</p>
            <div
              onDragEnter={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setDragActive(false)
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                'relative rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 bg-secondary/20 hover:border-primary/40'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                  e.target.value = ''
                }}
              />
              {!selectedFile ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Drag & drop your document here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse · JPG, PNG, PDF · max {MAX_SIZE_MB}MB
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 text-left">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Document preview"
                      className="w-24 h-24 object-cover rounded-lg border border-border/60 shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg border border-border/60 bg-secondary/50 flex items-center justify-center shrink-0">
                      <FileText className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    {uploadProgress === 'uploading' && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={clearFile}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full sm:w-auto glow-primary"
            onClick={() => void handleSubmit()}
            disabled={!selectedFile || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit for Review'
            )}
          </Button>
        </div>
      )}

      {state?.latest_request && status !== 'not_verified' && !showUpload && (
        <button
          type="button"
          onClick={() => void viewMyDocument()}
          className="text-xs text-primary hover:underline"
        >
          View submitted document
        </button>
      )}
    </motion.section>
  )
}
