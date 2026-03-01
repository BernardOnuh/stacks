"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  connect,
  disconnect as stacksDisconnect,
  isConnected,
  getLocalStorage,
  openSTXTransfer,
} from "@stacks/connect";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://stackswap-backend-d84c5a71d927.herokuapp.com";
const STACKS_NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK || "mainnet";
const network = STACKS_NETWORK === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

// Buy STX goes live March 3rd 2026
const BUY_LAUNCH_DATE = new Date("2026-03-03T00:00:00");

interface StoredAddresses {
  addresses?: {
    stx?: Array<{ address: string; publicKey?: string }>;
    btc?: Array<{ address: string; publicKey?: string }>;
  };
}

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
    const end = value;
    const startTime = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - startTime) / 400, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * ease);
      if (p < 1) requestAnimationFrame(frame);
      else prev.current = end;
    };
    requestAnimationFrame(frame);
  }, [value]);
  return <>{prefix}{display.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(""); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return timeLeft;
}

type AppMode  = "sell" | "buy";
type FlowStep = "swap" | "sell_bank" | "sell_confirm" | "sell_sending" | "sell_pending" | "buy_details" | "buy_payment" | "success";

interface Bank { code: string; name: string; }
interface RateData { marketRateNGN: number; flatFeeNGN: number; priceUSD: number; change24h?: number; }
interface OfframpResult {
  transactionReference: string; ngnAmount: number; grossNGN: number; flatFeeNGN: number;
  depositInstructions: { sendTo: string; amount: string; memo: string; expiresAt: string; expiresInMinutes: number; };
  bank: { accountName: string; accountNumber: string; bankName: string; };
}
interface OnrampResult {
  transactionId: string; paymentReference: string; tokenAmount: number; totalPayableNGN: number;
  monnifyConfig: { amount: number; reference: string; apiKey: string; contractCode: string; customerFullName: string; customerEmail: string; customerMobileNumber: string; paymentDescription: string; paymentMethods: string[]; currency: string; };
}

