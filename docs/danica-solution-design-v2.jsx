import { useState } from "react";

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:      "#090C12",
  surface: "#10131A",
  border:  "#1C2030",
  muted:   "#4B5563",
  text:    "#DDD9D0",
  dim:     "#9CA3AF",
  // actors
  camunda: { bg: "#0E2318", border: "#1A4A30", accent: "#34C97A" },
  agent:   { bg: "#1A1230", border: "#3A2A60", accent: "#9B6EF5" },
  calc:    { bg: "#1A1230", border: "#2A3060", accent: "#5B8EF5" },
  user:    { bg: "#0D1A2A", border: "#1A3050", accent: "#4A9EDD" },
  kb:      { bg: "#2A1200", border: "#502A00", accent: "#E07B30" },
};

const tabs = [
  { id: "overview",   label: "Architecture Overview",        icon: "◈" },
  { id: "bpmn",       label: "BPMN Process Design",          icon: "⬡" },
  { id: "connector",  label: "AI Agent Connector",           icon: "⟁" },
  { id: "tools",      label: "Tool Definitions & Prompts",   icon: "▦" },
  { id: "data",       label: "Data Model",                   icon: "≡" },
];

// ─── SMALL REUSABLES ─────────────────────────────────────────────────────────
function Tag({ children, color = C.muted }) {
  return (
    <span style={{ background: color + "22", border: `1px solid ${color}55`, color,
      borderRadius: 3, padding: "2px 8px", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.5px" }}>
      {children}
    </span>
  );
}

function SecLabel({ children }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: C.muted,
      fontFamily: "monospace", marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}

function Code({ children, accent = C.camunda.accent }) {
  return (
    <pre style={{ background: "#06080E", border: `1px solid ${accent}30`, borderLeft: `3px solid ${accent}`,
      borderRadius: 4, padding: "14px 16px", fontSize: 11, fontFamily: "monospace", color: C.dim,
      overflowX: "auto", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {children}
    </pre>
  );
}

function Card({ title, accent, children, noPad }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `2px solid ${accent}`,
      borderRadius: 5, padding: noPad ? 0 : "16px", overflow: "hidden" }}>
      {title && <div style={{ fontSize: 11, color: accent, fontFamily: "monospace", marginBottom: 10,
        letterSpacing: "0.5px", fontWeight: 600 }}>{title}</div>}
      {children}
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: color + "18",
      border: `1px solid ${color}40`, borderRadius: 20, padding: "3px 10px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 10, color, fontFamily: "monospace" }}>{label}</span>
    </div>
  );
}

// ─── TAB 1 · ARCHITECTURE OVERVIEW ───────────────────────────────────────────
function OverviewTab() {
  const layers = [
    {
      label: "PRESENTATION LAYER",
      color: C.user.accent,
      items: ["Web / Mobile Chat UI", "Live Report Panel (side-by-side)", "Parameter controls (natural language)"],
      note: "User-facing. Sends messages via REST to Camunda API. Receives SSE updates for live report refresh.",
    },
    {
      label: "ORCHESTRATION LAYER — Camunda 8 (Zeebe)",
      color: C.camunda.accent,
      items: [
        "Main process: phases, gateways, boundaries",
        "AI Agent Sub-process (intake + iterate) — ad-hoc, tool-driven",
        "AI Agent Task (single-shot tasks: report compile, eligibility check)",
        "Simulation sub-process — deterministic, sequential",
      ],
      note: "Owns process state. Zeebe persists all variables, tool calls, and outcomes. Full audit trail in Camunda Operate.",
    },
    {
      label: "AI LAYER — AWS Bedrock via Camunda AI Agent Connector",
      color: C.agent.accent,
      items: [
        "LLM: Claude 3.5 Sonnet (via Bedrock Converse API)",
        "Short-term memory: managed natively by Sub-process connector",
        "Tool calling: dynamically selects from ad-hoc sub-process activities",
        "RAG: Bedrock Knowledge Base (Danica product rules + guide book)",
        "Guardrails: grounding + content filtering on every response",
      ],
      note: "Stateless LLM. All context injected per call by Camunda connector. Sub-process connector handles the reasoning loop internally.",
    },
    {
      label: "INTEGRATION LAYER",
      color: C.calc.accent,
      items: [
        "Pension Amount Calculator (REST API)",
        "Coverage Premium Calculator (REST API)",
        "Benefit Projection Calculator (REST API)",
        "Eligibility Rules Service (REST / DMN)",
      ],
      note: "Deterministic. Called by Camunda connectors from within the simulation sub-process and as tools from the AI agent.",
    },
    {
      label: "KNOWLEDGE LAYER — Bedrock Knowledge Base",
      color: C.kb.accent,
      items: [
        "Danica product catalogue + rules",
        "Pension advisor guide book (question framework)",
        "Coverage eligibility rules",
        "Historical advisory patterns (future)",
      ],
      note: "Vector-indexed. Retrieved via hybrid search (semantic + keyword). Used by AI agent for grounded responses.",
    },
  ];

  const connectorComparison = [
    {
      name: "AI Agent Sub-process",
      use: "Intake conversation · Iterate / explore loop",
      why: "Multi-turn, autonomous tool selection. Agent decides which questions to ask next and which parameters to update — no fixed sequence.",
      strength: "Native short-term memory, event sub-process support, clean BPMN model",
      tradeoff: "Less granular audit per tool call — rely on connector logs + Operate",
      color: C.agent.accent,
    },
    {
      name: "AI Agent Task",
      use: "Eligibility check · Report compilation · Delta explanation",
      why: "Single-shot tasks with deterministic inputs and outputs. Wrap with BPMN for oversight and retry.",
      strength: "Full BPMN control, explicit input/output mapping, easy to audit",
      tradeoff: "No internal loop — one call, one result",
      color: C.calc.accent,
    },
  ];

  return (
    <div>
      <SecLabel>System Architecture — Layered View</SecLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
        {layers.map((layer, i) => (
          <div key={i} style={{ display: "flex", gap: 0, borderRadius: 5, overflow: "hidden",
            border: `1px solid ${layer.color}30` }}>
            <div style={{ width: 10, flexShrink: 0, background: layer.color }} />
            <div style={{ flex: 1, padding: "14px 18px", background: C.surface }}>
              <div style={{ fontSize: 10, color: layer.color, fontFamily: "monospace",
                letterSpacing: "2px", marginBottom: 10 }}>{layer.label}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                {layer.items.map((item, ii) => (
                  <div key={ii} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <span style={{ color: layer.color, fontSize: 12, marginTop: 1 }}>·</span>
                    <span style={{ fontSize: 12, color: C.dim }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace",
                paddingTop: 8, borderTop: `1px solid ${C.border}` }}>{layer.note}</div>
            </div>
          </div>
        ))}
      </div>

      <SecLabel>Connector Selection — When to Use Which</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        {connectorComparison.map(c => (
          <Card key={c.name} accent={c.color}>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>{c.name}</div>
            <div style={{ marginBottom: 12 }}><Tag color={c.color}>{c.use}</Tag></div>
            {[["WHY HERE", c.why], ["STRENGTH", c.strength], ["TRADE-OFF", c.tradeoff]].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace",
                  letterSpacing: "2px", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.65 }}>{v}</div>
              </div>
            ))}
          </Card>
        ))}
      </div>

      <SecLabel>Key Design Principles</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { title: "Camunda owns phases", color: C.camunda.accent, desc: "High-level BPMN gates (sufficiency, satisfaction, finalise) are explicit and deterministic. AI autonomy is bounded within each phase." },
          { title: "Agent owns conversation", color: C.agent.accent, desc: "Within each ad-hoc sub-process, the AI agent decides tool call sequence autonomously. No hard-coded script per question or parameter change." },
          { title: "Short-term memory is native", color: C.agent.accent, desc: "The Sub-process connector manages conversation context internally. No manual conversationHistory variable threading across calls." },
          { title: "Calculators stay deterministic", color: C.calc.accent, desc: "Pension amounts and premiums come from calculator APIs, not the LLM. Bedrock explains; it never invents numbers." },
          { title: "Knowledge base grounds the AI", color: C.kb.accent, desc: "All product rules, eligibility constraints, and advisory logic live in Bedrock KB. Guardrails enforce grounding on every response." },
          { title: "Full audit via Zeebe", color: C.camunda.accent, desc: "Every tool call, variable update, and gateway decision is logged by Zeebe and visible in Camunda Operate. Compliant by design." },
        ].map(p => (
          <div key={p.title} style={{ background: C.surface, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${p.color}`, borderRadius: 5, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: p.color, fontFamily: "monospace",
              marginBottom: 6, fontWeight: 600 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.65 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB 2 · BPMN ─────────────────────────────────────────────────────────────
function BpmnTab() {
  const [expanded, setExpanded] = useState(null);

  const phases = [
    {
      id: "entry",
      label: "Entry",
      color: C.user.accent,
      type: "deterministic",
      elements: [
        { kind: "start",   label: "Start" },
        { kind: "task",    label: "Create process instance\n+ load product context", actor: "Camunda" },
        { kind: "task",    label: "Select product\n+ consent", actor: "User" },
      ],
      detail: {
        desc: "Fully deterministic. User selects pension product. Camunda creates a process instance, loads product context (product code, eligibility rules) into process variables, and records consent. No AI involvement.",
        vars: ["processInstanceId", "productCode", "consentGiven", "sessionStartedAt"],
        connector: null,
      },
    },
    {
      id: "intake",
      label: "Intake\n(AI Agent Sub-process)",
      color: C.agent.accent,
      type: "agent-subprocess",
      elements: [
        { kind: "agent-subprocess", label: "AI Agent Sub-process\n— Intake Conversation" },
        { kind: "gateway", label: "Sufficient\ninfo?" },
      ],
      detail: {
        desc: "The AI Agent Sub-process connector runs an autonomous conversation loop. The agent has access to tools inside the ad-hoc sub-process: ask_question, store_answer, check_eligibility, assess_sufficiency. The agent decides the order and number of calls. It loops until it determines sufficiency (score ≥ 80) — then signals Camunda to exit the sub-process. The sufficiency gateway reads the score from process variables.",
        vars: ["age", "annualSalary", "employmentStatus", "desiredRetirementAge", "hasPartner", "hasDependants", "housingType", "otherSavingsDKK", "sufficiencyScore", "eligibilityFlags"],
        connector: "AI Agent Sub-process",
        tools: ["ask_question", "store_answer", "check_eligibility", "assess_sufficiency"],
        memory: "Native short-term memory within the Sub-process connector — no manual history threading",
      },
    },
    {
      id: "sim1",
      label: "First Simulation",
      color: C.calc.accent,
      type: "deterministic",
      elements: [
        { kind: "task",    label: "Trigger simulation\nsub-process", actor: "Camunda" },
        { kind: "task",    label: "Run calculators\n(pension + coverage + projection)", actor: "Calculators" },
        { kind: "task",    label: "Compile results\n→ process variables", actor: "Camunda" },
        { kind: "task",    label: "AI Agent Task:\nGenerate report summary", actor: "Bedrock" },
        { kind: "task",    label: "Render live report", actor: "User" },
      ],
      detail: {
        desc: "Deterministic simulation sub-process. Camunda orchestrates three sequential calculator API calls, aggregates results into process variables. An AI Agent Task (single-shot) then generates a plain-language report summary. The live report renders in the UI alongside the chat.",
        vars: ["projectedPensionMonthlyDKK", "salaryReplacementPct", "totalMonthlyPremiumDKK", "coverageBreakdown", "simulationHistory[0]"],
        connector: "AI Agent Task (report summary only)",
        tools: null,
      },
    },
    {
      id: "iterate",
      label: "Explore & Iterate\n(AI Agent Sub-process)",
      color: C.agent.accent,
      type: "agent-subprocess",
      elements: [
        { kind: "agent-subprocess", label: "AI Agent Sub-process\n— Explore & Iterate" },
        { kind: "gateway", label: "User\nsatisfied?" },
      ],
      detail: {
        desc: "Second major AI Agent Sub-process. The agent handles the full iterate loop autonomously — it parses the user's natural language request, calls update_parameter to update process variables, calls run_simulation to trigger the Camunda simulation sub-process, calls get_simulation_result, then calls explain_delta to generate a plain-language diff. The agent loops until the user signals confirmation or asks to generate the report. Camunda exits the sub-process and checks the satisfaction gateway.",
        vars: ["lastIntentParsed", "simulationHistory (appended per run)", "previousSimulationResult", "simulationRunCount"],
        connector: "AI Agent Sub-process",
        tools: ["parse_intent", "update_parameter", "run_simulation", "get_simulation_result", "explain_delta", "query_knowledge_base"],
        memory: "Conversation context maintained natively across iterate turns",
      },
    },
    {
      id: "finalise",
      label: "Finalise",
      color: C.camunda.accent,
      type: "deterministic",
      elements: [
        { kind: "task",    label: "Compile report dossier", actor: "Camunda" },
        { kind: "task",    label: "Deliver report to user", actor: "Camunda" },
        { kind: "end",     label: "End" },
      ],
      detail: {
        desc: "Fully deterministic. Camunda compiles the final report from all process variables: user profile, all simulation runs (simulationHistory), final configuration, coverage breakdown, AI explanations. Delivers to user. Process instance completes. Advisor receives report as a completed dossier outside this process scope.",
        vars: ["Final report object (all vars + simulationHistory + conversationSummary)"],
        connector: null,
      },
    },
  ];

  return (
    <div>
      <SecLabel>Process Flow — Phase-Level Overview</SecLabel>

      {/* Horizontal flow */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, overflowX: "auto", paddingBottom: 8 }}>
        {phases.map((phase, pi) => (
          <div key={phase.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div
              onClick={() => setExpanded(expanded === phase.id ? null : phase.id)}
              style={{
                cursor: "pointer",
                background: expanded === phase.id ? phase.color + "20" : C.surface,
                border: `2px solid ${expanded === phase.id ? phase.color : C.border}`,
                borderRadius: 6,
                padding: "14px 16px",
                minWidth: 150,
                textAlign: "center",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 18, color: phase.color, marginBottom: 6 }}>
                {phase.type === "agent-subprocess" ? "⟁" : "⬡"}
              </div>
              <div style={{ fontSize: 11, color: phase.color, fontFamily: "monospace",
                fontWeight: 600, whiteSpace: "pre-line", lineHeight: 1.4 }}>
                {phase.label}
              </div>
              <div style={{ marginTop: 8 }}>
                <Tag color={phase.type === "agent-subprocess" ? C.agent.accent : C.camunda.accent}>
                  {phase.type === "agent-subprocess" ? "Agent Sub-process" : "Deterministic"}
                </Tag>
              </div>
            </div>
            {pi < phases.length - 1 && (
              <div style={{ color: C.muted, fontSize: 18, padding: "0 8px" }}>→</div>
            )}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {expanded && (() => {
        const phase = phases.find(p => p.id === expanded);
        return (
          <div style={{ background: "#06080E", border: `1px solid ${phase.color}40`,
            borderRadius: 6, padding: 20, marginBottom: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: phase.color, fontFamily: "monospace",
                  letterSpacing: "2px", marginBottom: 10 }}>PHASE DESCRIPTION</div>
                <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.75, marginBottom: 16 }}>
                  {phase.detail.desc}
                </div>
                {phase.detail.connector && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace",
                      letterSpacing: "2px", marginBottom: 6 }}>CONNECTOR USED</div>
                    <Tag color={phase.color}>{phase.detail.connector}</Tag>
                  </div>
                )}
                {phase.detail.memory && (
                  <div style={{ background: C.agent.bg, border: `1px solid ${C.agent.border}`,
                    borderRadius: 4, padding: "10px 12px", marginTop: 10 }}>
                    <div style={{ fontSize: 9, color: C.agent.accent, fontFamily: "monospace",
                      letterSpacing: "2px", marginBottom: 4 }}>MEMORY HANDLING</div>
                    <div style={{ fontSize: 12, color: C.dim }}>{phase.detail.memory}</div>
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: phase.color, fontFamily: "monospace",
                  letterSpacing: "2px", marginBottom: 10 }}>PROCESS VARIABLES WRITTEN</div>
                {phase.detail.vars.map((v, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.camunda.accent, fontFamily: "monospace",
                    padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>{v}</div>
                ))}
                {phase.detail.tools && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, color: phase.color, fontFamily: "monospace",
                      letterSpacing: "2px", marginBottom: 10 }}>TOOLS IN AD-HOC SUB-PROCESS</div>
                    {phase.detail.tools.map((t, i) => (
                      <div key={i} style={{ display: "inline-block", marginRight: 6, marginBottom: 6 }}>
                        <Tag color={phase.color}>{t}()</Tag>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gateway logic */}
      <SecLabel>Gateway Logic</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        {[
          {
            name: "Sufficiency Gateway (after Intake)",
            color: C.agent.accent,
            logic: [
              { cond: "sufficiencyScore ≥ 80", outcome: "→ Proceed to First Simulation" },
              { cond: "sufficiencyScore < 80  AND loopCount < 3", outcome: "→ Return to AI Agent Sub-process (intake)" },
              { cond: "loopCount ≥ 3", outcome: "→ Force proceed (agent logged warning)" },
            ],
            note: "Score is set by the agent's assess_sufficiency tool call before exiting the sub-process.",
          },
          {
            name: "Satisfaction Gateway (after Iterate)",
            color: C.agent.accent,
            logic: [
              { cond: "lastIntentParsed.intent = CONFIRM", outcome: "→ Proceed to Finalise" },
              { cond: "lastIntentParsed.intent = CHANGE_PARAMETER", outcome: "→ Loop back to AI Agent Sub-process (iterate)" },
              { cond: "lastIntentParsed.intent = GENERATE_REPORT", outcome: "→ Proceed to Finalise" },
            ],
            note: "The iterate agent signals completion by calling a signal_complete tool, which sets lastIntentParsed.intent before exiting.",
          },
        ].map(gw => (
          <Card key={gw.name} accent={gw.color}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>{gw.name}</div>
            {gw.logic.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <code style={{ fontSize: 11, color: gw.color, fontFamily: "monospace",
                  flexShrink: 0, paddingTop: 1 }}>{l.cond}</code>
                <span style={{ fontSize: 12, color: C.dim }}>{l.outcome}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`,
              fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{gw.note}</div>
          </Card>
        ))}
      </div>

      <SecLabel>Error Handling</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { scenario: "Calculator timeout", handling: "Retry ×3 exponential backoff → boundary error event → user notified, process parked for resume" },
          { scenario: "Bedrock rate limit", handling: "Connector retries with backoff → if persistent, agent exits sub-process with fallback message, Camunda parks" },
          { scenario: "Agent loops excessively", handling: "Max-loop boundary event on Sub-process → escalate to sufficiency-forced path or human fallback" },
          { scenario: "Invalid tool output", handling: "Agent retries tool call up to 2× → if still invalid, exits with partial state, Camunda logs for debug" },
          { scenario: "Session inactivity", handling: "Timer boundary event: 30 min → save state, send resume link. Process persists 7 days then auto-cancels" },
          { scenario: "Eligibility violation", handling: "check_eligibility tool returns ineligible → agent removes option from available tools, explains to user" },
        ].map(e => (
          <div key={e.scenario} style={{ background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 5, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#E07B30", fontFamily: "monospace",
              marginBottom: 6 }}>⚠ {e.scenario}</div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.65 }}>{e.handling}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB 3 · AI AGENT CONNECTOR ───────────────────────────────────────────────
