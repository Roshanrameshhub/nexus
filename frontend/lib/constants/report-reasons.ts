export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'fake_profile', label: 'Fake Profile' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'scam_fraud', label: 'Scam / Fraud' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright_violation', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' },
] as const

export type ReportType = 'post' | 'ecosystem_post' | 'comment' | 'profile'

export const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label])
)
