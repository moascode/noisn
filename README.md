# Danica Pension Configurator

Self-serve pension configurator — Camunda 8 + AWS Bedrock + Python.

## Project Structure

```
danica/
├── bpmn/                  # Camunda process model (deploy to your cluster)
│   └── pension-configurator.bpmn
├── api/                   # FastAPI calculator service
│   ├── main.py
│   ├── calculators.py
│   ├── models.py
│   └── requirements.txt
├── workers/               # Zeebe job workers (one per tool)
│   ├── main.py            # Worker runner — starts all workers
│   ├── tools/
│   │   ├── ask_question.py
│   │   ├── store_answer.py
│   │   ├── check_eligibility.py
│   │   ├── assess_sufficiency.py
│   │   ├── signal_complete.py
│   │   ├── parse_intent.py
│   │   ├── update_parameter.py
│   │   ├── run_simulation.py
│   │   ├── get_simulation_result.py
│   │   ├── explain_delta.py
│   │   └── query_knowledge_base.py
│   ├── bedrock_client.py  # Shared Bedrock wrapper
│   ├── camunda_client.py  # Shared Camunda REST helper
│   ├── prompts.py         # All system + user prompt templates
│   └── requirements.txt
└── ui/                    # React frontend
    └── src/
        └── App.jsx

```

## Quick Start

### 1. Deploy the BPMN
- Open Camunda Web Modeler
- Import `bpmn/pension-configurator.bpmn`
- Deploy to your cluster

### 2. Start the Calculator API
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 3. Start the Zeebe Workers
```bash
cd workers
pip install -r requirements.txt

# Set env vars
export ZEEBE_ADDRESS=your-cluster.zeebe.camunda.io:443
export ZEEBE_CLIENT_ID=your-client-id
export ZEEBE_CLIENT_SECRET=your-client-secret
export AWS_REGION=eu-west-1
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
export BEDROCK_KB_ID=your-knowledge-base-id
export CALCULATOR_API_URL=http://localhost:8001

python main.py
```

### 4. Start the UI
```bash
cd ui
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `ZEEBE_ADDRESS` | Camunda cluster Zeebe gRPC address |
| `ZEEBE_CLIENT_ID` | Camunda API client ID |
| `ZEEBE_CLIENT_SECRET` | Camunda API client secret |
| `AWS_REGION` | AWS region (eu-west-1) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `BEDROCK_MODEL_ID` | Bedrock model ID |
| `BEDROCK_KB_ID` | Bedrock Knowledge Base ID |
| `CALCULATOR_API_URL` | Internal URL for calculator API |
| `CAMUNDA_REST_URL` | Camunda REST API base URL |
| `CAMUNDA_REST_TOKEN` | Camunda REST API OAuth token |
