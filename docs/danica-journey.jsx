import { useState } from "react";

const phases = [
  {
    id: "entry",
    phase: "01",
    label: "Entry & Product Selection",
    color: "#1B3A5C",
    accent: "#2E6DA4",
    icon: "◈",
    actor: "User",
    steps: [
      {
        title: "Access Chatbot",
        desc: "User opens the Danica self-service portal via web or mobile app.",
        system: null,
      },
      {
        title: "Select Pension Product",
        desc: "User selects their pension product (e.g. Danica Balance, Danica Link). Product context is established for the session.",
        system: "Product catalogue loaded into session context",
      },
      {
        title: "Welcome & Consent",
        desc: "Chatbot introduces the configuration journey and confirms data usage consent.",
        system: "Session initialised in Camunda — process instance created",
      },
    ],
  },
  {
    id: "intake",
    phase: "02",
    label: "Guided Intake",
    color: "#1B4D3E",
    accent: "#2E9973",
    icon: "◎",
    actor: "User + AI",
    steps: [
      {
        title: "Predetermined Questions",
        desc: "Chatbot collects core inputs in a structured sequence: age, salary, desired retirement age, employment status (employed / self-employed), housing situation, other savings or assets.",
        system: "Answers stored as Camunda process variables",
      },
      {
        title: "Dynamic Follow-Up Questions",
        desc: "Based on answers, AI generates contextual probes. Examples: dependants detected → ask about life insurance and children's health cover; self-employed → apply different product rules; age 50+ → flag critical illness ineligibility proactively.",
        system: "Bedrock evaluates completeness and generates follow-ups against product knowledge base",
      },
      {
        title: "Sufficiency Gate",
        desc: "AI assesses whether enough information has been collected to run a meaningful simulation. If gaps exist, targeted follow-up questions are asked before proceeding.",
        system: "Camunda gateway: sufficient info? → proceed to simulation / else → loop back",
      },
    ],
  },
  {
    id: "simulation",
    phase: "03",
    label: "First Simulation",
    color: "#3D2B1F",
    accent: "#C47A3A",
    icon: "◉",
    actor: "System",
    steps: [
      {
        title: "Trigger Simulation",
        desc: "Camunda calls the calculator APIs with the collected parameters.",
        system: "Camunda orchestrates: pension amount calc, coverage premium calc, benefit projection calc",
      },
      {
        title: "Aggregate Results",
        desc: "Simulation outputs are assembled: projected pension amount at retirement, monthly/annual contribution required, coverage breakdown (loss of earning capacity, critical illness, life insurance, health), total premium cost.",
        system: "Results written back to process instance variables",
      },
      {
        title: "Generate Initial Report",
        desc: "Bedrock composes a plain-language summary of the results. Live report is rendered alongside the chat — contribution schedule, coverage summary, projected payout, risk profile.",
        system: "Report document generated and displayed in real time",
      },
    ],
  },
  {
    id: "explore",
    phase: "04",
    label: "Explore & Iterate",
    color: "#2B1F3D",
    accent: "#7A5CC4",
    icon: "◐",
    actor: "User + System",
    steps: [
      {
        title: "User Reviews Report",
        desc: "User reads the live report panel. Chatbot proactively highlights key trade-offs and prompts exploration (e.g. 'Retiring 2 years earlier would require DKK X more per month').",
        system: null,
      },
      {
        title: "Conversational Parameter Changes",
        desc: "User requests changes in natural language: 'What if I retire at 62?', 'Increase my critical illness cover', 'Switch to low risk profile', 'What happens if I extend by 5 years?'",
        system: "Bedrock parses intent → extracts parameter delta → updates Camunda process variables",
      },
      {
        title: "Re-Simulation",
        desc: "Calculators re-run with updated parameters. Report refreshes in real time showing new figures.",
        system: "Camunda triggers simulation sub-process → results returned → report updated",
      },
      {
        title: "Delta Explanation",
        desc: "Bedrock generates a plain-language explanation of what changed and why: 'Your projected pension increased by DKK 3,200/month because you extended your contribution period by 3 years.'",
        system: "Previous vs current state diff passed to Bedrock for explanation",
      },
      {
        title: "Iterate (repeat as needed)",
        desc: "User continues adjusting parameters. Each change triggers a re-simulation and report refresh. No limit on iterations.",
        system: "Loop continues until user signals satisfaction",
      },
    ],
  },
  {
    id: "coverage",
    phase: "05",
    label: "Coverage Configuration",
    color: "#1F2B3D",
    accent: "#3A7AC4",
    icon: "◑",
    actor: "User + AI",
    steps: [
      {
        title: "Review Insurance Covers",
        desc: "Chatbot walks through available insurance add-ons based on user profile: loss of earning capacity (end age 65 or state pension age), critical illness tier (DKK 90,900 or 181,800), health insurance modules, life insurance for self or spouse.",
        system: "Eligibility rules applied server-side (e.g. age 50+ → critical illness unavailable)",
      },
      {
        title: "Toggle and Simulate",
        desc: "User adds or removes coverage options. Each toggle triggers a re-simulation showing the premium impact and updated total cost.",
        system: "Coverage variables updated → calculators re-run → report reflects new premium breakdown",
      },
      {
        title: "AI Guidance on Trade-offs",
        desc: "If user removes a cover that appears important given their profile (e.g. has dependants but removes life insurance), chatbot flags the implication without pressuring.",
        system: "Bedrock evaluates profile vs coverage selection for proactive guidance",
      },
    ],
  },
  {
    id: "finalise",
    phase: "06",
    label: "Finalise & Report",
    color: "#1F3D2B",
    accent: "#3AC47A",
    icon: "◆",
    actor: "User",
    steps: [
      {
        title: "Final Review",
        desc: "User reviews the complete configuration. Chatbot presents a summary of all choices: savings parameters, coverage selections, projected outcomes, total monthly cost.",
        system: null,
      },
      {
        title: "Confirm Configuration",
        desc: "User confirms they are satisfied with the configuration. Chatbot confirms and prepares the final report.",
        system: "Camunda moves to report generation task",
      },
      {
        title: "Report Generated & Delivered",
        desc: "A structured PDF/digital report is generated containing: all inputs captured, questions asked and answers given, simulation history (all runs), final configuration, projected pension amount, coverage dossier, contribution schedule.",
        system: "Report compiled → delivered to user via email and portal → process instance completes",
      },
    ],
  },
];

