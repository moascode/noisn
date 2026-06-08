"""
Danica Pension — All Zeebe Job Workers
One file per tool, collected here for clarity.
Each worker handles one tool type from the ad-hoc sub-process.
"""

import os
import json
import logging
import requests
from pyzeebe import ZeebeWorker, Job, create_camunda_cloud_channel

from bedrock_client import invoke_llm, invoke_llm_json, query_knowledge_base as kb_query
from camunda_client import get_process_variables, set_process_variable
from prompts import (
    INTENT_SYSTEM_PROMPT, build_intent_user_prompt,
    DELTA_SYSTEM_PROMPT, build_delta_user_prompt,
    SUFFICIENCY_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)

CALCULATOR_API = os.getenv("CALCULATOR_API_URL", "http://localhost:8001")


# ─── CHANNEL + WORKER SETUP ──────────────────────────────────────────────────
def create_worker() -> ZeebeWorker:
    channel = create_camunda_cloud_channel(
        client_id=os.getenv("ZEEBE_CLIENT_ID"),
        client_secret=os.getenv("ZEEBE_CLIENT_SECRET"),
        cluster_id=os.getenv("ZEEBE_CLUSTER_ID"),
        region=os.getenv("ZEEBE_REGION", "bru-2"),
    )
    return ZeebeWorker(channel)


worker = create_worker()


# ─── INIT SESSION ─────────────────────────────────────────────────────────────
@worker.task(task_type="init-session", timeout_ms=10_000)
async def init_session(job: Job):
    """Initialise session variables with defaults."""
    from datetime import datetime, timezone

    variables = job.variables
    product_code = variables.get("productCode", "DANICA_BALANCE")

    # Fetch product defaults from calculator API
    try:
        resp = requests.get(f"{CALCULATOR_API}/products/{product_code}/defaults", timeout=5)
        defaults = resp.json() if resp.ok else {}
    except Exception:
        defaults = {}

    await job.set_success_status(variables={
        "productCode": product_code,
        "consentGiven": variables.get("consentGiven", True),
        "sessionStartedAt": datetime.now(timezone.utc).isoformat(),
        "sufficiencyScore": 0,
        "simulationRunCount": 0,
        "simulationHistory": [],
        "eligibilityFlags": {},
        "incomingUserMessage": "",
        "lastIntentParsed": {"intent": "NONE"},
        # Config defaults
        "monthlyContribution": defaults.get("monthly_contribution", 3000),
        "riskProfile": defaults.get("risk_profile", "MEDIUM"),
        "payoutType": defaults.get("payout_type", "ANNUITY"),
        "earningCapacityCoverEndAge": defaults.get("earning_capacity_cover_end_age", 65),
        "criticalIllnessTier": defaults.get("critical_illness_tier", "NONE"),
        "lifeInsuranceEnabled": defaults.get("life_insurance_enabled", False),
        "partnerLifeInsuranceEnabled": defaults.get("partner_life_insurance_enabled", False),
        "healthInsuranceModules": defaults.get("health_insurance_modules", ["BASIC", "MODULE_1"]),
        "childrenHealthEnabled": defaults.get("children_health_enabled", False),
        # Profile defaults (null until collected)
        "age": None,
        "annualSalary": None,
        "employmentStatus": "EMPLOYED",
        "desiredRetirementAge": None,
        "hasPartner": None,
        "hasDependants": None,
        "housingType": None,
        "homeEquityDKK": 0,
        "otherSavingsDKK": 0,
    })


# ─── TOOL: ASK QUESTION ───────────────────────────────────────────────────────
@worker.task(task_type="tool-ask-question", timeout_ms=30_000)
async def tool_ask_question(job: Job):
    """
    Deliver a question to the user via the UI.
    In production this publishes to a message broker / SSE stream.
    Here we store the question in a process variable for the UI to poll.
    """
    variables = job.variables
    question = variables.get("question", "")
    question_key = variables.get("questionKey", "")
    input_hint = variables.get("inputHint", "")

    logger.info(f"Asking question [{question_key}]: {question}")

    # The UI polls 'pendingQuestion' variable — clear after user answers
    await job.set_success_status(variables={
        "pendingQuestion": {
            "text": question,
            "key": question_key,
            "hint": input_hint,
            "answered": False,
        }
    })


