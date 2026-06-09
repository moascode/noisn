# Implementation Plan

## Overview

Migration from the existing REST-polling + custom Python LLM orchestration to the WebSocket + Camunda AI Agent Connector architecture. The plan is structured in five phases that can each be delivered and tested independently.

**Total estimated effort:** 8–12 days for a single developer familiar with the codebase.

---

## Phase 0: Prerequisites and Setup (0.5 days)

Before writing any code, verify the environment is ready.

### 0.1 Confirm Camunda connector availability
- Log in to Camunda Console → Check that `agenticai-aiagent-job-worker` element template is available in the Web Modeler
- Verify cluster version is 8.8+
- If self-managed: deploy the `agentic-ai` connector JAR to the connector runtime

### 0.2 Create the feature branch
```bash
git checkout -b feature/websocket-camunda-ai-connector
```

### 0.3 Validate Bedrock credentials work from element template
- Create a minimal test BPMN with just the AI Agent Connector and the AWS Bedrock provider
- Configure with `anthropic.claude-3-5-sonnet-20241022-v2:0`
- Run a one-shot "echo this back" test to confirm auth works via the connector (not the custom Python client)

---

## Phase 1: Session Broker (2 days)

The Session Broker is the new infrastructure component. Build and test it in isolation before touching anything else.

### 1.1 Scaffold the broker service

Create `broker/` directory as a Spring Boot project:

```
broker/
├── src/main/java/com/danica/broker/
│   ├── BrokerApplication.java        # Spring Boot entry point
│   ├── ws/
│   │   ├── WebSocketConfig.java      # @EnableWebSocketMessageBroker
│   │   ├── SessionWebSocketHandler.java  # WebSocket frame handler
│   │   └── SessionStore.java         # ConcurrentHashMap: sessionId → {ws, processInstanceKey, state}
│   ├── camunda/
│   │   └── CamundaClient.java        # REST wrapper: createProcessInstance, publishMessage
│   └── api/
│       └── SendController.java       # Internal POST /send endpoint
├── pom.xml
└── application.yml
```

### 1.2 Implement `SessionWebSocketHandler.java`

WebSocket handler using `spring-websocket`:

```java
// On connection: assign sessionId (UUID), register in SessionStore
// On start_session frame: call CamundaClient.createProcessInstance → store PIK in SessionStore
// On user_message frame: call CamundaClient.publishMessage(user_input_received, PIK, vars)
// On resume_session frame: re-associate WebSocketSession with existing PIK
// On close: mark session disconnected (do NOT delete — Camunda process still alive)
```

Key events to handle:
- `start_session` → `createProcessInstance` → store mapping
- `user_message` → `publishMessage`
- `resume_session` → re-associate WebSocketSession
- keepalive via Spring's built-in heartbeat

### 1.3 Implement `SendController.java` — internal send endpoint

```java
// POST /internal/send
// Body: { processInstanceKey, messageType, payload }
// Looks up WebSocketSession in SessionStore, sends JSON frame
// Returns 200 if delivered, 404 if session not found, 503 if socket closed
```

This is the endpoint that the `send-to-ui` job worker calls.

### 1.4 Implement `CamundaClient.java`

```java
// Uses Spring's RestTemplate or WebClient
//
// createProcessInstance(processDefinitionKey, Map<String,Object> variables)
//   POST {CAMUNDA_REST_URL}/v2/process-instances
//   Auth: Bearer token from application.yml
//
// publishMessage(String messageName, String correlationKey, Map<String,Object> variables)
//   POST {CAMUNDA_REST_URL}/v2/messages/publication
```

### 1.5 Add environment variables (`application.yml`)

```yaml
camunda:
  rest-url: https://...
  rest-token: ...        # or configure OAuth2 client credentials
  process-definition-key: pension-configurator

server:
  port: 3001             # WebSocket + HTTP server port
```

### 1.6 Testing

Write Spring Boot integration tests (`@SpringBootTest`) that:
1. Connect a mock WebSocket client
2. Send `start_session` → verify `processInstanceKey` returned
3. Call `POST /internal/send` → verify WebSocket frame received
4. Send `user_message` → verify `publishMessage` called with correct args (mock Camunda via `@MockBean`)

---

## Phase 2: BPMN Redesign (2 days)

Redesign the process definition to use the AI Agent Connector and message events.

### 2.1 Back up existing BPMN
```bash
cp bpmn/pension-configurator.bpmn bpmn/pension-configurator-v1.bpmn
```

