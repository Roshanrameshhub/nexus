"""Verification document types and role mappings."""

FOUNDER_DOCUMENT_TYPES = frozenset(
    {
        "certificate_of_incorporation",
        "company_registration_certificate",
        "startup_india_certificate",
        "gst_registration_certificate",
        "business_license",
        "msme_registration",
        "company_pan_document",
        "other_company_verification_document",
    }
)

INVESTOR_DOCUMENT_TYPES = frozenset(
    {
        "investment_firm_registration",
        "vc_firm_registration",
        "angel_network_membership_proof",
        "fund_registration_document",
        "business_registration_certificate",
        "other_investor_verification_document",
    }
)

LEGACY_DOCUMENT_TYPES = frozenset({"college_id", "company_id"})

ALLOWED_DOCUMENT_TYPES = LEGACY_DOCUMENT_TYPES | FOUNDER_DOCUMENT_TYPES | INVESTOR_DOCUMENT_TYPES

DOCUMENT_TYPE_LABELS: dict[str, str] = {
    "college_id": "College ID",
    "company_id": "Company ID",
    "certificate_of_incorporation": "Certificate of Incorporation",
    "company_registration_certificate": "Company Registration Certificate",
    "startup_india_certificate": "Startup India Certificate",
    "gst_registration_certificate": "GST Registration Certificate",
    "business_license": "Business License",
    "msme_registration": "MSME Registration",
    "company_pan_document": "Company PAN Document",
    "other_company_verification_document": "Other Company Verification Document",
    "investment_firm_registration": "Investment Firm Registration",
    "vc_firm_registration": "VC Firm Registration",
    "angel_network_membership_proof": "Angel Network Membership Proof",
    "fund_registration_document": "Fund Registration Document",
    "business_registration_certificate": "Business Registration Certificate",
    "other_investor_verification_document": "Other Investor Verification Document",
}

VERIFICATION_TYPE_LABELS: dict[str, str] = {
    "student": "Student Verification",
    "developer": "Professional Verification",
    "executive": "Professional Verification",
    "mentor": "Professional Verification",
    "founder": "Founder Verification",
    "investor": "Investor Verification",
}


def normalize_role(role: str | None) -> str:
    if not role:
        return ""
    return role.lower().strip()


def allowed_document_types_for_role(role: str | None) -> frozenset[str]:
    key = normalize_role(role)
    if key == "student":
        return frozenset({"college_id"})
    if key in ("developer", "executive", "mentor"):
        return frozenset({"company_id"})
    if key == "founder":
        return FOUNDER_DOCUMENT_TYPES
    if key == "investor":
        return INVESTOR_DOCUMENT_TYPES
    return frozenset()


def verification_type_label(role: str | None) -> str:
    return VERIFICATION_TYPE_LABELS.get(normalize_role(role), "Identity Verification")


def document_type_label(document_type: str | None) -> str:
    if not document_type:
        return "Unknown"
    return DOCUMENT_TYPE_LABELS.get(document_type, document_type.replace("_", " ").title())
