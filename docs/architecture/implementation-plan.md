# Implementation Plan

## Overview

Migration from the existing REST-polling + custom Python LLM orchestration to the WebSocket + Camunda AI Agent Connector architecture. The plan is structured in five phases that can each be delivered and tested independently.

**Fundamental design shift:** The system is no longer a *configurator* (customer picks a product, tweaks parameters). It is now a *recommender*: the agent collects a full customer profile and existing pension information through conversation, then recommends the best-suited Danica product. The live report builds progressively in three sections:

1. **Customer Profile** — intake answers (demographics, income, goals, risk tolerance) updated in real-time as the conversation progresses
2. **Existing Coverage** — current pension situation (employer plan, state pension, existing savings) collected during intake
3. **Recommended Product** — the Danica product best suited to this customer, with a simulation projection and explanation

The customer no longer selects a product before the session starts.

**Total estimated effort:** 9–13 days for a single developer familiar with the codebase.

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
// On start_session frame: call CamundaClient.createProcessInstance (no product variable) → store PIK in SessionStore
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
- Init script task (update to initialise empty profile variables — no product variable at start)
- Overall process flow structure
- Error boundary events

**Replace / Add:**
1. **Remove** all individual service tasks for tool workers (`tool-ask-question`, `tool-store-answer`, `tool-assess-sufficiency`, etc.)
2. **Remove** the intake and iterate sub-process definitions (they were custom orchestration)
3. **Update init script task** to set initial process variables:
   ```
   customerProfile = {}        // filled progressively during intake
   existingCoverage = {}       // employer pension, state pension, savings
   recommendedProduct = null   // set by agent after assessment
   simulationResult = null
   ```
4. **Add** a single **ad-hoc sub-process** spanning the main agent interaction
5. **Apply** the `agenticai-aiagent-job-worker` element template to this sub-process
6. **Inside** the ad-hoc sub-process, add four service tasks:
   - `send-to-ui` (task type: `send-to-ui`)
   - `run-simulation` (task type: `run-simulation`)
   - `search-kb` (task type: `search-kb`)
   - `update-profile` (task type: `update-profile`) — stores collected profile/coverage data as process variables
7. **Add** a non-interrupting **Message Intermediate Catch Event** to the sub-process boundary:
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

The system prompt must describe the agent's recommender role and all available tools:

```
"You are a pension advisor for Danica Pension. Your goal is to understand the customer's full situation
and recommend the Danica product that best fits their needs — not to configure a product they have already chosen.

You have access to these tools:
- send-to-ui: Send a message or a live report update to the user interface.
  Use messageType:
    'question'         — ask the user one question
    'agent_message'    — informational response (no question, no report update)
    'profile_update'   — update the Profile section of the live report with collected data so far
    'existing_update'  — update the Existing Coverage section of the live report
    'recommendation'   — present the recommended product with explanation (before simulation)
    'report'           — full live report update after simulation (all three sections)
    'report_final'     — confirmed final report

- update-profile: Persist collected profile or coverage data as process variables so the live report
  can be restored on reconnect. Call this after each meaningful intake answer, not after every message.

- run-simulation: Run a pension projection for a specific product and customer profile.
  Always call this AFTER making a recommendation, using the recommended productCode.

- search-kb: Look up Danica product details, eligibility rules, or coverage information.

Workflow:
1. PROFILE COLLECTION — Ask about: age, annual gross salary, desired retirement age, family status,
   number of dependants, monthly contribution capacity, risk tolerance (LOW/MEDIUM/HIGH), and
   primary pension goal (income replacement / lump sum / flexibility).
   After each answer, call update-profile and send a profile_update frame.
2. EXISTING COVERAGE — Ask about: employer pension (provider, monthly contribution),
   state pension estimate, any private savings or insurance.
   Call update-profile and send an existing_update frame.
3. PRODUCT RECOMMENDATION — Use search-kb to understand which Danica products match this profile.
   Send a recommendation frame with the product name, key reasons, and trade-offs.
4. SIMULATION — Call run-simulation with the recommended productCode and full profile.
   Send a report frame with all three sections populated.
5. EXPLORATION — Allow the customer to adjust contribution, retirement age, or risk profile
   and re-run simulation. Send a report frame on each change.
6. CONFIRMATION — When the customer confirms, send a report_final frame.

Always ask one question at a time. Match the customer's language (Danish or English).
Never recommend a product before completing steps 1 and 2."
```