### 2.2 Update BPMN structure

Open `bpmn/pension-configurator.bpmn` in Camunda Web Modeler and make these changes:

**Keep:**
- Start Event
- Init script task (update to set `sessionId` from process variable)
- Overall process flow structure
- Error boundary events

**Replace / Add:**
1. **Remove** all individual service tasks for tool workers (`tool-ask-question`, `tool-store-answer`, `tool-assess-sufficiency`, etc.)
2. **Remove** the intake and iterate sub-process definitions (they were custom orchestration)
3. **Add** a single **ad-hoc sub-process** spanning the main agent interaction
4. **Apply** the `agenticai-aiagent-job-worker` element template to this sub-process
5. **Inside** the ad-hoc sub-process, add three service tasks:
   - `send-to-ui` (task type: `send-to-ui`)
   - `run-simulation` (task type: `run-simulation`)
   - `search-kb` (task type: `search-kb`)
6. **Add** a non-interrupting **Message Intermediate Catch Event** to the sub-process boundary:
   - Message name: `user_input_received`
   - Correlation key expression: `=processInstanceKey`
   - Output variable: `userMessage`

### 2.3 Configure AI Agent Connector element template

In the Web Modeler, configure the ad-hoc sub-process with the AI Agent Connector:

| Property | Value |
|----------|-------|
| Provider | AWS Bedrock |
| Model ID | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| AWS Region | `eu-west-1` |
| Access Key ID | `=secrets.AWS_ACCESS_KEY_ID` |
| Secret Access Key | `=secrets.AWS_SECRET_ACCESS_KEY` |
| System Prompt | See §2.4 |
| User Prompt | `=userMessage` |
| Memory Type | In-process |
| Memory Window | 40 |
| Max Model Calls | 10 |
| Result Variable | `agentResponse` |

### 2.4 Write the system prompt (FEEL expression)

The system prompt must describe the agent's role and all available tools:

```
"You are a pension advisor for Danica Pension. You help customers configure their pension plan through conversation.

You have access to these tools:
- send-to-ui: Send a message to the user. Use messageType 'question' to ask the user something, 'agent_message' for informational responses, 'summary' after running an initial simulation, and 'report' when delivering updated simulation data.
- run-simulation: Run a pension projection. Provide the customer profile fields you have collected.
- search-kb: Look up product information from the Danica knowledge base.

Workflow:
1. Collect the customer's age, annual salary, desired retirement age, and monthly contribution through conversation.
2. Once you have these, run a simulation and send a summary.
3. Continue refining with the customer based on their feedback.
4. When the customer confirms they are satisfied, send a report_final message.

Always ask one question at a time. Match the customer's language (Danish or English)."
```

### 2.5 Tool schema declarations

For each tool task inside the sub-process, the connector needs to know the tool's input schema. This is set via extension properties on each service task:

**send-to-ui schema:**
```json
{
  "name": "send-to-ui",
  "description": "Send a message to the user interface",
  "parameters": {
    "type": "object",
    "properties": {
      "messageType": {"type": "string", "enum": ["question","agent_message","summary","report","report_final"]},
      "content": {"type": "object", "description": "Message payload"}
    },
    "required": ["messageType", "content"]
  }
}
```

**run-simulation schema:**
```json
{
  "name": "run-simulation",
  "description": "Run a pension projection simulation",
  "parameters": {
    "type": "object",
    "properties": {
      "age": {"type": "integer"},
      "annualSalary": {"type": "number"},
      "desiredRetirementAge": {"type": "integer"},
      "monthlyContribution": {"type": "number"},
      "riskProfile": {"type": "string", "enum": ["LOW","MEDIUM","HIGH"]},
      "payoutType": {"type": "string", "enum": ["LUMP_SUM","ANNUITY","LIFE_ANNUITY","COMBINED"]}
    },
    "required": ["age", "annualSalary", "desiredRetirementAge", "monthlyContribution"]
  }
}
```

**search-kb schema:**
```json
{
  "name": "search-kb",
  "description": "Search the Danica knowledge base for product or policy information",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Natural language search query"}
    },
    "required": ["query"]
  }
}
```

### 2.6 Deploy and smoke test BPMN

1. Deploy the updated BPMN via Web Modeler
2. Manually create a process instance via Camunda REST with `userMessage = "Hello"`
3. Verify in Camunda Operate that the ad-hoc sub-process activates and the connector calls Bedrock

