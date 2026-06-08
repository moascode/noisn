import { useState } from "react";

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const T = {
  bg: "#F7F5F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EDE6",
  border: "#E2DDD6",
  borderStrong: "#C8C0B4",
  text: "#1A1714",
  dim: "#6B6560",
  muted: "#9E9890",
  s1: { bg: "#0F2744", accent: "#2E7DD1", light: "#EBF3FC" },
  s2: { bg: "#1A3320", accent: "#2DA05A", light: "#EAF7EE" },
  s3: { bg: "#2D1A00", accent: "#C47A20", light: "#FEF3E2" },
  s4: { bg: "#1A0F2D", accent: "#7B4FD4", light: "#F2EDFD" },
  risk: {
    low: { color: "#2DA05A", bg: "#EAF7EE" },
    med: { color: "#C47A20", bg: "#FEF3E2" },
    high: { color: "#C43A2A", bg: "#FDECEA" },
  },
  role: {
    "Process Architect": "#2E7DD1",
    "AI/ML Engineer": "#7B4FD4",
    "Backend Engineer": "#2DA05A",
    "Frontend Engineer": "#C47A20",
    "BA / Domain Expert": "#C43A2A",
    "DevOps / Infra": "#6B6560",
    "QA Engineer": "#1A7B8A",
  },
};

const tabs = [
  { id: "slices",   label: "Delivery Slices",    icon: "▤" },
  { id: "prereqs",  label: "Pre-Build Gates",     icon: "◉" },
  { id: "team",     label: "Team & Roles",        icon: "◎" },
  { id: "deps",     label: "Dependencies",        icon: "⬡" },
  { id: "risks",    label: "Risks & Mitigations", icon: "△" },
  { id: "timeline", label: "Timeline",            icon: "▷" },
];

// ─── DATA ─────────────────────────────────────────────────────────────────────

const slices = [
  {
    id: "s1",
    num: "01",
    name: "Core Loop",
    subtitle: "Intake · First Simulation · Live Report",
    color: T.s1,
    duration: "6 weeks",
    outcome: "A working end-to-end flow: user completes intake conversation, system runs first simulation, live report renders. Fully demonstrable to stakeholders.",
    deliverables: [
      "Camunda process model (entry → intake → simulation → live report)",
      "AI Agent Sub-process for intake (5 tools: ask_question, store_answer, check_eligibility, assess_sufficiency, signal_complete)",
      "Bedrock Knowledge Base — initial product rules + guide book content",
      "Pension amount calculator API (one calculator, real formula)",
      "Live report UI (side-by-side chat + report panel, initial render)",
      "Sufficiency gateway logic",
      "System + user prompt templates for intake agent",
      "Process variable model (session context + user profile + first sim result)",
    ],
    outOfScope: [
      "Parameter changes / re-simulation loop",
      "Coverage configuration (insurance add-ons)",
      "Report generation / PDF export",
      "Auth / identity management",
      "All calculators beyond pension amount",
    ],
    roles: ["Process Architect", "AI/ML Engineer", "Backend Engineer", "Frontend Engineer", "BA / Domain Expert"],
    risks: ["KB content quality determines intake agent quality — needs domain expert involvement from day 1", "Calculator API availability — stub with realistic formula if not ready"],
  },
  {
    id: "s2",
    num: "02",
    name: "Iterate Loop",
    subtitle: "Explore · Parameter Changes · Delta Explanation",
    color: T.s2,
    duration: "5 weeks",
    outcome: "User can change parameters conversationally, re-simulate, and see the live report refresh with a plain-language explanation of what changed. The full iterative advisory loop is working.",
    deliverables: [
      "AI Agent Sub-process for iterate (7 tools: parse_intent, update_parameter, run_simulation, get_simulation_result, explain_delta, query_knowledge_base, signal_complete)",
      "Simulation sub-process (reusable, triggered by both initial and re-run)",
      "Coverage premium calculator API",
      "Benefit projection calculator API",
      "Satisfaction gateway logic",
      "Live report dynamic refresh (per-simulation update, previous vs current diff view)",
      "System + user prompt templates for iterate agent",
      "Script tasks for context injection (userPromptVariable construction)",
      "simulationHistory accumulation",
    ],
    outOfScope: [
      "Coverage configuration UI (toggle insurance add-ons)",
      "Report finalisation / PDF",
      "Auth / identity",
    ],
    roles: ["Process Architect", "AI/ML Engineer", "Backend Engineer", "Frontend Engineer"],
    risks: ["Intent parsing accuracy — needs thorough prompt testing across edge cases", "Simulation loop latency — user expects near-real-time report refresh"],
  },
  {
    id: "s3",
    num: "03",
    name: "Coverage Layer",
    subtitle: "Insurance Configuration · Eligibility · Full Product",
    color: T.s3,
    duration: "4 weeks",
    outcome: "User can configure all insurance add-ons (loss of earning capacity, critical illness, life insurance, health insurance) with eligibility rules enforced. Full Danica product surface is now configurable.",
    deliverables: [
      "Eligibility rules service (age-gated covers, employment status rules)",
      "Coverage configuration tools added to iterate agent toolset",
      "Eligibility flags computed and passed to agent context",
      "Coverage premium calculator extended for all insurance modules",
      "Coverage toggle UI in live report panel",
      "AI guidance on coverage trade-offs (agent flags gaps without pressuring)",
      "Children's health, partner life insurance, health extension flows",
      "KB updated with all eligibility rules and coverage details",
    ],
    outOfScope: [
      "Report PDF generation",
      "Production auth",
      "Monitoring / alerting",
    ],
    roles: ["Process Architect", "AI/ML Engineer", "Backend Engineer", "Frontend Engineer", "BA / Domain Expert"],
    risks: ["Eligibility rules complexity — GDPR and Danish regulatory nuances need BA + legal sign-off", "KB content for all insurance modules — significant content work"],
  },
  {
    id: "s4",
    num: "04",
    name: "Production Hardening",
    subtitle: "Auth · Report · Monitoring · Compliance · Go-Live",
    color: T.s4,
    duration: "5 weeks",
    outcome: "Production-ready system. Users authenticate, complete the full journey, receive a PDF report. Ops team can monitor, alert, and respond to incidents. GDPR compliance documented and verified.",
    deliverables: [
      "User authentication + session management (SSO / Danske Bank identity)",
      "Report finalisation — PDF/HTML dossier (all inputs, sim history, config, projections)",
      "Report delivery (portal + email)",
      "Camunda Operate dashboards (process health, completion rates, error rates)",
      "Alerting runbooks (calculator down, Bedrock throttling, process stuck)",
      "Error boundary testing — all exception paths validated",
      "GDPR compliance — data retention, consent audit trail, right to erasure",
      "Load testing — concurrent sessions, Camunda cluster sizing",
      "Security review — pen test, secrets management, IAM roles",
      "KB governance process — how product rule changes get published",
      "Regression test suite — agent behaviour, simulation accuracy",
      "Go-live checklist + rollback plan",
    ],
    outOfScope: ["Advisor review workflow (future phase)", "Multi-product support beyond initial product", "Mobile native app"],
    roles: ["Process Architect", "AI/ML Engineer", "Backend Engineer", "Frontend Engineer", "DevOps / Infra", "QA Engineer", "BA / Domain Expert"],
    risks: ["Auth integration timeline depends on Danske Bank identity platform availability", "GDPR sign-off may require legal review cycle — start early", "Load test results may require Camunda cluster re-sizing"],
  },
];

