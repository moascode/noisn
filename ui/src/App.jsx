import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CAMUNDA_API = import.meta.env.VITE_CAMUNDA_API_URL || "http://localhost:8080";
const POLL_INTERVAL_MS = 2000;

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F1EC",
  surface: "#FFFFFF",
  border: "#E0DBD3",
  text: "#1C1916",
  dim: "#6B6560",
  muted: "#A09890",
  accent: "#1B4F8A",
  accentLight: "#EBF3FC",
  green: "#1A7A3F",
  greenLight: "#E8F5ED",
  orange: "#B85C00",
  orangeLight: "#FEF3E2",
  red: "#9B2020",
  redLight: "#FDECEA",
  userBubble: "#1B4F8A",
  agentBubble: "#FFFFFF",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n)
    : "—";

const fmtPct = (n) => (n != null ? `${n.toFixed(1)}%` : "—");

// ─── CAMUNDA API CLIENT ───────────────────────────────────────────────────────
async function startProcess(productCode) {
  const res = await fetch(`${CAMUNDA_API}/v1/process-instances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      processDefinitionKey: "pension-configurator",
      variables: { productCode, consentGiven: true },
    }),
  });
  if (!res.ok) throw new Error("Failed to start process");
  return res.json();
}

async function getVariables(processInstanceKey) {
  const res = await fetch(
    `${CAMUNDA_API}/v1/process-instances/${processInstanceKey}/variables`,
    { headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.value ?? v]));
}

async function sendUserMessage(processInstanceKey, message) {
  await fetch(`${CAMUNDA_API}/v1/process-instances/${processInstanceKey}/variables/incomingUserMessage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: message }),
  });
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ReplacementGauge({ pct }) {
  const target = 80;
  const clamped = Math.min(Math.max(pct || 0, 0), 120);
  const color = pct >= target ? C.green : pct >= 60 ? C.orange : C.red;
  const bgColor = pct >= target ? C.greenLight : pct >= 60 ? C.orangeLight : C.redLight;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>SALARY REPLACEMENT</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{fmtPct(pct)}</span>
      </div>
      <div style={{ position: "relative", height: 8, background: C.border, borderRadius: 4 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${Math.min(clamped / 120 * 100, 100)}%`,
          background: color, borderRadius: 4, transition: "width 0.6s ease",
        }} />
        {/* Target marker at 80% */}
        <div style={{
          position: "absolute", left: `${target / 120 * 100}%`,
          top: -3, bottom: -3, width: 2,
          background: C.dim, borderRadius: 1,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Target: 80%</span>
      </div>
    </div>
  );
}

function SimulationReport({ vars }) {
  if (!vars?.projectedPensionMonthlyDKK) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100%", color: C.muted, gap: 12 }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>◎</div>
      <div style={{ fontSize: 13, fontFamily: "monospace" }}>Awaiting simulation...</div>
      <div style={{ fontSize: 11, color: C.muted, textAlign: "center", maxWidth: 200, lineHeight: 1.6 }}>
        Complete the intake conversation to generate your first simulation
      </div>
    </div>
  );

  const cb = vars.coverageBreakdown || {};
  const reaches = vars.reachesTarget;
  const run = vars.simulationRunCount || 1;

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "20px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 4 }}>
            SIMULATION #{run}
          </div>
          <div style={{ fontSize: 13, color: C.dim }}>{vars.productCode || "Danica Pension"}</div>
        </div>
        <div style={{
          background: reaches ? C.greenLight : C.orangeLight,
          border: `1px solid ${reaches ? C.green : C.orange}30`,
          borderRadius: 4, padding: "4px 10px", fontSize: 11,
          color: reaches ? C.green : C.orange, fontFamily: "monospace",
        }}>
          {reaches ? "✓ Target reached" : "Below 80% target"}
        </div>
      </div>

      {/* Replacement gauge */}
      <ReplacementGauge pct={vars.salaryReplacementPct} />

      {/* Key figures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Monthly Pension", value: fmt(vars.projectedPensionMonthlyDKK), accent: C.accent },
          { label: "Annual Pension", value: fmt(vars.projectedPensionAnnualDKK), accent: C.accent },
          { label: "Monthly Cost", value: fmt(vars.totalMonthlyPremiumDKK), accent: C.dim },
          { label: "Retirement Age", value: vars.desiredRetirementAge ? `Age ${vars.desiredRetirementAge}` : "—", accent: C.dim },
        ].map(f => (
          <div key={f.label} style={{ background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace",
              letterSpacing: "1.5px", marginBottom: 6 }}>{f.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: f.accent }}>{f.value}</div>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace",
          letterSpacing: "2px", marginBottom: 10 }}>CURRENT CONFIGURATION</div>
        {[
          ["Contribution", fmt(vars.monthlyContribution) + "/month"],
          ["Risk Profile", vars.riskProfile || "MEDIUM"],
          ["Payout Type", vars.payoutType || "ANNUITY"],
          ["Critical Illness", vars.criticalIllnessTier || "NONE"],
          ["Life Insurance", vars.lifeInsuranceEnabled ? "Enabled" : "Disabled"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between",
            padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <span style={{ color: C.dim }}>{k}</span>
            <span style={{ color: C.text, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Coverage breakdown */}
      {cb && Object.keys(cb).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace",
            letterSpacing: "2px", marginBottom: 10 }}>MONTHLY COST BREAKDOWN</div>
          {Object.entries(cb)
            .filter(([k]) => k !== "total" && cb[k] > 0)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.dim, textTransform: "capitalize" }}>
                  {k.replace(/_/g, " ")}
                </span>
                <span style={{ fontSize: 12, color: C.text, fontFamily: "monospace" }}>
                  {fmt(v)}/mo
                </span>
              </div>
            ))}
          <div style={{ display: "flex", justifyContent: "space-between",
            padding: "8px 0", fontSize: 13, fontWeight: 700, color: C.text }}>
            <span>Total</span>
            <span style={{ fontFamily: "monospace" }}>{fmt(cb.total)}/mo</span>
          </div>
        </div>
      )}

      {/* AI explanation */}
      {vars.aiExplanation && (
        <div style={{ background: C.accentLight, border: `1px solid ${C.accent}30`,
          borderRadius: 6, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, color: C.accent, fontFamily: "monospace",
            letterSpacing: "2px", marginBottom: 6 }}>ADVISOR NOTE</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75 }}>{vars.aiExplanation}</div>
        </div>
      )}

      {/* Simulation history mini chart */}
      {vars.simulationHistory?.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace",
            letterSpacing: "2px", marginBottom: 10 }}>SIMULATION HISTORY</div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 48 }}>
            {vars.simulationHistory.map((run, i) => {
              const pct = run.outputs?.salary_replacement_pct || run.salaryReplacementPct || 0;
              const maxPct = 100;
              const h = Math.max(4, (pct / maxPct) * 48);
              const isLast = i === vars.simulationHistory.length - 1;
              return (
                <div key={i} title={`Run ${i + 1}: ${fmtPct(pct)}`}
                  style={{ flex: 1, height: h, borderRadius: "2px 2px 0 0",
                    background: isLast ? C.accent : C.border,
                    transition: "height 0.4s ease", cursor: "pointer" }} />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Run 1</span>
            <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
              Run {vars.simulationHistory.length} (current)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ role, content, isTyping }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12 }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#fff", marginRight: 8, flexShrink: 0, marginTop: 2 }}>
          D
        </div>
      )}
      <div style={{
        maxWidth: "75%",
        background: isUser ? C.userBubble : C.agentBubble,
        color: isUser ? "#fff" : C.text,
        border: isUser ? "none" : `1px solid ${C.border}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "10px 14px",
        fontSize: 14,
        lineHeight: 1.65,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        {isTyping ? (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: C.muted,
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        ) : content}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("select"); // select | chat
  const [product, setProduct] = useState("DANICA_BALANCE");
  const [processKey, setProcessKey] = useState(null);
  const [variables, setVariables] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);
  const prevVarsRef = useRef({});

  // ── Polling for process variable updates ──────────────────────────────────
  useEffect(() => {
    if (!processKey) return;
    const poll = setInterval(async () => {
      try {
        const vars = await getVariables(processKey);
        if (!vars) return;
        setVariables(vars);

        // Detect new AI explanation → add agent message
        if (vars.aiExplanation && vars.aiExplanation !== prevVarsRef.current.aiExplanation) {
          setIsTyping(false);
          setMessages(prev => [...prev, { role: "agent", content: vars.aiExplanation }]);
        }

        // Detect pending question from agent → add as agent message
        if (vars.pendingQuestion?.text && !vars.pendingQuestion?.answered &&
            vars.pendingQuestion?.text !== prevVarsRef.current.pendingQuestion?.text) {
          setIsTyping(false);
          setMessages(prev => [...prev, { role: "agent", content: vars.pendingQuestion.text }]);
        }

        // Detect KB answer
        if (vars.kbAnswer && vars.kbAnswer !== prevVarsRef.current.kbAnswer) {
          setIsTyping(false);
          setMessages(prev => [...prev, { role: "agent", content: vars.kbAnswer }]);
        }

        prevVarsRef.current = vars;
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [processKey]);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Start process ─────────────────────────────────────────────────────────
  const handleStart = async () => {
    try {
      const instance = await startProcess(product);
      setProcessKey(instance.key || instance.processInstanceKey);
      setScreen("chat");
      setMessages([{
        role: "agent",
        content: `Welcome to Danica Pension. I'll help you configure your ${product === "DANICA_BALANCE" ? "Danica Balance" : "Danica Link"} pension. Let's start with a few questions to understand your situation.`,
      }]);
      setIsTyping(true);
    } catch (err) {
      alert("Could not start process. Check your Camunda connection.\n" + err.message);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    const message = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setIsTyping(true);
    try {
      await sendUserMessage(processKey, message);
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── PRODUCT SELECTION SCREEN ──────────────────────────────────────────────
  if (screen === "select") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
        <div style={{ width: 440, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ background: C.accent, padding: "28px 32px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontFamily: "monospace",
              letterSpacing: "3px", marginBottom: 8 }}>DANICA PENSION · DENMARK</div>
            <div style={{ fontSize: 22, color: "#fff", fontWeight: 400 }}>Pension Configurator</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
              Configure your pension and explore your options
            </div>
          </div>
          <div style={{ padding: "28px 32px" }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>Select your pension product</div>
            {[
              { id: "DANICA_BALANCE", name: "Danica Balance", desc: "Expert-managed lifecycle investment. Risk adjusts automatically as you approach retirement." },
              { id: "DANICA_LINK", name: "Danica Link", desc: "Self-directed investment. You choose how your pension savings are invested." },
            ].map(p => (
              <div key={p.id} onClick={() => setProduct(p.id)}
                style={{ border: `2px solid ${product === p.id ? C.accent : C.border}`,
                  borderRadius: 8, padding: "14px 16px", marginBottom: 10, cursor: "pointer",
                  background: product === p.id ? C.accentLight : C.surface,
                  transition: "all 0.15s" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%",
                    border: `2px solid ${product === p.id ? C.accent : C.border}`,
                    background: product === p.id ? C.accent : "transparent",
                    flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{p.desc}</div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={handleStart} style={{
              width: "100%", background: C.accent, color: "#fff", border: "none",
              borderRadius: 8, padding: "14px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", marginTop: 8, letterSpacing: "0.3px",
            }}>
              Start Configuration →
            </button>
            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
              By continuing you consent to Danica processing your data for pension advisory purposes.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN CHAT + REPORT SCREEN ─────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "Georgia, serif", overflow: "hidden" }}>
      {/* CSS for typing animation */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
      `}</style>

      {/* ── CHAT PANEL ── */}
      <div style={{ width: "45%", display: "flex", flexDirection: "column",
        borderRight: `1px solid ${C.border}`, background: C.surface }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff", fontWeight: 700 }}>D</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Danica Advisor</div>
            <div style={{ fontSize: 11, color: variables.projectedPensionMonthlyDKK ? C.green : C.orange,
              fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%",
                background: variables.projectedPensionMonthlyDKK ? C.green : C.orange }} />
              {variables.projectedPensionMonthlyDKK ? "Simulation active" : "Collecting information"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
            {processKey ? `#${String(processKey).slice(-8)}` : ""}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {isTyping && <ChatBubble role="agent" isTyping={true} />}
          <div ref={chatEndRef} />
        </div>

        {/* Sufficiency indicator */}
        {variables.sufficiencyScore > 0 && variables.sufficiencyScore < 80 && (
          <div style={{ margin: "0 16px", padding: "8px 12px", background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.dim }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Information collected</span>
              <span style={{ fontFamily: "monospace", color: C.accent }}>{variables.sufficiencyScore}%</span>
            </div>
            <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${variables.sufficiencyScore}%`,
                background: C.accent, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message or ask a question..."
              rows={2}
              style={{
                flex: 1, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "10px 12px", fontSize: 14, fontFamily: "Georgia, serif",
                color: C.text, background: C.surface, resize: "none", outline: "none",
                lineHeight: 1.5,
              }}
            />
            <button onClick={handleSend} disabled={isSending || !inputValue.trim()}
              style={{
                background: inputValue.trim() ? C.accent : C.border,
                color: inputValue.trim() ? "#fff" : C.muted,
                border: "none", borderRadius: 8, padding: "0 18px",
                cursor: inputValue.trim() ? "pointer" : "default",
                fontSize: 18, transition: "all 0.15s",
              }}>→</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: "center" }}>
            Try: "What if I retire at 62?" · "Increase my contribution to 4000" · "Explain critical illness cover"
          </div>
        </div>
      </div>

      {/* ── LIVE REPORT PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`,
          background: C.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Live Report</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
              {variables.simulationRunCount
                ? `Run #${variables.simulationRunCount} · Updates automatically`
                : "Updates after first simulation"}
            </div>
          </div>
          {variables.reportReady && (
            <button style={{ background: C.green, color: "#fff", border: "none",
              borderRadius: 6, padding: "8px 16px", fontSize: 12, cursor: "pointer",
              fontFamily: "monospace" }}>
              ↓ Download Report
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <SimulationReport vars={variables} />
        </div>
      </div>
    </div>
  );
}
