"""
Danica Pension — Calculator API
FastAPI service exposing pension simulation and eligibility endpoints.
Called by Camunda simulation sub-process workers.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

from models import SimulationRequest, SimulationResult, EligibilityRequest, EligibilityResult
from calculators import run_full_simulation, check_eligibility

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Danica Pension Calculator API",
    description="Pension simulation and eligibility calculation service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "danica-calculator-api"}


@app.post("/simulate", response_model=SimulationResult)
def simulate(req: SimulationRequest):
    """
    Run full pension simulation.
    Called by Camunda simulation sub-process.
    Returns projected pension, salary replacement %, and full coverage breakdown.
    """
    logger.info(f"Simulation request: age={req.age}, salary={req.annual_salary}, "
                f"contribution={req.monthly_contribution}, risk={req.risk_profile}")
    try:
        result = run_full_simulation(req)
        logger.info(f"Simulation result: monthly={result.projected_pension_monthly_dkk} DKK, "
                    f"replacement={result.salary_replacement_pct}%")
        return result
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/eligibility", response_model=EligibilityResult)
def eligibility(req: EligibilityRequest):
    """
    Check eligibility for a specific cover type.
    Called by the check_eligibility tool in the intake agent.
    """
    logger.info(f"Eligibility check: age={req.age}, status={req.employment_status}, cover={req.cover_type}")
    result = check_eligibility(req.age, req.employment_status, req.cover_type)
    return EligibilityResult(**result)


@app.get("/products/{product_code}/defaults")
def get_product_defaults(product_code: str):
    """
    Return sensible default configuration for a given product.
    Used to initialise process variables at session start.
    """
    defaults = {
        "DANICA_BALANCE": {
            "risk_profile": "MEDIUM",
            "payout_type": "ANNUITY",
            "earning_capacity_cover_end_age": 65,
            "critical_illness_tier": "NONE",
            "life_insurance_enabled": False,
            "partner_life_insurance_enabled": False,
            "health_insurance_modules": ["BASIC", "MODULE_1"],
            "children_health_enabled": False,
            "monthly_contribution": 3000,
        },
        "DANICA_LINK": {
            "risk_profile": "HIGH",
            "payout_type": "ANNUITY",
            "earning_capacity_cover_end_age": 65,
            "critical_illness_tier": "NONE",
            "life_insurance_enabled": False,
            "partner_life_insurance_enabled": False,
            "health_insurance_modules": ["BASIC", "MODULE_1"],
            "children_health_enabled": False,
            "monthly_contribution": 3000,
        },
    }
    if product_code not in defaults:
        raise HTTPException(status_code=404, detail=f"Unknown product: {product_code}")
    return defaults[product_code]
