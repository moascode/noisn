# Sequence Diagrams

All diagrams use Mermaid syntax and are renderable in GitHub, Notion, and most markdown viewers.

---

## 1. Session Initialisation

How a browser WebSocket connection becomes a live Camunda process instance.

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8

    User->>UI: Opens browser / selects product
    UI->>SB: WebSocket connect<br/>ws://broker/session
    SB-->>UI: Connected (sessionId assigned internally)

    UI->>SB: {type:"start_session", product:"DANICA_BALANCE"}
    SB->>C8: POST /v2/process-instances<br/>{processDefinitionKey, variables:{product, sessionId}}
    C8-->>SB: {processInstanceKey: "2251799813685281"}
    SB->>SB: Store sessionId → processInstanceKey
    SB-->>UI: {type:"session_ready", processInstanceKey}

    Note over C8: Process starts:<br/>init-context task runs,<br/>ad-hoc sub-process enters,<br/>AI Agent Connector job created
```

---

## 2. AI Agent Intake — Collecting User Information

The AI agent asks questions to collect pension configuration data from the user.

```mermaid
sequenceDiagram
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8
    participant AAC as AI Agent Connector
    participant LLM as AWS Bedrock (Claude)
    participant W_UI as send-to-ui worker

    Note over AAC: Job activated.<br/>Assembles system prompt +<br/>initial user message.

    AAC->>LLM: converse(systemPrompt, userPrompt, tools)
    LLM-->>AAC: AssistantMessage<br/>toolCall: send-to-ui {type:"question", content:"What is your age?"}

    AAC->>C8: activateElement("send-to-ui", {toolCall:{type:"question", content:...}})
    C8->>W_UI: Job: type=send-to-ui
    W_UI->>SB: POST /send {processInstanceKey, type:"question", content:"What is your age?"}
    SB->>UI: WS frame {type:"question", content:"What is your age?"}
    UI-->>User: Displays question in chat
    W_UI-->>C8: complete job {toolCallResult:"delivered"}

    Note over AAC: Tool result received.<br/>Calls LLM again with tool result.
    AAC->>LLM: converse(..., toolResult:"delivered")
    LLM-->>AAC: AssistantMessage (no tool call)<br/>Waits for user input

    Note over C8: No tool calls → connector sets<br/>completionConditionFulfilled=false,<br/>pauses. Non-interrupting Message<br/>Receive Event activated.

    User->>UI: Types "I am 42 years old"
    UI->>SB: WS frame {type:"user_message", content:"I am 42 years old"}
    SB->>C8: publishMessage("user_input_received",<br/>correlationKey=processInstanceKey,<br/>variables:{userMessage:"I am 42 years old"})

    Note over C8: Message received,<br/>injected as event message<br/>into AgentContext.<br/>New connector job created.

    AAC->>LLM: converse(..., eventMessage:"I am 42 years old")
    LLM-->>AAC: toolCall: send-to-ui {type:"question", content:"What is your annual salary?"}

    Note over UI,C8: Pattern repeats for each<br/>intake question (salary, retirement age,<br/>contribution, risk profile...)