const prereqs = [
  {
    category: "Infrastructure",
    icon: "⬡",
    color: T.s1.accent,
    items: [
      { gate: "Camunda 8.8 cluster provisioned", detail: "SaaS (preferred for speed) or self-managed on AWS eu-west-1. AI Agent Connector requires 8.7+.", blocking: true },
      { gate: "AWS account + Bedrock access enabled", detail: "Request access to Claude 3.5 Sonnet model in eu-west-1. Model access approval can take 1–2 business days.", blocking: true },
      { gate: "AWS IAM roles configured", detail: "Camunda connector IAM role with Bedrock:InvokeModel, bedrock:Retrieve, bedrock:RetrieveAndGenerate permissions.", blocking: true },
      { gate: "Bedrock Knowledge Base created", detail: "S3 bucket for source documents + vector index (Amazon OpenSearch Serverless). Embeddings model: Titan Embeddings v2.", blocking: true },
      { gate: "Network topology agreed", detail: "How Camunda reaches calculator APIs — VPC peering, API Gateway, or direct. Security group rules.", blocking: false },
    ],
  },
  {
    category: "Domain Content",
    icon: "▦",
    color: T.s3.accent,
    items: [
      { gate: "Pension advisor guide book digitised", detail: "The question framework and advisory logic that currently lives in the guide book must be structured and ingested into Bedrock KB.", blocking: true },
      { gate: "Danica product rules documented", detail: "Eligibility constraints, coverage limits, payout options — structured as KB source documents (PDF or markdown).", blocking: true },
      { gate: "Calculator formulas specified", detail: "The Excel tool formulas must be formally specified with inputs, outputs, and edge cases before API implementation begins.", blocking: true },
      { gate: "Danish regulatory review", detail: "Confirm that self-serve digital advisory without real-time advisor involvement complies with Danish FSA requirements.", blocking: true },
      { gate: "GDPR data inventory", detail: "Classify all personal data collected, retention periods, lawful basis for processing, right to erasure mechanism.", blocking: false },
    ],
  },
  {
    category: "Team & Governance",
    icon: "◎",
    color: T.s2.accent,
    items: [
      { gate: "Team assembled and onboarded", detail: "All roles confirmed, access provisioned, development environment set up. No partial team starts.", blocking: true },
      { gate: "Stakeholder sign-off on solution design", detail: "Solution design v2 artifact reviewed and approved. Scope of all 4 slices agreed.", blocking: true },
      { gate: "Definition of Done agreed per slice", detail: "What does 'Slice 1 complete' mean? Acceptance criteria written before build starts.", blocking: true },
      { gate: "KB governance owner assigned", detail: "Who owns knowledge base content? Who approves updates? What's the publish process?", blocking: false },
      { gate: "Camunda modeller licences", detail: "Developers need Web Modeller access or Desktop Modeller installed.", blocking: false },
    ],
  },
];