---

## Phase 3: Job Workers Migration (1.5 days)

Create the Spring Boot workers project. Workers are pure tool implementations with zero LLM logic — the AI Agent Connector owns the reasoning loop.

### 3.1 Scaffold the workers service

Create `workers/` as a Spring Boot project:

```
workers/
├── src/main/java/com/danica/workers/
│   ├── WorkersApplication.java           # Spring Boot entry point
│   ├── SendToUiWorker.java               # @ZeebeWorker type=send-to-ui
│   ├── RunSimulationWorker.java          # @ZeebeWorker type=run-simulation
│   ├── SearchKbWorker.java               # @ZeebeWorker type=search-kb
│   ├── client/
│   │   ├── BrokerClient.java             # HTTP POST /internal/send to Session Broker
│   │   └── CalculatorClient.java         # HTTP POST /simulate to Calculator API
│   └── kb/
│       └── BedrockKbClient.java          # AWS SDK Java: retrieve_and_generate
├── pom.xml
└── application.yml
```

**`pom.xml` key dependencies:**
```xml
<dependency>
  <groupId>io.camunda.spring</groupId>
  <artifactId>spring-boot-starter-camunda</artifactId>
</dependency>
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>bedrockagentruntime</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

### 3.2 Implement `SendToUiWorker.java`

```java
@Component
public class SendToUiWorker {

    private final BrokerClient brokerClient;

    @ZeebeWorker(type = "send-to-ui", timeout = "PT10S")
    public void handle(JobClient client, ActivatedJob job) {
        Map<String, Object> toolCall = (Map<String, Object>) job.getVariablesAsMap().get("toolCall");
        String processInstanceKey = String.valueOf(job.getProcessInstanceKey());

        String result = brokerClient.send(processInstanceKey,
            (String) toolCall.get("messageType"),
            toolCall.get("content"));

        client.newCompleteCommand(job)
            .variable("toolCallResult", result)
            .send()
            .join();
    }
}
```

**`BrokerClient.java`** calls `POST {BROKER_INTERNAL_URL}/internal/send` with `{ processInstanceKey, messageType, payload }`. Returns `"delivered"` on 200 or `"session_not_connected"` on 404.

### 3.3 Implement `RunSimulationWorker.java`

```java
@Component
public class RunSimulationWorker {

    private final CalculatorClient calculatorClient;

    @ZeebeWorker(type = "run-simulation", timeout = "PT30S")
    public void handle(JobClient client, ActivatedJob job) {
        Map<String, Object> toolCall = (Map<String, Object>) job.getVariablesAsMap().get("toolCall");

        SimulationRequest request = SimulationRequest.builder()
            .age((Integer) toolCall.get("age"))
            .annualSalary(((Number) toolCall.get("annualSalary")).doubleValue())
            .desiredRetirementAge((Integer) toolCall.get("desiredRetirementAge"))
            .monthlyContribution(((Number) toolCall.get("monthlyContribution")).doubleValue())
            .riskProfile((String) toolCall.getOrDefault("riskProfile", "MEDIUM"))
            .payoutType((String) toolCall.getOrDefault("payoutType", "ANNUITY"))
            .build();

        SimulationResult result = calculatorClient.simulate(request);

        client.newCompleteCommand(job)
            .variable("toolCallResult", result.toJson())
            .send()
            .join();
    }
}
```

### 3.4 Implement `SearchKbWorker.java`

```java
@Component
public class SearchKbWorker {

    private final BedrockKbClient kbClient;

    @ZeebeWorker(type = "search-kb", timeout = "PT30S")
    public void handle(JobClient client, ActivatedJob job) {
        Map<String, Object> toolCall = (Map<String, Object>) job.getVariablesAsMap().get("toolCall");
        String query = (String) toolCall.get("query");

        String answer = kbClient.retrieveAndGenerate(query);

        client.newCompleteCommand(job)
            .variable("toolCallResult", answer)
            .send()
            .join();
    }
}
```

**`BedrockKbClient.java`** uses the AWS SDK Java v2 `BedrockAgentRuntimeClient` to call `retrieve_and_generate` with the configured Knowledge Base ID.

### 3.5 Add environment variables (`application.yml`)

```yaml
camunda:
  client:
    zeebe:
      grpc-address: ${ZEEBE_ADDRESS}
    auth:
      client-id: ${ZEEBE_CLIENT_ID}
      client-secret: ${ZEEBE_CLIENT_SECRET}