const systemActors = [
  { label: "User", color: "#94a3b8" },
  { label: "AI Chatbot (Bedrock)", color: "#C47A3A" },
  { label: "Camunda Orchestrator", color: "#2E6DA4" },
  { label: "Calculator APIs", color: "#2E9973" },
];

export default function DanicaJourney() {
  const [activePhase, setActivePhase] = useState(null);
  const [activeStep, setActiveStep] = useState(null);

  const toggle = (phaseId, stepIdx) => {
    if (activePhase === phaseId && activeStep === stepIdx) {
      setActivePhase(null);
      setActiveStep(null);
    } else {
      setActivePhase(phaseId);
      setActiveStep(stepIdx);
    }
  };

  return (
    <div style={{
      fontFamily: "'Georgia', 'Times New Roman', serif",
      background: "#0F1117",
      minHeight: "100vh",
      color: "#E8E4DC",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #2A2D38",
        padding: "36px 48px 28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#6B7280", textTransform: "uppercase", marginBottom: "10px", fontFamily: "monospace" }}>
            Danica Pension · Denmark · To-Be Solution
          </div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "400", color: "#E8E4DC", letterSpacing: "-0.5px" }}>
            End-to-End User Journey
          </h1>
          <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "6px" }}>
            Self-Serve Pension Configurator — Conversational AI + Camunda Orchestration
          </div>
        </div>
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          {systemActors.map(a => (
            <div key={a.label} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: a.color }} />
              <span style={{ fontSize: "11px", color: "#9CA3AF", fontFamily: "monospace" }}>{a.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Journey */}
      <div style={{ padding: "40px 48px" }}>
        {phases.map((phase, pi) => (
          <div key={phase.id} style={{ marginBottom: "12px" }}>
            {/* Phase header */}
            <div style={{
              display: "flex",
              alignItems: "stretch",
              gap: "0",
              marginBottom: "8px",
            }}>
              {/* Phase number bar */}
              <div style={{
                width: "56px",
                minHeight: "56px",
                background: phase.color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "6px 0 0 6px",
                flexShrink: 0,
              }}>
                <div style={{ fontSize: "18px", color: phase.accent }}>{phase.icon}</div>
                <div style={{ fontSize: "10px", color: "#9CA3AF", fontFamily: "monospace", marginTop: "2px" }}>{phase.phase}</div>
              </div>

              {/* Phase label */}
              <div style={{
                flex: 1,
                background: "#181B24",
                borderRadius: "0 6px 6px 0",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #2A2D38",
                borderLeft: `3px solid ${phase.accent}`,
              }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "600", color: "#E8E4DC", letterSpacing: "0.2px" }}>
                    {phase.label}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7280", fontFamily: "monospace", marginTop: "3px" }}>
                    {phase.steps.length} steps · Actor: {phase.actor}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: phase.accent, fontFamily: "monospace" }}>
                  {activePhase === phase.id ? "▲ collapse" : "▼ expand"}
                </div>
              </div>
            </div>

            {/* Steps */}
            <div style={{ marginLeft: "56px", paddingLeft: "20px", borderLeft: `1px solid ${phase.accent}30` }}>
              {phase.steps.map((step, si) => {
                const isOpen = activePhase === phase.id && activeStep === si;
                return (
                  <div
                    key={si}
                    onClick={() => toggle(phase.id, si)}
                    style={{
                      marginBottom: "6px",
                      background: isOpen ? "#181B24" : "#13151C",
                      border: `1px solid ${isOpen ? phase.accent + "60" : "#2A2D38"}`,
                      borderRadius: "5px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      overflow: "hidden",
                    }}
                  >
                    {/* Step header */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 16px",
                      gap: "12px",
                    }}>
                      <div style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: isOpen ? phase.accent : "#2A2D38",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        fontFamily: "monospace",
                        color: isOpen ? "#fff" : "#6B7280",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}>
                        {si + 1}
                      </div>
                      <div style={{ fontSize: "13px", color: isOpen ? "#E8E4DC" : "#C9C5BC", fontWeight: isOpen ? "600" : "400" }}>
                        {step.title}
                      </div>
                    </div>

                    {/* Step detail */}
                    {isOpen && (
                      <div style={{ padding: "0 16px 16px 50px" }}>
                        <div style={{ fontSize: "13px", color: "#9CA3AF", lineHeight: "1.7", marginBottom: step.system ? "12px" : "0" }}>
                          {step.desc}
                        </div>
                        {step.system && (
                          <div style={{
                            background: "#0D0F14",
                            border: `1px solid ${phase.accent}30`,
                            borderRadius: "4px",
                            padding: "10px 14px",
                            display: "flex",
                            gap: "10px",
                            alignItems: "flex-start",
                          }}>
                            <div style={{ fontSize: "10px", color: phase.accent, fontFamily: "monospace", flexShrink: 0, marginTop: "1px" }}>SYSTEM</div>
                            <div style={{ fontSize: "12px", color: "#6B7280", fontFamily: "monospace", lineHeight: "1.6" }}>
                              {step.system}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Connector arrow between phases */}
            {pi < phases.length - 1 && (
              <div style={{ marginLeft: "26px", color: "#2A2D38", fontSize: "16px", margin: "4px 0 4px 26px" }}>↓</div>
            )}
          </div>
        ))}

        {/* Footer note */}
        <div style={{
          marginTop: "32px",
          padding: "20px 24px",
          background: "#181B24",
          border: "1px solid #2A2D38",
          borderRadius: "6px",
          display: "flex",
          gap: "32px",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#6B7280", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "8px" }}>Key Design Principles</div>
            <div style={{ fontSize: "12px", color: "#9CA3AF", lineHeight: "1.8" }}>
              Camunda owns the <span style={{ color: "#2E6DA4" }}>phases and orchestration</span> · Bedrock owns the <span style={{ color: "#C47A3A" }}>conversation and explanation</span> · Calculators own the <span style={{ color: "#2E9973" }}>numbers</span> · Report is a <span style={{ color: "#7A5CC4" }}>live artefact</span>, not a final snapshot
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#6B7280", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "monospace", marginBottom: "8px" }}>Advisor Touchpoint</div>
            <div style={{ fontSize: "12px", color: "#9CA3AF", lineHeight: "1.8" }}>
              No advisor involvement during the self-serve journey. Advisor receives the finalised report as a completed dossier for review — outside the scope of this flow.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