### 2.5 Tool schema declarations

For each tool task inside the sub-process, the connector needs to know the tool's input schema. This is set via extension properties on each service task:

**send-to-ui schema:**
```json
{
  "name": "send-to-ui",
  "description": "Send a message or live report update to the user interface",
  "parameters": {
    "type": "object",
    "properties": {
      "messageType": {
        "type": "string",
        "enum": ["question","agent_message","profile_update","existing_update","recommendation","report","report_final"]
      },
      "content": {"type": "object", "description": "Message payload — structure depends on messageType (see system prompt)"}
    },
    "required": ["messageType", "content"]
  }
}
```

**update-profile schema:**
```json
{
  "name": "update-profile",
  "description": "Persist collected customer profile or existing coverage data as process variables",
  "parameters": {
    "type": "object",
    "properties": {
      "section": {"type": "string", "enum": ["customerProfile", "existingCoverage"]},
      "fields": {"type": "object", "description": "Key-value pairs to merge into the named section"}
    },
    "required": ["section", "fields"]
  }
}
```

**run-simulation schema:**
```json
{
  "name": "run-simulation",
  "description": "Run a pension projection for the recommended product and customer profile",
  "parameters": {
    "type": "object",
    "properties": {
      "productCode": {"type": "string", "description": "Danica product code, e.g. DANICA_BALANCE, DANICA_LINK"},
      "age": {"type": "integer"},
      "annualSalary": {"type": "number"},
      "desiredRetirementAge": {"type": "integer"},
      "monthlyContribution": {"type": "number"},
      "riskProfile": {"type": "string", "enum": ["LOW","MEDIUM","HIGH"]},
      "payoutType": {"type": "string", "enum": ["LUMP_SUM","ANNUITY","LIFE_ANNUITY","COMBINED"]}
    },
    "required": ["productCode", "age", "annualSalary", "desiredRetirementAge", "monthlyContribution"]
  }
}
```

**search-kb schema:**
```json
{
  "name": "search-kb",
  "description": "Search the Danica knowledge base for product details, eligibility rules, or coverage information",
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
│   ├── UpdateProfileWorker.java          # @ZeebeWorker type=update-profile
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

### 3.3 Implement `UpdateProfileWorker.java`

This worker writes collected profile or coverage data back into Camunda process variables so the live report can be restored on reconnect and so the data persists across sub-process iterations.

```java
@Component
public class UpdateProfileWorker {

    @ZeebeWorker(type = "update-profile", timeout = "PT5S")
    public void handle(JobClient client, ActivatedJob job) {
        Map<String, Object> toolCall = (Map<String, Object>) job.getVariablesAsMap().get("toolCall");
        String section = (String) toolCall.get("section");            // "customerProfile" or "existingCoverage"
        Map<String, Object> fields = (Map<String, Object>) toolCall.get("fields");

        // Merge incoming fields into the existing section map
        Map<String, Object> existing = (Map<String, Object>) job.getVariablesAsMap()
            .getOrDefault(section, new HashMap<>());
        existing.putAll(fields);

        client.newCompleteCommand(job)
            .variable(section, existing)
            .variable("toolCallResult", "updated")
            .send()
            .join();
    }
}
```

### 3.4 Implement `RunSimulationWorker.java`

```java
@Component
public class RunSimulationWorker {

    private final CalculatorClient calculatorClient;