```

---

## 3. Simulation Run + Summary Delivery

After enough information is collected, the agent runs a simulation and sends the summary.

```mermaid
sequenceDiagram
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8
    participant AAC as AI Agent Connector
    participant LLM as AWS Bedrock (Claude)
    participant W_UI as send-to-ui worker
    participant W_SIM as run-simulation worker
    participant CALC as Calculator API

    Note over AAC: Agent has enough context.<br/>Decides to run simulation.

    AAC->>LLM: converse(..., userMessage:"I'd like to see my projection")
    LLM-->>AAC: toolCall: run-simulation<br/>{age:42, salary:850000, contribution:4500,<br/>riskProfile:"MEDIUM", retirementAge:67, ...}

    AAC->>C8: activateElement("run-simulation", {toolCall:{...}})
    C8->>W_SIM: Job: type=run-simulation
    W_SIM->>CALC: POST /simulate {age:42, annual_salary:850000, ...}
    CALC-->>W_SIM: {projectedPension:18420, salaryReplacement:78, totalPremium:4900, ...}
    W_SIM-->>C8: complete job {toolCallResult:"{projectedPension:18420,...}"}

    AAC->>LLM: converse(..., toolResult:simulationJSON)
    LLM-->>AAC: toolCall: send-to-ui {type:"summary",<br/>content:{headline:"You will receive DKK 18,420/month",<br/>salaryReplacement:78, reachesTarget:false,<br/>explanation:"Your current plan reaches 78% of salary replacement..."}}

    AAC->>C8: activateElement("send-to-ui", {toolCall:{type:"summary", content:{...}}})
    C8->>W_UI: Job: type=send-to-ui
    W_UI->>SB: POST /send {processInstanceKey, type:"summary", content:{...}}
    SB->>UI: WS frame {type:"summary", content:{...}}
    UI-->>User: Displays summary card with key metrics
    W_UI-->>C8: complete job {toolCallResult:"delivered"}

    Note over C8: Summary delivered.<br/>Message Receive Event<br/>now waiting for user reply.
```

---

## 4. Parameter Change + Live Report Delivery

User adjusts a parameter; agent updates the simulation and delivers the full live report.

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8
    participant AAC as AI Agent Connector
    participant LLM as AWS Bedrock (Claude)
    participant W_UI as send-to-ui worker
    participant W_SIM as run-simulation worker
    participant CALC as Calculator API

    User->>UI: "What if I increase contribution to 6000?"
    UI->>SB: WS frame {type:"user_message", content:"What if I increase contribution to 6000?"}
    SB->>C8: publishMessage("user_input_received",<br/>correlationKey=processInstanceKey,<br/>variables:{userMessage:"..."})

    Note over C8: Message injects as<br/>event message into agent context.<br/>Connector job re-created.

    AAC->>LLM: converse(..., eventMessage:"What if I increase contribution to 6000?")
    LLM-->>AAC: toolCall: run-simulation<br/>{..., monthlyContribution:6000}

    AAC->>C8: activateElement("run-simulation", {toolCall:{monthlyContribution:6000,...}})
    C8->>W_SIM: Job: type=run-simulation
    W_SIM->>CALC: POST /simulate {monthly_contribution:6000, ...}
    CALC-->>W_SIM: {projectedPension:21850, salaryReplacement:92, reachesTarget:true, ...}
    W_SIM-->>C8: complete {toolCallResult:"{projectedPension:21850,...}"}

    AAC->>LLM: converse(..., toolResult:newSimulationJSON)
    LLM-->>AAC: toolCall: send-to-ui {type:"report",<br/>content:{simulationResult:{...},<br/>explanation:"Increasing to DKK 6,000/month raises your pension to DKK 21,850/month and you now exceed the 80% target.",<br/>chartData:[...], coverageBreakdown:{...}}}

    AAC->>C8: activateElement("send-to-ui", {toolCall:{type:"report", content:{...}}})
    C8->>W_UI: Job: type=send-to-ui
    W_UI->>SB: POST /send {processInstanceKey, type:"report", content:{...}}
    SB->>UI: WS frame {type:"report", content:{...}}
    UI-->>User: Live report panel updates with new numbers + chart
    W_UI-->>C8: complete {toolCallResult:"delivered"}

    Note over C8: Process continues.<br/>Agent waits for next user<br/>message or CONFIRM intent.
```

---

## 5. Knowledge Base Query