const teamRoles = [
  {
    role: "Process Architect",
    count: 1,
    color: T.role["Process Architect"],
    owns: ["BPMN process model design and maintenance", "Gateway logic and boundary events", "Camunda connector configuration", "Ad-hoc sub-process tool definitions", "Process variable model"],
    slices: ["s1", "s2", "s3", "s4"],
    skills: ["Camunda 8 / Zeebe", "BPMN 2.0", "AI Agent Connector", "FEEL expressions"],
    note: "Most critical hire. Needs Camunda 8 AI connector experience specifically — not just general Camunda.",
  },
  {
    role: "AI/ML Engineer",
    count: 1,
    color: T.role["AI/ML Engineer"],
    owns: ["System + user prompt engineering for both agents", "Bedrock Knowledge Base setup and content structuring", "Guardrails configuration", "Agent behaviour testing and iteration", "RAG quality evaluation"],
    slices: ["s1", "s2", "s3", "s4"],
    skills: ["AWS Bedrock", "Prompt engineering", "RAG / vector DBs", "Claude API", "LLM evaluation"],
    note: "Owns the AI quality — prompt changes are as important as code changes. Must be embedded, not advisory.",
  },
  {
    role: "Backend Engineer",
    count: 2,
    color: T.role["Backend Engineer"],
    owns: ["Calculator API development (pension amount, coverage, projection)", "Eligibility rules service", "Simulation sub-process integration", "Camunda REST API integration", "Process variable serialisation"],
    slices: ["s1", "s2", "s3", "s4"],
    skills: ["REST API design", "Java or Node.js", "Camunda client SDK", "AWS Lambda / ECS"],
    note: "One engineer per calculator workstream. Calculator API readiness is on the critical path from week 1.",
  },
  {
    role: "Frontend Engineer",
    count: 1,
    color: T.role["Frontend Engineer"],
    owns: ["Chat UI + live report panel", "SSE / WebSocket for real-time report refresh", "Coverage toggle controls", "Report rendering (web + PDF export)", "Auth integration (UI layer)"],
    slices: ["s1", "s2", "s3", "s4"],
    skills: ["React", "WebSocket / SSE", "PDF rendering", "Danish UX conventions"],
    note: "Side-by-side chat + live report is the core UX challenge. Start with a working prototype in week 1.",
  },
  {
    role: "BA / Domain Expert",
    count: 1,
    color: T.role["BA / Domain Expert"],
    owns: ["Guide book digitisation and KB content authoring", "Calculator formula specification", "Eligibility rules documentation", "Acceptance testing (is the AI saying the right things?)", "Regulatory liaison"],
    slices: ["s1", "s3"],
    skills: ["Danica product knowledge", "Pension advisory process", "Danish FSA regulatory familiarity"],
    note: "Without this person, the AI says plausible-sounding but wrong things. Not optional.",
  },
  {
    role: "DevOps / Infra",
    count: 1,
    color: T.role["DevOps / Infra"],
    owns: ["AWS infrastructure (ECS, IAM, OpenSearch, S3)", "CI/CD pipelines", "Camunda cluster management", "Monitoring + alerting setup", "Security hardening", "Load testing"],
    slices: ["s1", "s4"],
    skills: ["AWS", "Terraform / CDK", "Camunda Operate", "CloudWatch / Grafana"],
    note: "Needed from week 1 for infra setup, lighter in middle slices, critical again in S4 hardening.",
  },
  {
    role: "QA Engineer",
    count: 1,
    color: T.role["QA Engineer"],
    owns: ["Agent behaviour regression suite", "Simulation accuracy validation", "Error path testing", "Load and performance testing", "GDPR audit trail verification"],
    slices: ["s4"],
    skills: ["Test automation", "LLM output evaluation", "Performance testing", "GDPR compliance testing"],
    note: "Joins in S3, full focus in S4. Agent testing is non-trivial — needs a structured evaluation framework, not just manual spot-checks.",
  },
];

const dependencies = [
  {
    from: "Slice 1", to: "Slice 2",
    type: "Sequential",
    condition: "Simulation sub-process and process variable model must be stable. Agent context injection pattern proven.",
    color: T.s2.accent,
  },
  {
    from: "Slice 2", to: "Slice 3",
    type: "Sequential",
    condition: "Iterate agent toolset and update_parameter pattern must be working. Eligibility flags in process variables.",
    color: T.s3.accent,
  },
  {
    from: "Slice 3", to: "Slice 4",
    type: "Sequential",
    condition: "Full product surface complete. All calculator APIs live. Coverage configuration stable.",
    color: T.s4.accent,
  },
  {
    from: "KB Content", to: "Slice 1",
    type: "Prerequisite (blocking)",
    condition: "Initial guide book + product rules must be ingested before intake agent can be tested meaningfully.",
    color: T.s3.accent,
  },
  {
    from: "Calculator API specs", to: "Slice 1 (parallel)",
    type: "Parallel workstream",
    condition: "Formula specification can happen in parallel with BPMN modelling. API must be ready by week 3 of Slice 1.",
    color: T.s2.accent,
  },
  {
    from: "Regulatory review", to: "Go-live",
    type: "Gating (non-build)",
    condition: "Danish FSA compliance confirmation required before production launch. Start this conversation at project kick-off — do not leave to S4.",
    color: "#C43A2A",
  },
  {
    from: "Auth / identity platform", to: "Slice 4",
    type: "External dependency",
    condition: "Depends on Danske Bank identity platform team. Align early. If delayed, stub with basic auth for S4 start, replace before go-live.",
    color: T.s4.accent,
  },
  {
    from: "Camunda cluster", to: "Slice 1",
    type: "Prerequisite (blocking)",
    condition: "Must be provisioned and accessible before any BPMN deployment. SaaS cluster can be up in hours; self-managed takes longer.",
    color: T.s1.accent,
  },
];