broker:
  internal-url: ${BROKER_INTERNAL_URL:http://localhost:3001}

calculator:
  api-url: ${CALCULATOR_API_URL:http://localhost:8080}

aws:
  region: ${AWS_REGION:eu-west-1}
  bedrock-kb-id: ${BEDROCK_KB_ID}
```

### 3.6 Delete obsolete files

If migrating from an existing Python workers module:
- Remove `workers/prompts.py` — all prompts now live in the BPMN element template
- Remove LLM-calling functions from `workers/bedrock_client.py` (`invoke_llm`, `invoke_llm_json`); keep `query_knowledge_base` only if not yet replaced by `BedrockKbClient.java`
- Remove any `assess_sufficiency`, `parse_intent`, `explain_delta`, `ask_question`, `store_answer`, `signal_complete`, `deliver_report` worker functions (all replaced by the connector)

---

## Phase 4: UI Migration (1.5 days)

Replace polling with WebSocket and update message handling.

### 4.1 Replace polling with WebSocket hook

Create `ui/src/hooks/useSessionSocket.js`:

```javascript
import { useEffect, useRef, useCallback } from 'react';

export function useSessionSocket({ product, onMessage, onReady }) {
  const ws = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(import.meta.env.VITE_BROKER_WS_URL);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'start_session', product }));
    };

    socket.onmessage = (event) => {
      const frame = JSON.parse(event.data);
      if (frame.type === 'session_ready') {
        onReady(frame.processInstanceKey);
      } else {
        onMessage(frame);
      }
    };

    socket.onclose = () => { /* show reconnect UI */ };
    socket.onerror = (e) => { console.error('WS error', e); };

    ws.current = socket;
    return () => socket.close();
  }, [product]);

  const send = useCallback((content) => {
    ws.current?.send(JSON.stringify({ type: 'user_message', content }));
  }, []);

  return { send };
}
```

### 4.2 Update `App.jsx`

Remove:
- `setInterval(pollForUpdates, POLL_INTERVAL_MS)` and all polling logic
- `GET /v1/process-instances/{key}/variables` calls
- `PUT /v1/process-instances/{key}/variables/incomingUserMessage` call
- `POST /v1/process-instances` call (moved to broker)

Add:
- `useSessionSocket` hook
- Message dispatcher that routes incoming WS frames to UI state:

```javascript
function handleMessage(frame) {
  switch (frame.type) {
    case 'question':
      setMessages(m => [...m, { role: 'agent', content: frame.content, isQuestion: true }]);
      break;
    case 'agent_message':
      setMessages(m => [...m, { role: 'agent', content: frame.content }]);
      break;
    case 'summary':
      setSummary(frame.content);
      setMessages(m => [...m, { role: 'agent', content: frame.content.explanation }]);
      break;
    case 'report':
      setReport(frame.content.simulationResult);
      setMessages(m => [...m, { role: 'agent', content: frame.content.explanation }]);
      break;
    case 'report_final':
      setReport(frame.content.configuration);
      setSessionComplete(true);
      break;
    case 'error':
      setError(frame.content);
      break;
  }
}
```

### 4.3 Update environment variables

`.env`:
```
VITE_BROKER_WS_URL=ws://localhost:3001
```

Remove `VITE_CAMUNDA_API_URL` (no longer called directly from UI).

### 4.4 Update `vite.config.js`

Remove the Camunda REST proxy if it was configured there.

---

## Phase 5: Integration Testing (2 days)

### 5.1 Local integration test environment

Update `docker-compose.yml` (or create one) to run all components together:

```yaml
services:
  broker:
    build: ./broker
    ports: ["3001:3001"]
    environment:
      - CAMUNDA_REST_URL
      - CAMUNDA_REST_TOKEN
      - PROCESS_DEFINITION_KEY=pension-configurator

  workers:
    build: ./workers          # Spring Boot Maven build (Dockerfile: mvn package, java -jar)
    environment:
      - ZEEBE_ADDRESS
      - ZEEBE_CLIENT_ID
      - ZEEBE_CLIENT_SECRET
      - CALCULATOR_API_URL=http://api:8080
      - BROKER_INTERNAL_URL=http://broker:3001
      - AWS_REGION
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY
      - BEDROCK_KB_ID

  api:
    build: ./api              # Spring Boot Maven build
    ports: ["8080:8080"]

  ui:
    build: ./ui
    ports: ["5173:5173"]
    environment:
      - VITE_BROKER_WS_URL=ws://localhost:3001
