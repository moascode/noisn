"""
Shared AWS Bedrock client — used by all tool workers that call the LLM.
Handles Converse API calls, Knowledge Base retrieval, and structured JSON extraction.
"""

import os
import json
import boto3
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
KB_ID = os.getenv("BEDROCK_KB_ID", "")
REGION = os.getenv("AWS_REGION", "eu-west-1")


def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=REGION)


def get_bedrock_agent_client():
    return boto3.client("bedrock-agent-runtime", region_name=REGION)


def invoke_llm(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.3,
    max_tokens: int = 1024,
    conversation_history: Optional[list] = None,
) -> str:
    """
    Call Bedrock Converse API.
    Returns the text response from the model.
    """
    client = get_bedrock_client()

    messages = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": [{"text": user_message}]})

    response = client.converse(
        modelId=MODEL_ID,
        system=[{"text": system_prompt}],
        messages=messages,
        inferenceConfig={
            "temperature": temperature,
            "maxTokens": max_tokens,
        },
    )

    output = response["output"]["message"]["content"][0]["text"]
    logger.debug(f"LLM response: {output[:200]}...")
    return output


def invoke_llm_json(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> dict:
    """
    Call Bedrock and parse the response as JSON.
    Strips markdown fences if present.
    """
    raw = invoke_llm(
        system_prompt=system_prompt + "\n\nRESPOND ONLY WITH VALID JSON. No preamble, no markdown fences.",
        user_message=user_message,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    # Strip markdown fences if model added them
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


def query_knowledge_base(query: str, n_results: int = 5) -> str:
    """
    Query Bedrock Knowledge Base using RetrieveAndGenerate.
    Returns a grounded answer based on KB content.
    """
    if not KB_ID:
        logger.warning("BEDROCK_KB_ID not set — returning placeholder KB response")
        return f"[KB not configured] Query: {query}"

    client = get_bedrock_agent_client()
    response = client.retrieve_and_generate(
        input={"text": query},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": KB_ID,
                "modelArn": f"arn:aws:bedrock:{REGION}::foundation-model/{MODEL_ID}",
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "numberOfResults": n_results,
                        "overrideSearchType": "HYBRID",
                    }
                },
            },
        },
    )
    return response["output"]["text"]
