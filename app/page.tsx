"use client";

import { useState, useEffect, useRef, useCallback } from "react";
// ── Modern @stacks/connect API (no AppConfig / UserSession needed) ──
import {
  connect,
  disconnect as stacksDisconnect,
  isConnected,
  getLocalStorage,
  openSTXTransfer,
  openContractCall,
} from "@stacks/connect";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";
import { uintCV, standardPrincipalCV, someCV, bufferCVFromString } from "@stacks/transactions";

// ── API base ─────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const STACKS_NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK || "mainnet";

const network = STACKS_NETWORK === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

// ── Types for @stacks/connect getLocalStorage() ──────────────────
interface StoredAddresses {
  addresses?: {
    stx?: Array<{ address: string; publicKey?: string }>;
    btc?: Array<{ address: string; publicKey?: string }>;
  };
}

// ── USDC SIP-010 contract ─────────────────────────────────────────
const USDC_CONTRACT_ADDRESS = "SP3Y2DC0WJ6EXMM9MSSEZ5JHVHPS6XMTFJ35XAPD";
const USDC_CONTRACT_NAME    = "usdc-token";

const TOKENS = [
  { id: "STX",  label: "Stacks",   symbol: "STX",  color: "#FF6B00", glow: "#FF6B0044", icon: "S" },
  { id: "USDC", label: "USD Coin", symbol: "USDC", color: "#2775CA", glow: "#2775CA44", icon: "$" },
];