User asks a policy question; agent delegates to the KB tool.

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8
    participant AAC as AI Agent Connector
    participant LLM as AWS Bedrock (Claude)
    participant W_UI as send-to-ui worker
    participant W_KB as search-kb worker
    participant KB as Bedrock Knowledge Base

    User->>UI: "What does critical illness cover include?"
    UI->>SB: WS frame {type:"user_message", content:"..."}
    SB->>C8: publishMessage("user_input_received", ...)

    AAC->>LLM: converse(..., eventMessage:"What does critical illness cover include?")
    LLM-->>AAC: toolCall: search-kb {query:"critical illness cover Danica"}

    AAC->>C8: activateElement("search-kb", {toolCall:{query:"..."}})
    C8->>W_KB: Job: type=search-kb
    W_KB->>KB: retrieve_and_generate("critical illness cover Danica")
    KB-->>W_KB: "Tier 1 critical illness covers 30 defined conditions including..."
    W_KB-->>C8: complete {toolCallResult:"Tier 1 critical illness covers..."}

    AAC->>LLM: converse(..., toolResult:kbAnswer)
    LLM-->>AAC: toolCall: send-to-ui {type:"agent_message",<br/>content:"Danica's critical illness cover comes in two tiers. Tier 1 covers 30 conditions..."}

    AAC->>C8: activateElement("send-to-ui", {toolCall:{type:"agent_message", content:"..."}})
    C8->>W_UI: Job: type=send-to-ui
    W_UI->>SB: POST /send {processInstanceKey, type:"agent_message", content:"..."}
    SB->>UI: WS frame {type:"agent_message", content:"..."}
    UI-->>User: Chat bubble with KB answer
    W_UI-->>C8: complete {toolCallResult:"delivered"}
```

---

## 6. Session End — Report Confirmed

User confirms and receives the final report.

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8
    participant AAC as AI Agent Connector
    participant LLM as AWS Bedrock (Claude)
    participant W_UI as send-to-ui worker

    User->>UI: "Yes, I'm happy with this configuration"
    UI->>SB: WS frame {type:"user_message", content:"Yes, I'm happy..."}
    SB->>C8: publishMessage("user_input_received", ...)

    AAC->>LLM: converse(..., eventMessage:"Yes, I'm happy with this configuration")
    LLM-->>AAC: toolCall: send-to-ui {type:"report_final",<br/>content:{confirmed:true, configuration:{...}, reportUrl:null}}

    AAC->>C8: activateElement("send-to-ui", {toolCall:{type:"report_final",...}})
    C8->>W_UI: Job: type=send-to-ui
    W_UI->>SB: POST /send {processInstanceKey, type:"report_final", content:{...}}
    SB->>UI: WS frame {type:"report_final", content:{...}}
    UI-->>User: Final report screen with download option
    W_UI-->>C8: complete {toolCallResult:"delivered"}

    Note over AAC: LLM returns no further<br/>tool calls →<br/>completionConditionFulfilled=true

    C8->>C8: Ad-hoc sub-process ends
    C8->>SB: Process instance completed event (via polling or webhook)
    SB->>SB: Remove sessionId from map
    SB->>UI: WS frame {type:"session_complete"}
    UI-->>User: Session closed gracefully
```

---

## 7. Error Handling — Connection Drop and Resume

WebSocket disconnects and user reconnects with their session token.

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant SB as Session Broker
    participant C8 as Camunda 8

    Note over UI,SB: Network drop

    UI-xSB: WebSocket disconnected
    SB->>SB: Mark session as "disconnected"<br/>Keep processInstanceKey in map<br/>(process continues in Camunda)

    Note over C8: Process instance still alive<br/>in Zeebe. Message Receive<br/>Event still waiting.

    User->>UI: Reloads tab
    UI->>SB: WebSocket connect<br/>+ {type:"resume_session", processInstanceKey:"2251..."}
    SB->>SB: Lookup processInstanceKey<br/>Re-associate new WebSocket
    SB-->>UI: {type:"session_resumed", state:"waiting_for_input"}
    UI-->>User: Chat history restored, input re-enabled

    User->>UI: Continues conversation
    UI->>SB: WS frame {type:"user_message", content:"..."}
    SB->>C8: publishMessage("user_input_received", correlationKey=processInstanceKey, ...)
    Note over C8: Process resumes normally
```
