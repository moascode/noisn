"""
Danica Pension — Worker Runner
Starts all Zeebe job workers and keeps them running.
Run: python main.py
"""

import asyncio
import logging
import sys
import os

# Add parent to path
sys.path.insert(0, os.path.dirname(__file__))

from tools.workers import worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    logger.info("Starting Danica Pension Zeebe workers...")
    logger.info(f"Connecting to: {os.getenv('ZEEBE_CLUSTER_ID')}.zeebe.camunda.io")
    logger.info(f"Bedrock model: {os.getenv('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0')}")
    logger.info(f"Calculator API: {os.getenv('CALCULATOR_API_URL', 'http://localhost:8001')}")

    registered = [
        "init-session",
        "tool-ask-question", "tool-store-answer",
        "tool-check-eligibility", "tool-assess-sufficiency",
        "tool-signal-complete", "tool-parse-intent",
        "tool-update-parameter", "tool-run-simulation",
        "tool-get-simulation-result", "tool-explain-delta",
        "tool-query-kb", "compile-report", "deliver-report",
    ]
    logger.info(f"Workers registered: {', '.join(registered)}")

    await worker.work()


if __name__ == "__main__":
    asyncio.run(main())