# ─── TOOL: STORE ANSWER ───────────────────────────────────────────────────────
@worker.task(task_type="tool-store-answer", timeout_ms=10_000)
async def tool_store_answer(job: Job):
    """
    Parse and store a typed answer into process variables.
    Handles type coercion (string → int, float, bool).
    """
    variables = job.variables
    field = variables.get("field", "")
    raw_value = variables.get("value")

    # Type coercion based on known field types
    int_fields = {"age", "desiredRetirementAge", "earningCapacityCoverEndAge"}
    float_fields = {"annualSalary", "monthlyContribution", "homeEquityDKK", "otherSavingsDKK"}
    bool_fields = {"hasPartner", "hasDependants", "lifeInsuranceEnabled",
                   "partnerLifeInsuranceEnabled", "childrenHealthEnabled"}

    if field in int_fields and raw_value is not None:
        value = int(str(raw_value).replace(",", "").replace(".", "").strip())
    elif field in float_fields and raw_value is not None:
        value = float(str(raw_value).replace(",", "").strip())
    elif field in bool_fields and raw_value is not None:
        if isinstance(raw_value, bool):
            value = raw_value
        else:
            value = str(raw_value).lower() in ("yes", "true", "ja", "1")
    else:
        value = raw_value

    logger.info(f"Storing answer: {field} = {value}")
    await job.set_success_status(variables={field: value, "success": True})


# ─── TOOL: CHECK ELIGIBILITY ─────────────────────────────────────────────────
@worker.task(task_type="tool-check-eligibility", timeout_ms=10_000)
async def tool_check_eligibility(job: Job):
    """Call calculator API eligibility endpoint."""
    variables = job.variables
    payload = {
        "age": variables.get("age", 30),
        "employment_status": variables.get("employmentStatus", "EMPLOYED"),
        "cover_type": variables.get("coverType", "CRITICAL_ILLNESS"),
    }
    try:
        resp = requests.post(f"{CALCULATOR_API}/eligibility", json=payload, timeout=5)
        result = resp.json()
    except Exception as e:
        result = {"eligible": True, "reason": f"Eligibility service unavailable: {e}", "age_limit": None}

    # Update eligibility flags
    existing_flags = job.variables.get("eligibilityFlags", {})
    cover_type = variables.get("coverType", "UNKNOWN")
    existing_flags[cover_type] = result["eligible"]

    await job.set_success_status(variables={
        "eligibilityFlags": existing_flags,
        "eligible": result["eligible"],
        "eligibilityReason": result["reason"],
    })


# ─── TOOL: ASSESS SUFFICIENCY ─────────────────────────────────────────────────
@worker.task(task_type="tool-assess-sufficiency", timeout_ms=30_000)
async def tool_assess_sufficiency(job: Job):
    """Use LLM to assess completeness of collected information."""
    variables = job.variables

    collected = {
        k: variables.get(k)
        for k in ["age", "annualSalary", "employmentStatus", "desiredRetirementAge",
                  "hasPartner", "hasDependants", "housingType", "homeEquityDKK", "otherSavingsDKK"]
        if variables.get(k) is not None
    }

    required = ["age", "annualSalary", "desiredRetirementAge"]

    user_msg = f"""
Collected so far: {json.dumps(collected, indent=2)}
Required fields: {required}
All fields: age, annualSalary, employmentStatus, desiredRetirementAge, hasPartner, hasDependants, housingType, homeEquityDKK, otherSavingsDKK
"""
    try:
        result = invoke_llm_json(SUFFICIENCY_SYSTEM_PROMPT, user_msg)
        score = result.get("score", 0)
    except Exception as e:
        logger.error(f"Sufficiency assessment error: {e}")
        # Fallback: simple field count heuristic
        score = min(100, len(collected) * 11)

    logger.info(f"Sufficiency score: {score}")
    await job.set_success_status(variables={
        "sufficiencyScore": score,
        "readyToSimulate": score >= 80,
    })