const risks = [
  {
    id: "R1", title: "Agent says something wrong about a product",
    category: "AI Quality", prob: "Medium", impact: "High",
    color: T.risk.high,
    mitigation: "Bedrock Guardrails with grounding check on every response. KB is the single source of truth. BA domain expert validates agent responses in every slice. Never let the LLM quote amounts from training data — always route through KB or calculator.",
    earlySignal: "In S1 testing, spot-check 20+ intake conversations for hallucinated product facts.",
  },
  {
    id: "R2", title: "Calculator API readiness delays build",
    category: "Dependency", prob: "Medium", impact: "High",
    color: T.risk.high,
    mitigation: "Define calculator API contracts in pre-build week 0. Build stubs with realistic formulas (matching Excel tool logic) immediately. Real APIs slot in without changing the process model.",
    earlySignal: "If formula specs aren't signed off by end of week 1, escalate immediately.",
  },
  {
    id: "R3", title: "Regulatory / FSA compliance blocks go-live",
    category: "Compliance", prob: "Low", impact: "Critical",
    color: T.risk.high,
    mitigation: "Engage Danish FSA / legal counsel at project kick-off, not at S4. Frame early: this is a decision-support tool, not automated advice. Advisor review of the finalised report provides the human-in-the-loop safeguard.",
    earlySignal: "Get initial legal opinion before Slice 1 build starts.",
  },
  {
    id: "R4", title: "Simulation latency feels slow to users",
    category: "Performance", prob: "Medium", impact: "Medium",
    color: T.risk.med,
    mitigation: "Set expectation with a progress indicator in the UI during simulation. Target < 3s for calculator round-trip. Bedrock explanation call can be streamed. Parallelize calculator calls in the simulation sub-process where independent.",
    earlySignal: "Measure end-to-end latency on first working simulation in S1. If > 5s, re-architect.",
  },
  {
    id: "R5", title: "KB content quality insufficient for agent grounding",
    category: "AI Quality", prob: "Medium", impact: "High",
    color: T.risk.high,
    mitigation: "BA domain expert owns KB content from day 1. Structure guide book content as clean, factual chunks — avoid narrative prose. Test RAG retrieval quality with a benchmark question set before S1 sign-off.",
    earlySignal: "Run 15-question KB retrieval benchmark before Slice 1 demo.",
  },
  {
    id: "R6", title: "Camunda AI Agent Connector behaviour edge cases",
    category: "Technology", prob: "Low", impact: "Medium",
    color: T.risk.med,
    mitigation: "Process Architect to run a connector spike in week 0 — build a minimal intake agent with 2 tools to validate the feedback loop, memory behaviour, and tool resolution. Identify gaps before full build starts.",
    earlySignal: "Spike results reviewed before S1 day 1.",
  },
  {
    id: "R7", title: "Auth integration delayed by identity platform team",
    category: "Dependency", prob: "Medium", impact: "Medium",
    color: T.risk.med,
    mitigation: "Start auth conversation at project kick-off. Use stub auth (API key / session token) through S1–S3. Real SSO integration is purely a frontend + API gateway change — process model is unaffected.",
    earlySignal: "If identity platform team can't commit by S2 end, implement stub auth as default for S4.",
  },
  {
    id: "R8", title: "GDPR right-to-erasure conflicts with simulationHistory",
    category: "Compliance", prob: "Low", impact: "Medium",
    color: T.risk.med,
    mitigation: "simulationHistory contains personal data. Design erasure process in S4 — Camunda process instance deletion cascade to linked document storage. Data retention policy: auto-delete process instances after N days post-completion.",
    earlySignal: "GDPR data inventory completed before S3 ends.",
  },
];

