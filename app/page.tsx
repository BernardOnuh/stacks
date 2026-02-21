"use client";

import { useState, useEffect } from "react";

const STX_TO_NGN_RATE = 1_847.35; // mock rate
const NGN_TO_STX_RATE = 1 / STX_TO_NGN_RATE;

function formatNGN(val: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(val);
}

function formatSTX(val: number) {
  return val.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export default function Home() {
  const [mode, setMode] = useState<"buy" | "sell">("sell");
  const [stxAmount, setStxAmount] = useState("100");
  const [ngnAmount, setNgnAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [tick, setTick] = useState(0);

  // Simulate live rate tick
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const liveRate = STX_TO_NGN_RATE + Math.sin(tick * 0.7) * 12;

  useEffect(() => {
    if (mode === "sell") {
      const stx = parseFloat(stxAmount) || 0;
      setNgnAmount(stx > 0 ? (stx * liveRate).toFixed(2) : "");
    } else {
      const ngn = parseFloat(ngnAmount) || 0;
      setStxAmount(ngn > 0 ? (ngn * NGN_TO_STX_RATE).toFixed(4) : "");
    }
  }, [tick, stxAmount, ngnAmount, mode]);

  const handleSTXChange = (val: string) => {
    setStxAmount(val);
    const stx = parseFloat(val) || 0;
    setNgnAmount(stx > 0 ? (stx * liveRate).toFixed(2) : "");
  };

  const handleNGNChange = (val: string) => {
    setNgnAmount(val);
    const ngn = parseFloat(val) || 0;
    setStxAmount(ngn > 0 ? (ngn / liveRate).toFixed(4) : "");
  };

  const handleConvert = () => {
    setStatus("loading");
    setTimeout(() => setStatus("success"), 1800);
    setTimeout(() => setStatus("idle"), 4000);
  };

  const fee = mode === "sell"
    ? (parseFloat(stxAmount) || 0) * liveRate * 0.005
    : (parseFloat(ngnAmount) || 0) * 0.005;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0e1a",
        fontFamily: "'Sora', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Google font import via style tag */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          pointer-events: none;
        }

        .card {
          background: #111827;
          border: 1px solid #1f2d45;
          border-radius: 24px;
          padding: 32px;
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 10;
          box-shadow: 0 0 60px rgba(255, 107, 0, 0.05), 0 24px 48px rgba(0,0,0,0.5);
        }

        .tab {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .tab-active {
          background: #ff6b00;
          color: #fff;
          box-shadow: 0 4px 16px rgba(255,107,0,0.35);
        }

        .tab-inactive {
          background: transparent;
          color: #6b7a99;
        }

        .input-wrap {
          background: #0d1625;
          border: 1px solid #1f2d45;
          border-radius: 14px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: border-color 0.2s;
        }

        .input-wrap:focus-within {
          border-color: #ff6b00;
        }

        .token-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #1a2540;
          border-radius: 8px;
          padding: 6px 10px;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
        }

        .amount-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: 'Space Mono', monospace;
          font-size: 20px;
          font-weight: 700;
          color: #f1f5f9;
          width: 100%;
          min-width: 0;
        }

        .amount-input::placeholder { color: #2a3a58; }

        .swap-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #1a2540;
          border: 1px solid #1f2d45;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          transition: all 0.2s;
          color: #6b7a99;
        }
        .swap-btn:hover { background: #ff6b00; color: #fff; border-color: #ff6b00; }

        .convert-btn {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.5px;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .convert-btn-idle {
          background: linear-gradient(135deg, #ff6b00, #ff9500);
          color: #fff;
          box-shadow: 0 8px 24px rgba(255,107,0,0.4);
        }

        .convert-btn-idle:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(255,107,0,0.5);
        }

        .convert-btn-loading {
          background: #1a2540;
          color: #6b7a99;
          cursor: not-allowed;
        }

        .convert-btn-success {
          background: linear-gradient(135deg, #00c853, #69f0ae);
          color: #0a0e1a;
          box-shadow: 0 8px 24px rgba(0,200,83,0.35);
        }

        .rate-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #4a5a7a;
          padding: 4px 0;
        }

        .rate-val { color: #94a3b8; font-family: 'Space Mono', monospace; font-size: 11px; }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00c853;
          display: inline-block;
          animation: pulse 1.5s infinite;
          margin-right: 4px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          vertical-align: middle;
          margin-right: 8px;
        }

        .divider {
          height: 1px;
          background: #1f2d45;
          margin: 20px 0;
        }
      `}</style>

      {/* Background orbs */}
      <div className="glow-orb" style={{ width: 400, height: 400, background: "#ff6b00", top: -100, right: -100 }} />
      <div className="glow-orb" style={{ width: 300, height: 300, background: "#6c63ff", bottom: -50, left: -80 }} />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32, position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #ff6b00, #ff9500)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff"
          }}>S</div>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.5px" }}>StackSwap</span>
        </div>
        <p style={{ color: "#4a5a7a", fontSize: 13 }}>Convert STX ↔ Naira instantly</p>
      </div>

      <div className="card">
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, background: "#0d1625", borderRadius: 14, padding: 6, marginBottom: 24 }}>
          <button className={`tab ${mode === "sell" ? "tab-active" : "tab-inactive"}`} onClick={() => setMode("sell")}>
            Sell STX → NGN
          </button>
          <button className={`tab ${mode === "buy" ? "tab-active" : "tab-inactive"}`} onClick={() => setMode("buy")}>
            Buy STX ← NGN
          </button>
        </div>

        {/* STX Input */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: "#4a5a7a", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
            {mode === "sell" ? "You Send" : "You Receive"}
          </label>
          <div className="input-wrap">
            <div className="token-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ff6b00" opacity="0.2"/>
                <text x="12" y="16" textAnchor="middle" fill="#ff6b00" fontSize="10" fontWeight="bold">S</text>
              </svg>
              STX
            </div>
            <input
              className="amount-input"
              type="number"
              placeholder="0.0000"
              value={stxAmount}
              onChange={(e) => handleSTXChange(e.target.value)}
            />
          </div>
        </div>

        {/* Swap icon */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "12px 0" }}>
          <button className="swap-btn" onClick={() => setMode(mode === "sell" ? "buy" : "sell")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          </button>
        </div>

        {/* NGN Output */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, color: "#4a5a7a", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
            {mode === "sell" ? "You Receive" : "You Send"}
          </label>
          <div className="input-wrap">
            <div className="token-badge">
              <span style={{ color: "#00c853", fontSize: 14 }}>₦</span>
              NGN
            </div>
            <input
              className="amount-input"
              type="number"
              placeholder="0.00"
              value={ngnAmount}
              onChange={(e) => handleNGNChange(e.target.value)}
              style={{ color: "#00c853" }}
            />
          </div>
        </div>

        {/* Rate info */}
        <div style={{ background: "#0d1625", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div className="rate-row">
            <span><span className="live-dot" />Live Rate</span>
            <span className="rate-val">1 STX = {formatNGN(liveRate)}</span>
          </div>
          <div className="rate-row" style={{ marginTop: 6 }}>
            <span>Network fee (0.5%)</span>
            <span className="rate-val">≈ {formatNGN(fee)}</span>
          </div>
          <div className="rate-row" style={{ marginTop: 6 }}>
            <span>Settlement</span>
            <span className="rate-val" style={{ color: "#00c853" }}>~30 seconds</span>
          </div>
        </div>

        {/* Convert Button */}
        <button
          className={`convert-btn ${status === "idle" ? "convert-btn-idle" : status === "loading" ? "convert-btn-loading" : "convert-btn-success"}`}
          onClick={handleConvert}
          disabled={status !== "idle"}
        >
          {status === "idle" && (mode === "sell" ? "⚡ Convert STX to Naira" : "⚡ Buy STX with Naira")}
          {status === "loading" && <><span className="spinner" />Processing…</>}
          {status === "success" && "✓ Conversion Successful!"}
        </button>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#2a3a58", marginTop: 16 }}>
          Secured by Stacks blockchain · KYC required for &gt;₦500,000
        </p>
      </div>

      {/* Bottom trust badges */}
      <div style={{ display: "flex", gap: 20, marginTop: 24, position: "relative", zIndex: 10 }}>
        {["Non-custodial", "Instant NGN", "CBN Compliant"].map((label) => (
          <div key={label} style={{ fontSize: 11, color: "#2a3a58", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#ff6b00"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}