# ─── TOOL: SIGNAL COMPLETE ────────────────────────────────────────────────────
@worker.task(task_type="tool-signal-complete", timeout_ms=10_000)
async def tool_signal_complete(job: Job):
    """Signal the sub-process to exit cleanly."""
    variables = job.variables
    exit_reason = variables.get("exitReason", "CONFIRMED")
    final_score = variables.get("finalScore", variables.get("sufficiencyScore", 80))

    logger.info(f"Signal complete: reason={exit_reason}, score={final_score}")
    await job.set_success_status(variables={
        "subprocessComplete": True,
        "exitReason": exit_reason,
    })


# ─── TOOL: PARSE INTENT ───────────────────────────────────────────────────────
@worker.task(task_type="tool-parse-intent", timeout_ms=30_000)
async def tool_parse_intent(job: Job):
    """Parse user's natural language message into structured intent."""
    variables = job.variables
    user_message = variables.get("userMessage", variables.get("incomingUserMessage", ""))

    current_config = {
        "monthlyContribution": variables.get("monthlyContribution"),
        "riskProfile": variables.get("riskProfile"),
        "desiredRetirementAge": variables.get("desiredRetirementAge"),
        "criticalIllnessTier": variables.get("criticalIllnessTier"),
        "lifeInsuranceEnabled": variables.get("lifeInsuranceEnabled"),
    }

    try:
        result = invoke_llm_json(
            INTENT_SYSTEM_PROMPT,
            build_intent_user_prompt(user_message, current_config),
            temperature=0.1,
        )
    except Exception as e:
        logger.error(f"Intent parse error: {e}")
        result = {
            "intent": "UNCLEAR",
            "parameters": {"field": None, "value": None, "unit": None},
            "clarificationNeeded": True,
            "clarifyingQuestion": "I didn't quite understand that. Could you rephrase?",
            "confidence": 0.0,
        }

    logger.info(f"Parsed intent: {result.get('intent')} | field: {result.get('parameters', {}).get('field')}")
    await job.set_success_status(variables={"lastIntentParsed": result})


# ─── TOOL: UPDATE PARAMETER ───────────────────────────────────────────────────
@worker.task(task_type="tool-update-parameter", timeout_ms=10_000)
async def tool_update_parameter(job: Job):
    """Update a single configurable parameter in process variables."""
    variables = job.variables
    field = variables.get("field", "")
    value = variables.get("value")
    previous_value = variables.get(field)

    logger.info(f"Updating parameter: {field} = {value} (was: {previous_value})")

    update = {
        field: value,
        "parameterChangeLog": {
            "field": field,
            "from": previous_value,
            "to": value,
        }
    }
    await job.set_success_status(variables=update)


