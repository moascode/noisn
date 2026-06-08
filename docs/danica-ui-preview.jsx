import { useState, useEffect, useRef } from "react";

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
};

const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n)
    : "—";

const fmtPct = (n) => (n != null ? `${n.toFixed(1)}%` : "—");

// ─── MOCK SIMULATION DATA ────────────────────────────────────────────────────
const MOCK_SIM = {
  productCode: "DANICA_BALANCE",
  projectedPensionMonthlyDKK: 19800,
  projectedPensionAnnualDKK: 237600,
  salaryReplacementPct: 79.2,
  totalMonthlyPremiumDKK: 4100,
  reachesTarget: false,
  simulationRunCount: 1,
  desiredRetirementAge: 65,
  monthlyContribution: 3500,
  riskProfile: "MEDIUM",
  payoutType: "ANNUITY",
  criticalIllnessTier: "TIER_1",
  lifeInsuranceEnabled: true,
  coverageBreakdown: {
    pension_contribution: 3500,
    earning_capacity: 250,
    critical_illness: 280,
    life_insurance: 190,
    health_insurance: 130,
    children_health: 0,
    partner_life_insurance: 0,
    total: 4350,
  },
  aiExplanation: "Your current setup gives you DKK 19,800/month at retirement — 79.2% salary replacement, just under the 80% target. Increasing your monthly contribution by DKK 200 would close the gap.",
  simulationHistory: [
    { salaryReplacementPct: 72.1 },
    { salaryReplacementPct: 75.4 },
    { salaryReplacementPct: 79.2 },
  ],
};

// ─── MOCK CONVERSATION ────────────────────────────────────────────────────────
const INITIAL_MESSAGES = [
  { role: "agent", content: "Welcome to Danica Pension. I'll help you configure your Danica Balance pension. Let's start with a few questions to understand your situation." },
  { role: "agent", content: "How old are you?" },
  { role: "user",  content: "I'm 42" },
  { role: "agent", content: "Great. What is your current gross annual salary in DKK?" },
  { role: "user",  content: "Around 600,000 DKK" },
  { role: "agent", content: "At what age would you like to retire?" },
  { role: "user",  content: "I'm thinking 65" },
  { role: "agent", content: "Do you have a partner or cohabitant?" },
  { role: "user",  content: "Yes, married" },
  { role: "agent", content: "Do you have any dependent children?" },
  { role: "user",  content: "Two kids, ages 8 and 11" },
  { role: "agent", content: "Do you own or rent your home?" },
  { role: "user",  content: "We own — rough equity around 1.2M DKK" },
  { role: "agent", content: "Any other savings or assets outside of pension — investments, savings accounts, etc.?" },
  { role: "user",  content: "About 150,000 in a savings account" },
  { role: "agent", content: "Perfect, I have everything I need. Running your first simulation now..." },
  { role: "agent", content: "Your initial simulation shows DKK 19,800/month at retirement — that's 79.2% salary replacement, just below the 80% target. The live report on the right has the full breakdown. Feel free to ask questions or make changes." },
];

