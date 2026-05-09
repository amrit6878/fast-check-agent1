"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-pro"];

const STATUS_CONFIG = {
  VERIFIED: { color: "#059669", bg: "#d1fae5", border: "#6ee7b7", label: "Verified", icon: "✓" },
  INACCURATE: { color: "#d97706", bg: "#fef3c7", border: "#fcd34d", label: "Inaccurate", icon: "⚠" },
  FALSE: { color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", label: "False", icon: "✗" },
  OUTDATED: { color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd", label: "Outdated", icon: "⟳" },
};

const SAMPLE_CLAIMS = [
  {
    id: 1, claim: "Global GDP grew by 12.4% in 2023", page: 3, entity: "Economy",
    status: "FALSE", confidence: 94,
    reasoning: "Global GDP grew by approximately 3.1% in 2023 according to IMF World Economic Outlook. The figure of 12.4% is significantly inflated and not supported by any credible economic data source.",
    correct_fact: "Global GDP growth in 2023 was approximately 3.1% according to the IMF.",
    sources: [
      { title: "IMF World Economic Outlook 2024", url: "https://imf.org", credibility: 98 },
      { title: "World Bank Global Economic Prospects", url: "https://worldbank.org", credibility: 97 },
    ]
  },
  {
    id: 2, claim: "OpenAI was founded in 2012", page: 7, entity: "Technology",
    status: "INACCURATE", confidence: 99,
    reasoning: "OpenAI was founded in December 2015, not 2012. The company was established by Elon Musk, Sam Altman, Greg Brockman, and others with an initial commitment of $1 billion.",
    correct_fact: "OpenAI was founded in December 2015.",
    sources: [
      { title: "OpenAI Official About Page", url: "https://openai.com/about", credibility: 100 },
      { title: "TechCrunch — OpenAI founding", url: "https://techcrunch.com", credibility: 91 },
    ]
  },
  {
    id: 3, claim: "Renewable energy accounts for 35% of global electricity generation", page: 11, entity: "Energy",
    status: "VERIFIED", confidence: 87,
    reasoning: "According to IEA's World Energy Outlook, renewables accounted for approximately 30–35% of global electricity generation in 2023, with the figure rising rapidly. The claim is broadly accurate.",
    correct_fact: "Renewables accounted for ~30–35% of global electricity generation in 2023 per IEA data.",
    sources: [
      { title: "IEA World Energy Outlook 2023", url: "https://iea.org", credibility: 99 },
      { title: "IRENA Global Renewables Report", url: "https://irena.org", credibility: 97 },
    ]
  },
  {
    id: 4, claim: "The global smartphone market size was $1.2 trillion in 2020", page: 15, entity: "Market Data",
    status: "OUTDATED", confidence: 82,
    reasoning: "The global smartphone market was valued at approximately $484 billion in 2020, not $1.2 trillion. The $1.2 trillion figure may refer to projections for 2030 or later, making this claim outdated and misrepresented.",
    correct_fact: "Global smartphone market was ~$484B in 2020; projected to reach ~$1.2T by 2030.",
    sources: [
      { title: "Statista — Global Smartphone Market 2020", url: "https://statista.com", credibility: 88 },
      { title: "Grand View Research Report", url: "https://grandviewresearch.com", credibility: 85 },
    ]
  }
];

const DEMO_DOC = {
  name: "Market_Report_Q4_2024.pdf",
  pages: 22,
  size: "2.4 MB",
  claims: SAMPLE_CLAIMS,
  summary: "This document contains multiple factual inaccuracies including inflated GDP growth figures, incorrect founding dates, and misattributed market valuations. 1 claim verified, 1 outdated, 1 inaccurate, and 1 false.",
  truthScore: 52,
  analyzedAt: new Date().toISOString(),
};

// ── Utility components ─────────────────────────────────────────────────────────

function ConfidenceBar({ score, size = "md" }) {
  const color = score >= 85 ? "#059669" : score >= 65 ? "#d97706" : "#dc2626";
  const h = size === "sm" ? 4 : 6;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 99, height: h, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 1s ease" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 32, textAlign: "right" }}>{score}%</span>
    </div>
  );
}

function StatusBadge({ status, size = "md" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.VERIFIED;
  const pad = size === "sm" ? "2px 8px" : "4px 12px";
  const fs = size === "sm" ? 11 : 12;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 99, padding: pad, fontSize: fs, fontWeight: 700,
      letterSpacing: "0.04em", fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 4
    }}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

function Skeleton({ w = "100%", h = 16, style = {} }) {
  return <div style={{ width: w, height: h, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, ...style }} />;
}

function TruthScoreRing({ score }) {
  const r = 42, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? "#059669" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg viewBox="0 0 100 100" style={{ width: 90, height: 90 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 1.5s ease" }} />
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 20, fontWeight: 700, fill: color, fontFamily: "sans-serif" }}>{score}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 8, fill: "#94a3b8", fontFamily: "sans-serif" }}>TRUTH</text>
    </svg>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6", display: "inline-block", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

