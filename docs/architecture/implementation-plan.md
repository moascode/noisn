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

Create `broker/` directory:

```
broker/
├── src/
│   ├── index.js          # Entry point
│   ├── wsServer.js       # WebSocket server, connection lifecycle
│   ├── sessionStore.js   # In-memory map: sessionId → {ws, processInstanceKey, state}
│   ├── camundaClient.js  # REST wrapper: createProcessInstance, publishMessage
│   └── routes.js         # Internal HTTP POST /send endpoint
├── package.json
└── .env.example
```

### 1.2 Implement `wsServer.js`

WebSocket server logic:

```javascript
// On connection: assign sessionId, wait for start_session frame
// On start_session: createProcessInstance → store in sessionStore
// On user_message: publishMessage(name="user_input_received", correlationKey=pik, variables)
// On resume_session: re-associate ws with existing processInstanceKey
// On close: mark session disconnected (do NOT delete — process may still be live)
```

Key events to handle:
- `start_session` → `createProcessInstance` → store mapping
- `user_message` → `publishMessage`
- `resume_session` → re-associate WebSocket
- `ping` / `pong` for keepalive

### 1.3 Implement `routes.js` — internal send endpoint

```javascript
// POST /send
// Body: { processInstanceKey, messageType, payload }
// Looks up WebSocket in sessionStore, sends JSON frame
// Returns 200 if delivered, 404 if session not found, 503 if socket closed
```

This is the endpoint that `send-to-ui` job worker calls.

### 1.4 Implement `camundaClient.js`

```javascript
// createProcessInstance(processDefinitionKey, variables)
//   POST {CAMUNDA_REST_URL}/v2/process-instances
//   Auth: Bearer token (reuse token from env or fetch via OAuth)
//
// publishMessage(messageName, correlationKey, variables)
//   POST {CAMUNDA_REST_URL}/v2/messages/publication
```

Reuse the OAuth token flow from existing `workers/camunda_client.py` — same credentials, different language.

### 1.5 Add environment variables

```
CAMUNDA_REST_URL=https://...
CAMUNDA_REST_TOKEN=...   # or ZEEBE_CLIENT_ID/SECRET for OAuth flow
PROCESS_DEFINITION_KEY=pension-configurator
PORT=3001                # WebSocket + HTTP server port
```

### 1.6 Testing

Write integration tests (Jest or pytest) that:
1. Connect a mock WebSocket client
2. Send `start_session` → verify `processInstanceKey` returned
3. Call `POST /send` → verify WebSocket frame received
4. Send `user_message` → verify `publishMessage` called with correct args (mock Camunda)

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

Strip LLM logic from workers, add the three new tool workers.

### 3.1 Remove old workers

Delete or archive the following worker functions from `workers/tools/workers.py` (or equivalent):
- `assess_sufficiency` (LLM call — replaced by connector)
- `parse_intent` (LLM call — replaced by connector)
- `explain_delta` (LLM call — replaced by connector)
- `ask_question` (replaced by `send-to-ui` tool)
- `store_answer` (replaced by connector handling variables)
- `signal_complete` (replaced by connector completion condition)
- `deliver_report` (replaced by `send-to-ui` tool)

Keep (they become tool implementations):
- `run_simulation` → rename task type to `run-simulation`, strip orchestration logic
- `query_kb` → rename task type to `search-kb`, strip orchestration logic
- `init_session` → keep as-is, update to store `sessionId`
- `check_eligibility` → keep, but convert to a tool the LLM can call if needed

### 3.2 Add `send-to-ui` worker

New file `workers/tools/send_to_ui.py`:

```python
@worker.task(task_type="send-to-ui", timeout_ms=10_000)
async def send_to_ui(job: Job):
    variables = job.variables
    tool_call = variables.get("toolCall", {})
    process_instance_key = variables.get("processInstanceKey")

    message_type = tool_call.get("messageType")
    content = tool_call.get("content")

    # Call Session Broker internal endpoint
    response = requests.post(
        f"{BROKER_INTERNAL_URL}/send",
        json={
            "processInstanceKey": str(process_instance_key),
            "messageType": message_type,
            "payload": content
        },
        timeout=5
    )

    if response.status_code == 404:
        # Session disconnected — complete anyway, message will be delivered on reconnect
        await job.set_success_status(variables={"toolCallResult": "session_not_connected"})
        return

    await job.set_success_status(variables={"toolCallResult": "delivered"})
```