// ─── MOCK AGENT RESPONSES ─────────────────────────────────────────────────────
function getMockResponse(message, simState) {
  const lower = message.toLowerCase();

  if (lower.includes("62") || lower.includes("retire") && lower.includes("earlier")) {
    return {
      text: "Retiring at 62 instead of 65 reduces your contribution period by 3 years. Your projected monthly pension drops to DKK 17,100 — that's 68.4% salary replacement, meaningfully below the 80% target. To compensate, you'd need to increase your monthly contribution to around DKK 4,800.",
      sim: { ...simState, desiredRetirementAge: 62, projectedPensionMonthlyDKK: 17100, projectedPensionAnnualDKK: 205200, salaryReplacementPct: 68.4, reachesTarget: false, simulationRunCount: (simState.simulationRunCount || 1) + 1, aiExplanation: "Retiring 3 years earlier reduces your projected monthly pension by DKK 2,700, bringing salary replacement to 68.4% — well below the 80% target. You'd need to increase your monthly contribution to DKK 4,800 to maintain the same payout.", simulationHistory: [...(simState.simulationHistory || []), { salaryReplacementPct: 68.4 }] },
    };
  }
  if (lower.includes("4000") || lower.includes("contribution") && lower.includes("increase")) {
    return {
      text: "Increasing your monthly contribution to DKK 4,000 boosts your projected pension to DKK 21,400/month — that's 85.6% salary replacement, comfortably above the 80% target. Your total monthly cost increases to DKK 4,850.",
      sim: { ...simState, monthlyContribution: 4000, projectedPensionMonthlyDKK: 21400, projectedPensionAnnualDKK: 256800, salaryReplacementPct: 85.6, reachesTarget: true, totalMonthlyPremiumDKK: 4850, simulationRunCount: (simState.simulationRunCount || 1) + 1, aiExplanation: "Increasing your monthly contribution by DKK 500 adds DKK 1,600 to your projected monthly pension — bringing you to 85.6% salary replacement, above the 80% target.", simulationHistory: [...(simState.simulationHistory || []), { salaryReplacementPct: 85.6 }], coverageBreakdown: { ...simState.coverageBreakdown, pension_contribution: 4000, total: 4850 } },
    };
  }
  if (lower.includes("high") || lower.includes("risk")) {
    return {
      text: "Switching to a High risk profile (targeting ~7% annual return) increases your projected monthly pension to DKK 23,200 — that's 92.8% salary replacement. The trade-off is higher volatility, especially in the years approaching retirement. Danica Balance automatically de-risks as you get older.",
      sim: { ...simState, riskProfile: "HIGH", projectedPensionMonthlyDKK: 23200, projectedPensionAnnualDKK: 278400, salaryReplacementPct: 92.8, reachesTarget: true, simulationRunCount: (simState.simulationRunCount || 1) + 1, aiExplanation: "Switching to High risk (targeting ~7%/yr) raises your projected monthly pension by DKK 3,400. At 92.8% replacement you're well above target, though returns will vary year to year.", simulationHistory: [...(simState.simulationHistory || []), { salaryReplacementPct: 92.8 }] },
    };
  }
  if (lower.includes("critical illness") || lower.includes("remove critical")) {
    return {
      text: "Removing critical illness cover (Tier 1) saves you DKK 280/month. Your total monthly cost drops to DKK 3,820. Note: you're 42 now — critical illness cover must be established before age 50, so this is a window that closes in 8 years.",
      sim: { ...simState, criticalIllnessTier: "NONE", totalMonthlyPremiumDKK: 3820, simulationRunCount: (simState.simulationRunCount || 1) + 1, coverageBreakdown: { ...simState.coverageBreakdown, critical_illness: 0, total: 3820 }, aiExplanation: "Removing critical illness cover saves DKK 280/month. Your pension projection is unchanged — this only affects your insurance premium. Remember, you can't re-add this after age 50.", simulationHistory: [...(simState.simulationHistory || []), { salaryReplacementPct: simState.salaryReplacementPct }] },
    };
  }
  if (lower.includes("what") || lower.includes("explain") || lower.includes("how")) {
    return {
      text: "Danica Balance uses a lifecycle investment approach — when you're younger, your savings are weighted toward equities for higher growth potential. As you approach retirement, we automatically shift toward bonds and lower-risk assets to protect what you've built. The three risk profiles (Low, Medium, High) adjust how aggressively this allocation starts.",
      sim: null,
    };
  }
  return {
    text: "I've noted that. Would you like me to run a simulation with that change, or do you have other adjustments in mind first?",
    sim: null,
  };
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ReplacementGauge({ pct }) {
  const target = 80;
  const clamped = Math.min(Math.max(pct || 0, 0), 120);
  const color = pct >= target ? C.green : pct >= 65 ? C.orange : C.red;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", letterSpacing: "1px" }}>SALARY REPLACEMENT</span>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{fmtPct(pct)}</span>
      </div>
      <div style={{ position: "relative", height: 10, background: C.border, borderRadius: 5 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${(clamped / 120) * 100}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 5, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
        }} />
        <div style={{
          position: "absolute", left: `${(target / 120) * 100}%`,
          top: -4, bottom: -4, width: 2,
          background: C.text, borderRadius: 1, opacity: 0.3,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>0%</span>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>Target: 80%</span>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>120%+</span>
      </div>
    </div>
  );
}

function HistoryBars({ history }) {
  if (!history || history.length < 2) return null;
  const max = 100;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>SIMULATION HISTORY</div>
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 40 }}>
        {history.map((run, i) => {
          const pct = run.salaryReplacementPct || 0;
          const h = Math.max(4, (pct / max) * 40);
          const isLast = i === history.length - 1;
          const color = pct >= 80 ? C.green : pct >= 65 ? C.orange : C.red;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: isLast ? C.text : C.muted, fontFamily: "monospace" }}>
                {pct.toFixed(0)}%
              </span>
              <div style={{
                width: "100%", height: h, borderRadius: "3px 3px 0 0",
                background: isLast ? color : C.border,
                transition: "height 0.5s ease",
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ height: 1, background: C.border, marginTop: 0 }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 9, color: C.muted, fontFamily: "monospace" }}>Run 1</span>
        <span style={{ fontSize: 9, color: C.muted, fontFamily: "monospace" }}>Run {history.length} (current)</span>
      </div>
    </div>
  );
}