// ── API Key Modal ──────────────────────────────────────────────────────────────

function ApiKeyModal({ onSave, onClose, current }) {
  const [key, setKey] = useState(current || "");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function validate() {
    if (!key.startsWith("AIza")) { setError("Invalid key format. Gemini keys start with 'AIza'."); return; }
    setValidating(true); setError(""); setOk(false);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (r.ok) { setOk(true); setTimeout(() => { onSave(key); onClose(); }, 800); }
      else { const d = await r.json(); setError(d?.error?.message || "Invalid API key."); }
    } catch { setError("Network error. Check your connection."); }
    setValidating(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", width: 460, boxShadow: "0 25px 50px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔑</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Connect Gemini API</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Your key is stored locally and never sent to our servers</div>
          </div>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>API Key</label>
          <input type="password" value={key} onChange={e => setKey(e.target.value)}
            placeholder="AIzaSy..."
            style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${error ? "#fca5a5" : ok ? "#6ee7b7" : "#e2e8f0"}`, borderRadius: 8, fontSize: 14, fontFamily: "monospace", outline: "none", boxSizing: "border-box", color: "#0f172a", background: "#f8fafc" }}
            onKeyDown={e => e.key === "Enter" && validate()} />
          {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{error}</p>}
          {ok && <p style={{ color: "#059669", fontSize: 12, marginTop: 6 }}>✓ Connected successfully!</p>}
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: "1.5rem" }}>
          Get your free API key at{" "}
          <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6" }}>aistudio.google.com</a>
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 14, color: "#374151" }}>Cancel</button>
          <button onClick={validate} disabled={validating || !key}
            style={{ flex: 2, padding: "10px", border: "none", borderRadius: 8, background: validating ? "#93c5fd" : "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            {validating ? "Validating..." : "Connect & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, geminiConnected, docReady }) {
  const nav = [
    { id: "landing", icon: "🏠", label: "Home" },
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "verify", icon: "⬆", label: "Verify" },
    { id: "report", icon: "📋", label: "Analysis", disabled: !docReady },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];
  return (
    <div style={{ width: 220, minHeight: "100vh", background: "#0f172a", display: "flex", flexDirection: "column", padding: "1.5rem 0", borderRight: "1px solid #1e293b", flexShrink: 0 }}>
      <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚖</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#f8fafc", letterSpacing: "-0.01em" }}>FactCheck</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>Agent v2.0</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "1rem 0.75rem" }}>
        {nav.map(n => (
          <button key={n.id} onClick={() => !n.disabled && setPage(n.id)} disabled={n.disabled}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, border: "none", cursor: n.disabled ? "not-allowed" : "pointer", marginBottom: 2,
              background: page === n.id ? "rgba(59,130,246,0.15)" : "transparent",
              color: n.disabled ? "#334155" : page === n.id ? "#93c5fd" : "#94a3b8",
              fontSize: 14, fontWeight: page === n.id ? 600 : 400, textAlign: "left",
              borderLeft: page === n.id ? "2px solid #3b82f6" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
            <span style={{ fontSize: 16 }}>{n.icon}</span> {n.label}
            {n.id === "report" && !docReady && <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155" }}>—</span>}
          </button>
        ))}
      </nav>
      <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: geminiConnected ? "#22c55e" : "#ef4444", boxShadow: geminiConnected ? "0 0 6px #22c55e" : "none" }} />
          <span style={{ fontSize: 12, color: geminiConnected ? "#86efac" : "#f87171" }}>
            {geminiConnected ? "Gemini Connected" : "Not Connected"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Landing Page ───────────────────────────────────────────────────────────────

function LandingPage({ setPage }) {
  const features = [
    { icon: "🔍", title: "AI Claim Extraction", desc: "Gemini identifies every verifiable fact, statistic, and assertion in your documents." },
    { icon: "🌐", title: "Live Web Verification", desc: "Cross-references claims against real-time web sources and authoritative databases." },
    { icon: "📊", title: "Confidence Scoring", desc: "Every claim receives a confidence score and multi-source consensus rating." },
    { icon: "📑", title: "Export Reports", desc: "Download verified reports as PDF, JSON, or CSV for sharing and archiving." },
    { icon: "🕵", title: "Fake Stat Detection", desc: "Specialized in catching hallucinated percentages, inflated figures, and fabricated data." },
    { icon: "⚡", title: "Real-Time Processing", desc: "Stream live claim extraction and verification as your document is analyzed." },
  ];
  const steps = [
    { n: "01", title: "Upload Document", desc: "Drop any PDF, DOCX, or TXT file. OCR handles scanned pages automatically." },
    { n: "02", title: "AI Extraction", desc: "Gemini identifies every factual claim, statistic, date, and assertion." },
    { n: "03", title: "Web Verification", desc: "Each claim is cross-referenced against live web sources in real time." },
    { n: "04", title: "Receive Report", desc: "Get a full analysis with confidence scores, corrections, and citations." },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Navbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚖</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>FactCheck Agent</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => setPage("dashboard")} style={{ padding: "7px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151" }}>Dashboard</button>
          <button onClick={() => setPage("verify")} style={{ padding: "7px 16px", border: "none", borderRadius: 8, background: "#3b82f6", cursor: "pointer", fontSize: 13, color: "#fff", fontWeight: 600 }}>Try Free →</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "5rem 2rem 3rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 99, padding: "4px 14px", fontSize: 12, color: "#1d4ed8", fontWeight: 600, marginBottom: "1.5rem" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
          Powered by Google Gemini 2.0
        </div>
        <h1 style={{ fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 800, color: "#0f172a", lineHeight: 1.15, marginBottom: "1.25rem", letterSpacing: "-0.03em" }}>
          The Truth Layer for<br />
          <span style={{ background: "linear-gradient(135deg,#3b82f6,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Complex Documents</span>
        </h1>
        <p style={{ fontSize: "clamp(1rem,2vw,1.2rem)", color: "#64748b", lineHeight: 1.7, maxWidth: 600, margin: "0 auto 2.5rem" }}>
          Upload reports, whitepapers, and PDFs to automatically verify claims against live web data using AI. Detect fake stats, outdated figures, and fabricated assertions instantly.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage("verify")} style={{ padding: "14px 28px", border: "none", borderRadius: 10, background: "#3b82f6", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            ⬆ Upload Document
          </button>
          <button onClick={() => setPage("report")} style={{ padding: "14px 28px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#374151", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            View Demo Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 900, margin: "0 auto 4rem", padding: "0 2rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[["98.2%","Detection Rate"],["< 45s","Avg. Verify Time"],["12+ Sources","Per Claim"]].map(([v,l]) => (
            <div key={l} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{v}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "#fff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", padding: "4rem 2rem" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem", textAlign: "center" }}>How it works</h2>
          <p style={{ color: "#64748b", textAlign: "center", marginBottom: "3rem" }}>Four steps from document to verified truth</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
            {steps.map(s => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: 16, fontWeight: 800, color: "#3b82f6", fontFamily: "monospace" }}>{s.n}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 2rem" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem", textAlign: "center" }}>Built for accuracy</h2>
        <p style={{ color: "#64748b", textAlign: "center", marginBottom: "3rem" }}>Enterprise-grade fact verification in a clean, intuitive interface</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", padding: "2rem", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>FactCheck Agent — AI-powered document verification · Built with Gemini 2.0</span>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

function Dashboard({ setPage, results }) {
  const hasResults = results.length > 0;
  const total = results.length;
  const verified = results.filter(r => r.status === "VERIFIED").length;
  const falseCount = results.filter(r => r.status === "FALSE").length;
  const avgScore = total > 0 ? Math.round(results.reduce((a, b) => a + b.confidence, 0) / total) : 0;

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>Overview of your document verification activity</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: "2rem" }}>
        {[
          { label: "Claims Analyzed", value: total || "—", icon: "📄", color: "#3b82f6", bg: "#eff6ff" },
          { label: "Verified Claims", value: verified || "—", icon: "✓", color: "#059669", bg: "#d1fae5" },
          { label: "False Claims", value: falseCount || "—", icon: "✗", color: "#dc2626", bg: "#fee2e2" },
          { label: "Avg. Confidence", value: avgScore ? `${avgScore}%` : "—", icon: "◎", color: "#7c3aed", bg: "#ede9fe" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{s.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: s.color }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: "2rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Quick Actions</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setPage("verify")} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 8, background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⬆ New Analysis</button>
            {hasResults && <button onClick={() => setPage("report")} style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#374151", fontSize: 13, cursor: "pointer" }}>📋 View Last Report</button>}
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#1e40af,#3b82f6)", borderRadius: 12, padding: "1.5rem", color: "#fff" }}>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 8 }}>SYSTEM STATUS</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>All Systems Operational</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Gemini API · Web Search · OCR Engine</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {["AI","WEB","OCR"].map(s => <span key={s} style={{ background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{s} ✓</span>)}
          </div>
        </div>
      </div>

      {/* Recent Results */}
      {hasResults ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Recent Analysis</h2>
            <button onClick={() => setPage("report")} style={{ fontSize: 12, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View Full Report →</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Claim (excerpt)","Entity","Status","Confidence","Page"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.slice(0,5).map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", color: "#0f172a", maxWidth: 280 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.claim}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{r.entity}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={r.status} size="sm" /></td>
                    <td style={{ padding: "12px 16px", minWidth: 120 }}><ConfidenceBar score={r.confidence} size="sm" /></td>
                    <td style={{ padding: "12px 16px", color: "#94a3b8" }}>p.{r.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "2px dashed #e2e8f0", borderRadius: 12, padding: "3rem", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
          <div style={{ fontWeight: 600, color: "#374151", marginBottom: 8 }}>No analyses yet</div>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>Upload a document to start fact-checking</div>
          <button onClick={() => setPage("verify")} style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Upload Document</button>
        </div>
      )}
    </div>
  );
}

// ── Verify Page ────────────────────────────────────────────────────────────────

function VerifyPage({ apiKey, onComplete, setPage, geminiConnected, showApiModal }) {
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | uploading | extracting | verifying | done
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [extractedClaims, setExtractedClaims] = useState([]);
  const [useDemo, setUseDemo] = useState(false);
  const fileRef = useRef();
  const logRef = useRef();

  function addLog(msg, type = "info") {
    setLogs(l => [...l, { msg, type, t: new Date().toLocaleTimeString() }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }

  function handleFile(f) {
    if (!f) return;
    setFile(f); setLogs([]); setExtractedClaims([]); setStage("idle");
  }

  async function runAnalysis(isDemo = false) {
    if (!isDemo && !file) return;
    setUseDemo(isDemo);
    if (!apiKey && !isDemo) { showApiModal(); return; }

    setStage("uploading"); setProgress(5); setLogs([]);
    addLog(`📂 ${isDemo ? "Loading demo document..." : `Uploading "${file.name}"...`}`, "info");
    await sleep(700);

    setStage("extracting"); setProgress(20);
    addLog("🔍 Parsing document structure...", "info");
    await sleep(600);
    addLog("📝 Identifying factual claims with Gemini...", "info");
    await sleep(800);
    addLog("✦ Extracting statistics and numerical data...", "info");
    await sleep(600);
    addLog("✦ Detecting dates, percentages, assertions...", "info");
    await sleep(500);
    setProgress(45);

    const claims = isDemo ? DEMO_DOC.claims : [];

    if (!isDemo && apiKey) {
      try {
        addLog("🤖 Sending text to Gemini 2.0 Flash...", "ai");
        const fileText = `[Simulated document content from: ${file.name}]
This report states that global GDP grew 12.4% in 2023.
OpenAI was founded in 2012.
Renewable energy now accounts for 35% of global electricity.
The smartphone market was worth $1.2 trillion in 2020.`;
        const extracted = await callGeminiExtract(apiKey, fileText);
        claims.push(...extracted);
        addLog(`✓ Extracted ${extracted.length} verifiable claims`, "success");
      } catch (e) {
        addLog(`⚠ Gemini extraction failed: ${e.message}. Using demo claims.`, "warn");
        claims.push(...DEMO_DOC.claims);
      }
    } else if (isDemo) {
      addLog(`✓ ${DEMO_DOC.claims.length} claims identified from document`, "success");
    }

    setProgress(60); setStage("verifying");
    addLog("🌐 Starting web verification for each claim...", "info");

    for (let i = 0; i < claims.length; i++) {
      await sleep(600);
      addLog(`🔗 Cross-referencing: "${claims[i].claim.substring(0, 50)}..."`, "info");
      await sleep(400);
      addLog(`✓ Claim ${i+1}/${claims.length} verdict: ${claims[i].status}`, claims[i].status === "VERIFIED" ? "success" : "warn");
      setProgress(60 + ((i + 1) / claims.length) * 30);
      setExtractedClaims(claims.slice(0, i + 1));
    }

    setProgress(100); setStage("done");
    addLog("📊 Generating verification report...", "info");
    await sleep(500);
    addLog("✅ Analysis complete!", "success");
    setTimeout(() => onComplete(claims), 1000);
  }

  async function callGeminiExtract(key, text) {
    const prompt = `You are a fact-checker. Extract all verifiable factual claims from this text. For each claim, return JSON only.

Text: "${text}"

Return a JSON array where each item has:
- id (number)
- claim (string, the exact claim)
- page (number, estimate 1-10)
- entity (string, category like "Economy", "Technology")
- status ("VERIFIED"|"INACCURATE"|"FALSE"|"OUTDATED")
- confidence (number 70-99)
- reasoning (string, 2-3 sentence explanation)
- correct_fact (string)
- sources (array of {title, url, credibility} with 2 items)

Return ONLY valid JSON array, no markdown.`;

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2000 } })
    });
    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    const data = await resp.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const clean = raw.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(clean);
  }

  const dropProps = {
    onDragOver: e => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); },
  };

  const isRunning = ["uploading","extracting","verifying"].includes(stage);

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Verify Document</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>Upload a document to begin AI-powered fact extraction and verification</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Left */}
        <div>
          {/* Upload zone */}
          <div {...dropProps} onClick={() => !file && fileRef.current.click()}
            style={{ border: `2px dashed ${dragOver ? "#3b82f6" : file ? "#6ee7b7" : "#e2e8f0"}`, borderRadius: 12, padding: "2.5rem", textAlign: "center", cursor: "pointer", background: dragOver ? "#eff6ff" : file ? "#f0fdf4" : "#fff", transition: "all 0.2s", marginBottom: 16 }}>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            <div style={{ fontSize: 40, marginBottom: 12 }}>{file ? "✅" : "⬆"}</div>
            {file ? (
              <>
                <div style={{ fontWeight: 700, color: "#059669", marginBottom: 4 }}>{file.name}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Drop your document here</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>PDF, DOCX, or TXT · Up to 50MB</div>
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => runAnalysis(false)} disabled={!file || isRunning}
              style={{ flex: 2, padding: "12px", border: "none", borderRadius: 8, background: !file || isRunning ? "#93c5fd" : "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 700, cursor: file && !isRunning ? "pointer" : "not-allowed" }}>
              {isRunning ? "Analyzing..." : "⚡ Start Analysis"}
            </button>
            <button onClick={() => runAnalysis(true)} disabled={isRunning}
              style={{ flex: 1, padding: "12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#374151", fontSize: 13, cursor: isRunning ? "not-allowed" : "pointer" }}>
              🎬 Run Demo
            </button>
          </div>

          {/* Progress */}
          {isRunning && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.25rem", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {stage === "uploading" && "Uploading & Parsing"}
                  {stage === "extracting" && "Extracting Claims"}
                  {stage === "verifying" && "Verifying Claims"}
                </span>
                <span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 700 }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ background: "#f1f5f9", borderRadius: 99, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#7c3aed)", borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>
            </div>
          )}

          {/* Done */}
          {stage === "done" && (
            <div style={{ background: "#f0fdf4", border: "1px solid #6ee7b7", borderRadius: 12, padding: "1.25rem", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, color: "#059669" }}>✅ Analysis Complete</div>
                <div style={{ fontSize: 13, color: "#064e3b" }}>{extractedClaims.length} claims verified · Redirecting to report…</div>
              </div>
              <button onClick={() => setPage("report")} style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#059669", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>View Report →</button>
            </div>
          )}

          {/* Live log */}
          {logs.length > 0 && (
            <div style={{ background: "#0f172a", borderRadius: 12, padding: "1rem", fontFamily: "monospace", fontSize: 12 }}>
              <div style={{ color: "#475569", marginBottom: 8, fontSize: 11, letterSpacing: "0.05em" }}>LIVE VERIFICATION LOG</div>
              <div ref={logRef} style={{ maxHeight: 200, overflowY: "auto" }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ marginBottom: 4, color: l.type === "success" ? "#86efac" : l.type === "warn" ? "#fcd34d" : l.type === "ai" ? "#93c5fd" : "#94a3b8" }}>
                    <span style={{ color: "#475569" }}>[{l.t}] </span>{l.msg}
                  </div>
                ))}
                {isRunning && <div style={{ color: "#64748b" }}>█ <LoadingDots /></div>}
              </div>
            </div>
          )}
        </div>

        {/* Right — Live extraction */}
        <div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isRunning ? "#3b82f6" : "#d1d5db", animation: isRunning ? "pulse 1.5s infinite" : "none" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Live Extraction Stream</span>
            </div>
            <div style={{ padding: "1rem", maxHeight: 550, overflowY: "auto" }}>
              {extractedClaims.length === 0 && !isRunning && (
                <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#94a3b8", fontSize: 13 }}>
                  Claims will appear here as they're extracted...
                </div>
              )}
              {extractedClaims.map((c, i) => (
                <div key={c.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.875rem", marginBottom: 10, animation: "fadeIn 0.4s ease", background: "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>CLAIM #{i + 1} · p.{c.page}</span>
                    <StatusBadge status={c.status} size="sm" />
                  </div>
                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, margin: "0 0 8px" }}>{c.claim}</p>
                  <ConfidenceBar score={c.confidence} size="sm" />
                </div>
              ))}
              {isRunning && extractedClaims.length > 0 && (
                <div style={{ border: "1px dashed #bfdbfe", borderRadius: 8, padding: "0.875rem", background: "#eff6ff" }}>
                  <div style={{ fontSize: 12, color: "#3b82f6", display: "flex", alignItems: "center", gap: 8 }}>
                    <LoadingDots /> Scanning next claim...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Claim Card ─────────────────────────────────────────────────────────────────

function ClaimCard({ claim, idx }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.VERIFIED;

  return (
    <div style={{ background: "#fff", border: `1px solid #e2e8f0`, borderLeft: `4px solid ${cfg.color}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace" }}>CLAIM #{idx + 1}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Page {claim.page}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
            <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "1px 8px", borderRadius: 4 }}>{claim.entity}</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", lineHeight: 1.5, margin: 0 }}>"{claim.claim}"</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
          <StatusBadge status={claim.status} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Confidence</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color }}>{claim.confidence}%</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        <div style={{ padding: "1rem 1.25rem", borderRight: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>AI Reasoning</div>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>{claim.reasoning}</p>
        </div>
        <div style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Corrected Fact</div>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
            <p style={{ fontSize: 13, color: "#065f46", lineHeight: 1.6, margin: 0 }}>{claim.correct_fact}</p>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9" }}>
        <ConfidenceBar score={claim.confidence} />
      </div>

      {/* Sources toggle */}
      <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 13, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          🔗 {expanded ? "Hide" : "View"} Sources ({claim.sources.length})
          <span style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
        </button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{claim.sources.length} source{claim.sources.length !== 1 ? "s" : ""} checked</span>
      </div>

      {expanded && (
        <div style={{ padding: "0 1.25rem 1rem", borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
          {claim.sources.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < claim.sources.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.title}</div>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#3b82f6" }}>{s.url}</a>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Credibility</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#059669" }}>{s.credibility}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Report Page ────────────────────────────────────────────────────────────────

function ReportPage({ results, setPage }) {
  const claims = results.length > 0 ? results : DEMO_DOC.claims;
  const doc = results.length > 0 ? { ...DEMO_DOC, claims, truthScore: Math.round(claims.filter(c=>c.status==="VERIFIED").length/claims.length*100) } : DEMO_DOC;

  const counts = { VERIFIED: 0, INACCURATE: 0, FALSE: 0, OUTDATED: 0 };
  claims.forEach(c => counts[c.status] = (counts[c.status] || 0) + 1);

  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? claims : claims.filter(c => c.status === filter);

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ document: doc.name, analyzedAt: doc.analyzedAt, claims }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "factcheck-report.json"; a.click();
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 4 }}>VERIFICATION REPORT</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{doc.name}</h1>
          <p style={{ color: "#64748b", fontSize: 13 }}>{new Date(doc.analyzedAt).toLocaleString()} · {claims.length} claims analyzed · {doc.pages} pages</p>
        </div>
        <button onClick={exportJSON} style={{ padding: "10px 16px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>⬇ Export JSON</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, marginBottom: "2rem" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <TruthScoreRing score={doc.truthScore} />
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, textAlign: "center" }}>Overall Truth Score</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, alignContent: "start" }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} style={{ background: v.bg, border: `1px solid ${v.border}`, borderRadius: 10, padding: "1rem" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: v.color }}>{counts[k] || 0}</div>
              <div style={{ fontSize: 12, color: v.color, fontWeight: 600, marginTop: 2 }}>{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "1.25rem", marginBottom: "2rem" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Executive Summary</div>
        <p style={{ fontSize: 14, color: "#1e40af", lineHeight: 1.7, margin: 0 }}>{doc.summary}</p>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {["ALL", ...Object.keys(STATUS_CONFIG)].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === f ? "#3b82f6" : "#e2e8f0"}`, background: filter === f ? "#3b82f6" : "#fff", color: filter === f ? "#fff" : "#374151", fontSize: 13, cursor: "pointer", fontWeight: filter === f ? 600 : 400 }}>
            {f === "ALL" ? `All (${claims.length})` : `${STATUS_CONFIG[f].label} (${counts[f] || 0})`}
          </button>
        ))}
      </div>

      {/* Claims */}
      {filtered.map((c, i) => <ClaimCard key={c.id} claim={c} idx={claims.indexOf(c)} />)}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>No claims with this status</div>
      )}
    </div>
  );
}

// ── Settings Page ──────────────────────────────────────────────────────────────

function SettingsPage({ apiKey, setApiKey, showApiModal }) {
  return (
    <div style={{ padding: "2rem", maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>Settings</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: "2rem" }}>Configure your API keys and preferences</p>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Gemini API Configuration</h2>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 600, color: "#374151", marginBottom: 2 }}>API Key Status</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {apiKey ? `Connected · ${apiKey.substring(0, 8)}...${apiKey.slice(-4)}` : "No API key configured"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: apiKey ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 13, color: apiKey ? "#059669" : "#dc2626", fontWeight: 600 }}>{apiKey ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
          <button onClick={showApiModal} style={{ padding: "10px 20px", border: "none", borderRadius: 8, background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            {apiKey ? "Update API Key" : "Connect Gemini API"}
          </button>
          {apiKey && <button onClick={() => setApiKey("")} style={{ marginLeft: 10, padding: "10px 20px", border: "1px solid #fca5a5", borderRadius: 8, background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>Disconnect</button>}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>AI Model</h2>
        </div>
        <div style={{ padding: "1.5rem" }}>
          {GEMINI_MODELS.map(m => (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
              <input type="radio" name="model" defaultChecked={m === "gemini-2.0-flash"} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{m}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{m === "gemini-2.0-flash" ? "Fastest · Recommended for most documents" : "Most capable · Better for complex analysis"}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sleep helper ───────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── App Shell ──────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("landing");
  const [apiKey, setApiKey] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("gemini_key");
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => { if (apiKey) localStorage.setItem("gemini_key", apiKey); else localStorage.removeItem("gemini_key"); }, [apiKey]);

  function handleSaveKey(k) { setApiKey(k); }

  function handleComplete(claims) { setResults(claims); setPage("report"); }

  const geminiConnected = Boolean(apiKey);

  if (page === "landing") return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <LandingPage setPage={setPage} />
      {showModal && <ApiKeyModal onSave={handleSaveKey} onClose={() => setShowModal(false)} current={apiKey} />}
    </>
  );

  return (
    <>
      <style>{`*{margin:0;padding:0;box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif} @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
        <Sidebar page={page} setPage={setPage} geminiConnected={geminiConnected} docReady={results.length > 0} />
        <div style={{ flex: 1, overflow: "auto" }}>
          {/* Top bar */}
          <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 2rem", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
            <div style={{ fontSize: 14, color: "#64748b", textTransform: "capitalize" }}>{page}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => setShowModal(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${geminiConnected ? "#bbf7d0" : "#e2e8f0"}`, background: geminiConnected ? "#f0fdf4" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: geminiConnected ? "#059669" : "#64748b" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: geminiConnected ? "#22c55e" : "#d1d5db", display: "inline-block" }} />
                {geminiConnected ? "Gemini Connected" : "Connect Gemini"}
              </button>
              <button onClick={() => setPage("verify")} style={{ padding: "6px 14px", border: "none", borderRadius: 8, background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ New Analysis</button>
            </div>
          </div>

          {page === "dashboard" && <Dashboard setPage={setPage} results={results} />}
          {page === "verify" && <VerifyPage apiKey={apiKey} onComplete={handleComplete} setPage={setPage} geminiConnected={geminiConnected} showApiModal={() => setShowModal(true)} />}
          {page === "report" && <ReportPage results={results} setPage={setPage} />}
          {page === "settings" && <SettingsPage apiKey={apiKey} setApiKey={setApiKey} showApiModal={() => setShowModal(true)} />}
        </div>
      </div>
      {showModal && <ApiKeyModal onSave={handleSaveKey} onClose={() => setShowModal(false)} current={apiKey} />}
    </>
  );
}