const timeline = [
  {
    week: "Week 0", label: "Pre-Build Sprint", color: "#6B6560",
    tracks: [
      { role: "All", task: "Project kick-off, team onboarding, environment setup" },
      { role: "Process Architect", task: "Camunda connector spike — minimal intake agent with 2 tools" },
      { role: "BA / Domain Expert", task: "Guide book digitisation begins, calculator formula specification" },
      { role: "DevOps", task: "Camunda SaaS cluster, AWS Bedrock access, IAM roles, KB infrastructure" },
      { role: "All", task: "Regulatory / legal first conversation" },
    ],
    gate: "Pre-build gates met → green-light for Slice 1",
  },
  {
    week: "Weeks 1–6", label: "Slice 1 — Core Loop", color: T.s1.accent,
    tracks: [
      { role: "Process Architect", task: "BPMN model (entry → intake sub-process → simulation → report). Gateway logic. Connector config." },
      { role: "AI/ML Engineer", task: "KB content ingestion. Intake agent system prompt. Tool definitions. Guardrails. Prompt iteration." },
      { role: "Backend ×2", task: "Pension amount calculator API. Simulation sub-process integration. Camunda REST client." },
      { role: "Frontend", task: "Chat UI + live report panel prototype (weeks 1–2). Real integration (weeks 3–6)." },
      { role: "BA", task: "KB content review and validation. Intake conversation acceptance testing." },
    ],
    gate: "Demo: end-to-end intake → simulation → live report. Stakeholder sign-off.",
  },
  {
    week: "Weeks 7–11", label: "Slice 2 — Iterate Loop", color: T.s2.accent,
    tracks: [
      { role: "Process Architect", task: "Iterate sub-process. Satisfaction gateway. Script tasks for context injection. simulationHistory." },
      { role: "AI/ML Engineer", task: "Iterate agent system prompt. 7-tool toolset. Intent parsing prompt. Delta explanation. Prompt regression tests." },
      { role: "Backend ×2", task: "Coverage premium calculator. Benefit projection calculator. Reusable simulation sub-process." },
      { role: "Frontend", task: "Live report dynamic refresh. Previous vs current diff view. Natural language input handling." },
    ],
    gate: "Demo: user changes retirement age conversationally, report refreshes with delta explanation.",
  },
  {
    week: "Weeks 12–15", label: "Slice 3 — Coverage Layer", color: T.s3.accent,
    tracks: [
      { role: "Process Architect", task: "Eligibility rules integration. Coverage tools added to iterate agent. Eligibility flags in process model." },
      { role: "AI/ML Engineer", task: "KB updated with all insurance module content. Coverage guidance prompts. Eligibility-aware agent behaviour." },
      { role: "Backend ×2", task: "Eligibility rules service. Coverage premium calculator extended. All calculator APIs production-grade." },
      { role: "Frontend", task: "Coverage toggle UI. Eligibility state display. Children/partner cover flows." },
      { role: "BA", task: "Eligibility rules validation. Full product acceptance testing. Regulatory liaison continues." },
    ],
    gate: "Demo: full Danica product surface configurable. Eligibility rules enforced. All calculators live.",
  },
  {
    week: "Weeks 16–20", label: "Slice 4 — Production Hardening", color: T.s4.accent,
    tracks: [
      { role: "Process Architect + AI/ML", task: "Agent regression suite. Error boundary testing. Connector edge cases." },
      { role: "Backend ×2", task: "Auth integration. Report PDF generation. Data retention + GDPR erasure API." },
      { role: "Frontend", task: "Auth UI. Report download. Production polish." },
      { role: "DevOps", task: "Monitoring dashboards. Alerting runbooks. Load testing. Security review. Go-live checklist." },
      { role: "QA", task: "Full regression suite. Load testing. GDPR audit trail. Simulation accuracy validation." },
      { role: "BA", task: "UAT sign-off. Regulatory confirmation. KB governance process documented." },
    ],
    gate: "Go-live readiness review. All gates met → production launch.",
  },
];

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Tag({ children, color, bg }) {
  return (
    <span style={{
      background: bg || color + "18",
      border: `1px solid ${color}40`,
      color,
      borderRadius: 3,
      padding: "2px 8px",
      fontSize: 10,
      fontFamily: "monospace",
      letterSpacing: "0.3px",
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function SecLabel({ children, color = T.muted }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: "3px", textTransform: "uppercase",
      color, fontFamily: "monospace", marginBottom: 16,
      paddingBottom: 8, borderBottom: `1px solid ${T.border}`,
    }}>{children}</div>
  );
}

function RoleDot({ role, size = 8 }) {
  const color = T.role[role] || T.muted;
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, marginRight: 5, flexShrink: 0 }} />;
}