function ConnectorTab() {
  const [active, setActive] = useState("subprocess");

  const variants = [
    {
      id: "subprocess",
      name: "AI Agent Sub-process",
      color: C.agent.accent,
      usedFor: ["Intake conversation phase", "Explore & iterate phase"],
      how: "Applied as an element template to an ad-hoc sub-process (job-worker implementation). The Zeebe job worker manages the LLM reasoning loop internally — it sends the system prompt, user prompt, and tool descriptions to Bedrock Converse API, receives tool_use blocks, executes the matching ad-hoc activity, feeds results back to the LLM, and loops until the LLM returns a final text response (no more tool calls).",
      memory: "Native short-term memory: the connector stores the conversation as an external document reference inside the process scope. Each LLM call receives the full conversation history automatically — no manual threading in process variables.",
      config: `# Applied to the ad-hoc sub-process element
provider: BEDROCK
region: eu-west-1
modelId: anthropic.claude-3-5-sonnet-20241022-v2:0
authentication: IAM_ROLE

systemPrompt: |
  {{systemPromptVariable}}        # injected from process var

userPrompt: |
  {{userPromptVariable}}          # constructed by script task upstream

memory:
  enabled: true
  storage: DOCUMENT               # Camunda document store

toolResolution: AUTO              # auto-discovers tools from ad-hoc activities
completionCondition: NO_TOOL_CALL # loop exits when LLM stops calling tools

guardrails:
  guardrailId: danica-pension-guardrail
  trace: ENABLED`,
      flow: [
        "Script task upstream constructs userPromptVariable from current process state",
        "Connector sends systemPrompt + userPromptVariable + auto-resolved tool list to Bedrock",
        "LLM returns tool_use block → connector executes the matching ad-hoc activity",
        "Activity result (tool_result) fed back to LLM as next message",
        "LLM continues calling tools until goal is met → returns final text response",
        "Connector exits sub-process → Camunda reads written process variables + proceeds",
      ],
    },
    {
      id: "task",
      name: "AI Agent Task",
      color: C.calc.accent,
      usedFor: ["Report summary generation (after first simulation)", "Delta explanation", "Eligibility assessment (single-shot)"],
      how: "Applied to a standard service task. Single LLM call with optional tool definitions. Does not loop — returns one response. Camunda explicitly maps input variables into the prompt template and maps the LLM output back to process variables. Best for well-defined, single-goal tasks where you want full BPMN visibility.",
      memory: "No native memory — this is a single-shot call. All context must be injected via the prompt template from process variables (e.g. simulationResult, previousSimulationResult).",
      config: `# Applied to a service task
provider: BEDROCK
region: eu-west-1
modelId: anthropic.claude-3-5-sonnet-20241022-v2:0
authentication: IAM_ROLE

systemPrompt: |
  {{systemPromptVariable}}

userPrompt: |
  {{userPromptVariable}}

tools:                            # optional — only if single-shot tool use needed
  - name: get_product_rules
    description: Retrieve product rules from knowledge base
    inputSchema:
      type: object
      properties:
        product_code: { type: string }

outputMapping:
  resultVariable: aiTaskOutput    # LLM text response stored here
  errorExpression: error          # for boundary error events`,
      flow: [
        "Camunda resolves prompt template variables from process instance",
        "Single Bedrock Converse API call with system + user prompt",
        "If tools defined: LLM may call one tool, result returned, LLM finalises",
        "Text response mapped to output variable",
        "Camunda continues to next BPMN element",
      ],
    },
  ];

  const v = variants.find(x => x.id === active);

  return (
    <div>
      <SecLabel>Camunda AI Agent Connector — Two Variants</SecLabel>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {variants.map(variant => (
          <button key={variant.id} onClick={() => setActive(variant.id)} style={{
            background: active === variant.id ? variant.color + "20" : "transparent",
            border: `1px solid ${active === variant.id ? variant.color : C.border}`,
            borderRadius: 4, color: active === variant.id ? variant.color : C.muted,
            fontFamily: "monospace", fontSize: 12, padding: "8px 20px", cursor: "pointer",
          }}>{variant.name}</button>
        ))}
      </div>

      <div style={{ background: "#06080E", border: `1px solid ${v.color}30`,
        borderRadius: 6, overflow: "hidden", marginBottom: 28 }}>
        {/* Header */}
        <div style={{ background: v.color + "15", padding: "16px 20px",
          borderBottom: `1px solid ${v.color}20`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>{v.name}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {v.usedFor.map(u => <Tag key={u} color={v.color}>{u}</Tag>)}
            </div>
          </div>
        </div>

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace",
              letterSpacing: "2px", marginBottom: 10 }}>HOW IT WORKS</div>
            <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.75, marginBottom: 16 }}>{v.how}</div>

            <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace",
              letterSpacing: "2px", marginBottom: 10 }}>MEMORY HANDLING</div>
            <div style={{ background: C.agent.bg, border: `1px solid ${C.agent.border}`,
              borderRadius: 4, padding: "10px 12px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.dim }}>{v.memory}</div>
            </div>

            <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace",
              letterSpacing: "2px", marginBottom: 10 }}>RUNTIME FLOW</div>
            {v.flow.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: v.color + "22",
                  border: `1px solid ${v.color}55`, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 9, color: v.color, flexShrink: 0,
                  fontFamily: "monospace" }}>{i + 1}</div>
                <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.65, paddingTop: 2 }}>{step}</div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace",
              letterSpacing: "2px", marginBottom: 10 }}>CONNECTOR CONFIGURATION</div>
            <Code accent={v.color}>{v.config}</Code>
          </div>
        </div>
      </div>

      {/* Context injection */}
      <SecLabel>Context Injection — How Process Variables Reach the LLM</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.agent.accent, fontFamily: "monospace", marginBottom: 8 }}>
            Script Task: Build Intake User Prompt
          </div>
          <Code accent={C.agent.accent}>{`// Runs before AI Agent Sub-process (Intake)
// FEEL expression in script task

var profile = {
  "productCode":   productCode,
  "sessionGoal":   "Collect all required information to run pension simulation"
};

var ctx = {
  "currentVariables": {
    "age":               age,
    "annualSalary":      annualSalary,
    "employmentStatus":  employmentStatus,
    "desiredRetirementAge": desiredRetirementAge,
    "hasPartner":        hasPartner,
    "hasDependants":     hasDependants
  },
  "eligibilityFlags":   eligibilityFlags,
  "sufficiencyScore":   sufficiencyScore
};

userPromptVariable =
  "SESSION GOAL: " + profile.sessionGoal +
  "\\nPRODUCT: " + profile.productCode +
  "\\nCURRENT STATE: " + string(ctx) +
  "\\nBegin or continue collecting the required information.";`}
          </Code>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.calc.accent, fontFamily: "monospace", marginBottom: 8 }}>
            Script Task: Build Iterate User Prompt
          </div>
          <Code accent={C.calc.accent}>{`// Runs before AI Agent Sub-process (Iterate)
// Includes simulation state for agent context

var simState = {
  "current": {
    "projectedPensionMonthlyDKK": projectedPensionMonthlyDKK,
    "salaryReplacementPct":       salaryReplacementPct,
    "totalMonthlyPremiumDKK":     totalMonthlyPremiumDKK,
    "coverageBreakdown":          coverageBreakdown
  },
  "configuration": {
    "monthlyContribution":        monthlyContribution,
    "riskProfile":                riskProfile,
    "retirementAge":              desiredRetirementAge,
    "criticalIllnessTier":        criticalIllnessTier,
    "lifeInsuranceEnabled":       lifeInsuranceEnabled
  },
  "runCount":  simulationRunCount,
  "userMessage": incomingUserMessage
};

userPromptVariable =
  "USER MESSAGE: " + simState.userMessage +
  "\\nSIMULATION STATE: " + string(simState) +
  "\\nProcess the user's request.";`}
          </Code>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 4 · TOOLS ───────────────────────────────────────────────────────────
