"""
Danica Pension — Calculator Engine
Implements pension amount, coverage premium, and projection formulas.
Based on Danica product rules (public documentation).
"""

import uuid
from models import (
    SimulationRequest, SimulationResult, CoverageBreakdown,
    RiskProfile, CriticalIllnessTier, HealthModule
)

# ─── RETURN RATE ASSUMPTIONS (annualised) ────────────────────────────────────
RETURN_RATES = {
    RiskProfile.LOW:    0.03,
    RiskProfile.MEDIUM: 0.05,
    RiskProfile.HIGH:   0.07,
}

# ─── COVERAGE PREMIUM RATES (DKK/month) ──────────────────────────────────────
# Approximate rates — replace with actual Danica tariff tables
EARNING_CAPACITY_RATE_PCT = 0.012       # 1.2% of annual salary / 12
CRITICAL_ILLNESS_TIER_1_MONTHLY = 280   # DKK 90,900 lump sum cover
CRITICAL_ILLNESS_TIER_2_MONTHLY = 560   # DKK 181,800 lump sum cover
LIFE_INSURANCE_RATE_PCT = 0.003         # 0.3% of annual salary / 12
PARTNER_LIFE_INSURANCE_MONTHLY = 190
HEALTH_BASIC_MONTHLY = 130
HEALTH_MODULE_1_MONTHLY = 95
HEALTH_MODULE_2_MONTHLY = 75
CHILDREN_HEALTH_MONTHLY = 115

TARGET_REPLACEMENT_PCT = 80.0


def calculate_pension_amount(req: SimulationRequest) -> float:
    """
    Future value of monthly contributions with compound interest.
    FV = PMT * [((1+r)^n - 1) / r]
    where r = monthly rate, n = months of contribution
    """
    contribution_years = req.desired_retirement_age - req.age
    if contribution_years <= 0:
        return 0.0

    annual_rate = RETURN_RATES[req.risk_profile]
    monthly_rate = annual_rate / 12
    n_months = contribution_years * 12

    if monthly_rate == 0:
        fv = req.monthly_contribution * n_months
    else:
        fv = req.monthly_contribution * (((1 + monthly_rate) ** n_months - 1) / monthly_rate)

    # Add other savings (simple, no growth assumed for conservatism)
    total_savings = fv + req.other_savings_dkk + (req.home_equity_dkk * 0.3)  # 30% of equity accessible
    return round(total_savings, 2)


def calculate_monthly_pension_payout(total_savings: float, payout_years: int = 20) -> float:
    """
    Convert lump sum to monthly annuity payout over payout_years.
    Uses 2% drawdown rate assumption during payout phase.
    """
    if payout_years <= 0:
        return 0.0
    monthly_drawdown_rate = 0.02 / 12
    n = payout_years * 12
    if monthly_drawdown_rate == 0:
        return total_savings / n
    # PMT = PV * [r(1+r)^n] / [(1+r)^n - 1]
    pmt = total_savings * (monthly_drawdown_rate * (1 + monthly_drawdown_rate) ** n) / \
          ((1 + monthly_drawdown_rate) ** n - 1)
    return round(pmt, 2)