function LiveReport({ vars }) {
  const isWaiting = !vars?.projectedPensionMonthlyDKK;

  if (isWaiting) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 14 }}>
      <div style={{ fontSize: 40, opacity: 0.15 }}>◎</div>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>Awaiting simulation...</div>
      <div style={{ fontSize: 12, color: C.muted, textAlign: "center", maxWidth: 220, lineHeight: 1.7 }}>
        Complete the intake conversation to generate your first simulation result.
      </div>
    </div>
  );

  const cb = vars.coverageBreakdown || {};
  const reaches = vars.reachesTarget;
  const run = vars.simulationRunCount || 1;

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "20px 24px" }}>
      {/* Status row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 3 }}>
            SIMULATION #{run}
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>{vars.productCode === "DANICA_BALANCE" ? "Danica Balance" : "Danica Link"}</div>
        </div>
        <div style={{
          background: reaches ? C.greenLight : C.orangeLight,
          border: `1px solid ${reaches ? C.green : C.orange}40`,
          color: reaches ? C.green : C.orange,
          borderRadius: 5, padding: "5px 12px", fontSize: 11, fontFamily: "monospace",
        }}>
          {reaches ? "✓ On track" : "↑ Below 80% target"}
        </div>
      </div>

      {/* Gauge */}
      <ReplacementGauge pct={vars.salaryReplacementPct} />

      {/* Key figures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: "MONTHLY PENSION", value: fmt(vars.projectedPensionMonthlyDKK), accent: C.accent, big: true },
          { label: "ANNUAL PENSION",  value: fmt(vars.projectedPensionAnnualDKK), accent: C.accent, big: true },
          { label: "MONTHLY COST",    value: fmt(vars.totalMonthlyPremiumDKK), accent: C.dim },
          { label: "RETIREMENT AGE",  value: vars.desiredRetirementAge ? `Age ${vars.desiredRetirementAge}` : "—", accent: C.dim },
        ].map(f => (
          <div key={f.label} style={{ background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace",
              letterSpacing: "1.5px", marginBottom: 6 }}>{f.label}</div>
            <div style={{ fontSize: f.big ? 17 : 15, fontWeight: 700, color: f.accent }}>{f.value}</div>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>
          CONFIGURATION
        </div>
        {[
          ["Contribution",     fmt(vars.monthlyContribution) + "/month"],
          ["Risk Profile",     vars.riskProfile || "MEDIUM"],
          ["Payout Type",      vars.payoutType || "ANNUITY"],
          ["Critical Illness", vars.criticalIllnessTier === "TIER_1" ? "DKK 90,900 cover" : vars.criticalIllnessTier === "TIER_2" ? "DKK 181,800 cover" : "None"],
          ["Life Insurance",   vars.lifeInsuranceEnabled ? "Enabled" : "Disabled"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between",
            padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <span style={{ color: C.dim }}>{k}</span>
            <span style={{ color: C.text, fontWeight: 500, fontFamily: "monospace", fontSize: 11 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Coverage breakdown */}
      {Object.values(cb).some(v => v > 0) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", letterSpacing: "2px", marginBottom: 10 }}>
            MONTHLY COST BREAKDOWN
          </div>
          {Object.entries(cb)
            .filter(([k, v]) => k !== "total" && v > 0)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 3, height: 12, borderRadius: 2,
                    background: k === "pension_contribution" ? C.accent : C.muted }} />
                  <span style={{ fontSize: 12, color: C.dim }}>
                    {k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: C.text, fontFamily: "monospace" }}>{fmt(v)}</span>
              </div>
            ))}
          <div style={{ display: "flex", justifyContent: "space-between",
            padding: "9px 0", fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: C.text }}>Total</span>
            <span style={{ fontFamily: "monospace", color: C.text }}>{fmt(cb.total)}/mo</span>
          </div>
        </div>
      )}

      {/* AI note */}
      {vars.aiExplanation && (
        <div style={{ background: C.accentLight, border: `1px solid ${C.accent}25`,
          borderLeft: `3px solid ${C.accent}`, borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: C.accent, fontFamily: "monospace",
            letterSpacing: "2px", marginBottom: 6 }}>ADVISOR NOTE</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75 }}>{vars.aiExplanation}</div>
        </div>
      )}

      {/* History bars */}
      <HistoryBars history={vars.simulationHistory} />
    </div>
  );
}