# ─── TOOL: RUN SIMULATION ─────────────────────────────────────────────────────
@worker.task(task_type="tool-run-simulation", timeout_ms=60_000)
async def tool_run_simulation(job: Job):
    """
    Call the calculator API to run a full simulation.
    Stores results directly — acts as a lightweight simulation runner
    for use within the iterate agent tool loop.
    """
    variables = job.variables

    payload = {
        "age": variables.get("age", 35),
        "annual_salary": variables.get("annualSalary", 500000),
        "desired_retirement_age": variables.get("desiredRetirementAge", 65),
        "employment_status": variables.get("employmentStatus", "EMPLOYED"),
        "monthly_contribution": variables.get("monthlyContribution", 3000),
        "risk_profile": variables.get("riskProfile", "MEDIUM"),
        "payout_type": variables.get("payoutType", "ANNUITY"),
        "earning_capacity_cover_end_age": variables.get("earningCapacityCoverEndAge", 65),
        "critical_illness_tier": variables.get("criticalIllnessTier", "NONE"),
        "life_insurance_enabled": variables.get("lifeInsuranceEnabled", False),
        "partner_life_insurance_enabled": variables.get("partnerLifeInsuranceEnabled", False),
        "health_insurance_modules": variables.get("healthInsuranceModules", ["BASIC", "MODULE_1"]),
        "children_health_enabled": variables.get("childrenHealthEnabled", False),
        "other_savings_dkk": variables.get("otherSavingsDKK", 0),
        "home_equity_dkk": variables.get("homeEquityDKK", 0),
    }

    try:
        resp = requests.post(f"{CALCULATOR_API}/simulate", json=payload, timeout=15)
        resp.raise_for_status()
        result = resp.json()
    except Exception as e:
        logger.error(f"Simulation API error: {e}")
        await job.set_failure_status(message=str(e), max_retries=2)
        return

    # Snapshot previous before overwriting
    previous = {
        "projectedPensionMonthlyDKK": variables.get("projectedPensionMonthlyDKK"),
        "salaryReplacementPct": variables.get("salaryReplacementPct"),
        "totalMonthlyPremiumDKK": variables.get("totalMonthlyPremiumDKK"),
    }

    run_count = variables.get("simulationRunCount", 0) + 1

    # Build history entry
    history = variables.get("simulationHistory", [])
    history.append({
        "runNumber": run_count,
        "inputs": payload,
        "outputs": result,
        "changedParameter": variables.get("parameterChangeLog", {}).get("field"),
    })

    await job.set_success_status(variables={
        "projectedPensionMonthlyDKK": result["projected_pension_monthly_dkk"],
        "projectedPensionAnnualDKK": result["projected_pension_annual_dkk"],
        "salaryReplacementPct": result["salary_replacement_pct"],
        "totalMonthlyPremiumDKK": result["total_monthly_premium_dkk"],
        "coverageBreakdown": result["coverage_breakdown"],
        "reachesTarget": result["reaches_target"],
        "gapToTargetDKK": result["gap_to_target_dkk"],
        "simulationRunCount": run_count,
        "simulationHistory": history,
        "previousSimulationResult": previous,
        "latestSimulationId": result["simulation_id"],
    })


# ─── TOOL: GET SIMULATION RESULT ─────────────────────────────────────────────
@worker.task(task_type="tool-get-simulation-result", timeout_ms=10_000)
async def tool_get_simulation_result(job: Job):
    """Return latest simulation results from current process variables."""
    variables = job.variables
    result = {
        "projectedPensionMonthlyDKK": variables.get("projectedPensionMonthlyDKK"),
        "projectedPensionAnnualDKK": variables.get("projectedPensionAnnualDKK"),
        "salaryReplacementPct": variables.get("salaryReplacementPct"),
        "totalMonthlyPremiumDKK": variables.get("totalMonthlyPremiumDKK"),
        "coverageBreakdown": variables.get("coverageBreakdown"),
        "reachesTarget": variables.get("reachesTarget"),
        "gapToTargetDKK": variables.get("gapToTargetDKK"),
        "simulationRunCount": variables.get("simulationRunCount"),
    }
    await job.set_success_status(variables={"currentSimulationResult": result})


# ─── TOOL: EXPLAIN DELTA ─────────────────────────────────────────────────────
@worker.task(task_type="tool-explain-delta", timeout_ms=30_000)
async def tool_explain_delta(job: Job):
    """Generate plain-language explanation of what changed between simulation runs."""
    variables = job.variables
    previous = variables.get("previousSimulationResult", {})
    current = {
        "projectedPensionMonthlyDKK": variables.get("projectedPensionMonthlyDKK"),
        "salaryReplacementPct": variables.get("salaryReplacementPct"),
        "totalMonthlyPremiumDKK": variables.get("totalMonthlyPremiumDKK"),
    }

    change_log = variables.get("parameterChangeLog", {})
    changed_param = change_log.get("field", "configuration")
    from_val = change_log.get("from", "previous value")
    to_val = change_log.get("to", "new value")

    if not previous or not previous.get("projectedPensionMonthlyDKK"):
        explanation = (
            f"Your initial simulation shows a projected monthly pension of "
            f"DKK {current.get('projectedPensionMonthlyDKK', 0):,.0f}, "
            f"representing {current.get('salaryReplacementPct', 0)}% salary replacement. "
            f"{'You have reached the 80% target.' if variables.get('reachesTarget') else 'This is below the 80% target — consider increasing your monthly contribution.'}"
        )
    else:
        try:
            explanation = invoke_llm(
                DELTA_SYSTEM_PROMPT,
                build_delta_user_prompt(previous, current, changed_param, from_val, to_val),
                temperature=0.5,
                max_tokens=300,
            )
        except Exception as e:
            logger.error(f"Delta explanation error: {e}")
            monthly_diff = (current.get("projectedPensionMonthlyDKK", 0) or 0) - (previous.get("projectedPensionMonthlyDKK", 0) or 0)
            explanation = f"After changing {changed_param} to {to_val}, your monthly pension {'increased' if monthly_diff >= 0 else 'decreased'} by DKK {abs(monthly_diff):,.0f}."

    logger.info(f"Delta explanation generated: {explanation[:100]}...")
    await job.set_success_status(variables={"aiExplanation": explanation})