def calculate_coverage_premiums(req: SimulationRequest) -> CoverageBreakdown:
    """Calculate monthly premiums for all insurance covers."""

    # Loss of earning capacity
    earning_capacity = round((req.annual_salary * EARNING_CAPACITY_RATE_PCT) / 12, 2)

    # Critical illness
    ci_map = {
        CriticalIllnessTier.NONE:   0,
        CriticalIllnessTier.TIER_1: CRITICAL_ILLNESS_TIER_1_MONTHLY,
        CriticalIllnessTier.TIER_2: CRITICAL_ILLNESS_TIER_2_MONTHLY,
    }
    critical_illness = ci_map[req.critical_illness_tier]

    # Life insurance
    life_insurance = round((req.annual_salary * LIFE_INSURANCE_RATE_PCT) / 12, 2) \
        if req.life_insurance_enabled else 0

    # Partner life insurance
    partner_life = PARTNER_LIFE_INSURANCE_MONTHLY if req.partner_life_insurance_enabled else 0

    # Health insurance
    health = 0
    if HealthModule.BASIC in req.health_insurance_modules:
        health += HEALTH_BASIC_MONTHLY
    if HealthModule.MODULE_1 in req.health_insurance_modules:
        health += HEALTH_MODULE_1_MONTHLY
    if HealthModule.MODULE_2 in req.health_insurance_modules:
        health += HEALTH_MODULE_2_MONTHLY

    # Children health
    children_health = CHILDREN_HEALTH_MONTHLY if req.children_health_enabled else 0

    total = sum([
        req.monthly_contribution,
        earning_capacity,
        critical_illness,
        life_insurance,
        partner_life,
        health,
        children_health,
    ])

    return CoverageBreakdown(
        pension_contribution=req.monthly_contribution,
        earning_capacity=earning_capacity,
        critical_illness=critical_illness,
        life_insurance=life_insurance,
        partner_life_insurance=partner_life,
        health_insurance=health,
        children_health=children_health,
        total=round(total, 2),
    )


def check_eligibility(age: int, employment_status: str, cover_type: str) -> dict:
    """Rule-based eligibility checks based on Danica product rules."""

    rules = {
        "CRITICAL_ILLNESS": {
            "check": age < 50,
            "reason": f"Critical illness cover can only be established up to age 50. Current age: {age}.",
            "age_limit": 50,
        },
        "HEALTH_EXTENSION": {
            "check": age < 67,
            "reason": f"Health insurance extension (module 2) available until age 67. Current age: {age}.",
            "age_limit": 67,
        },
        "EARNING_CAPACITY": {
            "check": True,  # Always eligible
            "reason": "Loss of earning capacity cover is available to all employed and self-employed customers.",
            "age_limit": None,
        },
        "LIFE_INSURANCE": {
            "check": age < 65,
            "reason": f"Life insurance cover available until age 65. Current age: {age}.",
            "age_limit": 65,
        },
        "SELF_EMPLOYED_MINIMUM": {
            "check": employment_status == "SELF_EMPLOYED",
            "reason": "Self-employed minimum contribution rules apply. Minimum DKK 3,000/year for TIER_1 critical illness.",
            "age_limit": None,
        },
    }

    if cover_type not in rules:
        return {"eligible": True, "reason": "No specific eligibility rules for this cover type.", "age_limit": None}

    rule = rules[cover_type]
    return {
        "eligible": rule["check"],
        "reason": rule["reason"],
        "age_limit": rule["age_limit"],
    }


def run_full_simulation(req: SimulationRequest) -> SimulationResult:
    """Orchestrate all calculators and return complete simulation result."""

    contribution_years = max(req.desired_retirement_age - req.age, 0)
    total_savings = calculate_pension_amount(req)

    # Assume 20-year payout period by default
    payout_years = 85 - req.desired_retirement_age  # To age 85
    monthly_pension = calculate_monthly_pension_payout(total_savings, max(payout_years, 10))
    annual_pension = round(monthly_pension * 12, 2)

    # Salary replacement
    monthly_salary = req.annual_salary / 12
    replacement_pct = round((monthly_pension / monthly_salary) * 100, 1) if monthly_salary > 0 else 0

    # Coverage premiums
    coverage = calculate_coverage_premiums(req)

    # Gap analysis
    target_monthly = monthly_salary * (TARGET_REPLACEMENT_PCT / 100)
    gap = round(target_monthly - monthly_pension, 2)

    return SimulationResult(
        projected_pension_monthly_dkk=monthly_pension,
        projected_pension_annual_dkk=annual_pension,
        salary_replacement_pct=replacement_pct,
        total_savings_at_retirement_dkk=total_savings,
        coverage_breakdown=coverage,
        total_monthly_premium_dkk=coverage.total,
        contribution_period_years=contribution_years,
        target_replacement_pct=TARGET_REPLACEMENT_PCT,
        gap_to_target_dkk=gap,
        reaches_target=replacement_pct >= TARGET_REPLACEMENT_PCT,
        simulation_id=str(uuid.uuid4()),
        risk_profile_used=req.risk_profile,
    )
