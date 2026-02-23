"use client";

import { useState, useEffect, useRef } from "react";

const TOKENS = [
  { id: "STX", label: "Stacks", symbol: "STX", color: "#FF6B00", glow: "#FF6B0044", rate: 1847.35, icon: "S", change: +2.4 },
  { id: "USDC", label: "USD Coin", symbol: "USDC", color: "#2775CA", glow: "#2775CA44", rate: 1620.5, icon: "$", change: +0.1 },
];

function formatNGN(val: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(val);
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const duration = 400;
    const startTime = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * ease);
      if (p < 1) requestAnimationFrame(frame);
      else prev.current = end;
    };
    requestAnimationFrame(frame);
  }, [value]);
  return <>{prefix}{display.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

export default function Home() {
  const [mode, setMode] = useState<"sell" | "buy">("sell");
  const [selectedToken, setSelectedToken] = useState("STX");
  const [tokenAmount, setTokenAmount] = useState("100");
  const [ngnAmount, setNgnAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tick, setTick] = useState(0);
  const [focused, setFocused] = useState<"token" | "ngn" | null>(null);
  const [recentTx] = useState([
    { type: "sell", token: "STX", amount: "250", ngn: "461,837.50", time: "2m ago" },
    { type: "buy", token: "USDC", amount: "100", ngn: "162,050.00", time: "5m ago" },
    { type: "sell", token: "STX", amount: "50", ngn: "92,367.50", time: "11m ago" },
  ]);
  const [showHistory, setShowHistory] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; speed: number; opacity: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  const token = TOKENS.find((t) => t.id === selectedToken)!;
  const liveRate = token.rate + Math.sin(tick * 0.7) * (selectedToken === "STX" ? 14 : 2.5);
  const ngnValue = (parseFloat(tokenAmount) || 0) * liveRate;
  const fee = ngnValue * 0.005;
  const youGet = ngnValue - fee;

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode === "sell") {
      const amt = parseFloat(tokenAmount) || 0;
      setNgnAmount(amt > 0 ? (amt * liveRate).toFixed(2) : "");
    } else {
      const ngn = parseFloat(ngnAmount) || 0;
      setTokenAmount(ngn > 0 ? (ngn / liveRate).toFixed(4) : "");
    }
  }, [tick, mode, selectedToken]);

  const handleTokenAmt = (v: string) => {
    setTokenAmount(v);
    const amt = parseFloat(v) || 0;
    setNgnAmount(amt > 0 ? (amt * liveRate).toFixed(2) : "");
  };

  const handleNgnAmt = (v: string) => {
    setNgnAmount(v);
    const ngn = parseFloat(v) || 0;
    setTokenAmount(ngn > 0 ? (ngn / liveRate).toFixed(4) : "");
  };

  const handleConvert = () => {
    if (!tokenAmount || parseFloat(tokenAmount) <= 0) return;
    setStatus("loading");
    // Spawn particles
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        size: Math.random() * 6 + 3,
        speed: Math.random() * 2 + 1,
        opacity: 1,
      }));
      setParticles(newParticles);
    }
    setTimeout(() => { setStatus("success"); setParticles([]); }, 1800);
    setTimeout(() => setStatus("idle"), 4200);
  };

  const quickAmounts = ["50", "100", "500", "1000"];

  return (
    <div style={{ minHeight: "100vh", background: "#070B14", fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "24px 16px 40px", position: "relative", overflowX: "hidden", overflowY: "auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --token-color: ${token.color};
          --token-glow: ${token.glow};
        }

        body { background: #070B14; }

        /* Animated grid background */
        .grid-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(255,107,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,107,0,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .orb {
          position: absolute; border-radius: 50%; filter: blur(100px);
          pointer-events: none; z-index: 0;
        }

        .wrapper {
          position: relative; z-index: 10;
          width: 100%; max-width: 460px;
          display: flex; flex-direction: column; gap: 12px;
          margin-top: 8px;
        }

        /* Top nav */
        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 4px; margin-bottom: 4px;
        }

        .logo {
          display: flex; align-items: center; gap: 10px;
        }

        .logo-mark {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, #FF6B00, #FF9500);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 800; color: #fff;
          box-shadow: 0 4px 16px #FF6B0055;
        }

        .logo-text { font-size: 18px; font-weight: 700; color: #F1F5F9; letter-spacing: -0.5px; }
        .logo-sub { font-size: 11px; color: #3A4A6A; letter-spacing: 0.5px; }

        .network-pill {
          display: flex; align-items: center; gap: 6px;
          background: #0F1829; border: 1px solid #1E2D45;
          border-radius: 20px; padding: 6px 12px;
          font-size: 11px; color: #4A6A8A; font-weight: 500;
        }

        /* Main card */
        .card {
          background: linear-gradient(145deg, #0F1829 0%, #0D1520 100%);
          border: 1px solid #1A2840;
          border-radius: 28px;
          padding: 28px;
          position: relative;
          overflow: visible;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02), 0 32px 64px rgba(0,0,0,0.6);
        }

        .card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,107,0,0.3), transparent);
        }

        /* Token pills */
        .token-pills {
          display: flex; gap: 8px; margin-bottom: 24px;
        }

        .token-pill {
          flex: 1; padding: 10px 14px; border-radius: 14px; border: 1px solid #1A2840;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 600; transition: all 0.25s;
          display: flex; align-items: center; gap: 8px;
          background: #0A1020;
          color: #4A6A8A;
        }

        .token-pill:hover { border-color: #2A3A5A; color: #8A9AB8; }

        .token-pill-active {
          border-color: var(--token-color) !important;
          background: color-mix(in srgb, var(--token-color) 8%, #0A1020) !important;
          color: #F1F5F9 !important;
          box-shadow: 0 0 20px var(--token-glow);
        }

        .pill-icon {
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
        }

        .pill-change { margin-left: auto; font-size: 11px; }
        .pill-change-pos { color: #22C55E; }
        .pill-change-neg { color: #EF4444; }

        /* Mode switch */
        .mode-switch {
          display: flex; background: #080E1A; border-radius: 14px;
          padding: 4px; margin-bottom: 20px; border: 1px solid #1A2840;
        }

        .mode-btn {
          flex: 1; padding: 10px; border: none; border-radius: 10px;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 600; transition: all 0.2s;
          background: transparent; color: #3A5070;
        }

        .mode-btn-sell-active { background: #FF6B00; color: #fff; box-shadow: 0 4px 12px #FF6B0044; }
        .mode-btn-buy-active { background: #22C55E; color: #fff; box-shadow: 0 4px 12px #22C55E44; }

        /* Input fields */
        .field-label {
          font-size: 10px; color: #3A5070; text-transform: uppercase;
          letter-spacing: 1.2px; margin-bottom: 8px; font-weight: 600;
        }

        .input-box {
          background: #080E1A; border-radius: 16px;
          border: 1.5px solid #1A2840;
          padding: 14px 16px;
          display: flex; align-items: center; gap: 12px;
          transition: all 0.2s; position: relative;
        }

        .input-box-focused { border-color: var(--token-color); box-shadow: 0 0 0 3px var(--token-glow); }
        .input-box-ngn-focused { border-color: #22C55E; box-shadow: 0 0 0 3px #22C55E22; }

        .token-badge {
          display: flex; align-items: center; gap: 7px;
          background: #0F1829; border: 1px solid #1A2840;
          border-radius: 10px; padding: 7px 10px;
          white-space: nowrap; flex-shrink: 0;
        }

        .badge-icon {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
        }

        .badge-label { font-size: 12px; font-weight: 600; color: #C8D8E8; }

        .amount-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-family: 'DM Mono', monospace; font-size: 22px;
          font-weight: 500; color: #F1F5F9; width: 100%; min-width: 0;
        }
        .amount-input::placeholder { color: #1E2D45; }
        .amount-input-ngn { color: #22C55E !important; }

        .input-usd-hint {
          font-size: 11px; color: #2A4060; font-family: 'DM Mono', monospace;
          white-space: nowrap;
        }

        /* Quick amounts */
        .quick-amounts {
          display: flex; gap: 6px; margin-top: 8px;
        }

        .quick-btn {
          flex: 1; padding: 6px; border-radius: 8px;
          border: 1px solid #1A2840; background: #080E1A;
          font-family: 'DM Sans', sans-serif; font-size: 11px;
          font-weight: 600; color: #3A5070; cursor: pointer;
          transition: all 0.15s;
        }
        .quick-btn:hover { border-color: var(--token-color); color: var(--token-color); }

        /* Arrow */
        .arrow-wrap {
          display: flex; align-items: center; justify-content: center;
          margin: 12px 0; position: relative;
        }

        .arrow-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: #0F1829; border: 1.5px solid #1A2840;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #3A5070; transition: all 0.2s; z-index: 1;
        }
        .arrow-btn:hover { background: #FF6B00; color: #fff; border-color: #FF6B00; transform: rotate(180deg); }

        .arrow-line {
          position: absolute; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, #1A2840, transparent);
        }

        /* Summary strip */
        .summary {
          background: #080E1A; border: 1px solid #1A2840;
          border-radius: 14px; padding: 14px 16px; margin-bottom: 18px;
        }

        .summary-row {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 12px; color: #3A5070; padding: 3px 0;
        }

        .summary-val {
          font-family: 'DM Mono', monospace; font-size: 11px; color: #6A8AAA;
        }

        .summary-total {
          border-top: 1px solid #1A2840; margin-top: 8px; padding-top: 8px;
          font-weight: 600; color: #C8D8E8 !important;
        }

        .summary-total .summary-val { color: #22C55E !important; font-size: 13px !important; }

        .live-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #22C55E; display: inline-block;
          animation: blink 1.8s ease-in-out infinite; margin-right: 4px;
        }

        /* Convert button */
        .convert-btn {
          width: 100%; padding: 17px; border-radius: 16px; border: none;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 700; letter-spacing: 0.3px;
          transition: all 0.25s; position: relative; overflow: hidden;
        }

        .convert-idle {
          background: linear-gradient(135deg, #FF6B00 0%, #FF9A00 100%);
          color: #fff; box-shadow: 0 8px 28px #FF6B0050;
        }
        .convert-idle:hover { transform: translateY(-2px); box-shadow: 0 14px 36px #FF6B0060; }
        .convert-idle:active { transform: translateY(0); }

        .convert-buy-idle {
          background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
          color: #fff; box-shadow: 0 8px 28px #22C55E40;
        }
        .convert-buy-idle:hover { transform: translateY(-2px); box-shadow: 0 14px 36px #22C55E50; }

        .convert-loading { background: #0F1829; color: #3A5070; cursor: not-allowed; border: 1px solid #1A2840; }

        .convert-success {
          background: linear-gradient(135deg, #22C55E 0%, #86EFAC 100%);
          color: #052e16; box-shadow: 0 8px 28px #22C55E50;
        }

        /* Spinner */
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.15);
          border-top-color: #6A8AAA; border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block; vertical-align: middle; margin-right: 8px;
        }

        /* History card */
        .history-card {
          background: #0F1829; border: 1px solid #1A2840;
          border-radius: 20px; padding: 20px; overflow: hidden;
          transition: all 0.3s;
        }

        .history-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 14px; cursor: pointer;
        }

        .history-title { font-size: 12px; font-weight: 600; color: #4A6A8A; text-transform: uppercase; letter-spacing: 1px; }

        .tx-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid #0A1020;
        }
        .tx-row:last-child { border-bottom: none; }

        .tx-icon {
          width: 32px; height: 32px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; flex-shrink: 0;
        }

        .tx-sell { background: #FF6B0015; }
        .tx-buy { background: #22C55E15; }

        .tx-info { flex: 1; }
        .tx-title { font-size: 12px; font-weight: 600; color: #8A9AB8; }
        .tx-sub { font-size: 10px; color: #3A5070; margin-top: 1px; }
        .tx-amount { font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; color: #22C55E; text-align: right; }
        .tx-time { font-size: 10px; color: #3A5070; text-align: right; margin-top: 2px; }

        /* Trust badges */
        .badges {
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px;
        }
        .badge {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; color: #2A4060; font-weight: 500;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0); }
        }
        @keyframes betaPulse {
          0%, 100% { box-shadow: 0 0 12px #7C3AED33; }
          50% { box-shadow: 0 0 20px #7C3AED66; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .slide-in { animation: slideIn 0.3s ease forwards; }

        .shimmer {
          background: linear-gradient(90deg, #1A2840 25%, #2A3A5A 50%, #1A2840 75%);
          background-size: 200% 100%;
          animation: shimmerAnim 1.5s infinite;
        }

        @keyframes shimmerAnim {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Background */}
      <div className="grid-bg" />
      <div className="orb" style={{ width: 500, height: 500, background: token.color, opacity: 0.06, top: -150, right: -150 }} />
      <div className="orb" style={{ width: 400, height: 400, background: "#2775CA", opacity: 0.05, bottom: -100, left: -150 }} />
      <div className="orb" style={{ width: 200, height: 200, background: "#22C55E", opacity: 0.04, top: "40%", left: "10%" }} />

      <div className="wrapper">
        {/* Topbar */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-mark">S</div>
            <div>
              <div className="logo-text">StackSwap</div>
              <div className="logo-sub">STACKS · NAIRA</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "linear-gradient(135deg, #7C3AED22, #A855F722)",
              border: "1px solid #7C3AED55",
              borderRadius: 20, padding: "5px 10px",
              fontSize: 10, fontWeight: 700, color: "#C084FC",
              letterSpacing: "1.5px", textTransform: "uppercase",
              animation: "betaPulse 3s ease-in-out infinite",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%", background: "#A855F7",
                display: "inline-block", animation: "blink 1.8s ease-in-out infinite",
                marginRight: 2,
              }} />
              Beta
            </div>
            <div className="network-pill">
              <span className="live-dot" />
              Mainnet
            </div>
          </div>
        </div>

        {/* Beta banner */}
        <div style={{
          background: "linear-gradient(135deg, #7C3AED11, #A855F711)",
          border: "1px solid #7C3AED33",
          borderRadius: 14, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12,
        }}>
          <span style={{ fontSize: 16 }}>🧪</span>
          <div>
            <span style={{ color: "#C084FC", fontWeight: 600 }}>Beta Mode — </span>
            <span style={{ color: "#5A5A8A" }}>Features may change. Use small amounts while we test.</span>
          </div>
          <div style={{
            marginLeft: "auto", fontSize: 10, color: "#7C3AED",
            background: "#7C3AED22", borderRadius: 6, padding: "3px 8px",
            fontWeight: 600, whiteSpace: "nowrap",
          }}>v0.1.0</div>
        </div>

        {/* Main card */}
        <div className="card slide-in">
          {/* Token selection */}
          <div className="token-pills">
            {TOKENS.map((t) => (
              <button
                key={t.id}
                className={`token-pill ${selectedToken === t.id ? "token-pill-active" : ""}`}
                style={selectedToken === t.id ? { ["--token-color" as any]: t.color, ["--token-glow" as any]: t.glow } : {}}
                onClick={() => { setSelectedToken(t.id); setTokenAmount("100"); setNgnAmount(""); }}
              >
                <div className="pill-icon" style={{ background: t.color }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.symbol}</div>
                  <div style={{ fontSize: 10, color: "#3A5070" }}>{t.label}</div>
                </div>
                <span className={`pill-change ${t.change >= 0 ? "pill-change-pos" : "pill-change-neg"}`}>
                  {t.change >= 0 ? "▲" : "▼"} {Math.abs(t.change)}%
                </span>
              </button>
            ))}
          </div>

          {/* Mode switch */}
          <div className="mode-switch">
            <button
              className={`mode-btn ${mode === "sell" ? "mode-btn-sell-active" : ""}`}
              onClick={() => setMode("sell")}
            >
              ↑ Sell {token.symbol}
            </button>
            <button
              className={`mode-btn ${mode === "buy" ? "mode-btn-buy-active" : ""}`}
              onClick={() => setMode("buy")}
            >
              ↓ Buy {token.symbol}
            </button>
          </div>

          {/* Token amount input */}
          <div style={{ marginBottom: 6 }}>
            <div className="field-label">{mode === "sell" ? "You're Sending" : "You're Receiving"}</div>
            <div className={`input-box ${focused === "token" ? "input-box-focused" : ""}`}>
              <div className="token-badge">
                <div className="badge-icon" style={{ background: token.color }}>{token.icon}</div>
                <span className="badge-label">{token.symbol}</span>
              </div>
              <input
                className="amount-input"
                type="number"
                placeholder="0.00"
                value={tokenAmount}
                onChange={(e) => handleTokenAmt(e.target.value)}
                onFocus={() => setFocused("token")}
                onBlur={() => setFocused(null)}
              />
              <div className="input-usd-hint">
                ≈ {formatNGN((parseFloat(tokenAmount) || 0) * liveRate)}
              </div>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="quick-amounts" style={{ ["--token-color" as any]: token.color }}>
            {quickAmounts.map((amt) => (
              <button key={amt} className="quick-btn" onClick={() => handleTokenAmt(amt)}>
                {amt}
              </button>
            ))}
            <button className="quick-btn" onClick={() => handleTokenAmt("5000")}>MAX</button>
          </div>

          {/* Arrow */}
          <div className="arrow-wrap">
            <div className="arrow-line" />
            <button className="arrow-btn" onClick={() => setMode(mode === "sell" ? "buy" : "sell")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* NGN amount */}
          <div style={{ marginBottom: 20 }}>
            <div className="field-label">{mode === "sell" ? "You're Receiving" : "You're Sending"}</div>
            <div className={`input-box ${focused === "ngn" ? "input-box-ngn-focused" : ""}`}>
              <div className="token-badge">
                <div className="badge-icon" style={{ background: "#22C55E", fontSize: 13 }}>₦</div>
                <span className="badge-label">NGN</span>
              </div>
              <input
                className="amount-input amount-input-ngn"
                type="number"
                placeholder="0.00"
                value={ngnAmount}
                onChange={(e) => handleNgnAmt(e.target.value)}
                onFocus={() => setFocused("ngn")}
                onBlur={() => setFocused(null)}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="summary">
            <div className="summary-row">
              <span><span className="live-dot" />Rate</span>
              <span className="summary-val">1 {token.symbol} = <AnimatedNumber value={liveRate} prefix="₦" /></span>
            </div>
            <div className="summary-row" style={{ marginTop: 4 }}>
              <span>Network fee (0.5%)</span>
              <span className="summary-val">- {formatNGN(fee)}</span>
            </div>
            <div className="summary-row" style={{ marginTop: 4 }}>
              <span>Settlement</span>
              <span className="summary-val" style={{ color: "#22C55E" }}>~30 sec</span>
            </div>
            <div className="summary-row summary-total">
              <span>You {mode === "sell" ? "get" : "pay"}</span>
              <span className="summary-val">
                {mode === "sell" ? formatNGN(youGet) : `${tokenAmount} ${token.symbol}`}
              </span>
            </div>
          </div>

          {/* CTA button */}
          <button
            ref={btnRef}
            className={`convert-btn ${
              status === "idle"
                ? mode === "sell" ? "convert-idle" : "convert-buy-idle"
                : status === "loading"
                ? "convert-loading"
                : "convert-success"
            }`}
            onClick={handleConvert}
            disabled={status !== "idle"}
            style={{ ["--token-color" as any]: token.color }}
          >
            {status === "idle" && (
              mode === "sell"
                ? `⚡ Convert ${token.symbol} → Naira`
                : `⚡ Buy ${token.symbol} with Naira`
            )}
            {status === "loading" && <><span className="spinner" />Processing transaction…</>}
            {status === "success" && "✅ Conversion Complete!"}
          </button>

          <p style={{ textAlign: "center", fontSize: 10, color: "#1E2D45", marginTop: 14, lineHeight: 1.6 }}>
            Powered by Stacks L2 · Secured by Bitcoin · KYC required above ₦500,000
          </p>
        </div>

        {/* Recent transactions */}
        <div className="history-card">
          <div className="history-header" onClick={() => setShowHistory(!showHistory)}>
            <span className="history-title">Recent Transactions</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3A5070" strokeWidth="2"
              style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          {showHistory && (
            <div className="slide-in">
              {recentTx.map((tx, i) => (
                <div key={i} className="tx-row">
                  <div className={`tx-icon ${tx.type === "sell" ? "tx-sell" : "tx-buy"}`}>
                    {tx.type === "sell" ? "↑" : "↓"}
                  </div>
                  <div className="tx-info">
                    <div className="tx-title">{tx.type === "sell" ? "Sold" : "Bought"} {tx.amount} {tx.token}</div>
                    <div className="tx-sub">Confirmed · Stacks</div>
                  </div>
                  <div>
                    <div className="tx-amount">₦{tx.ngn}</div>
                    <div className="tx-time">{tx.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!showHistory && (
            <div style={{ display: "flex", gap: 6 }}>
              {recentTx.slice(0, 3).map((tx, i) => (
                <div key={i} style={{
                  flex: 1, background: "#080E1A", borderRadius: 10, padding: "8px 10px",
                  fontSize: 10, color: "#3A5070", textAlign: "center"
                }}>
                  <div style={{ color: tx.type === "sell" ? "#FF6B00" : "#22C55E", fontWeight: 600, marginBottom: 2 }}>
                    {tx.type === "sell" ? "↑" : "↓"} {tx.token}
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", color: "#4A6A8A" }}>{tx.amount}</div>
                  <div>{tx.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="badges">
          {["Non-custodial", "Bitcoin Secured", "Instant NGN", "CBN Compliant"].map((b) => (
            <div key={b} className="badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#22C55E" opacity="0.6">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {b}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}