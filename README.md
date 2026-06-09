# Danica Pension Configurator

AI-powered pension recommender — Camunda 8 + AWS Bedrock + Spring Boot + React.

The system collects a full customer profile through conversation, recommends the best-suited Danica product, and presents a live simulation report — all orchestrated via the Camunda AI Agent Connector rather than custom LLM code.

## Project Structure

```
noisn/
├── bpmn/
│   ├── pension-configurator.bpmn      # Active: AI Agent Connector recommender design
│   └── pension-configurator-v1.bpmn   # Archived: previous polling/worker design
├── broker/                            # Spring Boot WebSocket session broker
│   ├── src/main/java/com/danica/broker/
│   ├── pom.xml
│   └── Dockerfile
├── workers-java/                      # Spring Boot Zeebe job workers
│   ├── src/main/java/com/danica/workers/
│   ├── pom.xml
│   └── Dockerfile
├── api/                               # FastAPI calculator service (Python)
│   ├── main.py
│   ├── calculators.py
│   └── Dockerfile
├── ui/                                # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   └── hooks/useSessionSocket.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── docs/architecture/                 # Architecture docs and implementation plan
```

## Architecture

```
React UI ←→ WebSocket ←→ Session Broker ←→ Camunda (BPMN + AI Agent Connector)
                                                         ↕                   ↕
                                                  Job Workers          AWS Bedrock
                                               (send-to-ui,           (Claude 3.5
                                                update-profile,         Sonnet +
                                                run-simulation,         KB)
                                                search-kb)
                                                    ↕
                                             Calculator API
```

**Key design shift:** The system is a *recommender* (agent collects full customer profile → recommends best Danica product) rather than a *configurator* (customer picks product first). The live report builds progressively in three sections: Customer Profile, Existing Coverage, and Recommended Product.

## Quick Start

### Prerequisites

- Java 17+ and Maven
- Node.js 18+ and npm
- Python 3.11+ (for calculator API)
- Camunda 8 Cloud cluster (8.8+)
- AWS account with Bedrock access (Claude 3.5 Sonnet + Knowledge Base)

### 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your Camunda and AWS credentials
```

### 2. Deploy the BPMN

Import `bpmn/pension-configurator.bpmn` into Camunda Web Modeler and deploy to your cluster.

### 3. Start all services with Docker Compose

```bash
docker-compose up --build
```

Or start individually in this order: `api` → `workers-java` → `broker` → `ui`

### 4. Manual startup (development)

```bash
# Calculator API
cd api && pip install -r requirements.txt && uvicorn main:app --port 8001

# Job workers
cd workers-java && mvn spring-boot:run

# Session broker
cd broker && mvn spring-boot:run

# React UI
cd ui && npm install && npm run dev
```

Open `http://localhost:5173` — the UI connects automatically via WebSocket.

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `CAMUNDA_REST_URL` | broker | Camunda REST API base URL |
| `CAMUNDA_REST_TOKEN` | broker | Bearer token for Camunda REST API |
| `PROCESS_DEFINITION_KEY` | broker | BPMN process ID (default: `pension-configurator`) |
| `ZEEBE_ADDRESS` | workers-java | Zeebe gRPC address |
| `ZEEBE_CLIENT_ID` | workers-java | Camunda client ID |
| `ZEEBE_CLIENT_SECRET` | workers-java | Camunda client secret |
| `BROKER_INTERNAL_URL` | workers-java | Session Broker internal URL (default: `http://localhost:3001`) |
| `CALCULATOR_API_URL` | workers-java | Calculator API URL (default: `http://localhost:8001`) |
| `AWS_REGION` | workers-java | AWS region for Bedrock (default: `eu-west-1`) |
| `AWS_ACCESS_KEY_ID` | workers-java | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | workers-java | AWS credentials |
| `BEDROCK_KB_ID` | workers-java | Bedrock Knowledge Base ID |
| `VITE_BROKER_WS_URL` | ui | WebSocket URL (default: `ws://localhost:3001`) |

AWS credentials for the **AI Agent Connector** (LLM calls) are configured as Camunda secrets, not in Spring Boot.

## Services

### Session Broker (`broker/`, port 3001)

Spring Boot WebSocket server. Maps browser connections to Camunda process instances.

- **WebSocket** `/ws` — accepts `start_session`, `user_message`, `resume_session` frames
- **HTTP** `POST /internal/send` — called by `send-to-ui` worker to push frames to the browser

### Job Workers (`workers-java/`)

Four Zeebe `@JobWorker` beans — pure tool implementations, zero LLM logic:

| Worker | Type | Action |
|---|---|---|
| `SendToUiWorker` | `send-to-ui` | POSTs frame to broker's `/internal/send` |
| `UpdateProfileWorker` | `update-profile` | Merges profile/coverage fields into process variables |
| `RunSimulationWorker` | `run-simulation` | Calls Calculator API `/simulate` |
| `SearchKbWorker` | `search-kb` | Queries Bedrock Knowledge Base |

### Calculator API (`api/`, port 8001)

Python FastAPI service. Endpoints: `POST /simulate`, `POST /eligibility`, `GET /products/{code}/defaults`.

### React UI (`ui/`, port 5173 dev / 80 container)

WebSocket client using `useSessionSocket` hook. Live report panel with three progressive sections:
- **Customer Profile** — populated via `profile_update` frames
- **Existing Coverage** — populated via `existing_update` frames  
- **Recommended Product** — populated via `recommendation` and `report` frames

## Running Tests

```bash
# Broker integration tests
cd broker && mvn test

# Workers unit tests
cd workers-java && mvn test
```

## Observability

- **Camunda Operate** — view running process instances, `agentContext.metrics` (token counts)
- **Broker logs** — structured per-session events (`sessionId`, `processInstanceKey`)
- **Spring Actuator** — `http://localhost:3001/actuator/health`

For full architecture details, see `docs/architecture/architecture.md`.