### 3.3 Update `run-simulation` worker

```python
@worker.task(task_type="run-simulation", timeout_ms=30_000)
async def run_simulation(job: Job):
    tool_call = job.variables.get("toolCall", {})

    payload = {
        "age": tool_call.get("age"),
        "annual_salary": tool_call.get("annualSalary"),
        "desired_retirement_age": tool_call.get("desiredRetirementAge"),
        "monthly_contribution": tool_call.get("monthlyContribution"),
        "risk_profile": tool_call.get("riskProfile", "MEDIUM"),
        "payout_type": tool_call.get("payoutType", "ANNUITY"),
        # ... map remaining fields
    }

    response = requests.post(f"{CALCULATOR_API_URL}/simulate", json=payload, timeout=15)
    result = response.json()

    await job.set_success_status(variables={"toolCallResult": json.dumps(result)})
```

### 3.4 Update `search-kb` worker

```python
@worker.task(task_type="search-kb", timeout_ms=30_000)
async def search_kb(job: Job):
    tool_call = job.variables.get("toolCall", {})
    query = tool_call.get("query", "")

    answer = query_knowledge_base(query, n_results=5)

    await job.set_success_status(variables={"toolCallResult": answer})
```

### 3.5 Update `main.py` worker registry

```python
REGISTERED_WORKERS = [
    "init-session",
    "send-to-ui",
    "run-simulation",
    "search-kb",
    "check-eligibility",   # keep as optional tool
]
```

Add `BROKER_INTERNAL_URL` to environment variables.

### 3.6 Delete obsolete files

- `workers/prompts.py` — all prompts now live in the BPMN element template
- `workers/bedrock_client.py` `invoke_llm()` and `invoke_llm_json()` functions (keep `query_knowledge_base`)

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
    build: ./workers
    environment:
      - ZEEBE_ADDRESS
      - ZEEBE_CLIENT_ID
      - ZEEBE_CLIENT_SECRET
      - CALCULATOR_API_URL=http://api:8001
      - BROKER_INTERNAL_URL=http://broker:3001
      - AWS_REGION
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY
      - BEDROCK_KB_ID

  api:
    build: ./api
    ports: ["8001:8001"]

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
- `workers/prompts.py` (LLM system prompts — replaced by BPMN element template configuration)
- `workers/bedrock_client.py` `invoke_llm`, `invoke_llm_json` (LLM call logic)
- `workers/camunda_client.py` `set_process_variable` (no longer called from workers)
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
| `broker/` | Create | New service — WebSocket server + session store |
| `bpmn/pension-configurator.bpmn` | Rewrite | AI Agent Connector, 3 tool tasks, message events |
| `bpmn/pension-configurator-v1.bpmn` | Create | Backup of existing |
| `workers/tools/send_to_ui.py` | Create | New tool worker |
| `workers/tools/workers.py` | Heavily edit | Remove 9 workers, update 2, keep 3 |
| `workers/main.py` | Edit | Update registered worker list |
| `workers/prompts.py` | Delete | Prompts move to BPMN element template |
| `workers/bedrock_client.py` | Partially edit | Remove `invoke_llm`, `invoke_llm_json`; keep `query_knowledge_base` |
| `workers/camunda_client.py` | Partially edit | Remove `set_process_variable` direct calls |
| `ui/src/hooks/useSessionSocket.js` | Create | WebSocket hook |
| `ui/src/App.jsx` | Edit | Remove polling, add WS hook and message dispatcher |
| `ui/.env` | Edit | Replace `VITE_CAMUNDA_API_URL` with `VITE_BROKER_WS_URL` |
| `api/` | No change | Calculator API unchanged |
| `README.md` | Edit | Updated setup instructions |
