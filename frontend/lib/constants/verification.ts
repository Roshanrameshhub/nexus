export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  college_id: 'College ID',
  company_id: 'Company ID',
  certificate_of_incorporation: 'Certificate of Incorporation',
  company_registration_certificate: 'Company Registration Certificate',
  startup_india_certificate: 'Startup India Certificate',
  gst_registration_certificate: 'GST Registration Certificate',
  business_license: 'Business License',
  msme_registration: 'MSME Registration',
  company_pan_document: 'Company PAN Document',
  other_company_verification_document: 'Other Company Verification Document',
  investment_firm_registration: 'Investment Firm Registration',
  vc_firm_registration: 'VC Firm Registration',
  angel_network_membership_proof: 'Angel Network Membership Proof',
  fund_registration_document: 'Fund Registration Document',
  business_registration_certificate: 'Business Registration Certificate',
  other_investor_verification_document: 'Other Investor Verification Document',
}

export const FOUNDER_DOCUMENT_OPTIONS = [
  { value: 'certificate_of_incorporation', label: 'Certificate of Incorporation' },
  { value: 'company_registration_certificate', label: 'Company Registration Certificate' },
  { value: 'startup_india_certificate', label: 'Startup India Certificate' },
  { value: 'gst_registration_certificate', label: 'GST Registration Certificate' },
  { value: 'business_license', label: 'Business License' },
  { value: 'msme_registration', label: 'MSME Registration' },
  { value: 'company_pan_document', label: 'Company PAN Document' },
  { value: 'other_company_verification_document', label: 'Other Company Verification Document' },
] as const

export const INVESTOR_DOCUMENT_OPTIONS = [
  { value: 'investment_firm_registration', label: 'Investment Firm Registration' },
  { value: 'vc_firm_registration', label: 'VC Firm Registration' },
  { value: 'angel_network_membership_proof', label: 'Angel Network Membership Proof' },
  { value: 'fund_registration_document', label: 'Fund Registration Document' },
  { value: 'business_registration_certificate', label: 'Business Registration Certificate' },
  { value: 'other_investor_verification_document', label: 'Other Investor Verification Document' },
] as const

export const LEGACY_DOCUMENT_OPTIONS = [
  { value: 'college_id', label: 'College ID', description: 'Student or university identification' },
  { value: 'company_id', label: 'Company ID', description: 'Employee or workplace identification' },
] as const

export function getVerificationTypeLabel(role?: string | null): string {
  switch ((role || '').toLowerCase()) {
    case 'student':
      return 'Student Verification'
    case 'founder':
      return 'Founder Verification'
    case 'investor':
      return 'Investor Verification'
    case 'developer':
    case 'executive':
    case 'mentor':
      return 'Professional Verification'
    default:
      return 'Identity Verification'
  }
}

export function getVerifiedBadgeLabel(role?: string | null): string {
  switch ((role || '').toLowerCase()) {
    case 'student':
      return 'Verified Student'
    case 'founder':
      return 'Verified Founder'
    case 'investor':
      return 'Verified Investor'
    case 'developer':
    case 'executive':
    case 'mentor':
      return 'Verified Professional'
    default:
      return 'Verified Member'
  }
}

export function getDocumentOptionsForRole(role?: string | null) {
  switch ((role || '').toLowerCase()) {
    case 'student':
      return [{ value: 'college_id', label: 'College ID' }]
    case 'developer':
    case 'executive':
    case 'mentor':
      return [{ value: 'company_id', label: 'Company ID' }]
    case 'founder':
      return FOUNDER_DOCUMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    case 'investor':
      return INVESTOR_DOCUMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
    default:
      return LEGACY_DOCUMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
  }
}

export function getDocumentTypeLabel(documentType?: string | null): string {
  if (!documentType) return 'Unknown'
  return DOCUMENT_TYPE_LABELS[documentType] || documentType.replace(/_/g, ' ')
}

export function usesDropdownDocumentPicker(role?: string | null): boolean {
  const key = (role || '').toLowerCase()
  return key === 'founder' || key === 'investor'
}

export function usesLegacyCardPicker(role?: string | null): boolean {
  const key = (role || '').toLowerCase()
  return key === 'student' || key === 'developer' || key === 'executive' || key === 'mentor'
}