    @ZeebeWorker(type = "run-simulation", timeout = "PT30S")
    public void handle(JobClient client, ActivatedJob job) {
        Map<String, Object> toolCall = (Map<String, Object>) job.getVariablesAsMap().get("toolCall");

        SimulationRequest request = SimulationRequest.builder()
            .productCode((String) toolCall.get("productCode"))        // required — agent sets after recommendation
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
            .variable("simulationResult", result)           // also persist for reconnect
            .variable("recommendedProduct", request.getProductCode())
            .send()
            .join();
    }
}
```

### 3.5 Implement `SearchKbWorker.java`

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

### 3.6 Add environment variables (`application.yml`)

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

### 3.7 Delete obsolete files

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

The live report panel has **three sections** that update independently:
- **Profile** — customer demographics, income, goals, risk tolerance
- **Existing Coverage** — employer pension, state pension, private savings
- **Recommended Product** — product name + rationale + simulation

```javascript
function handleMessage(frame) {
  switch (frame.type) {
    case 'question':
      setMessages(m => [...m, { role: 'agent', content: frame.content, isQuestion: true }]);
      break;
    case 'agent_message':
      setMessages(m => [...m, { role: 'agent', content: frame.content }]);
      break;
    case 'profile_update':
      // Progressive update: merge new fields into the profile panel
      setProfile(p => ({ ...p, ...frame.content }));
      break;
    case 'existing_update':
      // Progressive update: merge new fields into the existing coverage panel
      setExistingCoverage(p => ({ ...p, ...frame.content }));
      break;
    case 'recommendation':
      // Show recommended product card (before simulation runs)
      setRecommendation(frame.content);   // { productCode, productName, reasons, tradeoffs }
      setMessages(m => [...m, { role: 'agent', content: frame.content.explanation }]);
      break;
    case 'report':
      // Full report update: all three sections populated after simulation
      setProfile(frame.content.customerProfile);
      setExistingCoverage(frame.content.existingCoverage);
      setRecommendation(frame.content.recommendation);
      setSimulationResult(frame.content.simulationResult);
      setMessages(m => [...m, { role: 'agent', content: frame.content.explanation }]);
      break;
    case 'report_final':
      setSimulationResult(frame.content.simulationResult);
      setSessionComplete(true);
      break;
    case 'error':
      setError(frame.content);
      break;
  }
}
```

**State shape:**
```javascript
const [profile, setProfile]                   = useState({});   // age, salary, retirementAge, riskProfile, ...
const [existingCoverage, setExistingCoverage] = useState({});   // employerPension, statePension, savings, ...
const [recommendation, setRecommendation]     = useState(null); // productCode, productName, reasons, tradeoffs
const [simulationResult, setSimulationResult] = useState(null); // projectedPension, salaryReplacement, ...
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

**Happy path — full recommender session:**
1. Connect WebSocket (no product pre-selection), receive `session_ready`
2. Receive first question from agent (age, salary, retirement goal, etc.)
3. Answer ~5 profile questions — verify `profile_update` frames update the Profile panel progressively
4. Answer ~3 existing coverage questions — verify `existing_update` frames update the Coverage panel
5. Verify agent calls `search-kb` to query product catalog before recommending
6. Verify `recommendation` frame received with `productCode`, `productName`, `reasons`
7. Verify `run-simulation` is called with the recommended `productCode`
8. Verify `report` frame received with all three sections (profile, existing, recommendation+simulation)
9. Send parameter change ("what if I contribute 500 more per month")
10. Verify updated `report` frame with new simulation numbers
11. Confirm session → verify `report_final` frame and `session_complete`

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
| Agent recommends product before collecting full profile | Medium | High | Enforce in system prompt: explicit ordering constraint (steps 1→2→3); test with short-cut user answers |
| Calculator API rejects unknown `productCode` | Medium | Medium | Validate productCode enum server-side; return 400 with message so worker returns error toolCallResult |
| Connector hits 10 LLM call limit before recommendation is made (long intake) | Medium | Medium | Profile + coverage collection spans two sub-process entries if needed; increase max model calls to 15 for intake sub-process |

---

## File Change Summary

| File | Action | Notes |
|------|--------|-------|
| `broker/` | Create | Spring Boot WebSocket server + session store |
| `workers/` | Create | Spring Boot @ZeebeWorker project (send-to-ui, update-profile, run-simulation, search-kb) |
| `api/` | Create/Update | Spring Boot Calculator API — `/simulate` must accept `productCode`; no longer optional |
| `bpmn/pension-configurator.bpmn` | Rewrite | AI Agent Connector, 4 tool tasks (incl. update-profile), message events |
| `bpmn/pension-configurator-v1.bpmn` | Create | Backup of existing |
| `ui/src/hooks/useSessionSocket.js` | Create | WebSocket hook |
| `ui/src/App.jsx` | Edit | Remove polling, add WS hook and message dispatcher |
| `ui/.env` | Edit | Replace `VITE_CAMUNDA_API_URL` with `VITE_BROKER_WS_URL` |
| `docker-compose.yml` | Create/Update | All Spring Boot services wired together |
| `README.md` | Edit | Updated setup instructions |
