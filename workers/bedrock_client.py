"""
Shared AWS Bedrock client — used by all tool workers that call the LLM.
Handles Converse API calls, OpenSearch vector retrieval, and structured JSON extraction.
"""

import os
import json
import boto3
import logging
import requests
from typing import Optional
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")
EMBED_MODEL_ID = os.getenv("BEDROCK_EMBED_MODEL_ID", "amazon.titan-embed-text-v2:0")
REGION = os.getenv("AWS_REGION", "eu-west-1")

OPENSEARCH_URL = os.getenv("OPENSEARCH_URL", "")          # e.g. https://my-cluster:9200
OPENSEARCH_INDEX = os.getenv("OPENSEARCH_INDEX", "pension-kb")
OPENSEARCH_USERNAME = os.getenv("OPENSEARCH_USERNAME", "")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "")
OPENSEARCH_VECTOR_FIELD = os.getenv("OPENSEARCH_VECTOR_FIELD", "embedding")
OPENSEARCH_TEXT_FIELD = os.getenv("OPENSEARCH_TEXT_FIELD", "text")


def get_bedrock_client():
    return boto3.client("bedrock-runtime", region_name=REGION)


def _embed(text: str) -> list[float]:
    client = get_bedrock_client()
    response = client.invoke_model(
        modelId=EMBED_MODEL_ID,
        body=json.dumps({"inputText": text}),
        contentType="application/json",
        accept="application/json",
    )
    return json.loads(response["body"].read())["embedding"]


def _opensearch_request(method: str, path: str, body: dict) -> dict:
    url = f"{OPENSEARCH_URL.rstrip('/')}/{path}"
    auth = (
        HTTPBasicAuth(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD)
        if OPENSEARCH_USERNAME
        else None
    )
    response = requests.request(
        method,
        url,
        json=body,
        auth=auth,
        headers={"Content-Type": "application/json"},
        timeout=10,
        verify=True,
    )
    response.raise_for_status()
    return response.json()


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
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


def query_knowledge_base(query: str, n_results: int = 5) -> str:
    """
    Retrieve-and-generate against a self-managed OpenSearch cluster.

    Steps:
      1. Embed the query via Bedrock embedding model.
      2. k-NN vector search against the OpenSearch index.
      3. Synthesise a grounded answer via Claude using the retrieved chunks.
    """
    if not OPENSEARCH_URL:
        logger.warning("OPENSEARCH_URL not set — returning placeholder KB response")
        return f"[KB not configured] Query: {query}"

    # 1. Embed
    try:
        vector = _embed(query)
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return f"[Embedding error] {e}"

    # 2. k-NN search
    search_body = {
        "size": n_results,
        "query": {
            "knn": {
                OPENSEARCH_VECTOR_FIELD: {
                    "vector": vector,
                    "k": n_results,
                }
            }
        },
        "_source": [OPENSEARCH_TEXT_FIELD, "title", "source"],
    }

    try:
        result = _opensearch_request(
            "POST",
            f"{OPENSEARCH_INDEX}/_search",
            search_body,
        )
    except Exception as e:
        logger.error(f"OpenSearch query failed: {e}")
        return f"[OpenSearch error] {e}"

    hits = result.get("hits", {}).get("hits", [])
    if not hits:
        return "No relevant product information found for your query."

    # 3. Synthesise answer with Claude
    chunks = "\n\n---\n\n".join(
        hit["_source"].get(OPENSEARCH_TEXT_FIELD, "") for hit in hits
    )
    system = (
        "You are a Danica Pension product expert. "
        "Answer the user's question using ONLY the provided knowledge base excerpts. "
        "Be concise and cite the source where relevant. "
        "If the excerpts do not contain enough information, say so clearly."
    )
    user_message = f"QUESTION: {query}\n\nKNOWLEDGE BASE EXCERPTS:\n{chunks}"
    return invoke_llm(system_prompt=system, user_message=user_message, temperature=0.1)
