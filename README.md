# Danica Pension Configurator

Self-serve pension configurator — Camunda 8 + AWS Bedrock + Spring Boot.

Event-driven architecture: Camunda orchestrates BPMN process, Bedrock provides AI (Claude 3.5 Sonnet), Spring Boot implements calculator API, job workers, and WebSocket session broker.

## Project Structure

```
noisn/
├── bpmn/                  # Camunda BPMN process model
│   └── pension-configurator.bpmn
├── api/                   # Spring Boot calculator service (REST)
│   ├── src/main/java/com/danica/calculator/
│   ├── pom.xml
│   └── application.yml
├── workers/               # Spring Boot Zeebe job workers
│   ├── src/main/java/com/danica/workers/
│   ├── pom.xml
│   └── application.yml
├── ui/                    # React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── docs/                  # Architecture documentation
    ├── architecture.html  # Visual architecture diagram (open in browser)
    └── danica-solution-design-v2.jsx  # Detailed design reference

```

## Tech Stack

- **Orchestration:** Camunda 8 (Zeebe) — BPMN process engine, process variables, gRPC job distribution
- **AI/LLM:** AWS Bedrock (Claude 3.5 Sonnet) — called directly by Camunda AI Agent Connector
- **Backend:** Spring Boot 3.x with Camunda Zeebe Spring Boot Starter
  - `api/` — Spring MVC calculator service
  - `workers/` — @ZeebeWorker job implementations
  - WebSocket broker for real-time UI updates (spring-websocket + STOMP)
- **Frontend:** React 18 + Vite
- **Knowledge Base:** Bedrock Knowledge Base (vector-indexed product docs, hybrid search)

## Quick Start

### 1. Prerequisites

- Java 17+ and Maven (for Spring Boot)
- Node.js 18+ and npm (for React UI)
- Camunda 8 Cloud cluster (SaaS) or self-hosted
- AWS account with Bedrock access (Claude 3.5 Sonnet model + Knowledge Base)

### 2. Deploy the BPMN

```bash
# Via Camunda Web Modeler:
# - Import bpmn/pension-configurator.bpmn
# - Deploy to your cluster
```

### 3. Build and Start Spring Boot Services

```bash
# Build calculator API
cd api
mvn clean package
mvn spring-boot:run

# In another terminal, build and start job workers
cd workers
mvn clean package
mvn spring-boot:run
```

Both services read from `.env` or `application.yml` (see Environment Variables below).

### 4. Start the React UI

```bash
cd ui
npm install
npm run dev
```

UI will connect via WebSocket to Spring Boot broker (default: `ws://localhost:8080/ws`).

## Environment Variables

Spring Boot services read from `.env` file or `application.yml`. Camunda credentials are required for both API and workers.

| Variable | Service | Description |
|---|---|---|
| `ZEEBE_ADDRESS` | workers, api | Camunda Zeebe gRPC address (e.g., `your-cluster.zeebe.camunda.io:443`) |
| `ZEEBE_CLIENT_ID` | workers, api | Camunda client ID |
| `ZEEBE_CLIENT_SECRET` | workers, api | Camunda client secret |
| `CAMUNDA_REST_URL` | api, workers | Camunda REST API base URL (e.g., `https://your-cluster.camunda.io/api`) |
| `CAMUNDA_REST_TOKEN` | api, workers | Camunda REST API OAuth token |
| `SPRING_WEBSOCKET_PORT` | api | WebSocket broker port (default: 8080) |
| `CALCULATOR_API_URL` | workers | Internal calculator API URL (default: `http://localhost:8001`) |

**AWS/Bedrock credentials:** Configured in Camunda as connector properties (not in Spring Boot).
- `AWS_REGION` — where Bedrock cluster operates
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — IAM role for Camunda connector only
- `BEDROCK_MODEL_ID` — Claude model ID (e.g., `anthropic.claude-3-5-sonnet-20241022-v2:0`)
- `BEDROCK_KB_ID` — Knowledge Base ID

## Architecture Overview

**Layers:**
1. **Presentation:** React UI with WebSocket client (STOMP protocol)
2. **Session Broker:** Spring Boot WebSocket broker routes messages between UI and Camunda
3. **Orchestration:** Camunda 8 BPMN process (pension-configurator.bpmn)
   - AI Agent Connector (element template) calls Bedrock directly
   - Manages all session state as process variables
4. **Workers:** Spring Boot @ZeebeWorker implementations (ask-question, store-answer, run-simulation, etc.)
5. **Calculator:** Spring Boot REST API (/simulate, /eligibility, /products/{code}/defaults)
6. **LLM & Knowledge:** AWS Bedrock Claude + Knowledge Base (called by Camunda, not Spring Boot)

**Data Flow:**
- React sends user input → WebSocket → Spring Broker → Camunda REST API
- Camunda job task created → Spring Worker subscribes via Zeebe gRPC → executes tool → writes results
- Camunda AI Agent Sub-process → calls Bedrock directly → processes tool outcomes
- Results written to process variables → pushed via WebSocket to React

For detailed architecture diagram, open `docs/architecture.html` in your browser.

## Development

### Running Tests

```bash
# Spring Boot services
mvn test

# React UI
npm test
```

### Code Structure

- `api/src/main/java/com/danica/calculator/` — Calculator logic, eligibility rules
- `workers/src/main/java/com/danica/workers/` — Zeebe worker implementations (@ZeebeWorker beans)
- `ui/src/` — React components (chat, report, gauge, etc.)

### Debugging

- **Camunda Operate:** https://your-cluster.camunda.io/operate — view running process instances and variables
- **Spring logs:** Set `logging.level.com.danica=DEBUG` in application.yml
- **React DevTools:** Browser React extension for component inspection

## Deployment

See `docs/danica-delivery-plan.jsx` for full go-live checklist including:
- Auth integration (OAuth2 with Camunda)
- PDF report generation
- Monitoring and alerting
- GDPR compliance (right-to-erasure, audit trails)
- Load testing and hardening
