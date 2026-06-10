import { useState, useEffect, useRef } from "react";
import { useSessionSocket } from "./hooks/useSessionSocket";

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

const fmtPct = (n) => (n != null ? `${Number(n).toFixed(1)}%` : "—");

// keyframes injected once at the document level — available on all screens
const GLOBAL_STYLES = `
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-6px); }
  }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
`;

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ReplacementGauge({ pct }) {
  const target = 80;
  const clamped = Math.min(Math.max(pct || 0, 0), 120);
  const color = pct >= target ? C.green : pct >= 60 ? C.orange : C.red;

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
        <div style={{
          position: "absolute", left: `${target / 120 * 100}%`,
          top: -3, bottom: -3, width: 2, background: C.dim, borderRadius: 1,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Target: 80%</span>
      </div>
    </div>
  );
}

function ProfilePanel({ profile }) {
  const fields = [
    ["Age", profile.age],
    ["Annual Salary", profile.annualSalary ? fmt(profile.annualSalary) : null],
    ["Retirement Age", profile.desiredRetirementAge ? `Age ${profile.desiredRetirementAge}` : null],
    ["Family Status", profile.familyStatus],
    ["Dependants", profile.dependants],
    ["Risk Tolerance", profile.riskProfile],
    ["Monthly Contribution", profile.monthlyContribution ? fmt(profile.monthlyContribution) + "/mo" : null],
    ["Goal", profile.pensionGoal],
  ].filter(([, v]) => v != null);

  if (fields.length === 0) return (
    <div style={{ padding: "12px 0", fontSize: 12, color: C.muted, fontStyle: "italic" }}>
      Collecting profile information...
    </div>
  );

  return (
    <div>
      {fields.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between",
          padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
          <span style={{ color: C.dim }}>{k}</span>
          <span style={{ color: C.text, fontWeight: 500 }}>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function CoveragePanel({ coverage }) {
  const fields = [
    ["Employer Pension", coverage.employerPension],
    ["Employer Contribution", coverage.employerContribution ? fmt(coverage.employerContribution) + "/mo" : null],
    ["State Pension Est.", coverage.statePension ? fmt(coverage.statePension) + "/yr" : null],
    ["Private Savings", coverage.privateSavings ? fmt(coverage.privateSavings) : null],
    ["Other Insurance", coverage.otherInsurance],
  ].filter(([, v]) => v != null);

  if (fields.length === 0) return (
    <div style={{ padding: "12px 0", fontSize: 12, color: C.muted, fontStyle: "italic" }}>
      Collecting existing coverage information...
    </div>
  );

  return (
    <div>
      {fields.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between",
          padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
          <span style={{ color: C.dim }}>{k}</span>
          <span style={{ color: C.text, fontWeight: 500 }}>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function RecommendationPanel({ recommendation, simulationResult }) {
  if (!recommendation) return (
    <div style={{ padding: "12px 0", fontSize: 12, color: C.muted, fontStyle: "italic" }}>
      Awaiting product recommendation...
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
        {recommendation.productName || recommendation.productCode}
      </div>
      {recommendation.reasons?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "1.5px", marginBottom: 6 }}>
            WHY THIS PRODUCT
          </div>
          {recommendation.reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text, lineHeight: 1.6, display: "flex", gap: 6 }}>
              <span style={{ color: C.green }}>✓</span> {r}
            </div>
          ))}
        </div>
      )}
      {recommendation.tradeoffs?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "1.5px", marginBottom: 6 }}>
            CONSIDERATIONS
          </div>
          {recommendation.tradeoffs.map((t, i) => (
            <div key={i} style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, display: "flex", gap: 6 }}>
              <span style={{ color: C.orange }}>○</span> {t}
            </div>
          ))}
        </div>
      )}
      {simulationResult && (
        <div>
          <ReplacementGauge pct={simulationResult.salaryReplacementPct} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Monthly Pension", fmt(simulationResult.projectedPensionMonthlyDKK)],
              ["Annual Pension", fmt(simulationResult.projectedPensionAnnualDKK)],
              ["Monthly Cost", fmt(simulationResult.totalMonthlyPremiumDKK)],
            ].map(([label, value]) => (
              <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveReport({ profile, existingCoverage, recommendation, simulationResult, sessionComplete }) {
  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "20px 24px" }}>
      {sessionComplete && (
        <div style={{ background: C.greenLight, border: `1px solid ${C.green}30`,
          borderRadius: 6, padding: "10px 14px", marginBottom: 16,
          fontSize: 12, color: C.green, fontFamily: "monospace" }}>
          ✓ Session complete — report finalised
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>
          CUSTOMER PROFILE
        </div>
        <ProfilePanel profile={profile} />
      </div>
      <div style={{ marginBottom: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>
          EXISTING COVERAGE
        </div>
        <CoveragePanel coverage={existingCoverage} />
      </div>
      <div style={{ paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>
          RECOMMENDED PRODUCT
        </div>
        <RecommendationPanel recommendation={recommendation} simulationResult={simulationResult} />
      </div>
    </div>
  );
}

function ChatBubble({ role, content, isTyping }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
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
        padding: "10px 14px", fontSize: 14, lineHeight: 1.65,
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
  const [screen, setScreen] = useState("consent"); // consent | connecting | chat
  const [consentGiven, setConsentGiven] = useState(false);
  const [processKey, setProcessKey] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [error, setError] = useState(null);

  // Live report state — three independent sections
  const [profile, setProfile] = useState({});
  const [existingCoverage, setExistingCoverage] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [sessionComplete, setSessionComplete] = useState(false);

  const chatEndRef = useRef(null);
  // Guards against duplicate sends; reset when first agent response arrives
  const pendingSendRef = useRef(false);

  function handleMessage(frame) {
    // Any incoming frame means the agent responded — unblock the input
    pendingSendRef.current = false;
    setIsTyping(false);

    switch (frame.type) {
      case "question":
        setMessages(m => [...m, { role: "agent", content: frame.content, isQuestion: true }]);
        break;
      case "agent_message":
        setMessages(m => [...m, { role: "agent", content: frame.content }]);
        break;
      case "profile_update":
        setProfile(p => ({ ...p, ...frame.content }));
        break;
      case "existing_update":
        setExistingCoverage(p => ({ ...p, ...frame.content }));
        break;
      case "recommendation":
        setRecommendation(frame.content);
        if (frame.content?.explanation) {
          setMessages(m => [...m, { role: "agent", content: frame.content.explanation }]);
        }
        break;
      case "report":
        if (frame.content?.customerProfile) setProfile(frame.content.customerProfile);
        if (frame.content?.existingCoverage) setExistingCoverage(frame.content.existingCoverage);
        if (frame.content?.recommendation) setRecommendation(frame.content.recommendation);
        if (frame.content?.simulationResult) setSimulationResult(frame.content.simulationResult);
        if (frame.content?.explanation) {
          setMessages(m => [...m, { role: "agent", content: frame.content.explanation }]);
        }
        break;
      case "report_final":
        if (frame.content?.simulationResult) setSimulationResult(frame.content.simulationResult);
        setSessionComplete(true);
        break;
      case "error":
        setError(typeof frame.content === "string" ? frame.content : JSON.stringify(frame.content));
        break;
      default:
        console.warn("Unknown frame type:", frame.type);
    }
  }

  const { send } = useSessionSocket({
    enabled: consentGiven,
    onReady: (pik) => {
      setProcessKey(pik);
      setScreen("chat");
      setIsTyping(true);
    },
    onMessage: handleMessage,
    onDisconnect: () => setDisconnected(true),
  });

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim() || pendingSendRef.current || sessionComplete || disconnected) return;
    const message = inputValue.trim();
    setInputValue("");
    pendingSendRef.current = true;  // cleared when agent responds
    setIsTyping(true);
    setMessages(prev => [...prev, { role: "user", content: message }]);
    send(message);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConsent = () => {
    setConsentGiven(true);
    setScreen("connecting");
  };

  // ── CONSENT SCREEN ────────────────────────────────────────────────────────
  if (screen === "consent") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ width: 440, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ background: C.accent, padding: "28px 32px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontFamily: "monospace",
              letterSpacing: "3px", marginBottom: 8 }}>DANICA PENSION · DENMARK</div>
            <div style={{ fontSize: 22, color: "#fff", fontWeight: 400 }}>Pension Advisor</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
              AI-powered pension recommendation
            </div>
          </div>
          <div style={{ padding: "28px 32px" }}>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75, marginBottom: 20 }}>
              Our AI advisor will ask you a few questions about your financial situation to recommend
              the Danica pension product best suited to your needs and run a personalised projection.
            </div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "14px 16px", marginBottom: 20, fontSize: 12, color: C.dim, lineHeight: 1.65 }}>
              <strong style={{ color: C.text }}>Data & Privacy</strong><br />
              By continuing, you consent to Danica Pension A/S processing your personal and financial
              data for the purpose of pension advisory under GDPR Article 6(1)(b). Your data is not
              stored beyond this session without further consent. You may withdraw at any time.
            </div>
            <button onClick={handleConsent} style={{
              width: "100%", background: C.accent, color: "#fff", border: "none",
              borderRadius: 8, padding: "14px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.3px",
            }}>
              I Agree — Start Consultation →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CONNECTING SCREEN ─────────────────────────────────────────────────────
  if (screen === "connecting") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.4,
            animation: "bounce 1.2s ease-in-out infinite" }}>◎</div>
          <div style={{ fontSize: 14, color: C.dim }}>Connecting to Danica Advisor...</div>
        </div>
      </div>
    );
  }

  // ── MAIN CHAT + REPORT SCREEN ─────────────────────────────────────────────
  const inputBlocked = pendingSendRef.current || sessionComplete || disconnected;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "Georgia, serif", overflow: "hidden" }}>
      <style>{GLOBAL_STYLES}</style>

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
            <div style={{ fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4,
              color: disconnected ? C.red : simulationResult ? C.green : C.orange }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%",
                background: disconnected ? C.red : simulationResult ? C.green : C.orange }} />
              {disconnected ? "Disconnected" : simulationResult ? "Simulation active" : "Collecting information"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
            {processKey ? `#${String(processKey).slice(-8)}` : ""}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ margin: "8px 16px", padding: "8px 12px", background: C.redLight,
            border: `1px solid ${C.red}30`, borderRadius: 6, fontSize: 12, color: C.red }}>
            {error}
            <button onClick={() => setError(null)} style={{ float: "right", background: "none",
              border: "none", cursor: "pointer", color: C.red, fontSize: 14 }}>×</button>
          </div>
        )}

        {/* Disconnected banner */}
        {disconnected && (
          <div style={{ margin: "8px 16px", padding: "8px 12px", background: C.orangeLight,
            border: `1px solid ${C.orange}30`, borderRadius: 6, fontSize: 12, color: C.orange }}>
            Connection lost. Please reload to reconnect.
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {isTyping && <ChatBubble role="agent" isTyping={true} />}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionComplete ? "Session complete" : "Type your message..."}
              disabled={inputBlocked}
              rows={2}
              style={{
                flex: 1, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "10px 12px", fontSize: 14, fontFamily: "Georgia, serif",
                color: C.text, background: C.surface, resize: "none", outline: "none",
                lineHeight: 1.5, opacity: inputBlocked ? 0.5 : 1,
              }}
            />
            <button onClick={handleSend}
              disabled={inputBlocked || !inputValue.trim()}
              style={{
                background: !inputBlocked && inputValue.trim() ? C.accent : C.border,
                color: !inputBlocked && inputValue.trim() ? "#fff" : C.muted,
                border: "none", borderRadius: 8, padding: "0 18px",
                cursor: !inputBlocked && inputValue.trim() ? "pointer" : "default",
                fontSize: 18, transition: "all 0.15s",
              }}>→</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: "center" }}>
            The advisor will guide you through the conversation
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
              Updates progressively as you answer questions
            </div>
          </div>
          {sessionComplete && (
            <div style={{ background: C.greenLight, border: `1px solid ${C.green}30`,
              borderRadius: 6, padding: "6px 12px", fontSize: 11, color: C.green, fontFamily: "monospace" }}>
              ✓ Finalised
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <LiveReport
            profile={profile}
            existingCoverage={existingCoverage}
            recommendation={recommendation}
            simulationResult={simulationResult}
            sessionComplete={sessionComplete}
          />
        </div>
      </div>
    </div>
  );
}