# ─── TOOL: QUERY KNOWLEDGE BASE ──────────────────────────────────────────────
@worker.task(task_type="tool-query-kb", timeout_ms=30_000)
async def tool_query_kb(job: Job):
    """Query Bedrock Knowledge Base for product information."""
    variables = job.variables
    query = variables.get("query", "")
    product_code = variables.get("productCode", "DANICA_BALANCE")

    enriched_query = f"[Product: {product_code}] {query}"

    try:
        answer = kb_query(enriched_query)
    except Exception as e:
        logger.error(f"KB query error: {e}")
        answer = f"I couldn't retrieve that information right now. Please check the Danica website or contact an advisor for details about {query}."

    await job.set_success_status(variables={"kbAnswer": answer})


# ─── COMPILE REPORT ───────────────────────────────────────────────────────────
@worker.task(task_type="compile-report", timeout_ms=30_000)
async def compile_report(job: Job):
    """Compile the final report dossier from all process variables."""
    variables = job.variables

    report = {
        "reportId": f"DANICA-{variables.get('processInstanceKey', 'UNKNOWN')[:8].upper()}",
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat(),
        "product": variables.get("productCode"),
        "userProfile": {
            "age": variables.get("age"),
            "annualSalary": variables.get("annualSalary"),
            "employmentStatus": variables.get("employmentStatus"),
            "desiredRetirementAge": variables.get("desiredRetirementAge"),
            "hasPartner": variables.get("hasPartner"),
            "hasDependants": variables.get("hasDependants"),
        },
        "finalConfiguration": {
            "monthlyContribution": variables.get("monthlyContribution"),
            "riskProfile": variables.get("riskProfile"),
            "payoutType": variables.get("payoutType"),
            "criticalIllnessTier": variables.get("criticalIllnessTier"),
            "lifeInsuranceEnabled": variables.get("lifeInsuranceEnabled"),
            "healthInsuranceModules": variables.get("healthInsuranceModules"),
        },
        "finalSimulation": {
            "projectedPensionMonthlyDKK": variables.get("projectedPensionMonthlyDKK"),
            "projectedPensionAnnualDKK": variables.get("projectedPensionAnnualDKK"),
            "salaryReplacementPct": variables.get("salaryReplacementPct"),
            "totalMonthlyPremiumDKK": variables.get("totalMonthlyPremiumDKK"),
            "coverageBreakdown": variables.get("coverageBreakdown"),
            "reachesTarget": variables.get("reachesTarget"),
        },
        "simulationHistory": variables.get("simulationHistory", []),
        "totalSimulationRuns": variables.get("simulationRunCount", 0),
    }

    await job.set_success_status(variables={"finalReport": report})


# ─── DELIVER REPORT ───────────────────────────────────────────────────────────
@worker.task(task_type="deliver-report", timeout_ms=10_000)
async def deliver_report(job: Job):
    """Mark report as ready for delivery. UI polls for this flag."""
    variables = job.variables
    logger.info(f"Report ready for delivery: {variables.get('finalReport', {}).get('reportId')}")
    await job.set_success_status(variables={"reportReady": True, "reportDeliveredAt": __import__("datetime").datetime.utcnow().isoformat()})