export default function StackSwap() {
  const [mode, setMode]                   = useState<AppMode>("sell");
  const [step, setStep]                   = useState<FlowStep>("swap");
  const [tokenAmount, setTokenAmount]     = useState("100");
  const [ngnAmount, setNgnAmount]         = useState("");
  const [focused, setFocused]             = useState<"token" | "ngn" | null>(null);
  const [showHistory, setShowHistory]     = useState(false);

  const buyCountdown = useCountdown(BUY_LAUNCH_DATE);
  const buyIsLive    = Date.now() >= BUY_LAUNCH_DATE.getTime();

  const [walletConnected,  setWalletConnected]  = useState(false);
  const [walletAddress,    setWalletAddress]    = useState("");
  const [walletName,       setWalletName]       = useState("");
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [walletError,      setWalletError]      = useState("");
  const [broadcastTxId,    setBroadcastTxId]    = useState("");

  // ── Liquidity check state ────────────────────────────────────────────────
  const [liquidityError,     setLiquidityError]     = useState("");
  const [checkingLiquidity,  setCheckingLiquidity]  = useState(false);
  const [maxOrderNGN,        setMaxOrderNGN]        = useState<number | null>(null);

  const [rate, setRate]             = useState<RateData>({ marketRateNGN: 1847.35, flatFeeNGN: 100, priceUSD: 1.14, change24h: 0 });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [rateError,    setRateError]    = useState(false);

  const [banks,        setBanks]        = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError,   setBanksError]   = useState("");

  const [bankCode,      setBankCode]      = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName,   setAccountName]   = useState("");
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankError,     setBankError]     = useState("");
  const [bankVerified,  setBankVerified]  = useState(false);

  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [onrampResult,  setOnrampResult]  = useState<OnrampResult | null>(null);
  const [offrampResult, setOfframpResult] = useState<OfframpResult | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState("");

  const [recentTx] = useState([
    { type: "sell", amount: "250", ngn: "461,837.50", time: "2m ago" },
    { type: "buy",  amount: "100", ngn: "184,735.00", time: "5m ago" },
    { type: "sell", amount: "50",  ngn: "92,367.50",  time: "11m ago" },
  ]);

  const liveRate = rate.marketRateNGN ?? 0;
  const flatFee  = rate.flatFeeNGN ?? 100;
  const tokenAmt = parseFloat(tokenAmount) || 0;
  const ngnAmt   = parseFloat(ngnAmount)   || 0;

  const offrampGross = tokenAmt * liveRate;
  const offrampNet   = Math.floor(offrampGross - flatFee);
  const onrampTokens = ngnAmt / liveRate;
  const onrampTotal  = ngnAmt + flatFee;

  function detectWalletName(): string {
    if (typeof window === "undefined") return "Stacks Wallet";
    if ((window as any).LeatherProvider) return "Leather";
    if ((window as any).XverseProviders) return "Xverse";
    return "Stacks Wallet";
  }
  function extractAddress(data: StoredAddresses | null): string | null {
    return data?.addresses?.stx?.[0]?.address ?? null;
  }

  useEffect(() => {
    try {
      if (isConnected()) {
        const data = getLocalStorage() as StoredAddresses | null;
        const addr = extractAddress(data);
        if (addr) { setWalletAddress(addr); setWalletConnected(true); setWalletName(detectWalletName()); }
      }
    } catch {}
  }, []);

  const fetchRates = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/offramp/rate?token=STX`);
      const data = await res.json();
      if (data.success) {
        setRate({ marketRateNGN: data.data.marketRateNGN, flatFeeNGN: data.data.flatFeeNGN, priceUSD: data.data.priceUSD, change24h: data.data.change24h });
        setRateError(false);
      }
    } catch { setRateError(true); }
    finally { setRatesLoading(false); }
  }, []);

  useEffect(() => { fetchRates(); const id = setInterval(fetchRates, 30_000); return () => clearInterval(id); }, [fetchRates]);

  const fetchBanks = useCallback(async () => {
    if (banks.length > 0) return;
    setBanksLoading(true); setBanksError("");
    try {
      const res  = await fetch(`${API_BASE}/api/offramp/banks`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setBanks(data.data);
      else setBanksError(data.message || "Failed to load banks.");
    } catch { setBanksError("Could not load bank list."); }
    finally { setBanksLoading(false); }
  }, [banks.length]);

  useEffect(() => { if (step === "sell_bank") fetchBanks(); }, [step, fetchBanks]);

  useEffect(() => {
    if (!liveRate) return;
    if (mode === "sell" && tokenAmt > 0) setNgnAmount(offrampNet > 0 ? String(offrampNet) : "");
    else if (mode === "buy" && ngnAmt > 0) setTokenAmount((ngnAmt / liveRate).toFixed(4));
  }, [liveRate, mode]);

  const handleTokenAmt = (v: string) => {
    setTokenAmount(v);
    const a = parseFloat(v) || 0;
    const net = Math.floor(a * liveRate - flatFee);
    setNgnAmount(mode === "sell" ? (net > 0 ? String(net) : "") : (a * liveRate).toFixed(2));
    // Clear liquidity error when user changes amount
    setLiquidityError("");
    setMaxOrderNGN(null);
  };
  const handleNgnAmt = (v: string) => {
    setNgnAmount(v);
    const n = parseFloat(v) || 0;
    setTokenAmount(n > 0 ? (n / liveRate).toFixed(4) : "");
  };

  const connectWallet = useCallback(async () => {
    setConnectingWallet(true); setWalletError("");
    try {
      await connect();
      const data = getLocalStorage() as StoredAddresses | null;
      const addr = extractAddress(data);
      if (addr) { setWalletAddress(addr); setWalletConnected(true); setWalletName(detectWalletName()); }
      else setWalletError("No address found. Did you approve the connection in your wallet?");
    } catch (err: any) {
      setWalletError(err?.message || "Could not connect. Make sure Leather or Xverse is installed.");
    } finally { setConnectingWallet(false); }
  }, []);

  const disconnectWallet = useCallback(() => {
    stacksDisconnect(); setWalletConnected(false); setWalletAddress(""); setWalletName("");
  }, []);

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
    finally { setVerifyingBank(false); }
  }, [bankCode, accountNumber]);

  useEffect(() => { if (bankCode && accountNumber.length === 10 && !bankVerified) verifyBank(); }, [bankCode, accountNumber]);

  const submitOfframp = async () => {
    if (!bankVerified || !walletConnected) return;
    setSubmitting(true); setSubmitError("");
    try {
      const res  = await fetch(`${API_BASE}/api/offramp/initialize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "STX", tokenAmount: parseFloat(tokenAmount), stacksAddress: walletAddress, bankCode, accountNumber, accountName }),
      });
      const data = await res.json();
      if (!data.success) { setSubmitError(data.message || "Failed to create transaction."); setSubmitting(false); return; }
      setOfframpResult(data.data); setSubmitting(false); setStep("sell_sending");
      const adminAddress = data.data.depositInstructions.sendTo;
      const memo = data.data.depositInstructions.memo;
      const transactionReference = data.data.transactionReference;
      const notifyBackend = (stacksTxId: string) => {
        fetch(`${API_BASE}/api/offramp/notify-tx`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionReference, stacksTxId }),
        }).catch((err) => console.error("notify-tx failed:", err));
      };
      openSTXTransfer({
        network,
        recipient: adminAddress,
        amount: String(Math.round(parseFloat(tokenAmount) * 1_000_000)),
        memo,
        onFinish: (txData: { txId: string }) => {
          setBroadcastTxId(txData.txId);
          setStep("sell_pending");
          notifyBackend(txData.txId);
        },
        onCancel: () => {
          setSubmitError("Transaction cancelled in wallet.");
          setStep("sell_confirm");
        },
      });
    } catch { setSubmitError("Server error. Please try again."); setSubmitting(false); }
  };

  const submitOnramp = async () => {
    if (!walletAddress || !customerEmail) { setSubmitError("Connect wallet and enter email."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      const res  = await fetch(`${API_BASE}/api/onramp/initialize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "STX", amountNGN: parseFloat(ngnAmount), stacksAddress: walletAddress, customerEmail, customerPhone }),
      });
      const data = await res.json();
      if (data.success) { setOnrampResult(data.data); setStep("buy_payment"); }
      else setSubmitError(data.message || "Failed to initialize payment.");
    } catch { setSubmitError("Server error."); }
    finally { setSubmitting(false); }
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
    setTokenAmount("100"); setNgnAmount(""); setBroadcastTxId(""); setMode("sell");
    setLiquidityError(""); setMaxOrderNGN(null);
  };

  const sellQuickAmounts = ["10", "50", "100", "500"];

  const [txExpireLeft, setTxExpireLeft] = useState<string>("");
  useEffect(() => {
    if (!offrampResult?.depositInstructions?.expiresAt) return;
    const expiry = new Date(offrampResult.depositInstructions.expiresAt).getTime();
    const tick = () => {
      const diff = expiry - Date.now();
      if (diff <= 0) { setTxExpireLeft("Expired"); return; }
      setTxExpireLeft(`${Math.floor(diff/60000)}:${String(Math.floor((diff%60000)/1000)).padStart(2,"0")}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [offrampResult]);

  const explorerUrl = broadcastTxId ? `https://explorer.hiro.so/txid/${broadcastTxId}?chain=${STACKS_NETWORK}` : "";

  // ── handleCTA: checks liquidity before opening sell_bank step ─────────────
// ── handleCTA: checks liquidity before opening sell_bank step ─────────────
const handleCTA = useCallback(async (nextStep: FlowStep) => {
  if (!walletConnected) {
    await connectWallet();
    const data = getLocalStorage() as StoredAddresses | null;
    const addr = extractAddress(data);
    if (!addr) return;
  }

  if (nextStep === "sell_bank") {
    setCheckingLiquidity(true);
    setLiquidityError("");
    setMaxOrderNGN(null);

    try {
      const res  = await fetch(`${API_BASE}/api/offramp/liquidity`);
      const data = await res.json();

      if (data.success && data.data) {
        const platformBalance: number = data.data.balanceNGN ?? 0;

        if (platformBalance < offrampNet) {
          setMaxOrderNGN(platformBalance);
          setLiquidityError(
            `Platform balance  is less than your order ` +
            `(${formatNGN(offrampNet)}). Reduce your STX amount or try again later.`
          );
          return; // hard block
        }
      }
      // API error or missing data → fail open
    } catch {
      // Network error → fail open
    } finally {
      setCheckingLiquidity(false);
    }
  }

  setStep(nextStep);
}, [walletConnected, connectWallet, offrampNet]);

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
        .stx-header{display:flex;align-items:center;gap:12px;background:#0A1020;border:1px solid #FF6B0030;border-radius:16px;padding:14px 16px;margin-bottom:20px;}
        .stx-icon{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#FF6B00,#FF9500);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;box-shadow:0 4px 16px #FF6B0055;flex-shrink:0;}
        .stx-info{flex:1;}
        .stx-name{font-size:15px;font-weight:700;color:#F1F5F9;}
        .stx-meta{font-size:11px;color:#4A6A8A;margin-top:2px;}
        .stx-price{text-align:right;}
        .stx-usd{font-size:13px;font-weight:600;color:#C8D8E8;font-family:'DM Mono',monospace;}
        .mode-switch{display:flex;background:#080E1A;border-radius:14px;padding:4px;margin-bottom:20px;border:1px solid #1A2840;gap:4px;}
        .mode-btn{flex:1;padding:10px 8px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;transition:all 0.2s;background:transparent;color:#3A5070;display:flex;align-items:center;justify-content:center;gap:6px;}
        .mode-sell{background:#FF6B00;color:#fff;box-shadow:0 4px 12px #FF6B0044;}
        .mode-btn-locked{opacity:0.5;cursor:not-allowed;}
        .coming-tag{display:inline-flex;align-items:center;background:#7C3AED33;border:1px solid #7C3AED66;border-radius:5px;padding:1px 5px;font-size:9px;font-weight:700;color:#C084FC;letter-spacing:0.3px;white-space:nowrap;}
        .buy-soon-card{background:linear-gradient(160deg,#0D0A1A,#100D20);border:1px solid #7C3AED33;border-radius:20px;padding:30px 24px;text-align:center;position:relative;overflow:hidden;}
        .buy-soon-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(124,58,237,0.6),transparent);}
        .buy-soon-orb{position:absolute;width:200px;height:200px;border-radius:50%;background:#7C3AED;filter:blur(80px);opacity:0.06;top:-60px;right:-60px;pointer-events:none;}
        .countdown-box{display:inline-flex;align-items:center;gap:8px;background:#7C3AED1A;border:1px solid #7C3AED44;border-radius:12px;padding:10px 20px;margin-bottom:24px;}
        .feature-row{display:flex;align-items:center;gap:10px;background:#0A0F1A;border-radius:10px;padding:10px 14px;font-size:12px;color:#4A5A7A;text-align:left;margin-bottom:6px;}
        .field-label{font-size:10px;color:#3A5070;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;font-weight:600;}
        .input-box{background:#080E1A;border-radius:16px;border:1.5px solid #1A2840;padding:14px 16px;display:flex;align-items:center;gap:12px;transition:all 0.2s;}
        .input-box-focused{border-color:#FF6B00!important;box-shadow:0 0 0 3px #FF6B0022!important;}
        .token-badge{display:flex;align-items:center;gap:7px;background:#0F1829;border:1px solid #1A2840;border-radius:10px;padding:7px 10px;white-space:nowrap;flex-shrink:0;}
        .badge-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;}
        .badge-label{font-size:12px;font-weight:600;color:#C8D8E8;}
        .amount-input{flex:1;background:transparent;border:none;outline:none;font-family:'DM Mono',monospace;font-size:22px;font-weight:500;color:#F1F5F9;width:100%;min-width:0;}
        .amount-input::placeholder{color:#1E2D45;}
        .hint{font-size:11px;color:#2A4060;font-family:'DM Mono',monospace;white-space:nowrap;}
        .quick-amounts{display:flex;gap:6px;margin-top:8px;}
        .quick-btn{flex:1;padding:6px;border-radius:8px;border:1px solid #1A2840;background:#080E1A;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#3A5070;cursor:pointer;transition:all 0.15s;}
        .quick-btn:hover{border-color:#FF6B00;color:#FF6B00;}
        .arrow-wrap{display:flex;align-items:center;justify-content:center;margin:12px 0;position:relative;}
        .arrow-line{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#1A2840,transparent);}
        .arrow-icon{width:36px;height:36px;border-radius:50%;background:#0F1829;border:1.5px solid #1A2840;display:flex;align-items:center;justify-content:center;color:#3A5070;z-index:1;}
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
        .badge-trust{display:flex;align-items:center;gap:4px;font-size:10px;color:#2A4060;font-weight:500;}
        .success-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#22C55E22,#22C55E44);border:2px solid #22C55E;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;}
        .bank-skeleton{height:48px;border-radius:12px;background:linear-gradient(90deg,#1A2840 25%,#2A3A5A 50%,#1A2840 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}
        .pulse-ring{width:72px;height:72px;border-radius:50%;border:2px solid #FF6B00;margin:0 auto 20px;position:relative;display:flex;align-items:center;justify-content:center;font-size:28px;animation:pulseRing 2s ease-in-out infinite;}
        .liquidity-error{background:#1c0a0a;border:1px solid #7f1d1d;border-radius:12px;padding:14px 16px;margin-top:10px;display:flex;gap:10px;align-items:flex-start;animation:slideIn 0.25s ease forwards;}
        .liquidity-error-title{font-size:12px;font-weight:700;color:#EF4444;margin-bottom:4px;}
        .liquidity-error-body{font-size:12px;color:#FCA5A5;line-height:1.6;}
        .liquidity-autofill{display:inline-flex;align-items:center;gap:6px;margin-top:8px;background:transparent;border:1px solid #7f1d1d;border-radius:8px;padding:5px 12px;font-size:11px;color:#FB923C;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .liquidity-autofill:hover{background:#2a0a0a;border-color:#FB923C;color:#FDBA74;}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes betaPulse{0%,100%{box-shadow:0 0 12px #7C3AED33;}50%{box-shadow:0 0 20px #7C3AED66;}}
        @keyframes slideIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulseRing{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:0.6;}}
        @keyframes purpleGlow{0%,100%{box-shadow:0 0 0 0 #7C3AED33;}50%{box-shadow:0 0 0 10px transparent;}}
        .slide-in{animation:slideIn 0.3s ease forwards;} .fade-up{animation:fadeUp 0.4s ease forwards;}
      `}</style>

      <div className="grid-bg" />
      <div className="orb" style={{ width:500,height:500,background:"#FF6B00",opacity:0.06,top:-150,right:-150 }} />
      <div className="orb" style={{ width:400,height:400,background:"#FF6B00",opacity:0.04,bottom:-100,left:-150 }} />

      <div className="wrapper">

        {/* ── Topbar ── */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-mark">S</div>
            <div>
              <div className="logo-text">StackSwap</div>
              <div className="logo-sub">STX · NAIRA</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            {walletConnected ? (
              <button className="wallet-btn wallet-btn-on" onClick={disconnectWallet}>
                <span className="wallet-dot" style={{ background:"#22C55E" }} />{shortAddr(walletAddress)}
              </button>
            ) : (
              <button className="wallet-btn wallet-btn-off" onClick={connectWallet} disabled={connectingWallet}>
                {connectingWallet ? <><span className="spinner" style={{ width:12,height:12 }} />Connecting…</> : <>🔗 Connect Wallet</>}
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
          <div className="card slide-in">

            {/* STX header */}
            <div className="stx-header">
              <div className="stx-icon">S</div>
              <div className="stx-info">
                <div className="stx-name">Stacks (STX)</div>
                <div className="stx-meta">Bitcoin L2 · Secured by Bitcoin</div>
              </div>
              <div className="stx-price">
                {ratesLoading ? <div className="rate-shimmer" /> : <div className="stx-usd">${rate.priceUSD?.toFixed(4) ?? "—"}</div>}
                <div style={{ fontSize:11,marginTop:2,color:(rate.change24h??0)>=0?"#22C55E":"#EF4444" }}>
                  {(rate.change24h??0)>=0?"▲":"▼"} {Math.abs(rate.change24h??0).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* ── Mode tabs ── */}
            <div className="mode-switch">
              <button
                className={`mode-btn${mode==="sell" ? " mode-sell" : ""}`}
                onClick={() => { setMode("sell"); setNgnAmount(""); setLiquidityError(""); setMaxOrderNGN(null); }}
              >
                ↑ Sell STX
              </button>
              <button
                className={`mode-btn${!buyIsLive ? " mode-btn-locked" : (mode==="buy" ? " mode-buy" : "")}`}
                onClick={() => { if (buyIsLive) { setMode("buy"); setNgnAmount(""); } else { setMode("buy"); } }}
                title={!buyIsLive ? "Launches March 3rd, 2026" : undefined}
              >
                ↓ Buy STX
                {!buyIsLive && <span className="coming-tag">Mar 3</span>}
              </button>
            </div>

            {/* ── SELL content ── */}
            {mode === "sell" && (
              <>
                <div style={{ marginBottom:6 }}>
                  <div className="field-label">You're Sending</div>
                  <div className={`input-box${focused==="token"?" input-box-focused":""}`}>
                    <div className="token-badge">
                      <div className="badge-icon" style={{ background:"#FF6B00" }}>S</div>
                      <span className="badge-label">STX</span>
                    </div>
                    <input className="amount-input" type="number" placeholder="0.00" value={tokenAmount}
                      onChange={(e) => handleTokenAmt(e.target.value)}
                      onFocus={() => setFocused("token")} onBlur={() => setFocused(null)} />
                    <div className="hint">≈ {formatNGN(tokenAmt*liveRate)}</div>
                  </div>
                </div>
                <div className="quick-amounts">
                  {sellQuickAmounts.map((a) => <button key={a} className="quick-btn" onClick={() => handleTokenAmt(a)}>{a}</button>)}
                  <button className="quick-btn" onClick={() => handleTokenAmt("1000")}>MAX</button>
                </div>

                <div className="arrow-wrap">
                  <div className="arrow-line" />
                  <div className="arrow-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14m-7-7l7 7 7-7" /></svg></div>
                </div>

                <div style={{ marginBottom:20 }}>
                  <div className="field-label">You're Receiving</div>
                  <div className="input-box">
                    <div className="token-badge"><div className="badge-icon" style={{ background:"#22C55E",fontSize:13 }}>₦</div><span className="badge-label">NGN</span></div>
                    <div style={{ flex:1,fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:500,color:"#22C55E" }}>{offrampNet>0?offrampNet.toLocaleString():"0"}</div>
                  </div>
                </div>

                <div className="summary">
                  <div className="srow">
                    <span><span className="live-dot" />Rate</span>
                    {ratesLoading ? <div className="rate-shimmer" /> : <span className="sval">1 STX = <AnimatedNumber value={liveRate} prefix="₦" /></span>}
                  </div>
                  <div className="srow" style={{ marginTop:4 }}><span>Service fee</span><span className="sval">₦{flatFee.toFixed(2)} flat</span></div>
                  <div className="srow" style={{ marginTop:4 }}><span>Gross value</span><span className="sval">{formatNGN(offrampGross)}</span></div>
                  <div className="srow stotal"><span>You receive</span><span className="sval">{offrampNet>0?formatNGN(offrampNet):"—"}</span></div>
                  <div className="srow" style={{ marginTop:4 }}><span>Settlement</span><span className="sval" style={{ color:"#22C55E" }}>~30-60 sec</span></div>
                </div>

                {/* ── CTA with liquidity gate ── */}
                <button
                  className="cta cta-sell"
                  disabled={tokenAmt<=0 || connectingWallet || checkingLiquidity}
                  onClick={() => { setLiquidityError(""); handleCTA("sell_bank"); }}
                >
                  {connectingWallet
                    ? <><span className="spinner" />Connecting wallet…</>
                    : checkingLiquidity
                      ? <><span className="spinner" />Checking availability…</>
                      : "⚡ Sell STX → Get Naira"}
                </button>

                {/* ── Liquidity error card ── */}
                {liquidityError && (
                  <div className="liquidity-error">
                    <span style={{ fontSize:18,flexShrink:0,lineHeight:1 }}>🚫</span>
                    <div>
                      <div className="liquidity-error-title">Insufficient Liquidity</div>
                      <div className="liquidity-error-body">{liquidityError}</div>
                      {maxOrderNGN !== null && maxOrderNGN > 0 && liveRate > 0 && (
                        <button
                          className="liquidity-autofill"
                          onClick={() => {
                            const maxSTX = ((maxOrderNGN + flatFee) / liveRate).toFixed(4);
                            handleTokenAmt(maxSTX);
                            setLiquidityError("");
                            setMaxOrderNGN(null);
                          }}
                        >
                          ↙ Auto-fill max ({((maxOrderNGN + flatFee) / liveRate).toFixed(2)} STX)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <p style={{ textAlign:"center",fontSize:10,color:"#1E2D45",marginTop:14,lineHeight:1.6 }}>
                  Powered by Stacks L2 · Secured by Bitcoin · KYC required above ₦500,000
                </p>
              </>
            )}

            {/* ── BUY coming soon panel ── */}
            {mode === "buy" && !buyIsLive && (
              <div className="buy-soon-card slide-in">
                <div className="buy-soon-orb" />
                <div style={{ fontSize:36,marginBottom:12 }}>🛒</div>
                <div style={{ fontSize:20,fontWeight:800,color:"#F1F5F9",marginBottom:8 }}>Buy STX is Coming Soon</div>
                <div style={{ fontSize:13,color:"#5A4A7A",marginBottom:20,lineHeight:1.7 }}>
                  Purchase STX directly with Naira via Monnify.<br />
                  Launching <strong style={{ color:"#C084FC" }}>Monday, March 3rd 2026</strong>.
                </div>
                {buyCountdown && (
                  <div className="countdown-box" style={{ marginBottom:24 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span style={{ fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:700,color:"#C084FC",letterSpacing:"1px" }}>{buyCountdown}</span>
                  </div>
                )}
                <div style={{ marginBottom:20 }}>
                  {[["⚡","Instant STX delivery (~30 sec)"],["💳","Pay via Monnify – card, bank & USSD"],["🔒","Non-custodial – direct to your wallet"],["🏦","Supports all major Nigerian banks"]].map(([icon,text]) => (
                    <div key={String(text)} className="feature-row">
                      <span style={{ fontSize:16,flexShrink:0 }}>{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
                <button className="cta cta-ghost" onClick={() => setMode("sell")}>← Back to Sell STX</button>
              </div>
            )}
          </div>
        )}

        {/* ════ STEP: SELL_BANK ════ */}
        {step === "sell_bank" && (
          <div className="card slide-in">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep("swap")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg></button>
              <div><div className="step-title">Bank Account Details</div><div className="step-sub">Selling {tokenAmount} STX {offrampNet>0?`→ ≈ ${formatNGN(offrampNet)}`:""}</div></div>
            </div>
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
              <div className="info-row"><span className="info-key">You send</span><span className="info-val">{tokenAmount} STX</span></div>
              <div className="info-row"><span className="info-key">Gross NGN</span><span className="info-val">{formatNGN(offrampGross)}</span></div>
              <div className="info-row"><span className="info-key">Service fee</span><span className="info-val">− ₦{flatFee.toFixed(2)}</span></div>
              <div className="info-row"><span className="info-key" style={{ color:"#C8D8E8",fontWeight:600 }}>You receive</span><span className="info-val" style={{ color:"#22C55E",fontSize:13 }}>{formatNGN(offrampNet)}</span></div>
              <div className="info-row"><span className="info-key">Bank</span><span className="info-val">{accountName}</span></div>
              <div className="info-row"><span className="info-key">Account</span><span className="info-val">{accountNumber}</span></div>
              <div className="info-row"><span className="info-key">Settlement</span><span className="info-val" style={{ color:"#22C55E" }}>30–60 sec</span></div>
            </div>
            <div className="warn-box" style={{ marginBottom:20 }}>
              ℹ️ Clicking confirm opens <strong>{walletName || "your Stacks wallet"}</strong>
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
              Approve the <strong style={{ color:"#FF6B00" }}>{tokenAmount} STX</strong> transfer to continue.
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
                {tokenAmount} STX is on-chain. NGN will be sent to your bank after confirmation (~30-60 sec).
              </div>
            </div>
            {broadcastTxId && (
              <div style={{ marginBottom:16 }}>
                <div className="field-label" style={{ marginBottom:8 }}>Transaction ID</div>
                <div className="deposit-box">
                  <div className="deposit-addr">
                    <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ color:"#FF6B00",textDecoration:"none",fontFamily:"'DM Mono',monospace",fontSize:13,wordBreak:"break-all" }}>{broadcastTxId}</a>
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
              <div className="info-row"><span className="info-key">Expires in</span><span className="timer-pill">⏱ {txExpireLeft || `${offrampResult.depositInstructions.expiresInMinutes}m`}</span></div>
            </div>
            <div style={{ background:"#050A10",border:"1px solid #1A2840",borderRadius:12,padding:"12px 16px",fontSize:12,color:"#3A5070",marginBottom:20,lineHeight:1.6 }}>
              📋 Ref: <span style={{ color:"#8A9AB8",fontFamily:"monospace" }}>{offrampResult.transactionReference}</span><br />
              Save this for support queries. NGN is sent automatically after on-chain confirmation.
            </div>
            <button className="cta cta-ghost" onClick={resetFlow}>Start New Transaction</button>
          </div>
        )}

        {/* ════ STEP: SUCCESS ════ */}
        {step === "success" && (
          <div className="card fade-up" style={{ textAlign:"center" }}>
            <div className="success-icon">✅</div>
            <div style={{ fontSize:20,fontWeight:700,color:"#F1F5F9",marginBottom:8 }}>Payment Successful!</div>
            <div style={{ fontSize:13,color:"#4A6A8A",marginBottom:24,lineHeight:1.7 }}>
              STX will arrive in your wallet within <strong style={{ color:"#22C55E" }}>~30 seconds</strong>.
            </div>
            <div className="info-box" style={{ marginBottom:24,textAlign:"left" }}>
              {onrampResult && <>
                <div className="info-row"><span className="info-key">Tokens incoming</span><span className="info-val" style={{ color:"#22C55E" }}>{onrampResult.tokenAmount} STX</span></div>
                <div className="info-row"><span className="info-key">Wallet</span><span className="info-val">{shortAddr(walletAddress)}</span></div>
                <div className="info-row"><span className="info-key">Reference</span><span className="info-val">{onrampResult.paymentReference}</span></div>
              </>}
              <div className="info-row"><span className="info-key">Status</span><span className="info-val" style={{ color:"#22C55E" }}>Confirmed ✓</span></div>
            </div>
            <button className="cta cta-buy" onClick={resetFlow}>New Transaction</button>
          </div>
        )}

        {/* Recent txns */}
        {step === "swap" && mode === "sell" && (
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
                      <div style={{ fontSize:12,fontWeight:600,color:"#8A9AB8" }}>{tx.type==="sell"?"Sold":"Bought"} {tx.amount} STX</div>
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
                    <div style={{ color:tx.type==="sell"?"#FF6B00":"#22C55E",fontWeight:600,marginBottom:2 }}>{tx.type==="sell"?"↑ Sell":"↓ Buy"} STX</div>
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
            <div key={b} className="badge-trust">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#22C55E" opacity="0.6"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{b}
            </div>
          ))}
        </div>

        {/* WhatsApp support */}
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,paddingTop:4,paddingBottom:8 }}>
          <p style={{ fontSize:11,color:"#2A4060",textAlign:"center" }}>Having an issue with a transaction? Contact us immediately.</p>
          <a
            href="https://wa.me/2347043314162?text=Hi%2C%20I%20need%20urgent%20help%20with%20a%20StackSwap%20transaction."
            target="_blank" rel="noreferrer"
            style={{ display:"flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none",borderRadius:14,padding:"12px 22px",fontSize:14,fontWeight:700,boxShadow:"0 6px 24px #25D36650",transition:"transform 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform="translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform="translateY(0)")}
          >
            <svg width="20" height="20" viewBox="0 0 32 32" fill="white">
              <path d="M16 2C8.268 2 2 8.268 2 16c0 2.44.636 4.735 1.752 6.72L2 30l7.52-1.724A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 01-5.812-1.584l-.416-.248-4.464 1.024 1.052-4.34-.272-.432A11.46 11.46 0 014.5 16C4.5 9.648 9.648 4.5 16 4.5S27.5 9.648 27.5 16 22.352 27.5 16 27.5zm6.32-8.556c-.348-.174-2.056-1.012-2.376-1.128-.32-.116-.552-.174-.784.174-.232.348-.9 1.128-1.104 1.36-.204.232-.406.26-.754.086-.348-.174-1.468-.54-2.796-1.72-1.032-.92-1.728-2.056-1.932-2.404-.204-.348-.022-.536.152-.708.158-.156.348-.406.522-.61.174-.202.232-.348.348-.58.116-.232.058-.436-.028-.61-.088-.174-.784-1.888-1.074-2.586-.282-.678-.568-.586-.784-.596l-.668-.012c-.232 0-.61.086-.928.434-.32.348-1.216 1.188-1.216 2.896s1.244 3.358 1.418 3.59c.174.232 2.448 3.736 5.932 5.238.828.358 1.474.572 1.978.732.832.264 1.588.226 2.186.138.666-.1 2.056-.84 2.346-1.652.29-.812.29-1.508.204-1.652-.086-.144-.32-.232-.668-.406z"/>
            </svg>
            WhatsApp Emergency Support
          </a>
          <p style={{ fontSize:10,color:"#1E2D45",textAlign:"center" }}>+234 704 331 4162 · Available for urgent transaction issues</p>
        </div>

      </div>
    </div>
  );
}