function ChatBubble({ role, content, isTyping }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#fff", fontWeight: 700, marginRight: 8, flexShrink: 0, marginTop: 2 }}>
          D
        </div>
      )}
      <div style={{
        maxWidth: "75%",
        background: isUser ? C.accent : C.surface,
        color: isUser ? "#fff" : C.text,
        border: isUser ? "none" : `1px solid ${C.border}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        padding: "10px 14px", fontSize: 14, lineHeight: 1.65,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        {isTyping ? (
          <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: C.muted,
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        ) : content}
      </div>
    </div>
  );
}

// ─── PRODUCT SELECT ───────────────────────────────────────────────────────────
function ProductSelect({ onStart }) {
  const [product, setProduct] = useState("DANICA_BALANCE");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={{ width: 440, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.1)",
        animation: "fadeUp 0.4s ease both" }}>
        <div style={{ background: C.accent, padding: "28px 32px 24px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontFamily: "monospace",
            letterSpacing: "4px", marginBottom: 10 }}>DANICA PENSION · DENMARK</div>
          <div style={{ fontSize: 24, color: "#fff", fontWeight: 400, letterSpacing: "-0.3px" }}>
            Pension Configurator
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.5 }}>
            Explore your options and configure your pension in minutes
          </div>
        </div>
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace",
            letterSpacing: "2px", marginBottom: 14 }}>SELECT YOUR PRODUCT</div>
          {[
            { id: "DANICA_BALANCE", name: "Danica Balance", tag: "Recommended",
              desc: "Expert-managed lifecycle investment. Risk automatically adjusts as you approach retirement." },
            { id: "DANICA_LINK", name: "Danica Link", tag: "Self-directed",
              desc: "Choose how your savings are invested. Full control over fund selection and allocation." },
          ].map(p => (
            <div key={p.id} onClick={() => setProduct(p.id)}
              style={{ border: `2px solid ${product === p.id ? C.accent : C.border}`,
                borderRadius: 8, padding: "14px 16px", marginBottom: 10, cursor: "pointer",
                background: product === p.id ? C.accentLight : C.surface,
                transition: "all 0.15s" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", marginTop: 1, flexShrink: 0,
                  border: `2px solid ${product === p.id ? C.accent : C.border}`,
                  background: product === p.id ? C.accent : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {product === p.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: product === p.id ? C.accent : C.muted,
                      fontFamily: "monospace", border: `1px solid ${product === p.id ? C.accent : C.border}`,
                      borderRadius: 3, padding: "2px 6px" }}>{p.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{p.desc}</div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => onStart(product)} style={{
            width: "100%", background: C.accent, color: "#fff", border: "none",
            borderRadius: 8, padding: "14px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", marginTop: 6, letterSpacing: "0.3px",
            transition: "opacity 0.15s",
          }}
            onMouseEnter={e => e.target.style.opacity = "0.9"}
            onMouseLeave={e => e.target.style.opacity = "1"}
          >
            Start Configuration →
          </button>
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
            By continuing you consent to Danica processing your data<br />for pension advisory purposes.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN CONFIGURATOR ────────────────────────────────────────────────────────
function Configurator({ product }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [simVars, setSimVars] = useState({ ...MOCK_SIM, productCode: product });
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sufficiency, setSufficiency] = useState(100);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;
    const message = inputValue.trim();
    setInputValue("");
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setIsTyping(true);

    setTimeout(() => {
      const { text, sim } = getMockResponse(message, simVars);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "agent", content: text }]);
      if (sim) setSimVars(sim);
    }, 1400 + Math.random() * 600);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg,
      fontFamily: "Georgia, serif", overflow: "hidden" }}>
      <style>{`
        @keyframes bounce {
          0%,60%,100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
      `}</style>

      {/* ── CHAT ── */}
      <div style={{ width: "44%", display: "flex", flexDirection: "column",
        borderRight: `1px solid ${C.border}`, background: C.surface }}>

        {/* Chat header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0 }}>D</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Danica Advisor</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
              <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace" }}>Simulation active</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
            #{product === "DANICA_BALANCE" ? "DB" : "DL"}·A4F2C1
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 14px" }}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} />
          ))}
          {isTyping && <ChatBubble role="agent" isTyping />}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question or make a change..."
              rows={2}
              style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "9px 12px", fontSize: 13, fontFamily: "Georgia, serif",
                color: C.text, background: C.bg, resize: "none", outline: "none", lineHeight: 1.5 }}
            />
            <button onClick={handleSend} disabled={!inputValue.trim() || isTyping}
              style={{ background: inputValue.trim() && !isTyping ? C.accent : C.border,
                color: inputValue.trim() && !isTyping ? "#fff" : C.muted,
                border: "none", borderRadius: 8, padding: "0 16px",
                cursor: inputValue.trim() && !isTyping ? "pointer" : "default",
                fontSize: 18, transition: "all 0.15s", flexShrink: 0 }}>→</button>
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 7, textAlign: "center",
            fontFamily: "monospace", letterSpacing: "0.3px" }}>
            Try: "retire at 62" · "increase contribution to 4000" · "switch to high risk"
          </div>
        </div>
      </div>

      {/* ── LIVE REPORT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Report header */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`,
          background: C.surface, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Live Report</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
              Run #{simVars.simulationRunCount} · Updates automatically
            </div>
          </div>
          <button style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accent}30`,
            borderRadius: 6, padding: "7px 14px", fontSize: 11, cursor: "pointer",
            fontFamily: "monospace", letterSpacing: "0.5px" }}>
            ↓ Save Report
          </button>
        </div>

        {/* Report content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <LiveReport vars={simVars} />
        </div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("select");
  const [product, setProduct] = useState(null);

  const handleStart = (selectedProduct) => {
    setProduct(selectedProduct);
    setScreen("configurator");
  };

  if (screen === "select") return <ProductSelect onStart={handleStart} />;
  return <Configurator product={product} />;
}