// ─── SLICES TAB ───────────────────────────────────────────────────────────────
function SlicesTab() {
  const [open, setOpen] = useState("s1");

  return (
    <div>
      <SecLabel>Four Vertical Slices — Each Deployable, Each Demonstrable</SecLabel>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {slices.map(s => (
          <button key={s.id} onClick={() => setOpen(s.id)} style={{
            background: open === s.id ? s.color.bg : T.surfaceAlt,
            border: `2px solid ${open === s.id ? s.color.accent : T.border}`,
            borderRadius: 6, padding: "10px 18px", cursor: "pointer", textAlign: "left",
            minWidth: 160,
          }}>
            <div style={{ fontSize: 10, color: open === s.id ? s.color.accent : T.muted, fontFamily: "monospace", marginBottom: 4 }}>SLICE {s.num}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: open === s.id ? "#fff" : T.text }}>{s.name}</div>
            <div style={{ fontSize: 11, color: open === s.id ? s.color.accent : T.muted, marginTop: 2 }}>{s.duration}</div>
          </button>
        ))}
      </div>

      {slices.filter(s => s.id === open).map(s => (
        <div key={s.id}>
          <div style={{ background: s.color.bg, border: `1px solid ${s.color.accent}40`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${s.color.accent}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, color: s.color.accent, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 6 }}>SLICE {s.num} · {s.duration}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: s.color.accent }}>{s.subtitle}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 280, justifyContent: "flex-end" }}>
                  {s.roles.map(r => (
                    <div key={r} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px" }}>
                      <RoleDot role={r} size={6} />
                      <span style={{ fontSize: 10, color: "#ccc", fontFamily: "monospace" }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: "#ccc", lineHeight: 1.75 }}>{s.outcome}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              <div style={{ padding: "20px 24px", borderRight: `1px solid ${s.color.accent}20` }}>
                <div style={{ fontSize: 10, color: s.color.accent, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 14 }}>IN SCOPE</div>
                {s.deliverables.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ color: s.color.accent, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6 }}>{d}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ fontSize: 10, color: "#888", fontFamily: "monospace", letterSpacing: "2px", marginBottom: 14 }}>OUT OF SCOPE (THIS SLICE)</div>
                {s.outOfScope.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#555", fontSize: 14, flexShrink: 0, marginTop: 1 }}>–</span>
                    <span style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>{d}</span>
                  </div>
                ))}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${s.color.accent}20` }}>
                  <div style={{ fontSize: 10, color: "#E07B30", fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>SLICE RISKS</div>
                  {s.risks.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#aaa", marginBottom: 8, paddingLeft: 10, borderLeft: "2px solid #E07B3040", lineHeight: 1.6 }}>{r}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PREREQS TAB ──────────────────────────────────────────────────────────────
function PrereqsTab() {
  const [open, setOpen] = useState(null);

  return (
    <div>
      <SecLabel>Pre-Build Gates — Nothing Starts Until These Are Met</SecLabel>
      <div style={{ background: "#FEF3E2", border: "1px solid #C47A2040", borderLeft: "4px solid #C47A20", borderRadius: 5, padding: "12px 16px", marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#C47A20", fontFamily: "monospace", marginBottom: 4 }}>WHY THIS MATTERS</div>
        <div style={{ fontSize: 13, color: "#6B4A10", lineHeight: 1.7 }}>
          Starting the build before these gates are met is the single most common cause of wasted effort in AI projects. A missing calculator spec means the backend engineers build against assumptions. Missing KB content means the AI agent is untestable. Missing regulatory clarity means you may need to redesign post-build.
        </div>
      </div>

      {prereqs.map((cat) => (
        <div key={cat.category} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16, color: cat.color }}>{cat.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{cat.category}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.items.map((item, i) => (
              <div key={i} onClick={() => setOpen(open === `${cat.category}-${i}` ? null : `${cat.category}-${i}`)}
                style={{ background: T.surface, border: `1px solid ${open === `${cat.category}-${i}` ? cat.color : T.border}`,
                  borderLeft: `4px solid ${item.blocking ? cat.color : T.borderStrong}`,
                  borderRadius: 5, padding: "12px 16px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 16 }}>{item.blocking ? "🔴" : "🟡"}</span>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{item.gate}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Tag color={item.blocking ? "#C43A2A" : "#C47A20"}>{item.blocking ? "BLOCKING" : "IMPORTANT"}</Tag>
                    <span style={{ color: T.muted, fontSize: 12 }}>{open === `${cat.category}-${i}` ? "▲" : "▼"}</span>
                  </div>
                </div>
                {open === `${cat.category}-${i}` && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 13, color: T.dim, lineHeight: 1.7 }}>
                    {item.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 16, padding: "16px", background: T.surfaceAlt, borderRadius: 6, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span>🔴</span><span style={{ fontSize: 12, color: T.dim }}>Blocking — build cannot start without this</span></div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span>🟡</span><span style={{ fontSize: 12, color: T.dim }}>Important — resolve within first 2 weeks</span></div>
      </div>
    </div>
  );
}

// ─── TEAM TAB ─────────────────────────────────────────────────────────────────
function TeamTab() {
  const [open, setOpen] = useState("Process Architect");
  const totalFTE = teamRoles.reduce((a, r) => a + r.count, 0);

  return (
    <div>
      <SecLabel>Team Composition — {totalFTE} FTE</SecLabel>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        {/* Role list */}
        <div>
          {teamRoles.map(r => (
            <div key={r.role} onClick={() => setOpen(r.role)}
              style={{ background: open === r.role ? T.surfaceAlt : T.surface,
                border: `1px solid ${open === r.role ? r.color : T.border}`,
                borderLeft: `4px solid ${r.color}`, borderRadius: 5,
                padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.role}</div>
                <Tag color={r.color}>×{r.count}</Tag>
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                {r.slices.map(s => {
                  const sl = slices.find(x => x.id === s);
                  return <div key={s} style={{ width: 20, height: 4, borderRadius: 2, background: sl.color.accent }} />;
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: "12px 14px", background: T.surfaceAlt, borderRadius: 5 }}>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: "monospace", marginBottom: 8 }}>SLICE COVERAGE KEY</div>
            {slices.map(s => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <div style={{ width: 20, height: 4, borderRadius: 2, background: s.color.accent }} />
                <span style={{ fontSize: 11, color: T.dim }}>S{s.num} {s.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {teamRoles.filter(r => r.role === open).map(r => (
          <div key={r.role} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `3px solid ${r.color}`, borderRadius: 6, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>{r.role}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Tag color={r.color}>×{r.count} FTE</Tag>
                  <Tag color={T.muted}>Slices: {r.slices.map(s => slices.find(x => x.id === s).num).join(", ")}</Tag>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: r.color, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>OWNS</div>
                {r.owns.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                    <span style={{ color: r.color, flexShrink: 0, marginTop: 2 }}>→</span>
                    <span style={{ fontSize: 12, color: T.dim, lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 10, color: r.color, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>REQUIRED SKILLS</div>
                {r.skills.map((s, i) => (
                  <div key={i} style={{ display: "inline-block", marginRight: 6, marginBottom: 6 }}>
                    <Tag color={r.color}>{s}</Tag>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: r.color + "10", border: `1px solid ${r.color}30`, borderRadius: 5, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: r.color, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 6 }}>HIRING / STAFFING NOTE</div>
              <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.7 }}>{r.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DEPS TAB ─────────────────────────────────────────────────────────────────
function DepsTab() {
  return (
    <div>
      <SecLabel>Dependencies — Internal, External, and Parallel Workstreams</SecLabel>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dependencies.map((dep, i) => (
          <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "16px 20px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <div style={{ background: dep.color + "18", border: `1px solid ${dep.color}40`, borderRadius: 4, padding: "4px 10px", fontSize: 12, color: dep.color, fontFamily: "monospace", fontWeight: 700 }}>{dep.from}</div>
              <div style={{ color: dep.color, fontSize: 18 }}>→</div>
              <div style={{ background: dep.color + "18", border: `1px solid ${dep.color}40`, borderRadius: 4, padding: "4px 10px", fontSize: 12, color: dep.color, fontFamily: "monospace", fontWeight: 700 }}>{dep.to}</div>
              <div style={{ marginLeft: "auto" }}>
                <Tag color={dep.type.includes("blocking") || dep.type.includes("blocking") ? "#C43A2A" : dep.type.includes("External") ? "#C47A20" : dep.color}>{dep.type}</Tag>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.7, paddingLeft: 4 }}>{dep.condition}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <SecLabel>Parallel Workstreams — Week 0</SecLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { title: "BPMN + Connector", color: T.s1.accent, tasks: ["Process model skeleton", "Connector spike (2-tool intake agent)", "Gateway logic design", "Variable model draft"] },
            { title: "KB Content + AI", color: T.agent.accent, tasks: ["Guide book digitisation", "Product rules structuring", "KB ingestion pipeline setup", "Initial prompt drafts"] },
            { title: "Calculator APIs", color: T.s2.accent, tasks: ["Formula specification sign-off", "API contract definition (OpenAPI)", "Stub implementation", "Test data set preparation"] },
          ].map(w => (
            <div key={w.title} style={{ background: T.surface, border: `1px solid ${w.color}30`, borderTop: `3px solid ${w.color}`, borderRadius: 5, padding: 16 }}>
              <div style={{ fontSize: 12, color: w.color, fontFamily: "monospace", fontWeight: 700, marginBottom: 12 }}>{w.title}</div>
              {w.tasks.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, alignItems: "flex-start" }}>
                  <span style={{ color: w.color, flexShrink: 0, fontSize: 12, marginTop: 1 }}>·</span>
                  <span style={{ fontSize: 12, color: T.dim, lineHeight: 1.55 }}>{t}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RISKS TAB ────────────────────────────────────────────────────────────────
function RisksTab() {
  const [open, setOpen] = useState(null);

  return (
    <div>
      <SecLabel>Risk Register</SecLabel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 28 }}>
        {[
          { label: "High", count: risks.filter(r => r.color === T.risk.high).length, color: T.risk.high.color },
          { label: "Medium", count: risks.filter(r => r.color === T.risk.med).length, color: T.risk.med.color },
        ].map(s => (
          <div key={s.label} style={{ background: s.color + "10", border: `1px solid ${s.color}30`, borderRadius: 6, padding: "14px 20px", display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div>
              <div style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.label} Risk{s.count !== 1 ? "s" : ""}</div>
              <div style={{ fontSize: 11, color: T.muted }}>All have mitigations defined</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {risks.map(risk => (
          <div key={risk.id} onClick={() => setOpen(open === risk.id ? null : risk.id)}
            style={{ background: T.surface, border: `1px solid ${open === risk.id ? risk.color.color : T.border}`,
              borderLeft: `4px solid ${risk.color.color}`, borderRadius: 5, cursor: "pointer", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: risk.color.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: risk.color.color, fontFamily: "monospace", fontWeight: 700, flexShrink: 0 }}>
                {risk.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3 }}>{risk.title}</div>
                <Tag color={T.muted}>{risk.category}</Tag>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Tag color={risk.prob === "Medium" ? T.risk.med.color : "#C43A2A"}>Prob: {risk.prob}</Tag>
                <Tag color={risk.impact === "Critical" ? "#8B0000" : risk.impact === "High" ? "#C43A2A" : T.risk.med.color}>Impact: {risk.impact}</Tag>
                <span style={{ color: T.muted, fontSize: 12, marginLeft: 4 }}>{open === risk.id ? "▲" : "▼"}</span>
              </div>
            </div>
            {open === risk.id && (
              <div style={{ padding: "0 16px 16px 60px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: risk.color.color, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 8 }}>MITIGATION</div>
                  <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.75 }}>{risk.mitigation}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 8 }}>EARLY WARNING SIGNAL</div>
                  <div style={{ background: risk.color.bg, border: `1px solid ${risk.color.color}30`,
                    borderRadius: 4, padding: "10px 12px", fontSize: 13, color: T.dim, lineHeight: 1.7 }}>
                    {risk.earlySignal}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TIMELINE TAB ─────────────────────────────────────────────────────────────
function TimelineTab() {
  const [open, setOpen] = useState("Weeks 1–6");

  const totalWeeks = 20;

  return (
    <div>
      <SecLabel>Delivery Timeline — 20 Weeks to Production</SecLabel>

      {/* Gantt-style bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", height: 48, borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {[
            { label: "W0", width: 1/21, color: "#6B6560", text: "Pre-build" },
            { label: "S1", width: 6/21, color: T.s1.accent, text: "Slice 1 · 6w" },
            { label: "S2", width: 5/21, color: T.s2.accent, text: "Slice 2 · 5w" },
            { label: "S3", width: 4/21, color: T.s3.accent, text: "Slice 3 · 4w" },
            { label: "S4", width: 5/21, color: T.s4.accent, text: "Slice 4 · 5w" },
          ].map((bar, i) => (
            <div key={i} style={{ width: `${bar.width * 100}%`, background: bar.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRight: i < 4 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
              <span style={{ fontSize: 11, color: "#fff", fontFamily: "monospace",
                fontWeight: 700, textAlign: "center", padding: "0 4px" }}>{bar.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: T.muted, fontFamily: "monospace" }}>Week 0</span>
          <span style={{ fontSize: 10, color: T.muted, fontFamily: "monospace" }}>Week 20 → Go-live</span>
        </div>
      </div>

      {/* Detailed phases */}
      {timeline.map((phase) => (
        <div key={phase.week} style={{ marginBottom: 12 }}>
          <div onClick={() => setOpen(open === phase.week ? null : phase.week)}
            style={{ background: T.surface, border: `1px solid ${open === phase.week ? phase.color : T.border}`,
              borderLeft: `5px solid ${phase.color}`, borderRadius: 5, padding: "14px 18px",
              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: phase.color, fontFamily: "monospace",
                letterSpacing: "1px", marginBottom: 3 }}>{phase.week}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{phase.label}</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ background: phase.color + "15", border: `1px solid ${phase.color}40`,
                borderRadius: 4, padding: "6px 12px", fontSize: 11, color: phase.color,
                fontFamily: "monospace" }}>🏁 {phase.gate.split("→")[0].trim()}</div>
              <span style={{ color: T.muted }}>{open === phase.week ? "▲" : "▼"}</span>
            </div>
          </div>

          {open === phase.week && (
            <div style={{ border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 5px 5px",
              background: T.surfaceAlt, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Role", "Workstream"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10,
                      color: T.muted, fontFamily: "monospace", letterSpacing: "1.5px",
                      borderBottom: `1px solid ${T.border}`, textTransform: "uppercase",
                      background: T.surface }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {phase.tracks.map((track, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? T.surface : T.surfaceAlt }}>
                      <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <RoleDot role={track.role} />
                          <span style={{ fontSize: 11, color: T.dim, fontFamily: "monospace" }}>{track.role}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: T.text, lineHeight: 1.6 }}>{track.task}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "12px 16px", background: phase.color + "10",
                borderTop: `1px solid ${phase.color}20`, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: phase.color }}>🏁</span>
                <span style={{ fontSize: 12, color: phase.color, fontFamily: "monospace" }}>SLICE GATE: {phase.gate}</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Summary */}
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Total Duration", value: "~20 weeks", color: T.s1.accent },
          { label: "Team Size", value: "7 FTE", color: T.s2.accent },
          { label: "Delivery Slices", value: "4 vertical", color: T.s3.accent },
          { label: "First Demo", value: "Week 6", color: T.s4.accent },
        ].map(s => (
          <div key={s.label} style={{ background: T.surface, border: `1px solid ${T.border}`,
            borderTop: `3px solid ${s.color}`, borderRadius: 5, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.muted, fontFamily: "monospace" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("slices");

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: T.bg, minHeight: "100vh", color: T.text }}>
      {/* Header */}
      <div style={{ background: T.text, padding: "32px 40px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "4px", color: "#6B6560",
              fontFamily: "monospace", textTransform: "uppercase", marginBottom: 10 }}>
              Delivery Plan · Danica Pension · Full Production Build
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 400, color: "#F7F5F0", letterSpacing: "-0.5px" }}>
              Self-Serve Pension Configurator
            </h1>
            <div style={{ fontSize: 13, color: "#6B6560", marginTop: 6, fontFamily: "monospace" }}>
              4 slices · ~20 weeks · 7 FTE · Production-ready
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {slices.map(s => (
              <div key={s.id} style={{ background: s.color.bg, border: `1px solid ${s.color.accent}40`,
                borderRadius: 5, padding: "8px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: s.color.accent, fontFamily: "monospace", marginBottom: 2 }}>S{s.num}</div>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: s.color.accent }}>{s.duration}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex" }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? T.bg : "transparent",
              border: "none",
              borderTop: `2px solid ${activeTab === tab.id ? T.s1.accent : "transparent"}`,
              borderBottom: activeTab === tab.id ? `1px solid ${T.bg}` : "none",
              color: activeTab === tab.id ? T.text : "#6B6560",
              fontFamily: "monospace", fontSize: 11, padding: "10px 18px",
              cursor: "pointer", letterSpacing: "0.3px",
              marginBottom: activeTab === tab.id ? -1 : 0,
            }}>
              <span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "32px 40px" }}>
        {activeTab === "slices"   && <SlicesTab />}
        {activeTab === "prereqs"  && <PrereqsTab />}
        {activeTab === "team"     && <TeamTab />}
        {activeTab === "deps"     && <DepsTab />}
        {activeTab === "risks"    && <RisksTab />}
        {activeTab === "timeline" && <TimelineTab />}
      </div>
    </div>
  );
}
