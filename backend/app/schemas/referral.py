from pydantic import BaseModel


class ReferralMeResponse(BaseModel):
    referral_code: str
    referral_count: int
    referral_link: str