function ToolsTab() {
  const [activePhase, setActivePhase] = useState("intake");
  const [openTool, setOpenTool] = useState(null);

  const phases = [
    {
      id: "intake",
      label: "Intake Agent Tools",
      color: C.agent.accent,
      connector: "AI Agent Sub-process",
      systemPrompt: `You are a friendly, professional pension advisor assistant for Danica Pension, Denmark.
Your goal is to collect all information needed to run a pension simulation for the user.

PRODUCT CONTEXT:
- Product: {{productCode}}
- Target salary replacement at retirement: 80% of current salary
- Danish state pension supplements private pension

QUESTION FRAMEWORK (from advisor guide book):
Required fields: age, annualSalary, employmentStatus, desiredRetirementAge,
                 hasPartner, hasDependants, housingType, otherSavingsDKK

ELIGIBILITY FLAGS (already checked):
{{eligibilityFlags}}

RULES:
- Ask one question at a time in conversational language
- Never invent product rules or amounts
- If age > 50 → do NOT ask about critical illness (already flagged ineligible)
- If selfEmployed → mention different contribution rules apply
- Use the assess_sufficiency tool after each answer to track progress
- When sufficiencyScore reaches 80+, call signal_complete to exit

LANGUAGE: Match the user's language (Danish or English).`,
      tools: [
        {
          name: "ask_question",
          desc: "Delivers the next question to the user in the chat interface.",
          when: "When the agent needs to ask the user for a piece of information.",
          params: [
            { name: "question", type: "string", desc: "The question text to display" },
            { name: "questionKey", type: "string", desc: "The framework field this answers (e.g. age, annualSalary)" },
            { name: "inputHint", type: "string", desc: "Optional hint for UI (e.g. 'Enter a number')" },
          ],
          returns: "userAnswer: string — the user's typed response",
        },
        {
          name: "store_answer",
          desc: "Persists a parsed answer into the Camunda process variables.",
          when: "After receiving a user answer and extracting the typed value.",
          params: [
            { name: "field", type: "string", desc: "Process variable name (e.g. age, annualSalary)" },
            { name: "value", type: "any", desc: "Parsed, typed value (integer, decimal, boolean, enum)" },
          ],
          returns: "success: boolean",
        },
        {
          name: "check_eligibility",
          desc: "Calls the Eligibility Rules Service to evaluate a user's eligibility for a specific cover.",
          when: "Before asking about a coverage option — to avoid offering ineligible products.",
          params: [
            { name: "age", type: "integer", desc: "User age" },
            { name: "employmentStatus", type: "string", desc: "EMPLOYED | SELF_EMPLOYED" },
            { name: "coverType", type: "string", desc: "e.g. CRITICAL_ILLNESS, HEALTH_EXTENSION" },
          ],
          returns: "eligible: boolean, reason: string",
        },
        {
          name: "assess_sufficiency",
          desc: "Evaluates current completeness of collected information and returns a score 0–100.",
          when: "After each answer stored. Drives the sufficiency gateway decision.",
          params: [
            { name: "collectedFields", type: "object", desc: "Current process variable snapshot" },
            { name: "requiredFields", type: "array", desc: "List of mandatory fields for simulation" },
          ],
          returns: "score: integer (0–100), missingFields: string[]",
        },
        {
          name: "signal_complete",
          desc: "Signals the Sub-process connector to exit the feedback loop and return control to Camunda.",
          when: "When sufficiencyScore ≥ 80 — agent is satisfied that enough information has been collected.",
          params: [
            { name: "finalScore", type: "integer", desc: "Final sufficiency score" },
            { name: "summary", type: "string", desc: "Brief summary of what was collected" },
          ],
          returns: "void — triggers sub-process completion",
        },
      ],
    },
    {
      id: "iterate",
      label: "Iterate Agent Tools",
      color: C.calc.accent,
      connector: "AI Agent Sub-process",
      systemPrompt: `You are a pension simulation advisor for Danica Pension, Denmark.
The user is reviewing their simulation results and wants to explore different configurations.

CURRENT SIMULATION STATE:
{{simulationState}}

CONFIGURABLE PARAMETERS:
- desiredRetirementAge      (Integer, years)
- monthlyContribution       (Decimal, DKK)
- contributionPeriodYears   (Integer, years)
- riskProfile               (Enum: LOW | MEDIUM | HIGH)
- payoutType                (Enum: LUMP_SUM | ANNUITY | LIFE_ANNUITY | COMBINED)
- earningCapacityCoverEndAge (Integer: 65 or state pension age)
- criticalIllnessTier       (Enum: NONE | TIER_1 | TIER_2) — only if eligible
- lifeInsuranceEnabled      (Boolean)
- healthInsuranceModules    (List)

ELIGIBILITY FLAGS: {{eligibilityFlags}}

RULES:
- Parse the user's natural language request using parse_intent first
- If intent is CHANGE_PARAMETER → call update_parameter then run_simulation
- After simulation completes → call explain_delta to generate explanation
- If intent is ASK_QUESTION → answer using query_knowledge_base
- If intent is CONFIRM or GENERATE_REPORT → call signal_complete
- Do not invent numbers — always retrieve from get_simulation_result
- Target: 80% salary replacement. Highlight gaps or surplus.`,
      tools: [
        {
          name: "parse_intent",
          desc: "Parses the user's natural language message into a structured intent object.",
          when: "On every incoming user message, before taking any action.",
          params: [
            { name: "userMessage", type: "string", desc: "Raw user input" },
            { name: "currentState", type: "object", desc: "Current process variable snapshot" },
          ],
          returns: "{ intent: CHANGE_PARAMETER|ASK_QUESTION|CONFIRM|GENERATE_REPORT|UNCLEAR, parameters: { field, value }, clarificationNeeded: boolean }",
        },
        {
          name: "update_parameter",
          desc: "Updates a configurable parameter in the Camunda process variables.",
          when: "After parse_intent returns CHANGE_PARAMETER intent.",
          params: [
            { name: "field", type: "string", desc: "Process variable name" },
            { name: "value", type: "any", desc: "New value (typed)" },
          ],
          returns: "success: boolean, previousValue: any",
        },
        {
          name: "run_simulation",
          desc: "Triggers the Camunda simulation sub-process via message correlation.",
          when: "After updating parameters — initiates re-run of all calculators.",
          params: [
            { name: "processInstanceId", type: "string", desc: "Current process instance" },
            { name: "triggerType", type: "string", desc: "RERUN" },
          ],
          returns: "simulationJobId: string — polls until complete",
        },
        {
          name: "get_simulation_result",
          desc: "Retrieves the latest simulation output from process variables after a run completes.",
          when: "After run_simulation returns success.",
          params: [
            { name: "processInstanceId", type: "string", desc: "Current process instance" },
          ],
          returns: "{ projectedPensionMonthlyDKK, salaryReplacementPct, totalMonthlyPremiumDKK, coverageBreakdown }",
        },
        {
          name: "explain_delta",
          desc: "Generates a plain-language explanation of what changed between simulation runs.",
          when: "After get_simulation_result — before displaying updated report to user.",
          params: [
            { name: "previous", type: "object", desc: "Previous simulation result snapshot" },
            { name: "current", type: "object", desc: "New simulation result" },
            { name: "changedParameter", type: "string", desc: "Which parameter was changed" },
            { name: "changedFrom", type: "any" },
            { name: "changedTo", type: "any" },
          ],
          returns: "explanation: string (2–4 sentences, plain language, DKK figures, salary replacement %)",
        },
        {
          name: "query_knowledge_base",
          desc: "Retrieves relevant product information from the Bedrock Knowledge Base via RAG.",
          when: "When user asks a factual question about the product or coverage options.",
          params: [
            { name: "query", type: "string", desc: "User's question, rewritten as a KB search query" },
            { name: "productCode", type: "string", desc: "Filter results to this product" },
          ],
          returns: "answer: string (grounded in KB content), sources: string[]",
        },
        {
          name: "signal_complete",
          desc: "Signals the Sub-process to exit, setting the intent flag for the satisfaction gateway.",
          when: "When user confirms (CONFIRM) or requests report generation (GENERATE_REPORT).",
          params: [
            { name: "exitReason", type: "string", desc: "CONFIRMED | GENERATE_REPORT" },
          ],
          returns: "void",
        },
      ],
    },
  ];

  const p = phases.find(x => x.id === activePhase);

  return (
    <div>
      <SecLabel>Tool Definitions — Ad-Hoc Sub-Process Activities</SecLabel>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {phases.map(ph => (
          <button key={ph.id} onClick={() => { setActivePhase(ph.id); setOpenTool(null); }} style={{
            background: activePhase === ph.id ? ph.color + "20" : "transparent",
            border: `1px solid ${activePhase === ph.id ? ph.color : C.border}`,
            borderRadius: 4, color: activePhase === ph.id ? ph.color : C.muted,
            fontFamily: "monospace", fontSize: 12, padding: "8px 20px", cursor: "pointer",
          }}>{ph.label}</button>
        ))}
      </div>

      {/* System prompt */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: p.color, fontFamily: "monospace", marginBottom: 8 }}>
          SYSTEM PROMPT — {p.connector}
        </div>
        <Code accent={p.color}>{p.systemPrompt}</Code>
      </div>

      {/* Tools */}
      <div style={{ fontSize: 11, color: p.color, fontFamily: "monospace",
        letterSpacing: "2px", marginBottom: 12 }}>TOOL DEFINITIONS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {p.tools.map(tool => {
          const isOpen = openTool === tool.name;
          return (
            <div key={tool.name} onClick={() => setOpenTool(isOpen ? null : tool.name)}
              style={{ background: isOpen ? "#06080E" : C.surface, border: `1px solid ${isOpen ? p.color + "60" : C.border}`,
                borderRadius: 5, cursor: "pointer", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%",
                  background: isOpen ? p.color : C.border + "80", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11,
                  color: isOpen ? "#fff" : C.muted, fontFamily: "monospace", transition: "all 0.15s" }}>
                  ƒ
                </div>
                <code style={{ fontSize: 13, color: isOpen ? p.color : C.dim,
                  fontFamily: "monospace", fontWeight: 600 }}>{tool.name}()</code>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto", marginRight: 4 }}>
                  {isOpen ? "▲" : "▼"}
                </span>
              </div>
              {isOpen && (
                <div style={{ padding: "0 16px 16px 56px" }}>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, marginBottom: 14 }}>
                    {tool.desc}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace",
                        letterSpacing: "2px", marginBottom: 8 }}>WHEN TO USE</div>
                      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.65,
                        paddingLeft: 10, borderLeft: `2px solid ${p.color}40` }}>{tool.when}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace",
                        letterSpacing: "2px", marginBottom: 8 }}>RETURNS</div>
                      <code style={{ fontSize: 11, color: p.color, fontFamily: "monospace",
                        lineHeight: 1.65, display: "block" }}>{tool.returns}</code>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace",
                      letterSpacing: "2px", marginBottom: 8 }}>PARAMETERS</div>
                    {tool.params.map((param, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6,
                        alignItems: "flex-start", background: "#06080E",
                        padding: "8px 12px", borderRadius: 4 }}>
                        <code style={{ color: p.color, fontFamily: "monospace",
                          fontSize: 12, flexShrink: 0 }}>{param.name}</code>
                        <Tag color={C.muted}>{param.type}</Tag>
                        <span style={{ fontSize: 12, color: C.muted }}>{param.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB 5 · DATA MODEL ───────────────────────────────────────────────────────
function DataTab() {
  const [group, setGroup] = useState("Session Context");

  const groups = [
    {
      name: "Session Context",
      color: C.user.accent,
      note: "Set at process start, read-only thereafter",
      vars: [
        { name: "processInstanceId", type: "String", owner: "Camunda", desc: "Zeebe process instance ID — primary key for all lookups" },
        { name: "productCode", type: "String", owner: "User", desc: "Selected Danica product (e.g. DANICA_BALANCE, DANICA_LINK)" },
        { name: "sessionStartedAt", type: "DateTime", owner: "Camunda", desc: "ISO timestamp — used for session timeout boundary event" },
        { name: "consentGiven", type: "Boolean", owner: "User", desc: "GDPR data consent flag — must be true before intake begins" },
      ],
    },
    {
      name: "User Profile",
      color: C.user.accent,
      note: "Written by store_answer tool during Intake Sub-process",
      vars: [
        { name: "age", type: "Integer", owner: "Intake Agent", desc: "User age in years — drives eligibility flags" },
        { name: "annualSalary", type: "Decimal (DKK)", owner: "Intake Agent", desc: "Current gross annual salary — basis for 80% replacement target" },
        { name: "employmentStatus", type: "Enum", owner: "Intake Agent", desc: "EMPLOYED | SELF_EMPLOYED — affects product rules and minimum contributions" },
        { name: "desiredRetirementAge", type: "Integer", owner: "Intake Agent", desc: "Target retirement age — key simulation input" },
        { name: "hasPartner", type: "Boolean", owner: "Intake Agent", desc: "Drives partner life insurance and health cover options" },
        { name: "hasDependants", type: "Boolean", owner: "Intake Agent", desc: "Drives children health insurance option" },
        { name: "housingType", type: "Enum", owner: "Intake Agent", desc: "OWN | RENT" },
        { name: "homeEquityDKK", type: "Decimal (DKK)", owner: "Intake Agent", desc: "Estimated home equity — factored into total retirement assets" },
        { name: "otherSavingsDKK", type: "Decimal (DKK)", owner: "Intake Agent", desc: "Non-pension savings — offsets required pension contribution" },
      ],
    },
    {
      name: "Configuration Parameters",
      color: C.calc.accent,
      note: "Written by update_parameter tool during Iterate Sub-process. Initial values set after first simulation.",
      vars: [
        { name: "monthlyContribution", type: "Decimal (DKK)", owner: "User / Agent", desc: "Monthly pension contribution — primary lever" },
        { name: "contributionPeriodYears", type: "Integer", owner: "Derived", desc: "Derived from retirementAge − age. Can be overridden." },
        { name: "riskProfile", type: "Enum", owner: "User / Agent", desc: "LOW (~3% return) | MEDIUM (~5%) | HIGH (~7%) — applied by calculator" },
        { name: "payoutType", type: "Enum", owner: "User / Agent", desc: "LUMP_SUM | ANNUITY | LIFE_ANNUITY | COMBINED" },
        { name: "earningCapacityCoverEndAge", type: "Integer", owner: "User / Agent", desc: "65 or state pension age — affects loss of earnings premium" },
        { name: "criticalIllnessTier", type: "Enum", owner: "User / Agent", desc: "NONE | TIER_1 (DKK 90,900) | TIER_2 (DKK 181,800) — ineligible if age > 50" },
        { name: "lifeInsuranceEnabled", type: "Boolean", owner: "User / Agent", desc: "Life cover on/off" },
        { name: "partnerLifeInsuranceEnabled", type: "Boolean", owner: "User / Agent", desc: "Spouse/partner cover — only if hasPartner = true" },
        { name: "healthInsuranceModules", type: "List<Enum>", owner: "User / Agent", desc: "BASIC | MODULE_1 | MODULE_2" },
        { name: "childrenHealthEnabled", type: "Boolean", owner: "User / Agent", desc: "Only if hasDependants = true" },
      ],
    },
    {
      name: "Simulation Results",
      color: C.camunda.accent,
      note: "Written by simulation sub-process after each calculator run",
      vars: [
        { name: "projectedPensionMonthlyDKK", type: "Decimal (DKK)", owner: "Calculator", desc: "Projected monthly payout at retirement" },
        { name: "projectedPensionAnnualDKK", type: "Decimal (DKK)", owner: "Calculator", desc: "Annual equivalent" },
        { name: "salaryReplacementPct", type: "Decimal (%)", owner: "Calculator", desc: "Pension ÷ salary — target 80%" },
        { name: "totalMonthlyPremiumDKK", type: "Decimal (DKK)", owner: "Calculator", desc: "Total monthly cost including all covers" },
        { name: "coverageBreakdown", type: "Object", owner: "Calculator", desc: "Per-cover premium split: { pension, criticalIllness, lifeInsurance, healthInsurance }" },
        { name: "simulationRunCount", type: "Integer", owner: "Camunda", desc: "Incremented each run — used for history indexing" },
        { name: "simulationHistory", type: "List<Object>", owner: "Camunda", desc: "Full list of all simulation runs (inputs + outputs + AI explanation). See schema below." },
        { name: "previousSimulationResult", type: "Object", owner: "Camunda", desc: "Snapshot of last run before current — used by explain_delta tool" },
      ],
    },
    {
      name: "Agent State",
      color: C.agent.accent,
      note: "Written by agent tools. Memory within Sub-process is native — these are only the variables that cross the sub-process boundary.",
      vars: [
        { name: "sufficiencyScore", type: "Integer (0–100)", owner: "assess_sufficiency tool", desc: "Current completeness score — read by sufficiency gateway" },
        { name: "eligibilityFlags", type: "Object", owner: "check_eligibility tool", desc: "{ criticalIllnessEligible, selfEmployedRules, healthExtensionEligible }" },
        { name: "lastIntentParsed", type: "Object", owner: "parse_intent tool", desc: "{ intent, parameters: { field, value } } — read by satisfaction gateway" },
        { name: "incomingUserMessage", type: "String", owner: "UI / Camunda", desc: "Latest message from user — injected into iterate prompt" },
        { name: "systemPromptIntake", type: "String", owner: "Camunda", desc: "Resolved system prompt for intake agent (product-context-aware)" },
        { name: "systemPromptIterate", type: "String", owner: "Camunda", desc: "Resolved system prompt for iterate agent (simulation-state-aware)" },
      ],
    },
  ];

  const simHistorySchema = `// Each element in simulationHistory list:
{
  "runNumber":         3,
  "timestamp":         "2025-06-08T14:32:10Z",
  "triggerType":       "USER_CHANGE",       // INITIAL | USER_CHANGE
  "changedParameter":  "desiredRetirementAge",
  "changedFrom":       65,
  "changedTo":         62,
  "inputs": {
    "monthlyContribution":        3500,
    "contributionPeriodYears":    27,
    "riskProfile":                "MEDIUM",
    "payoutType":                 "ANNUITY",
    "criticalIllnessTier":        "TIER_1",
    "lifeInsuranceEnabled":       true,
    "earningCapacityCoverEndAge": 65
  },
  "outputs": {
    "projectedPensionMonthlyDKK": 19800,
    "salaryReplacementPct":       79.2,
    "totalMonthlyPremiumDKK":     4100,
    "coverageBreakdown": {
      "pension":          3500,
      "criticalIllness":   280,
      "lifeInsurance":     190,
      "healthInsurance":   130
    }
  },
  "aiExplanation": "Retiring 3 years earlier reduces your projected monthly pension
by DKK 1,400, bringing salary replacement to 79% — just under the 80% target.
Consider increasing monthly contributions by DKK 200 to close the gap."
}`;

  const g = groups.find(x => x.name === group);

  return (
    <div>
      <SecLabel>Process Variable Model</SecLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        {groups.map(gr => (
          <button key={gr.name} onClick={() => setGroup(gr.name)} style={{
            background: group === gr.name ? gr.color + "20" : "transparent",
            border: `1px solid ${group === gr.name ? gr.color : C.border}`,
            borderRadius: 4, color: group === gr.name ? gr.color : C.muted,
            fontFamily: "monospace", fontSize: 11, padding: "6px 14px", cursor: "pointer",
          }}>{gr.name}</button>
        ))}
      </div>

      {g && (
        <div style={{ marginTop: 16, marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace",
            marginBottom: 12, padding: "6px 10px", background: g.color + "10",
            border: `1px solid ${g.color}30`, borderRadius: 4 }}>{g.note}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Variable", "Type", "Written By", "Description"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "9px 14px", fontSize: 10,
                  color: C.muted, fontFamily: "monospace", letterSpacing: "1.5px",
                  borderBottom: `1px solid ${C.border}`, textTransform: "uppercase" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {g.vars.map((v, i) => (
                <tr key={v.name} style={{ background: i % 2 === 0 ? "#06080E" : C.surface }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace",
                    fontSize: 12, color: g.color }}>{v.name}</td>
                  <td style={{ padding: "10px 14px" }}><Tag color={g.color}>{v.type}</Tag></td>
                  <td style={{ padding: "10px 14px" }}><Tag color={C.muted}>{v.owner}</Tag></td>
                  <td style={{ padding: "10px 14px", fontSize: 12,
                    color: C.dim, lineHeight: 1.55 }}>{v.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SecLabel>simulationHistory — Object Schema</SecLabel>
      <Code accent={C.camunda.accent}>{simHistorySchema}</Code>

      <div style={{ marginTop: 24 }}>
        <SecLabel>What Changed vs Previous Design</SecLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { old: "conversationHistory passed manually on every Bedrock call", updated: "Removed — native to Sub-process connector. No longer a process variable.", color: C.agent.accent },
            { old: "questionsAsked list maintained as process variable", updated: "Removed — agent tracks question state in its own memory within the sub-process.", color: C.agent.accent },
            { old: "pendingFollowUps queued as process variable", updated: "Removed — agent decides follow-ups autonomously; never needs to pre-queue them.", color: C.agent.accent },
            { old: "lastIntentParsed written by a service task", updated: "Written by parse_intent tool inside the iterate agent — same variable, different writer.", color: C.calc.accent },
          ].map((diff, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 5, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6,
                textDecoration: "line-through", lineHeight: 1.6 }}>{diff.old}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ color: diff.color, fontSize: 14, flexShrink: 0 }}>→</span>
                <div style={{ fontSize: 12, color: diff.color, lineHeight: 1.65 }}>{diff.updated}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ fontFamily: "Georgia, serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "28px 40px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "3px", color: C.muted,
              fontFamily: "monospace", textTransform: "uppercase", marginBottom: 8 }}>
              Solution Design v2 · Technical Reference · Danica Pension Denmark
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 400,
              letterSpacing: "-0.3px", color: C.text }}>
              Self-Serve Pension Configurator
            </h1>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {[
              { label: "Camunda 8.8", color: C.camunda.accent },
              { label: "Bedrock (Claude 3.5)", color: C.agent.accent },
              { label: "AI Agent Sub-process", color: C.agent.accent },
              { label: "AI Agent Task", color: C.calc.accent },
            ].map(p => <Pill key={p.label} label={p.label} color={p.color} />)}
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? C.surface : "transparent",
              border: "none",
              borderTop: `2px solid ${activeTab === tab.id ? C.user.accent : "transparent"}`,
              borderBottom: activeTab === tab.id ? `1px solid ${C.surface}` : "none",
              color: activeTab === tab.id ? C.text : C.muted,
              fontFamily: "monospace", fontSize: 11,
              padding: "10px 20px", cursor: "pointer", letterSpacing: "0.3px",
              marginBottom: activeTab === tab.id ? -1 : 0,
            }}>
              <span style={{ marginRight: 7 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "32px 40px" }}>
        {activeTab === "overview"  && <OverviewTab />}
        {activeTab === "bpmn"      && <BpmnTab />}
        {activeTab === "connector" && <ConnectorTab />}
        {activeTab === "tools"     && <ToolsTab />}
        {activeTab === "data"      && <DataTab />}
      </div>
    </div>
  );
}