```

### 5.2 End-to-end test scenarios

**Happy path — full session:**
1. Connect WebSocket, receive `session_ready`
2. Receive first question from agent
3. Answer 5-6 intake questions
4. Verify `run-simulation` is called with correct parameters
5. Verify `summary` frame received with correct structure
6. Send parameter change message
7. Verify updated `report` frame received
8. Confirm session
9. Verify `report_final` frame and `session_complete`

**Reconnection scenario:**
1. Start session, receive first question
2. Disconnect WebSocket
3. Reconnect with `resume_session` + `processInstanceKey`
4. Verify session resumes correctly

**Knowledge base query:**
1. Send a product policy question during the session
2. Verify `search-kb` job worker is triggered
3. Verify `agent_message` response received

**Error scenario:**
1. Simulate Calculator API timeout
2. Verify error frame received in UI
3. Verify process doesn't crash (error boundary event handles it)

### 5.3 Performance baseline

Measure round-trip time for:
- UI message → LLM response → UI frame: target < 3s
- Simulation run (including LLM + Calculator API): target < 5s

Compare against previous polling design (minimum 2s delay + processing time).

---

## Phase 6: Cleanup and Documentation (0.5 days)

### 6.1 Remove obsolete code
- Python worker files (`workers/prompts.py`, `workers/bedrock_client.py`, `workers/main.py`) if the project had a previous Python workers implementation — all replaced by Spring Boot `workers/` module
- Polling constants and functions in `ui/src/App.jsx`

### 6.2 Update README
- New `broker/` service setup instructions
- Updated environment variable list
- New startup order: `api` → `workers` → `broker` → `ui`

### 6.3 Update `bpmn/pension-configurator-v1.bpmn` note
Add a comment in the file header noting the v1 is archived and the active design is in the main file.

---

## Dependency Map

```
Phase 0 (Prerequisites)
    ↓
Phase 1 (Session Broker) ─────────────────────────────────┐
    ↓                                                      │
Phase 2 (BPMN Redesign) ──────────────────────────────────┤
    ↓                                                      │
Phase 3 (Worker Migration)                                 │
    ↓                                                      │
Phase 4 (UI Migration)                                     │
    ↓                                                      │
Phase 5 (Integration Testing) ←────────────────────────────┘
    ↓
Phase 6 (Cleanup)
```

Phases 1, 2, and 3 can partially overlap. Phase 4 can start once Phase 1 is testable (broker running locally). Phase 5 requires all components complete.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI Agent Connector unavailable in target cluster | Low | High | Verify in Phase 0 before any other work |
| Connector's max 10 LLM calls limit hit during intake | Medium | Medium | Split intake into two sub-process entries; or increase limit via connector config |
| WebSocket connections not reaching broker in production (reverse proxy) | Medium | High | Test WebSocket upgrade headers with nginx/ALB config before go-live |
| Session map lost on broker restart mid-session | Low | Medium | Implement Redis-backed session store for production; in-memory acceptable for demo |
| LLM tool call schema mismatch (connector rejects tool call) | Medium | Medium | Validate schemas against connector expectations in Phase 2 smoke test |
| CORS / auth between broker internal HTTP and workers | Low | Low | Both run in same network in production; add simple bearer token for broker `/send` |

---

## File Change Summary

| File | Action | Notes |
|------|--------|-------|
| `broker/` | Create | Spring Boot WebSocket server + session store |
| `workers/` | Create | Spring Boot @ZeebeWorker project (send-to-ui, run-simulation, search-kb) |
| `api/` | Create/Update | Spring Boot Calculator API (Spring MVC, stateless REST) |
| `bpmn/pension-configurator.bpmn` | Rewrite | AI Agent Connector, 3 tool tasks, message events |
| `bpmn/pension-configurator-v1.bpmn` | Create | Backup of existing |
| `ui/src/hooks/useSessionSocket.js` | Create | WebSocket hook |
| `ui/src/App.jsx` | Edit | Remove polling, add WS hook and message dispatcher |
| `ui/.env` | Edit | Replace `VITE_CAMUNDA_API_URL` with `VITE_BROKER_WS_URL` |
| `docker-compose.yml` | Create/Update | All Spring Boot services wired together |
| `README.md` | Edit | Updated setup instructions |