function formatNGN(val: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(val);
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end   = value;
    const startTime = performance.now();
    const frame = (now: number) => {
      const p    = Math.min((now - startTime) / 400, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * ease);
      if (p < 1) requestAnimationFrame(frame);
      else prev.current = end;
    };
    requestAnimationFrame(frame);
  }, [value]);
  return <>{prefix}{display.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

// ── Types ─────────────────────────────────────────────────────────
type AppMode  = "sell" | "buy";
type FlowStep = "swap" | "sell_bank" | "sell_confirm" | "sell_sending" | "sell_pending" | "buy_details" | "buy_payment" | "success";

interface Bank       { code: string; name: string; }
interface RateData   { marketRateNGN: number; flatFeeNGN: number; priceUSD: number; change24h?: number; }
interface OfframpResult {
  transactionReference: string; ngnAmount: number; grossNGN: number; flatFeeNGN: number;
  depositInstructions: { sendTo: string; amount: string; memo: string; expiresAt: string; expiresInMinutes: number; };
  bank: { accountName: string; accountNumber: string; bankName: string; };
}
interface OnrampResult {
  transactionId: string; paymentReference: string; tokenAmount: number; totalPayableNGN: number;
  monnifyConfig: { amount: number; reference: string; apiKey: string; contractCode: string; customerFullName: string; customerEmail: string; customerMobileNumber: string; paymentDescription: string; paymentMethods: string[]; currency: string; };
}

// ═══════════════════════════════════════════════════════════════════
export default function StackSwap() {

  // ── Core state ──────────────────────────────────────────────────
  const [mode, setMode]                   = useState<AppMode>("sell");
  const [step, setStep]                   = useState<FlowStep>("swap");
  const [selectedToken, setSelectedToken] = useState("STX");
  const [tokenAmount, setTokenAmount]     = useState("100");
  const [ngnAmount, setNgnAmount]         = useState("");
  const [focused, setFocused]             = useState<"token" | "ngn" | null>(null);
  const [showHistory, setShowHistory]     = useState(false);

  // ── Wallet state ────────────────────────────────────────────────
  const [walletConnected,  setWalletConnected]  = useState(false);
  const [walletAddress,    setWalletAddress]    = useState("");
  const [walletName,       setWalletName]       = useState("");
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [walletError,      setWalletError]      = useState("");

  // ── Transaction ─────────────────────────────────────────────────
  const [broadcastTxId, setBroadcastTxId] = useState("");

  // ── Rates ───────────────────────────────────────────────────────
  const [rates, setRates] = useState<Record<string, RateData>>({
    STX:  { marketRateNGN: 1847.35, flatFeeNGN: 100, priceUSD: 1.14, change24h: 0 },
    USDC: { marketRateNGN: 1620.5,  flatFeeNGN: 100, priceUSD: 1.00, change24h: 0 },
  });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [rateError,    setRateError]    = useState(false);

  // ── Banks ───────────────────────────────────────────────────────
  const [banks,        setBanks]        = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError,   setBanksError]   = useState("");

  // ── Bank details ────────────────────────────────────────────────
  const [bankCode,       setBankCode]       = useState("");
  const [accountNumber,  setAccountNumber]  = useState("");
  const [accountName,    setAccountName]    = useState("");
  const [verifyingBank,  setVerifyingBank]  = useState(false);
  const [bankError,      setBankError]      = useState("");
  const [bankVerified,   setBankVerified]   = useState(false);

  // ── Onramp ──────────────────────────────────────────────────────
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // ── Results ─────────────────────────────────────────────────────
  const [onrampResult,  setOnrampResult]  = useState<OnrampResult | null>(null);
  const [offrampResult, setOfframpResult] = useState<OfframpResult | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState("");

  const [recentTx] = useState([
    { type: "sell", token: "STX",  amount: "250", ngn: "461,837.50", time: "2m ago" },
    { type: "buy",  token: "USDC", amount: "100", ngn: "162,050.00", time: "5m ago" },
    { type: "sell", token: "STX",  amount: "50",  ngn: "92,367.50",  time: "11m ago" },
  ]);

  const token    = TOKENS.find((t) => t.id === selectedToken)!;
  const liveRate = rates[selectedToken]?.marketRateNGN ?? 0;
  const flatFee  = rates[selectedToken]?.flatFeeNGN ?? 100;
  const tokenAmt = parseFloat(tokenAmount) || 0;
  const ngnAmt   = parseFloat(ngnAmount)   || 0;

  const offrampGross = tokenAmt * liveRate;
  const offrampNet   = offrampGross - flatFee;
  const onrampTokens = ngnAmt / liveRate;
  const onrampTotal  = ngnAmt + flatFee;

  // ── Helper: detect wallet name from window providers ────────────
  function detectWalletName(): string {
    if (typeof window === "undefined") return "Stacks Wallet";
    if ((window as any).LeatherProvider)      return "Leather";
    if ((window as any).XverseProviders)      return "Xverse";
    return "Stacks Wallet";
  }

  // ── Helper: extract STX address from getLocalStorage() ──────────
  function extractAddress(data: StoredAddresses | null): string | null {
    return data?.addresses?.stx?.[0]?.address ?? null;
  }

  // ── Restore session on mount (client-only) ──────────────────────
  useEffect(() => {
    try {
      if (isConnected()) {
        const data = getLocalStorage() as StoredAddresses | null;
        const addr = extractAddress(data);
        if (addr) {
          setWalletAddress(addr);
          setWalletConnected(true);
          setWalletName(detectWalletName());
        }
      }
    } catch { /* no stored session */ }
  }, []);

  // ── Fetch rates ─────────────────────────────────────────────────
  const fetchRates = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_BASE}/api/offramp/rate?token=STX`),
        fetch(`${API_BASE}/api/offramp/rate?token=USDC`),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (d1.success && d2.success) {
        setRates({
          STX:  { marketRateNGN: d1.data.marketRateNGN, flatFeeNGN: d1.data.flatFeeNGN, priceUSD: d1.data.priceUSD, change24h: d1.data.change24h },
          USDC: { marketRateNGN: d2.data.marketRateNGN, flatFeeNGN: d2.data.flatFeeNGN, priceUSD: d2.data.priceUSD, change24h: d2.data.change24h },
        });
        setRateError(false);
      }
    } catch { setRateError(true); }
    finally   { setRatesLoading(false); }
  }, []);

  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, 30_000);
    return () => clearInterval(id);
  }, [fetchRates]);

  // ── Fetch banks ─────────────────────────────────────────────────
  const fetchBanks = useCallback(async () => {
    if (banks.length > 0) return;
    setBanksLoading(true); setBanksError("");
    try {
      const res  = await fetch(`${API_BASE}/api/offramp/banks`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setBanks(data.data);
      else setBanksError(data.message || "Failed to load banks.");
    } catch { setBanksError("Could not load bank list."); }
    finally   { setBanksLoading(false); }
  }, [banks.length]);

  useEffect(() => { if (step === "sell_bank") fetchBanks(); }, [step, fetchBanks]);

  // ── Sync on rate change ─────────────────────────────────────────
  useEffect(() => {
    if (!liveRate) return;
    if (mode === "sell" && tokenAmt > 0) setNgnAmount(offrampNet > 0 ? offrampNet.toFixed(2) : "");
    else if (mode === "buy" && ngnAmt > 0) setTokenAmount((ngnAmt / liveRate).toFixed(4));
  }, [liveRate, mode]);

  const handleTokenAmt = (v: string) => {
    setTokenAmount(v);
    const a = parseFloat(v) || 0;
    setNgnAmount(mode === "sell" ? (a * liveRate - flatFee > 0 ? (a * liveRate - flatFee).toFixed(2) : "") : (a * liveRate).toFixed(2));
  };
  const handleNgnAmt = (v: string) => {
    setNgnAmount(v);
    const n = parseFloat(v) || 0;
    setTokenAmount(n > 0 ? (n / liveRate).toFixed(4) : "");
  };

  // ════════════════════════════════════════════════════════════════
  // WALLET — using modern @stacks/connect API
  // ════════════════════════════════════════════════════════════════

  const connectWallet = useCallback(async () => {
    setConnectingWallet(true);
    setWalletError("");
    try {
      await connect({
        appDetails: { name: "StackSwap", icon: window.location.origin + "/logo.png" },
      });

      const data = getLocalStorage() as StoredAddresses | null;
      const addr = extractAddress(data);

      if (addr) {
        setWalletAddress(addr);
        setWalletConnected(true);
        setWalletName(detectWalletName());
      } else {
        setWalletError("No address found. Did you approve the connection in your wallet?");
      }
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      setWalletError(
        err?.message ||
        "Could not connect. Make sure Leather or Xverse is installed."
      );
    } finally {
      setConnectingWallet(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    stacksDisconnect();
    setWalletConnected(false);
    setWalletAddress("");
    setWalletName("");
  }, []);

  // ── Bank verify ─────────────────────────────────────────────────
  const verifyBank = useCallback(async () => {
    if (!bankCode || accountNumber.length !== 10) { setBankError("Enter a valid 10-digit account number and select a bank."); return; }
    setVerifyingBank(true); setBankError(""); setBankVerified(false); setAccountName("");
    try {
      const res  = await fetch(`${API_BASE}/api/offramp/verify-account`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      const data = await res.json();
      if (data.success) { setAccountName(data.data.accountName); setBankVerified(true); }
      else setBankError(data.message || "Verification failed.");
    } catch { setBankError("Could not reach server."); }
    finally   { setVerifyingBank(false); }
  }, [bankCode, accountNumber]);

  useEffect(() => {
    if (bankCode && accountNumber.length === 10 && !bankVerified) verifyBank();
  }, [bankCode, accountNumber]);

  // ════════════════════════════════════════════════════════════════
  // OFFRAMP — initialize → wallet tx
  // NOTE: notifyBackend has been removed from the frontend.
  // The backend indexer (services/stacksIndexer.js) watches the
  // blockchain and calls /api/offramp/confirm-receipt server-side
  // when it detects the inbound transfer with the correct memo.
  // This fixes the EPROTO SSL error caused by calling an internal
  // endpoint from the browser, and removes the security risk of
  // exposing NEXT_PUBLIC_INTERNAL_KEY.
  // ════════════════════════════════════════════════════════════════
  const submitOfframp = async () => {
    if (!bankVerified || !walletConnected) return;
    setSubmitting(true); setSubmitError("");
    try {
      const res  = await fetch(`${API_BASE}/api/offramp/initialize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: selectedToken, tokenAmount: parseFloat(tokenAmount), stacksAddress: walletAddress, bankCode, accountNumber, accountName }),
      });
      const data = await res.json();
      if (!data.success) { setSubmitError(data.message || "Failed to create transaction."); setSubmitting(false); return; }

      setOfframpResult(data.data);
      setSubmitting(false);
      setStep("sell_sending");

      const adminAddress = data.data.depositInstructions.sendTo;
      const memo         = data.data.depositInstructions.memo;

      if (selectedToken === "STX") {
        openSTXTransfer({
          network,
          recipient:  adminAddress,
          amount:     String(Math.round(parseFloat(tokenAmount) * 1_000_000)), // µSTX
          memo,
          appDetails: { name: "StackSwap" },
          onFinish: (txData: { txId: string }) => {
            setBroadcastTxId(txData.txId);
            setStep("sell_pending");
            // ✅ No notifyBackend call here.
            // The Stacks indexer (stacksIndexer.js) running on the server
            // will detect this transaction on-chain and call confirm-receipt
            // internally. This is the secure, correct architecture.
          },
          onCancel: () => {
            setSubmitError("Transaction cancelled in wallet.");
            setStep("sell_confirm");
          },
        });
      } else {
        // USDC SIP-010
        openContractCall({
          network,
          contractAddress: USDC_CONTRACT_ADDRESS,
          contractName:    USDC_CONTRACT_NAME,
          functionName:    "transfer",
          functionArgs: [
            uintCV(Math.round(parseFloat(tokenAmount) * 1_000_000)),
            standardPrincipalCV(walletAddress),
            standardPrincipalCV(adminAddress),
            someCV(bufferCVFromString(memo)),
          ],
          appDetails: { name: "StackSwap" },
          onFinish: (txData: { txId: string }) => {
            setBroadcastTxId(txData.txId);
            setStep("sell_pending");
            // ✅ No notifyBackend call here either.
            // The indexer handles USDC contract-call events by
            // parsing post-conditions and FT transfer events.
          },
          onCancel: () => {
            setSubmitError("Transaction cancelled in wallet.");
            setStep("sell_confirm");
          },
        });
      }
    } catch (err: any) {
      setSubmitError("Server error. Please try again.");
      setSubmitting(false);
    }
  };

  // ── Onramp ──────────────────────────────────────────────────────
  const submitOnramp = async () => {
    if (!walletAddress || !customerEmail) { setSubmitError("Connect wallet and enter email."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      const res  = await fetch(`${API_BASE}/api/onramp/initialize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: selectedToken, amountNGN: parseFloat(ngnAmount), stacksAddress: walletAddress, customerEmail, customerPhone }),
      });
      const data = await res.json();
      if (data.success) { setOnrampResult(data.data); setStep("buy_payment"); }
      else setSubmitError(data.message || "Failed to initialize payment.");
    } catch { setSubmitError("Server error."); }
    finally   { setSubmitting(false); }
  };

  const launchMonnify = () => {
    if (!onrampResult) return;
    const cfg = onrampResult.monnifyConfig;
    if (typeof window !== "undefined" && (window as any).MonnifySDK) {
      (window as any).MonnifySDK.initialize({ ...cfg, onComplete: () => setStep("success"), onClose: () => setSubmitError("Payment cancelled.") });
    } else {
      alert(`Monnify SDK not loaded.\nReference: ${cfg.reference}\nAmount: ₦${cfg.amount}`);
    }
  };

  const resetFlow = () => {
    setStep("swap"); setBankCode(""); setAccountNumber(""); setAccountName(""); setBankVerified(false); setBankError("");
    setCustomerEmail(""); setCustomerPhone(""); setOnrampResult(null); setOfframpResult(null); setSubmitError("");
    setTokenAmount("100"); setNgnAmount(""); setBroadcastTxId("");
  };

  const quickAmounts = mode === "sell" ? ["10", "50", "100", "500"] : ["1000", "5000", "10000", "50000"];

  const [timeLeft, setTimeLeft] = useState<string>("");
  useEffect(() => {
    if (!offrampResult?.depositInstructions?.expiresAt) return;
    const expiry = new Date(offrampResult.depositInstructions.expiresAt).getTime();
    const tick = () => {
      const diff = expiry - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      setTimeLeft(`${Math.floor(diff/60000)}:${String(Math.floor((diff%60000)/1000)).padStart(2,"0")}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [offrampResult]);

  const explorerUrl = broadcastTxId ? `https://explorer.hiro.so/txid/${broadcastTxId}?chain=${STACKS_NETWORK}` : "";

  // ── handleCTA: connect wallet first if needed, then go to next step ──
  const handleCTA = useCallback(async (nextStep: FlowStep) => {
    if (!walletConnected) {
      await connectWallet();
      const data = getLocalStorage() as StoredAddresses | null;
      const addr = extractAddress(data);
      if (!addr) return;
    }
    setStep(nextStep);
  }, [walletConnected, connectWallet]);

  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:"100vh",background:"#070B14",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"24px 16px 40px",position:"relative",overflowX:"hidden",overflowY:"auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;} body{background:#070B14;}
        .grid-bg{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(255,107,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,0,0.03) 1px,transparent 1px);background-size:40px 40px;}
        .orb{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none;z-index:0;}
        .wrapper{position:relative;z-index:10;width:100%;max-width:460px;display:flex;flex-direction:column;gap:12px;margin-top:8px;}
        .topbar{display:flex;align-items:center;justify-content:space-between;padding:0 4px;margin-bottom:4px;flex-wrap:wrap;gap:8px;}
        .logo{display:flex;align-items:center;gap:10px;}
        .logo-mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#FF6B00,#FF9500);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;box-shadow:0 4px 16px #FF6B0055;}
        .logo-text{font-size:18px;font-weight:700;color:#F1F5F9;letter-spacing:-0.5px;}
        .logo-sub{font-size:11px;color:#3A4A6A;letter-spacing:0.5px;}

        .wallet-btn{display:flex;align-items:center;gap:7px;border-radius:20px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;border:none;font-family:'DM Sans',sans-serif;white-space:nowrap;}
        .wallet-btn-off{background:#FF6B0015;border:1px solid #FF6B0050;color:#FF6B00;}
        .wallet-btn-off:hover{background:#FF6B0025;}
        .wallet-btn-on{background:#22C55E15;border:1px solid #22C55E50;color:#22C55E;}
        .wallet-btn-on:hover{background:#22C55E22;}
        .wallet-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
        .network-pill{display:flex;align-items:center;gap:6px;background:#0F1829;border:1px solid #1E2D45;border-radius:20px;padding:6px 12px;font-size:11px;color:#4A6A8A;font-weight:500;}

        .card{background:linear-gradient(145deg,#0F1829 0%,#0D1520 100%);border:1px solid #1A2840;border-radius:28px;padding:28px;position:relative;box-shadow:0 0 0 1px rgba(255,255,255,0.02),0 32px 64px rgba(0,0,0,0.6);}
        .card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,107,0,0.3),transparent);}

        .token-pills{display:flex;gap:8px;margin-bottom:24px;}
        .token-pill{flex:1;padding:10px 14px;border-radius:14px;border:1px solid #1A2840;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;transition:all 0.25s;display:flex;align-items:center;gap:8px;background:#0A1020;color:#4A6A8A;}
        .token-pill:hover{border-color:#2A3A5A;color:#8A9AB8;}
        .token-pill-active{border-color:var(--tc)!important;background:color-mix(in srgb,var(--tc) 8%,#0A1020)!important;color:#F1F5F9!important;box-shadow:0 0 20px var(--tg);}
        .pill-icon{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}
        .pill-change{margin-left:auto;font-size:11px;} .pos{color:#22C55E;} .neg{color:#EF4444;}

        .mode-switch{display:flex;background:#080E1A;border-radius:14px;padding:4px;margin-bottom:20px;border:1px solid #1A2840;}
        .mode-btn{flex:1;padding:10px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;transition:all 0.2s;background:transparent;color:#3A5070;}
        .mode-sell{background:#FF6B00;color:#fff;box-shadow:0 4px 12px #FF6B0044;}
        .mode-buy{background:#22C55E;color:#fff;box-shadow:0 4px 12px #22C55E44;}

        .field-label{font-size:10px;color:#3A5070;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;font-weight:600;}
        .input-box{background:#080E1A;border-radius:16px;border:1.5px solid #1A2840;padding:14px 16px;display:flex;align-items:center;gap:12px;transition:all 0.2s;}
        .input-box-focused{border-color:var(--tc)!important;box-shadow:0 0 0 3px var(--tg)!important;}
        .input-box-ngn{border-color:#22C55E;box-shadow:0 0 0 3px #22C55E22;}
        .token-badge{display:flex;align-items:center;gap:7px;background:#0F1829;border:1px solid #1A2840;border-radius:10px;padding:7px 10px;white-space:nowrap;flex-shrink:0;}
        .badge-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;}
        .badge-label{font-size:12px;font-weight:600;color:#C8D8E8;}
        .amount-input{flex:1;background:transparent;border:none;outline:none;font-family:'DM Mono',monospace;font-size:22px;font-weight:500;color:#F1F5F9;width:100%;min-width:0;}
        .amount-input::placeholder{color:#1E2D45;} .amount-ngn{color:#22C55E!important;}
        .hint{font-size:11px;color:#2A4060;font-family:'DM Mono',monospace;white-space:nowrap;}

        .quick-amounts{display:flex;gap:6px;margin-top:8px;}
        .quick-btn{flex:1;padding:6px;border-radius:8px;border:1px solid #1A2840;background:#080E1A;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#3A5070;cursor:pointer;transition:all 0.15s;}
        .quick-btn:hover{border-color:var(--tc);color:var(--tc);}

        .arrow-wrap{display:flex;align-items:center;justify-content:center;margin:12px 0;position:relative;}
        .arrow-line{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#1A2840,transparent);}
        .arrow-btn{width:36px;height:36px;border-radius:50%;background:#0F1829;border:1.5px solid #1A2840;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#3A5070;transition:all 0.2s;z-index:1;}
        .arrow-btn:hover{background:#FF6B00;color:#fff;border-color:#FF6B00;transform:rotate(180deg);}

        .summary{background:#080E1A;border:1px solid #1A2840;border-radius:14px;padding:14px 16px;margin-bottom:18px;}
        .srow{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#3A5070;padding:3px 0;}
        .sval{font-family:'DM Mono',monospace;font-size:11px;color:#6A8AAA;}
        .stotal{border-top:1px solid #1A2840;margin-top:8px;padding-top:8px;font-weight:600;color:#C8D8E8!important;}
        .stotal .sval{color:#22C55E!important;font-size:13px!important;}
        .live-dot{width:5px;height:5px;border-radius:50%;background:#22C55E;display:inline-block;animation:blink 1.8s ease-in-out infinite;margin-right:4px;}
        .rate-shimmer{width:80px;height:14px;border-radius:4px;background:linear-gradient(90deg,#1A2840 25%,#2A3A5A 50%,#1A2840 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}

        .cta{width:100%;padding:17px;border-radius:16px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.3px;transition:all 0.25s;}
        .cta-sell{background:linear-gradient(135deg,#FF6B00,#FF9A00);color:#fff;box-shadow:0 8px 28px #FF6B0050;}
        .cta-sell:hover{transform:translateY(-2px);box-shadow:0 14px 36px #FF6B0060;}
        .cta-buy{background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;box-shadow:0 8px 28px #22C55E40;}
        .cta-buy:hover{transform:translateY(-2px);box-shadow:0 14px 36px #22C55E50;}
        .cta-wallet{background:linear-gradient(135deg,#7C3AED,#A855F7);color:#fff;box-shadow:0 8px 28px #7C3AED40;}
        .cta-wallet:hover{transform:translateY(-2px);}
        .cta-ghost{background:transparent;color:#6A8AAA;border:1px solid #1A2840;}
        .cta-ghost:hover{border-color:#2A3A5A;color:#C8D8E8;}
        .cta:disabled{opacity:0.5;cursor:not-allowed;transform:none!important;}

        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.2);border-top-color:currentColor;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px;}

        .wallet-box{display:flex;align-items:center;justify-content:space-between;background:#080E1A;border:1.5px solid #22C55E30;border-radius:14px;padding:12px 16px;margin-bottom:16px;}
        .wallet-addr{font-family:'DM Mono',monospace;font-size:13px;color:#22C55E;}
        .wallet-label{font-size:10px;color:#3A5070;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;}
        .disconnect-btn{font-size:11px;color:#4A6A8A;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:underline;}

        .form-group{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
        .form-label{font-size:10px;color:#3A5070;text-transform:uppercase;letter-spacing:1px;font-weight:600;}
        .form-input{background:#080E1A;border:1.5px solid #1A2840;border-radius:12px;padding:13px 16px;font-family:'DM Sans',sans-serif;font-size:14px;color:#F1F5F9;outline:none;transition:all 0.2s;width:100%;}
        .form-input::placeholder{color:#2A4060;}
        .form-input:focus{border-color:#FF6B00;box-shadow:0 0 0 3px #FF6B0022;}
        .form-select{background:#080E1A;border:1.5px solid #1A2840;border-radius:12px;padding:13px 16px;font-family:'DM Sans',sans-serif;font-size:14px;color:#F1F5F9;outline:none;transition:all 0.2s;width:100%;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A6A8A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;}
        .form-select option{background:#0F1829;}
        .form-select:focus{border-color:#FF6B00;box-shadow:0 0 0 3px #FF6B0022;}
        .form-select:disabled{opacity:0.5;cursor:not-allowed;}

        .verified-badge{display:flex;align-items:center;gap:6px;background:#052e16;border:1px solid #166534;border-radius:10px;padding:10px 14px;font-size:13px;color:#4ADE80;font-weight:600;margin-top:-6px;}
        .error-msg{background:#1c0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:10px 14px;font-size:12px;color:#FCA5A5;margin-top:-6px;}
        .warn-box{background:#1a0a00;border:1px solid #7c2d12;border-radius:12px;padding:12px 16px;font-size:12px;color:#FB923C;line-height:1.6;}
        .info-box{background:#0A1020;border:1px solid #1A2840;border-radius:14px;padding:16px;}
        .info-row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #0F1A2A;}
        .info-row:last-child{border-bottom:none;}
        .info-key{color:#3A5070;}
        .info-val{color:#8A9AB8;font-family:'DM Mono',monospace;font-size:11px;text-align:right;max-width:220px;word-break:break-all;}

        .deposit-box{background:#080E1A;border:1.5px solid #1A2840;border-radius:14px;padding:14px 16px;position:relative;}
        .deposit-addr{font-family:'DM Mono',monospace;font-size:13px;color:#C8D8E8;word-break:break-all;line-height:1.5;}
        .copy-btn{position:absolute;top:10px;right:10px;background:#0F1829;border:1px solid #1A2840;border-radius:8px;padding:6px 10px;font-size:11px;color:#4A6A8A;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .copy-btn:hover{color:#C8D8E8;}

        .hist-card{background:#0F1829;border:1px solid #1A2840;border-radius:20px;padding:20px;overflow:hidden;}
        .hist-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;cursor:pointer;}
        .hist-title{font-size:12px;font-weight:600;color:#4A6A8A;text-transform:uppercase;letter-spacing:1px;}
        .tx-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #0A1020;}
        .tx-row:last-child{border-bottom:none;}
        .tx-icon{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}

        .step-header{display:flex;align-items:center;gap:12px;margin-bottom:24px;}
        .back-btn{width:32px;height:32px;border-radius:50%;background:#080E1A;border:1px solid #1A2840;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#4A6A8A;flex-shrink:0;transition:all 0.15s;}
        .back-btn:hover{border-color:#2A3A5A;color:#C8D8E8;}
        .step-title{font-size:16px;font-weight:700;color:#F1F5F9;}
        .step-sub{font-size:12px;color:#3A5070;margin-top:2px;}
        .timer-pill{display:inline-flex;align-items:center;gap:6px;background:#1a0a00;border:1px solid #7c2d12;border-radius:8px;padding:4px 10px;font-size:12px;color:#FB923C;font-weight:600;font-family:'DM Mono',monospace;}

        .badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px;}
        .badge{display:flex;align-items:center;gap:4px;font-size:10px;color:#2A4060;font-weight:500;}
        .success-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#22C55E22,#22C55E44);border:2px solid #22C55E;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;}
        .bank-skeleton{height:48px;border-radius:12px;background:linear-gradient(90deg,#1A2840 25%,#2A3A5A 50%,#1A2840 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}
        .pulse-ring{width:72px;height:72px;border-radius:50%;border:2px solid #FF6B00;margin:0 auto 20px;position:relative;display:flex;align-items:center;justify-content:center;font-size:28px;animation:pulseRing 2s ease-in-out infinite;}

        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes betaPulse{0%,100%{box-shadow:0 0 12px #7C3AED33;}50%{box-shadow:0 0 20px #7C3AED66;}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseRing{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:0.6;}}
        .slide-in{animation:slideIn 0.3s ease forwards;} .fade-up{animation:fadeUp 0.4s ease forwards;}
      `}</style>

      <div className="grid-bg" />
      <div className="orb" style={{ width:500,height:500,background:token.color,opacity:0.06,top:-150,right:-150 }} />
      <div className="orb" style={{ width:400,height:400,background:"#2775CA",opacity:0.05,bottom:-100,left:-150 }} />

      <div className="wrapper">

        {/* Top bar */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-mark">S</div>
            <div>
              <div className="logo-text">StackSwap</div>
              <div className="logo-sub">STACKS · NAIRA</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            {walletConnected ? (
              <button className="wallet-btn wallet-btn-on" onClick={disconnectWallet}>
                <span className="wallet-dot" style={{ background:"#22C55E" }} />
                {shortAddr(walletAddress)}
              </button>
            ) : (
              <button className="wallet-btn wallet-btn-off" onClick={connectWallet} disabled={connectingWallet}>
                {connectingWallet
                  ? <><span className="spinner" style={{ width:12,height:12 }} />Connecting…</>
                  : <>🔗 Connect Wallet</>}
              </button>
            )}
            <div style={{ display:"flex",alignItems:"center",gap:5,background:"linear-gradient(135deg,#7C3AED22,#A855F722)",border:"1px solid #7C3AED55",borderRadius:20,padding:"5px 10px",fontSize:10,fontWeight:700,color:"#C084FC",letterSpacing:"1.5px",textTransform:"uppercase",animation:"betaPulse 3s ease-in-out infinite" }}>
              <span style={{ width:5,height:5,borderRadius:"50%",background:"#A855F7",display:"inline-block",animation:"blink 1.8s ease-in-out infinite",marginRight:2 }} />Beta
            </div>
            <div className="network-pill">
              <span className="live-dot" />
              {rateError ? <span style={{ color:"#EF4444" }}>Offline</span> : "Mainnet"}
            </div>
          </div>
        </div>

        {/* Wallet error */}
        {walletError && (
          <div className="error-msg" style={{ marginTop:0 }}>
            ⚠️ {walletError} — Make sure <strong>Leather</strong> or <strong>Xverse</strong> is installed as a browser extension.
          </div>
        )}

        {/* Beta banner */}
        <div style={{ background:"linear-gradient(135deg,#7C3AED11,#A855F711)",border:"1px solid #7C3AED33",borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,fontSize:12 }}>
          <span style={{ fontSize:16 }}>🧪</span>
          <div>
            <span style={{ color:"#C084FC",fontWeight:600 }}>Beta Mode — </span>
            <span style={{ color:"#5A5A8A" }}>Features may change. Use small amounts.</span>
          </div>
          <div style={{ marginLeft:"auto",fontSize:10,color:"#7C3AED",background:"#7C3AED22",borderRadius:6,padding:"3px 8px",fontWeight:600,whiteSpace:"nowrap" }}>v0.1.0</div>
        </div>

        {/* ════ STEP: SWAP ════ */}
        {step === "swap" && (
          <div className="card slide-in" style={{ ["--tc" as any]:token.color,["--tg" as any]:token.glow }}>
            <div className="token-pills">
              {TOKENS.map((t) => (
                <button key={t.id} className={`token-pill${selectedToken===t.id?" token-pill-active":""}`}
                  style={{ ["--tc" as any]:t.color,["--tg" as any]:t.glow }}
                  onClick={() => { setSelectedToken(t.id); setTokenAmount("100"); setNgnAmount(""); }}>
                  <div className="pill-icon" style={{ background:t.color }}>{t.icon}</div>
                  <div><div style={{ fontSize:13,fontWeight:600 }}>{t.symbol}</div><div style={{ fontSize:10,color:"#3A5070" }}>{t.label}</div></div>
                  {rates[t.id] && <span className={`pill-change ${(rates[t.id].change24h??0)>=0?"pos":"neg"}`}>{(rates[t.id].change24h??0)>=0?"▲":"▼"} {Math.abs(rates[t.id].change24h??0).toFixed(1)}%</span>}
                </button>
              ))}
            </div>

            <div className="mode-switch">
              <button className={`mode-btn${mode==="sell"?" mode-sell":""}`} onClick={() => { setMode("sell"); setNgnAmount(""); }}>↑ Sell {token.symbol}</button>
              <button className={`mode-btn${mode==="buy"?" mode-buy":""}`}  onClick={() => { setMode("buy");  setNgnAmount(""); }}>↓ Buy {token.symbol}</button>
            </div>

            {mode === "sell" && (
              <>
                <div style={{ marginBottom:6 }}>
                  <div className="field-label">You're Sending</div>
                  <div className={`input-box${focused==="token"?" input-box-focused":""}`}>
                    <div className="token-badge"><div className="badge-icon" style={{ background:token.color }}>{token.icon}</div><span className="badge-label">{token.symbol}</span></div>
                    <input className="amount-input" type="number" placeholder="0.00" value={tokenAmount} onChange={(e) => handleTokenAmt(e.target.value)} onFocus={() => setFocused("token")} onBlur={() => setFocused(null)} />
                    <div className="hint">≈ {formatNGN(tokenAmt*liveRate)}</div>
                  </div>
                </div>
                <div className="quick-amounts">
                  {quickAmounts.map((a) => <button key={a} className="quick-btn" onClick={() => handleTokenAmt(a)}>{a}</button>)}
                  <button className="quick-btn" onClick={() => handleTokenAmt("1000")}>MAX</button>
                </div>
              </>
            )}

            {mode === "buy" && (
              <>
                <div style={{ marginBottom:6 }}>
                  <div className="field-label">You're Paying (NGN)</div>
                  <div className={`input-box${focused==="ngn"?" input-box-ngn":""}`}>
                    <div className="token-badge"><div className="badge-icon" style={{ background:"#22C55E",fontSize:13 }}>₦</div><span className="badge-label">NGN</span></div>
                    <input className="amount-input amount-ngn" type="number" placeholder="0.00" value={ngnAmount} onChange={(e) => handleNgnAmt(e.target.value)} onFocus={() => setFocused("ngn")} onBlur={() => setFocused(null)} />
                    <div className="hint">≈ {(ngnAmt/liveRate||0).toFixed(4)} {token.symbol}</div>
                  </div>
                </div>
                <div className="quick-amounts">
                  {quickAmounts.map((a) => <button key={a} className="quick-btn" onClick={() => handleNgnAmt(a)}>₦{parseInt(a).toLocaleString()}</button>)}
                </div>
              </>
            )}

            <div className="arrow-wrap">
              <div className="arrow-line" />
              <button className="arrow-btn" onClick={() => setMode(mode==="sell"?"buy":"sell")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
              </button>
            </div>

            <div style={{ marginBottom:20 }}>
              <div className="field-label">You're Receiving</div>
              <div className="input-box">
                {mode==="sell" ? (<>
                  <div className="token-badge"><div className="badge-icon" style={{ background:"#22C55E",fontSize:13 }}>₦</div><span className="badge-label">NGN</span></div>
                  <div style={{ flex:1,fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:500,color:"#22C55E" }}>{offrampNet>0?offrampNet.toFixed(2):"0.00"}</div>
                </>) : (<>
                  <div className="token-badge"><div className="badge-icon" style={{ background:token.color }}>{token.icon}</div><span className="badge-label">{token.symbol}</span></div>
                  <div style={{ flex:1,fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:500,color:"#F1F5F9" }}>{onrampTokens>0?onrampTokens.toFixed(6):"0.000000"}</div>
                </>)}
              </div>
            </div>

            <div className="summary">
              <div className="srow"><span><span className="live-dot" />Rate</span>
                {ratesLoading ? <div className="rate-shimmer" /> : <span className="sval">1 {token.symbol} = <AnimatedNumber value={liveRate} prefix="₦" /></span>}
              </div>
              <div className="srow" style={{ marginTop:4 }}><span>Service fee</span><span className="sval">₦{flatFee.toFixed(2)} flat</span></div>
              {mode==="sell" ? (<>
                <div className="srow" style={{ marginTop:4 }}><span>Gross value</span><span className="sval">{formatNGN(offrampGross)}</span></div>
                <div className="srow stotal"><span>You receive</span><span className="sval">{offrampNet>0?formatNGN(offrampNet):"—"}</span></div>
              </>) : (<>
                <div className="srow" style={{ marginTop:4 }}><span>Token value</span><span className="sval">{formatNGN(ngnAmt)}</span></div>
                <div className="srow stotal" style={{ borderTop:"1px solid #1A2840",marginTop:8,paddingTop:8,fontWeight:600 }}>
                  <span>Total you pay</span><span className="sval" style={{ color:"#FB923C",fontSize:13 }}>{ngnAmt>0?formatNGN(onrampTotal):"—"}</span>
                </div>
              </>)}
              <div className="srow" style={{ marginTop:4 }}><span>Settlement</span><span className="sval" style={{ color:"#22C55E" }}>{mode==="sell"?"~5-15 min":"~30 sec"}</span></div>
            </div>

            <button className={`cta ${mode==="sell"?"cta-sell":"cta-buy"}`}
              disabled={(mode==="sell"?tokenAmt<=0:ngnAmt<=0) || connectingWallet}
              onClick={() => handleCTA(mode==="sell"?"sell_bank":"buy_details")}>
              {connectingWallet
                ? <><span className="spinner" />Connecting wallet…</>
                : mode==="sell" ? `⚡ Sell ${token.symbol} → Get Naira` : `⚡ Buy ${token.symbol} with Naira`}
            </button>
            <p style={{ textAlign:"center",fontSize:10,color:"#1E2D45",marginTop:14,lineHeight:1.6 }}>
              Powered by Stacks L2 · Secured by Bitcoin · KYC required above ₦500,000
            </p>
          </div>
        )}

        {/* ════ STEP: SELL_BANK ════ */}
        {step === "sell_bank" && (
          <div className="card slide-in">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep("swap")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg></button>
              <div><div className="step-title">Bank Account Details</div><div className="step-sub">Selling {tokenAmount} {selectedToken} {offrampNet>0?`→ ≈ ${formatNGN(offrampNet)}`:""}</div></div>
            </div>

            {/* Wallet */}
            <div style={{ marginBottom:20 }}>
              <div className="field-label">Sending From</div>
              {walletConnected ? (
                <div className="wallet-box">
                  <div><div className="wallet-label">{walletName || "Connected Wallet"}</div><div className="wallet-addr">{shortAddr(walletAddress)}</div></div>
                  <button className="disconnect-btn" onClick={disconnectWallet}>Disconnect</button>
                </div>
              ) : (
                <>
                  <button className="cta cta-wallet" style={{ marginBottom:6,fontSize:14 }} onClick={connectWallet} disabled={connectingWallet}>
                    {connectingWallet ? <><span className="spinner" />Opening wallet…</> : "🔗 Connect Leather / Xverse"}
                  </button>
                  <p style={{ fontSize:11,color:"#3A5070",textAlign:"center" }}>Required to sign the on-chain transfer</p>
                </>
              )}
            </div>

            {/* Bank */}
            <div className="form-group">
              <div className="form-label" style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <span>Bank</span>
                {banksLoading && <span style={{ fontSize:9,color:"#3A5070",textTransform:"none",letterSpacing:0 }}>Loading…</span>}
                {banksError && <button onClick={fetchBanks} style={{ fontSize:9,color:"#FB923C",background:"none",border:"none",cursor:"pointer",textDecoration:"underline" }}>Retry</button>}
              </div>
              {banksLoading ? <div className="bank-skeleton" /> : banksError ? (
                <div className="error-msg" style={{ marginTop:0 }}>{banksError}</div>
              ) : (
                <select className="form-select" value={bankCode} onChange={(e) => { setBankCode(e.target.value); setBankVerified(false); setAccountName(""); setBankError(""); }} disabled={banks.length===0}>
                  <option value="">Select your bank…</option>
                  {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <div className="form-label">Account Number</div>
              <input className="form-input" type="text" placeholder="0123456789" maxLength={10} value={accountNumber}
                onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g,"").slice(0,10)); setBankVerified(false); setAccountName(""); setBankError(""); }} />
            </div>

            {verifyingBank && <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",fontSize:12,color:"#4A6A8A",background:"#080E1A",borderRadius:10,marginBottom:16 }}><span className="spinner" style={{ borderTopColor:"#4A6A8A" }} />Verifying…</div>}
            {bankVerified && accountName && <div className="verified-badge" style={{ marginBottom:16 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#22C55E"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{accountName}</div>}
            {bankError && <div className="error-msg" style={{ marginBottom:16 }}>{bankError}</div>}
            {submitError && <div className="error-msg" style={{ marginBottom:16 }}>{submitError}</div>}

            <button className="cta cta-sell" disabled={!bankVerified||!walletConnected||submitting} onClick={() => setStep("sell_confirm")}>Continue →</button>
            {!walletConnected && <p style={{ textAlign:"center",fontSize:11,color:"#EF4444",marginTop:8 }}>⚠️ Connect wallet to continue</p>}
            <button className="cta cta-ghost" style={{ marginTop:8 }} onClick={() => setStep("swap")}>Cancel</button>
          </div>
        )}

        {/* ════ STEP: SELL_CONFIRM ════ */}
        {step === "sell_confirm" && (
          <div className="card slide-in">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep("sell_bank")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg></button>
              <div><div className="step-title">Confirm & Sign</div><div className="step-sub">Your wallet will open to approve</div></div>
            </div>

            <div className="info-box" style={{ marginBottom:20 }}>
              <div className="info-row"><span className="info-key">From wallet</span><span className="info-val" style={{ color:"#22C55E" }}>{shortAddr(walletAddress)}</span></div>
              <div className="info-row"><span className="info-key">You send</span><span className="info-val">{tokenAmount} {selectedToken}</span></div>
              <div className="info-row"><span className="info-key">Gross NGN</span><span className="info-val">{formatNGN(offrampGross)}</span></div>
              <div className="info-row"><span className="info-key">Service fee</span><span className="info-val">− ₦{flatFee.toFixed(2)}</span></div>
              <div className="info-row"><span className="info-key" style={{ color:"#C8D8E8",fontWeight:600 }}>You receive</span><span className="info-val" style={{ color:"#22C55E",fontSize:13 }}>{formatNGN(offrampNet)}</span></div>
              <div className="info-row"><span className="info-key">Bank</span><span className="info-val">{accountName}</span></div>
              <div className="info-row"><span className="info-key">Account</span><span className="info-val">{accountNumber}</span></div>
              <div className="info-row"><span className="info-key">Settlement</span><span className="info-val" style={{ color:"#22C55E" }}>5–15 min</span></div>
            </div>

            <div className="warn-box" style={{ marginBottom:20 }}>
              ℹ️ Clicking confirm opens <strong>{walletName || "your Stacks wallet"}</strong>. The {tokenAmount} {selectedToken} goes directly to StackSwap's admin wallet on-chain. NGN is released once the transfer confirms on the blockchain.
            </div>

            {submitError && <div className="error-msg" style={{ marginBottom:16 }}>{submitError}</div>}
            <button className="cta cta-sell" disabled={submitting} onClick={submitOfframp}>
              {submitting ? <><span className="spinner" />Preparing…</> : "⚡ Confirm & Open Wallet"}
            </button>
            <button className="cta cta-ghost" style={{ marginTop:8 }} onClick={() => setStep("sell_bank")}>Go back</button>
          </div>
        )}

        {/* ════ STEP: SELL_SENDING ════ */}
        {step === "sell_sending" && (
          <div className="card fade-up" style={{ textAlign:"center" }}>
            <div className="pulse-ring">🔐</div>
            <div style={{ fontSize:18,fontWeight:700,color:"#F1F5F9",marginBottom:8 }}>Waiting for Wallet</div>
            <div style={{ fontSize:13,color:"#4A6A8A",marginBottom:24,lineHeight:1.7 }}>
              Your <strong style={{ color:"#8A9AB8" }}>{walletName || "wallet"}</strong> popup should be open.<br />
              Approve the <strong style={{ color:"#FF6B00" }}>{tokenAmount} {selectedToken}</strong> transfer to continue.
            </div>
            <div style={{ background:"#080E1A",border:"1px solid #1A2840",borderRadius:12,padding:"12px 16px",fontSize:12,color:"#3A5070",marginBottom:20 }}>
              Don't see the popup? Click the wallet icon in your browser's extension bar.
            </div>
            {submitError && <div className="error-msg" style={{ marginBottom:16 }}>{submitError}</div>}
            <button className="cta cta-ghost" onClick={() => { setStep("sell_confirm"); setSubmitError(""); }}>Cancel & Try Again</button>
          </div>
        )}

        {/* ════ STEP: SELL_PENDING ════ */}
        {step === "sell_pending" && offrampResult && (
          <div className="card fade-up">
            <div style={{ textAlign:"center",marginBottom:24 }}>
              <div className="pulse-ring" style={{ borderColor:"#22C55E" }}>⛓️</div>
              <div style={{ fontSize:18,fontWeight:700,color:"#F1F5F9",marginBottom:6 }}>Transaction Broadcast!</div>
              <div style={{ fontSize:13,color:"#4A6A8A",lineHeight:1.7 }}>
                {tokenAmount} {selectedToken} is on-chain. NGN will be sent to your bank after confirmation (~5-15 min).
              </div>
            </div>

            {broadcastTxId && (
              <div style={{ marginBottom:16 }}>
                <div className="field-label" style={{ marginBottom:8 }}>Transaction ID</div>
                <div className="deposit-box">
                  <div className="deposit-addr">
                    <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ color:"#FF6B00",textDecoration:"none",fontFamily:"'DM Mono',monospace",fontSize:13,wordBreak:"break-all" }}>
                      {broadcastTxId}
                    </a>
                  </div>
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(broadcastTxId)}>Copy</button>
                </div>
                <p style={{ fontSize:11,color:"#3A5070",marginTop:6 }}>
                  <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ color:"#FF6B00",textDecoration:"none" }}>View on Stacks Explorer →</a>
                </p>
              </div>
            )}

            <div className="info-box" style={{ marginBottom:16 }}>
              <div className="info-row"><span className="info-key">You'll receive</span><span className="info-val" style={{ color:"#22C55E" }}>{formatNGN(offrampResult.ngnAmount)}</span></div>
              <div className="info-row"><span className="info-key">Bank</span><span className="info-val">{offrampResult.bank.accountName}</span></div>
              <div className="info-row"><span className="info-key">Account</span><span className="info-val">{offrampResult.bank.accountNumber} · {offrampResult.bank.bankName}</span></div>
              <div className="info-row"><span className="info-key">Expires in</span><span className="timer-pill">⏱ {timeLeft || `${offrampResult.depositInstructions.expiresInMinutes}m`}</span></div>
            </div>

            <div style={{ background:"#050A10",border:"1px solid #1A2840",borderRadius:12,padding:"12px 16px",fontSize:12,color:"#3A5070",marginBottom:20,lineHeight:1.6 }}>
              📋 Ref: <span style={{ color:"#8A9AB8",fontFamily:"monospace" }}>{offrampResult.transactionReference}</span><br />
              Save this for support queries. NGN is sent automatically after on-chain confirmation.
            </div>

            <button className="cta cta-ghost" onClick={resetFlow}>Start New Transaction</button>
          </div>
        )}

        {/* ════ STEP: BUY_DETAILS ════ */}
        {step === "buy_details" && (
          <div className="card slide-in">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep("swap")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg></button>
              <div><div className="step-title">Payment Details</div><div className="step-sub">Buying {onrampTokens.toFixed(4)} {selectedToken} for {formatNGN(onrampTotal)}</div></div>
            </div>

            <div className="info-box" style={{ marginBottom:20 }}>
              <div className="info-row"><span className="info-key">Token value</span><span className="info-val">{formatNGN(ngnAmt)}</span></div>
              <div className="info-row"><span className="info-key">Service fee</span><span className="info-val">+ ₦{flatFee.toFixed(2)}</span></div>
              <div className="info-row"><span className="info-key" style={{ color:"#C8D8E8",fontWeight:600 }}>Total payable</span><span className="info-val" style={{ color:"#FB923C",fontSize:13 }}>{formatNGN(onrampTotal)}</span></div>
              <div className="info-row"><span className="info-key">You receive</span><span className="info-val" style={{ color:"#22C55E" }}>{onrampTokens.toFixed(6)} {selectedToken}</span></div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div className="field-label">Receiving Wallet</div>
              {walletConnected ? (
                <div className="wallet-box">
                  <div><div className="wallet-label">{walletName || "Connected"}</div><div className="wallet-addr">{shortAddr(walletAddress)}</div></div>
                  <button className="disconnect-btn" onClick={disconnectWallet}>Change</button>
                </div>
              ) : (
                <button className="cta cta-wallet" style={{ fontSize:14 }} onClick={connectWallet} disabled={connectingWallet}>
                  {connectingWallet ? <><span className="spinner" />Connecting…</> : "🔗 Connect Wallet to Receive"}
                </button>
              )}
            </div>

            <div className="form-group">
              <div className="form-label">Email Address</div>
              <input className="form-input" type="email" placeholder="you@email.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <div className="form-label">Phone <span style={{ color:"#2A4060",textTransform:"none",letterSpacing:0 }}>(optional)</span></div>
              <input className="form-input" type="tel" placeholder="08012345678" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>

            {submitError && <div className="error-msg" style={{ marginBottom:16 }}>{submitError}</div>}
            <button className="cta cta-buy" disabled={!walletConnected||!customerEmail||submitting} onClick={submitOnramp}>
              {submitting ? <><span className="spinner" />Creating payment…</> : "Continue to Payment →"}
            </button>
            <button className="cta cta-ghost" style={{ marginTop:8 }} onClick={() => setStep("swap")}>Cancel</button>
          </div>
        )}

        {/* ════ STEP: BUY_PAYMENT ════ */}
        {step === "buy_payment" && onrampResult && (
          <div className="card slide-in">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep("buy_details")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg></button>
              <div><div className="step-title">Complete Payment</div><div className="step-sub">Pay via Monnify to receive your tokens</div></div>
            </div>
            <div className="info-box" style={{ marginBottom:20 }}>
              <div className="info-row"><span className="info-key">Amount</span><span className="info-val" style={{ color:"#FB923C",fontWeight:600,fontSize:14 }}>{formatNGN(onrampResult.totalPayableNGN)}</span></div>
              <div className="info-row"><span className="info-key">You receive</span><span className="info-val" style={{ color:"#22C55E" }}>{onrampResult.tokenAmount} {selectedToken}</span></div>
              <div className="info-row"><span className="info-key">Wallet</span><span className="info-val" style={{ color:"#22C55E" }}>{shortAddr(walletAddress)}</span></div>
              <div className="info-row"><span className="info-key">Reference</span><span className="info-val">{onrampResult.paymentReference}</span></div>
            </div>
            <button className="cta cta-buy" onClick={launchMonnify}>💳 Pay {formatNGN(onrampResult.totalPayableNGN)} via Monnify</button>
            <div style={{ textAlign:"center",fontSize:11,color:"#2A4060",marginTop:12 }}>Powered by Monnify · Secured payment gateway</div>
            <button className="cta cta-ghost" style={{ marginTop:8 }} onClick={resetFlow}>Cancel</button>
          </div>
        )}

        {/* ════ STEP: SUCCESS ════ */}
        {step === "success" && (
          <div className="card fade-up" style={{ textAlign:"center" }}>
            <div className="success-icon">✅</div>
            <div style={{ fontSize:20,fontWeight:700,color:"#F1F5F9",marginBottom:8 }}>Payment Successful!</div>
            <div style={{ fontSize:13,color:"#4A6A8A",marginBottom:24,lineHeight:1.7 }}>
              Tokens will arrive in your wallet within <strong style={{ color:"#22C55E" }}>~30 seconds</strong>.
            </div>
            <div className="info-box" style={{ marginBottom:24,textAlign:"left" }}>
              {onrampResult && <>
                <div className="info-row"><span className="info-key">Tokens incoming</span><span className="info-val" style={{ color:"#22C55E" }}>{onrampResult.tokenAmount} {selectedToken}</span></div>
                <div className="info-row"><span className="info-key">Wallet</span><span className="info-val">{shortAddr(walletAddress)}</span></div>
                <div className="info-row"><span className="info-key">Reference</span><span className="info-val">{onrampResult.paymentReference}</span></div>
              </>}
              <div className="info-row"><span className="info-key">Status</span><span className="info-val" style={{ color:"#22C55E" }}>Confirmed ✓</span></div>
            </div>
            <button className="cta cta-buy" onClick={resetFlow}>New Transaction</button>
          </div>
        )}

        {/* Recent txns */}
        {step === "swap" && (
          <div className="hist-card">
            <div className="hist-header" onClick={() => setShowHistory(!showHistory)}>
              <span className="hist-title">Recent Transactions</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3A5070" strokeWidth="2" style={{ transform:showHistory?"rotate(180deg)":"none",transition:"transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
            </div>
            {showHistory ? (
              <div className="slide-in">
                {recentTx.map((tx,i) => (
                  <div key={i} className="tx-row">
                    <div className="tx-icon" style={{ background:tx.type==="sell"?"#FF6B0015":"#22C55E15" }}>{tx.type==="sell"?"↑":"↓"}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12,fontWeight:600,color:"#8A9AB8" }}>{tx.type==="sell"?"Sold":"Bought"} {tx.amount} {tx.token}</div>
                      <div style={{ fontSize:10,color:"#3A5070",marginTop:1 }}>Confirmed · Stacks</div>
                    </div>
                    <div>
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,color:"#22C55E",textAlign:"right" }}>₦{tx.ngn}</div>
                      <div style={{ fontSize:10,color:"#3A5070",textAlign:"right",marginTop:2 }}>{tx.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display:"flex",gap:6 }}>
                {recentTx.slice(0,3).map((tx,i) => (
                  <div key={i} style={{ flex:1,background:"#080E1A",borderRadius:10,padding:"8px 10px",fontSize:10,color:"#3A5070",textAlign:"center" }}>
                    <div style={{ color:tx.type==="sell"?"#FF6B00":"#22C55E",fontWeight:600,marginBottom:2 }}>{tx.type==="sell"?"↑":"↓"} {tx.token}</div>
                    <div style={{ fontFamily:"'DM Mono',monospace",color:"#4A6A8A" }}>{tx.amount}</div>
                    <div>{tx.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="badges">
          {["Non-custodial","Bitcoin Secured","Instant NGN","CBN Compliant"].map((b) => (
            <div key={b} className="badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#22C55E" opacity="0.6"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{b}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}