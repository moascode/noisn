from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class RiskProfile(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class PayoutType(str, Enum):
    LUMP_SUM = "LUMP_SUM"
    ANNUITY = "ANNUITY"
    LIFE_ANNUITY = "LIFE_ANNUITY"
    COMBINED = "COMBINED"


class CriticalIllnessTier(str, Enum):
    NONE = "NONE"
    TIER_1 = "TIER_1"   # DKK 90,900
    TIER_2 = "TIER_2"   # DKK 181,800


class HealthModule(str, Enum):
    BASIC = "BASIC"
    MODULE_1 = "MODULE_1"
    MODULE_2 = "MODULE_2"


class SimulationRequest(BaseModel):
    # User profile
    age: int = Field(..., ge=18, le=70, description="User age in years")
    annual_salary: float = Field(..., gt=0, description="Gross annual salary in DKK")
    desired_retirement_age: int = Field(..., ge=55, le=75)
    employment_status: str = Field(default="EMPLOYED")

    # Savings configuration
    monthly_contribution: float = Field(..., gt=0, description="Monthly contribution in DKK")
    risk_profile: RiskProfile = Field(default=RiskProfile.MEDIUM)
    payout_type: PayoutType = Field(default=PayoutType.ANNUITY)

    # Coverage
    earning_capacity_cover_end_age: int = Field(default=65)
    critical_illness_tier: CriticalIllnessTier = Field(default=CriticalIllnessTier.NONE)
    life_insurance_enabled: bool = Field(default=False)
    partner_life_insurance_enabled: bool = Field(default=False)
    health_insurance_modules: List[HealthModule] = Field(default=[HealthModule.BASIC, HealthModule.MODULE_1])
    children_health_enabled: bool = Field(default=False)

    # Context
    other_savings_dkk: float = Field(default=0)
    home_equity_dkk: float = Field(default=0)


class CoverageBreakdown(BaseModel):
    pension_contribution: float
    earning_capacity: float
    critical_illness: float
    life_insurance: float
    partner_life_insurance: float
    health_insurance: float
    children_health: float
    total: float


class SimulationResult(BaseModel):
    # Pension projections
    projected_pension_monthly_dkk: float
    projected_pension_annual_dkk: float
    salary_replacement_pct: float
    total_savings_at_retirement_dkk: float

    # Cost breakdown
    coverage_breakdown: CoverageBreakdown
    total_monthly_premium_dkk: float

    # Contextual
    contribution_period_years: int
    target_replacement_pct: float = 80.0
    gap_to_target_dkk: float   # positive = below target, negative = above
    reaches_target: bool

    # Metadata
    simulation_id: str
    risk_profile_used: RiskProfile


class EligibilityRequest(BaseModel):
    age: int
    employment_status: str
    cover_type: str


class EligibilityResult(BaseModel):
    eligible: bool
    reason: str
    age_limit: Optional[int] = None
