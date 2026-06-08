"""
Camunda REST API helper — used by workers that need to read/write process variables
or trigger messages outside the normal job worker pattern.
"""

import os
import requests
import logging

logger = logging.getLogger(__name__)

CAMUNDA_REST_URL = os.getenv("CAMUNDA_REST_URL", "")
CAMUNDA_REST_TOKEN = os.getenv("CAMUNDA_REST_TOKEN", "")


def _headers():
    return {
        "Authorization": f"Bearer {CAMUNDA_REST_TOKEN}",
        "Content-Type": "application/json",
    }


def get_process_variables(process_instance_key: str) -> dict:
    """Fetch all variables for a process instance."""
    url = f"{CAMUNDA_REST_URL}/v1/process-instances/{process_instance_key}/variables"
    resp = requests.get(url, headers=_headers(), timeout=10)
    resp.raise_for_status()
    return {k: v["value"] for k, v in resp.json().items()}


def set_process_variable(process_instance_key: str, name: str, value) -> None:
    """Set a single variable on a process instance."""
    url = f"{CAMUNDA_REST_URL}/v1/process-instances/{process_instance_key}/variables/{name}"
    payload = {"value": value}
    resp = requests.put(url, json=payload, headers=_headers(), timeout=10)
    resp.raise_for_status()


def send_message(message_name: str, correlation_key: str, variables: dict = None) -> None:
    """Publish a message to correlate with a waiting process."""
    url = f"{CAMUNDA_REST_URL}/v1/messages"
    payload = {
        "messageName": message_name,
        "correlationKey": correlation_key,
        "variables": variables or {},
    }
    resp = requests.post(url, json=payload, headers=_headers(), timeout=10)
    resp.raise_for_status()
