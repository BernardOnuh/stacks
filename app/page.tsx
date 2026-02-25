"use client";

import { useState, useMemo, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Registrant {
  name: string;
  phone: string;
  track: string;
  location: string;
  level: string;
  twitter: string;
}

interface Template {
  title: string;
  emoji: string;
  text: string;
}

interface TrackStyle {
  bg: string;
  color: string;
  border: string;
}

interface LogEntry {
  text: string;
  type: "ok" | "err" | "info";
}

type Tab = "contacts" | "compose" | "preview" | "send";

// ─── Data ─────────────────────────────────────────────────────────────────────

const REGISTRANTS: Registrant[] = [
  {name:"Arije Alice",phone:"07049249248",track:"Blockchain",location:"FUTA",level:"Beginner",twitter:"@AliceArije"},
  {name:"Adeniji Sodeeq Oladoja",phone:"09063290648",track:"AI & Automation",location:"Online",level:"Intermediate",twitter:"@Boff_biggie"},
  {name:"Olufogobomi Gaius Adeoluwa",phone:"07014714872",track:"Web Dev",location:"Online",level:"Beginner",twitter:"Olufogobomi Adeoluwa"},
  {name:"Solomon Blessing Oluwafunmilayo",phone:"07071525618",track:"AI & Automation",location:"Online",level:"Beginner",twitter:"Funmi447302"},
  {name:"Kehinde Abdullai",phone:"08024309742",track:"AI & Automation",location:"Online",level:"Beginner",twitter:"@Tijesu03"},
  {name:"Diya Deborah Oluwafunso",phone:"09078026303",track:"AI & Automation",location:"Online",level:"Beginner",twitter:"@diya_debor50709"},
  {name:"Ogunsanya Oluwatobiloba Adebayo",phone:"08134916062",track:"Blockchain",location:"FUTA",level:"Beginner",twitter:"Techking"},
  {name:"Idowu Immanuel Oluwadaraninumi",phone:"09063644553",track:"Web Dev",location:"FUTA",level:"Intermediate",twitter:"—"},
  {name:"Mukhtar Mubarak",phone:"09061675692",track:"Web Dev",location:"FUTA",level:"Beginner",twitter:"Mukhtar Mubarak"},
  {name:"Divine Akintola",phone:"09071612052",track:"Web Dev",location:"Online",level:"Intermediate",twitter:"@digxzy_gadget1"},
  {name:"Emmanuel Alaba Olayinka",phone:"08144700674",track:"Blockchain",location:"Online",level:"Beginner",twitter:"@Emreethekid"},
  {name:"Oyetunji Peter",phone:"07085764736",track:"Blockchain",location:"FUTA",level:"Beginner",twitter:"@oyetunji_p87566"},
  {name:"Atere Abundance Ibukunola",phone:"08051016176",track:"ZK & Rust",location:"FUTA",level:"Beginner",twitter:"@Ibksmart_505"},
  {name:"Okunola Olamide",phone:"08188508352",track:"AI & Automation",location:"FUTA",level:"Intermediate",twitter:"Vira_kael"},
  {name:"Mas'ud Abdullah Olaoye",phone:"08088547002",track:"Web Dev",location:"FUTA",level:"Intermediate",twitter:"MAbdullah8032"},
  {name:"Petersen Daniel",phone:"09127272701",track:"ZK & Rust",location:"FUTA",level:"Beginner",twitter:"@Dan_zazzy"},
  {name:"Aiki Muhammad Olanrewaju",phone:"09155604600",track:"Web Dev",location:"FUTA",level:"Beginner",twitter:"Iykelanre"},
  {name:"Kuye Toluwanimi Joseph",phone:"07038208287",track:"AI & Automation",location:"FUTA",level:"Intermediate",twitter:"@Toluwanimi16095"},
  {name:"Adenaya Festus",phone:"09112330992",track:"Web Dev",location:"Online",level:"Beginner",twitter:"@festus042"},
  {name:"Olawale Olaribigbe Ayomide",phone:"08080160424",track:"AI & Automation",location:"FUTA",level:"Beginner",twitter:"@Satoshisavy"},
  {name:"Etim Iniekung",phone:"08062639417",track:"Web Dev",location:"Online",level:"Intermediate",twitter:"timmz@mystglac"},
  {name:"Taofeeq Mukhtar Akorede",phone:"07030130058",track:"ZK & Rust",location:"Online",level:"Intermediate",twitter:"@smart0058"},
  {name:"Omotunlese Monday Oluwatosin",phone:"09025517785",track:"Web Dev",location:"Online",level:"Beginner",twitter:"@OmotunleseM"},
  {name:"Winniran Oreoluwa Olabode",phone:"08152635583",track:"Web Dev",location:"FUTA",level:"Intermediate",twitter:"@BrightCode12"},
  {name:"Victor Michael",phone:"08056358132",track:"ZK & Rust",location:"FUTA",level:"Beginner",twitter:"@Viktor_micel"},
  {name:"Enyogai Michael Dike",phone:"09033870010",track:"UI/UX",location:"FUTA",level:"Beginner",twitter:"MDThirve01"},
  {name:"Ibrahim Abraham",phone:"09019145380",track:"AI & Automation",location:"FUTA",level:"Beginner",twitter:"@crypticclad"},
];

const DEFAULT_MSG = `Hi {{name}}! 👋

We received your application to join *Web3Nova Cohort III* and we'd love to have you on board! 🎉

Please join this group for further information about Cohort III 👇

[GROUP LINK HERE]

Cohort III kicks off the *first week of April* — don't miss out!

See you inside 💪
— Web3Nova`;

const TEMPLATES: Template[] = [
  { title: "Cohort III", emoji: "🚀", text: DEFAULT_MSG },
  { title: "Welcome",    emoji: "👋", text: `Hi {{name}}! 👋\n\nWelcome to Web3Nova Bootcamp! 🚀\n\nWe're thrilled to have you on the *{{track}}* track. Get ready for an incredible journey!\n\nStay active in our community channels — see you soon! 💪` },
  { title: "Kickoff",    emoji: "🎉", text: `Hello {{name}}! 🎉\n\nOur Web3Nova Cohort officially kicks off this week!\n\nYou're registered for *{{track}}* — check your email for onboarding details and the Zoom link.\n\nSee you there! 🔥` },
  { title: "Reminder",   emoji: "⏰", text: `Hey {{name}}! ⏰\n\nQuick reminder — your *{{track}}* class holds today.\n\nGet your tools ready and show up to learn. Let's build something great together! 👨‍💻` },
  { title: "Assignment", emoji: "📋", text: `Hi {{name}} 👩‍💻\n\nA new assignment just dropped for *{{track}}*!\n\nLog in to your dashboard to view details. Deadline is 72 hours — don't wait! Good luck! 🙌` },
  { title: "Custom",     emoji: "✏️", text: `` },
];

const TRACK_STYLE: Record<string, TrackStyle> = {
  Blockchain:       { bg: "rgba(37,211,102,0.12)",  color: "#25D366", border: "rgba(37,211,102,0.25)" },
  "Web Dev":        { bg: "rgba(168,255,120,0.1)",   color: "#a8ff78", border: "rgba(168,255,120,0.25)" },
  "UI/UX":          { bg: "rgba(255,209,102,0.1)",   color: "#ffd166", border: "rgba(255,209,102,0.25)" },
  "AI & Automation":{ bg: "rgba(100,160,255,0.12)",  color: "#7eb8ff", border: "rgba(100,160,255,0.25)" },
  "ZK & Rust":      { bg: "rgba(220,120,255,0.12)",  color: "#d87eff", border: "rgba(220,120,255,0.25)" },
};

const FILTERS: string[] = ["All", "Blockchain", "Web Dev", "UI/UX", "AI & Automation", "ZK & Rust", "FUTA", "Online"];

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "contacts", label: "Contacts", emoji: "👥" },
  { id: "compose",  label: "Compose",  emoji: "✍️" },
  { id: "preview",  label: "Preview",  emoji: "👁" },
  { id: "send",     label: "Send",     emoji: "💬" },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      "#080c08",
  surface: "#0e140e",
  card:    "#111811",
  border:  "#1a2a1a",
  text:    "#e4ede4",
  muted:   "#4a5e4a",
  mid:     "#5a7a5a",
  green:   "#25D366",
  accent:  "#a8ff78",
  warn:    "#ffd166",
  mono:    "'DM Mono', monospace" as const,
  sans:    "'Syne', sans-serif" as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(p: string): string {
  let n = p.replace(/\D/g, "");
  if (n.startsWith("0")) n = "234" + n.slice(1);
  if (!n.startsWith("234")) n = "234" + n;
  return n;
}

function resolveMsg(tpl: string, r: Registrant): string {
  return tpl
    .replace(/{{name}}/g, r.name.split(" ")[0])
    .replace(/{{track}}/g, r.track)
    .replace(/{{location}}/g, r.location)
    .replace(/{{level}}/g, r.level);
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: C.muted, marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Web3NovaDMTool() {
  const [tab, setTab]             = useState<Tab>("contacts");
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [filter, setFilter]       = useState<string>("All");
  const [search, setSearch]       = useState<string>("");
  const [message, setMessage]     = useState<string>(DEFAULT_MSG);
  const [activeTpl, setActiveTpl] = useState<number>(0);
  const [modal, setModal]         = useState<boolean>(false);
  const [sendIdx, setSendIdx]     = useState<number>(0);
  const [sendQueue, setSendQueue] = useState<Registrant[]>([]);
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [done, setDone]           = useState<boolean>(false);
  const [isMobile, setIsMobile]   = useState<boolean>(false);

  useEffect(() => {
    // Font
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    // Responsive
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visible = useMemo<Registrant[]>(() => {
    return REGISTRANTS.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.track.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q);
      const matchFilter =
        filter === "All" ||
        r.track === filter ||
        (filter === "FUTA"   && r.location.toLowerCase().includes("futa")) ||
        (filter === "Online" && ["online", "virtual"].includes(r.location.toLowerCase()));
      return matchSearch && matchFilter;
    });
  }, [search, filter]);

  const toggle = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected((prev) => { const n = new Set(prev); visible.forEach((r) => n.add(REGISTRANTS.indexOf(r))); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); visible.forEach((r) => n.delete(REGISTRANTS.indexOf(r))); return n; });
    }
  };

  const pickTemplate = (i: number) => { setActiveTpl(i); setMessage(TEMPLATES[i].text); };

  const insertVar = (v: string) => {
    const ta = document.getElementById("msg-ta") as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart ?? message.length;
    const e = ta.selectionEnd   ?? message.length;
    setMessage(message.slice(0, s) + v + message.slice(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length); }, 0);
  };

  const previewContact: Registrant = selected.size > 0 ? REGISTRANTS[[...selected][0]] : REGISTRANTS[0];
  const previewMsg  = message ? resolveMsg(message, previewContact) : "Your message will appear here…";
  const canSend     = selected.size > 0 && message.trim() !== "";

  const openNext = (queue: Registrant[], idx: number, currentLogs: LogEntry[]): LogEntry[] | undefined => {
    if (idx >= queue.length) { setDone(true); return; }
    const r = queue[idx];
    const url = `https://wa.me/${normalizePhone(r.phone)}?text=${encodeURIComponent(resolveMsg(message, r))}`;
    window.open(url, "_blank");
    const updated = [...currentLogs, { text: `✅ Opened chat for ${r.name}`, type: "ok" as const }];
    setLogs(updated);
    setSendIdx(idx + 1);
    if (idx + 1 >= queue.length) setDone(true);
    return updated;
  };

  const startSending = () => {
    const queue = [...selected].map((i) => REGISTRANTS[i]);
    setSendQueue(queue); setSendIdx(0); setLogs([]); setDone(false); setModal(true);
    openNext(queue, 0, []);
  };

  const progress = sendQueue.length ? Math.round((sendIdx / sendQueue.length) * 100) : 0;

  // ── Contacts panel ───────────────────────────────────────────────────────────
  const ContactsPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Search */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.muted }}>🔍</span>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, track, city…"
            style={{
              width: "100%", background: C.card, border: `1px solid ${C.border}`,
              color: C.text, fontFamily: C.mono, fontSize: 13,
              padding: "10px 12px 10px 36px", borderRadius: 10, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      {/* Filters */}
      <div style={{
        display: "flex", gap: 6, padding: "10px 16px", flexShrink: 0,
        borderBottom: `1px solid ${C.border}`, background: C.surface,
        overflowX: "auto", WebkitOverflowScrolling: "touch" as never,
      }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            whiteSpace: "nowrap", fontFamily: C.sans, fontSize: 11, fontWeight: 700,
            padding: "6px 14px", borderRadius: 20, border: "1px solid", cursor: "pointer", flexShrink: 0,
            borderColor: filter === f ? C.green : C.border,
            background:  filter === f ? "rgba(37,211,102,0.12)" : "transparent",
            color:       filter === f ? C.green : C.muted,
          }}>{f}</button>
        ))}
      </div>
      {/* Select all */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0,
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.mid, fontSize: 13 }}>
          <input
            type="checkbox"
            onChange={(e) => toggleAll(e.target.checked)}
            checked={visible.length > 0 && visible.every((r) => selected.has(REGISTRANTS.indexOf(r)))}
            style={{ accentColor: C.green, width: 16, height: 16 }}
          />
          Select all visible
        </label>
        <span style={{ fontFamily: C.mono, color: C.accent, fontWeight: 600, fontSize: 12 }}>{selected.size} selected</span>
      </div>
      {/* List */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>No results
          </div>
        ) : visible.map((r) => {
          const idx = REGISTRANTS.indexOf(r);
          const isSel = selected.has(idx);
          const ts: TrackStyle = TRACK_STYLE[r.track] ?? TRACK_STYLE["Blockchain"];
          return (
            <div key={idx} onClick={() => toggle(idx)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer",
              borderBottom: `1px solid rgba(26,42,26,0.5)`,
              background: isSel ? "rgba(37,211,102,0.07)" : "transparent",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${isSel ? C.green : C.border}`,
                background: isSel ? C.green : C.card,
                display: "grid", placeItems: "center", fontSize: 12, color: "#000", fontWeight: 800,
              }}>{isSel ? "✓" : ""}</div>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: C.border, color: C.accent,
                display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800,
              }}>{getInitials(r.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontFamily: C.mono, fontSize: 12, color: C.muted, marginTop: 2 }}>{r.phone}</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
                background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
              }}>{r.track}</span>
            </div>
          );
        })}
      </div>
      {/* Next CTA (mobile only) */}
      {isMobile && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <button onClick={() => setTab("compose")} style={{
            width: "100%", background: C.green, color: "#000",
            fontFamily: C.sans, fontSize: 15, fontWeight: 800,
            padding: "14px", border: "none", borderRadius: 12, cursor: "pointer",
          }}>Compose Message →</button>
        </div>
      )}
    </div>
  );

  // ── Compose panel ─────────────────────────────────────────────────────────────
  const ComposePanel = (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <SectionLabel>Quick Templates</SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(auto-fill,minmax(145px,1fr))",
        gap: 8, marginBottom: 20,
      }}>
        {TEMPLATES.map((t, i) => (
          <button key={i} onClick={() => pickTemplate(i)} style={{
            background: activeTpl === i ? "rgba(37,211,102,0.08)" : C.card,
            border: `1px solid ${activeTpl === i ? C.green : C.border}`,
            borderRadius: 10, padding: isMobile ? "10px 6px" : "13px 12px",
            cursor: "pointer", textAlign: "center", color: "inherit", position: "relative", overflow: "hidden",
          }}>
            {activeTpl === i && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${C.green},${C.accent})` }} />}
            <div style={{ fontSize: isMobile ? 22 : 18, marginBottom: 4 }}>{t.emoji}</div>
            <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: activeTpl === i ? C.green : C.text, lineHeight: 1.2 }}>{t.title}</div>
          </button>
        ))}
      </div>

      <SectionLabel>Your Message</SectionLabel>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: C.surface,
        }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["{{name}}", "{{track}}", "{{location}}", "{{level}}"].map((v) => (
              <button key={v} onClick={() => insertVar(v)} style={{
                fontFamily: C.mono, fontSize: 11, padding: "4px 10px", borderRadius: 6,
                border: `1px solid ${C.border}`, background: "transparent", color: C.green, cursor: "pointer",
              }}>{v}</button>
            ))}
          </div>
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted }}>{message.length} chars</span>
        </div>
        <textarea
          id="msg-ta"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={"Type your message…\n\nUse {{name}}, {{track}}, {{location}} as placeholders."}
          rows={isMobile ? 10 : 8}
          style={{
            width: "100%", background: "transparent", border: "none",
            color: C.text, fontFamily: C.mono, fontSize: 13,
            lineHeight: 1.75, padding: "14px", outline: "none", resize: "none", boxSizing: "border-box",
          }}
        />
      </div>
      {isMobile && (
        <button onClick={() => setTab("preview")} style={{
          width: "100%", background: C.green, color: "#000",
          fontFamily: C.sans, fontSize: 15, fontWeight: 800,
          padding: "14px", border: "none", borderRadius: 12, cursor: "pointer",
        }}>Preview Message →</button>
      )}
    </div>
  );

  // ── Preview panel ─────────────────────────────────────────────────────────────
  const ts0: TrackStyle = TRACK_STYLE[previewContact.track] ?? TRACK_STYLE["Blockchain"];
  const PreviewPanel = (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <SectionLabel>Message Preview</SectionLabel>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: "11px 14px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.mid,
      }}>
        <span>👁</span>
        Previewing as <strong style={{ color: C.text }}>{previewContact.name.split(" ")[0]}</strong>
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
          background: ts0.bg, color: ts0.color, border: `1px solid ${ts0.border}`,
        }}>{previewContact.track}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{
          background: "#182818", borderRadius: 20, padding: "16px 16px 20px",
          width: "100%", maxWidth: 360, border: `1px solid ${C.border}`,
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 14,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.green, display: "grid", placeItems: "center", fontSize: 16 }}>👤</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{previewContact.name.split(" ")[0]}</div>
              <div style={{ fontSize: 12, color: C.green, fontFamily: C.mono }}>online</div>
            </div>
          </div>
          <div style={{
            background: "#005c4b", borderRadius: "10px 10px 2px 10px",
            padding: "11px 14px", fontSize: 13, lineHeight: 1.7,
            fontFamily: C.mono, color: "#e8f5e8", whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>{previewMsg}</div>
          <div style={{ textAlign: "right", fontSize: 11, color: "rgba(232,245,232,0.4)", marginTop: 4, fontFamily: C.mono }}>
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
          </div>
        </div>
      </div>

      {isMobile && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setTab("send")} style={{
            width: "100%", background: canSend ? C.green : C.border,
            color: canSend ? "#000" : C.muted,
            fontFamily: C.sans, fontSize: 15, fontWeight: 800,
            padding: "14px", border: "none", borderRadius: 12, cursor: canSend ? "pointer" : "not-allowed",
          }}>{canSend ? `Send to ${selected.size} ${selected.size === 1 ? "person" : "people"} →` : "Select contacts first"}</button>
        </div>
      )}
    </div>
  );

  // ── Send panel ────────────────────────────────────────────────────────────────
  const SendPanel = (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <SectionLabel>Ready to Send</SectionLabel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Recipients", value: `${selected.size}`, sub: "selected",   color: C.accent },
          { label: "Message",    value: `${message.length}`, sub: "characters", color: C.green  },
        ].map((card) => (
          <div key={card.label} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, textAlign: "center",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color, fontFamily: C.mono }}>{card.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{card.sub}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</div>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Recipients</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...selected].map((idx) => {
              const r = REGISTRANTS[idx];
              return (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: C.card, border: `1px solid ${C.border}`,
                  padding: "6px 12px", borderRadius: 20, fontSize: 13,
                }}>
                  <span style={{ fontWeight: 700 }}>{r.name.split(" ")[0]}</span>
                  <button onClick={() => toggle(idx)} style={{
                    background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: 0, lineHeight: 1,
                  }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected.size === 0 && (
        <div style={{
          background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)",
          borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#ff6b6b",
        }}>⚠ No contacts selected. Go to Contacts to pick recipients.</div>
      )}

      {selected.size > 10 && (
        <div style={{
          background: "rgba(255,209,102,0.08)", border: `1px solid rgba(255,209,102,0.2)`,
          borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: C.warn,
        }}>⚠ Sending to {selected.size} people — WhatsApp will open one at a time.</div>
      )}

      <button onClick={startSending} disabled={!canSend} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: canSend ? C.green : C.border, color: canSend ? "#000" : C.muted,
        fontFamily: C.sans, fontSize: 16, fontWeight: 800,
        padding: "16px", border: "none", borderRadius: 12,
        cursor: canSend ? "pointer" : "not-allowed",
        boxShadow: canSend ? "0 4px 24px rgba(37,211,102,0.3)" : "none",
        transition: "all .2s",
      }}>💬 Open in WhatsApp</button>
    </div>
  );

  // ── Send modal ────────────────────────────────────────────────────────────────
  const SendModal = (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
      display: "grid", placeItems: "center", zIndex: 1000, backdropFilter: "blur(8px)", padding: 16,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 24, width: "100%", maxWidth: 460,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{done ? "🎉 All Done!" : "💬 Sending Messages"}</div>
        <div style={{ fontSize: 13, color: C.mid, marginBottom: 18 }}>
          {done ? "All chats opened. Send each message in WhatsApp." : `${sendIdx} / ${sendQueue.length} opened…`}
        </div>
        <div style={{ background: C.border, borderRadius: 4, height: 6, marginBottom: 18, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 4,
            background: `linear-gradient(90deg,${C.green},${C.accent})`,
            width: `${progress}%`, transition: "width .3s",
          }} />
        </div>
        <div style={{
          background: C.bg, borderRadius: 8, padding: 12, height: 140, overflowY: "auto",
          fontFamily: C.mono, fontSize: 12, lineHeight: 2,
        }}>
          {logs.map((l, i) => (
            <div key={i} style={{ color: l.type === "ok" ? C.green : l.type === "err" ? "#ff6b6b" : C.muted }}>{l.text}</div>
          ))}
          {!done && sendIdx < sendQueue.length && <div style={{ color: C.muted }}>Next: {sendQueue[sendIdx]?.name}…</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button onClick={() => setModal(false)} style={{
            fontFamily: C.sans, fontSize: 13, fontWeight: 700,
            padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.border}`,
            background: "transparent", color: C.text, cursor: "pointer",
          }}>Close</button>
          {!done && sendIdx < sendQueue.length && (
            <button onClick={() => { const u = openNext(sendQueue, sendIdx, logs); if (u) setLogs(u); }} style={{
              fontFamily: C.sans, fontSize: 13, fontWeight: 700,
              padding: "10px 18px", borderRadius: 8, border: "none",
              background: C.green, color: "#000", cursor: "pointer",
            }}>Open Next →</button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Desktop render ────────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{
        fontFamily: C.sans, background: C.bg, minHeight: "100vh", color: C.text,
        backgroundImage: `radial-gradient(ellipse at 15% 25%, rgba(37,211,102,0.06) 0%, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(168,255,120,0.03) 0%, transparent 50%)`,
      }}>
        {/* Header */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px", borderBottom: `1px solid ${C.border}`,
          background: "rgba(8,12,8,0.9)", backdropFilter: "blur(14px)",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: C.green, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 18 }}>💬</div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.4px" }}>
              Web3<span style={{ color: C.green }}>Nova</span>{" "}
              <span style={{ color: C.muted, fontWeight: 500, fontSize: 14 }}>DM Tool</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, fontFamily: C.mono, fontSize: 12 }}>
            {[{ label: "registrants", val: REGISTRANTS.length, accent: false }, { label: "selected", val: selected.size, accent: true }].map((s) => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, padding: "6px 14px", borderRadius: 20, color: C.mid }}>
                <span style={{ color: s.accent ? C.accent : C.green, fontWeight: 600 }}>{s.val}</span> {s.label}
              </div>
            ))}
          </div>
        </header>

        {/* 3-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 360px", minHeight: "calc(100vh - 69px)", overflow: "hidden" }}>
          <aside style={{ borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", height: "calc(100vh - 69px)", position: "sticky", top: 69 }}>
            {ContactsPanel}
          </aside>
          <div style={{ borderRight: `1px solid ${C.border}`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {ComposePanel}
          </div>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {PreviewPanel}
            <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>
              <button onClick={startSending} disabled={!canSend} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: canSend ? C.green : C.border, color: canSend ? "#000" : C.muted,
                fontFamily: C.sans, fontSize: 15, fontWeight: 800,
                padding: "14px", border: "none", borderRadius: 12,
                cursor: canSend ? "pointer" : "not-allowed",
                boxShadow: canSend ? "0 4px 24px rgba(37,211,102,0.3)" : "none",
              }}>💬 Send to {selected.size} {selected.size === 1 ? "person" : "people"}</button>
            </div>
          </div>
        </div>

        {modal && SendModal}
      </div>
    );
  }

  // ── Mobile render ─────────────────────────────────────────────────────────────
  const mobileContent: Record<Tab, React.ReactNode> = {
    contacts: ContactsPanel,
    compose:  ComposePanel,
    preview:  PreviewPanel,
    send:     SendPanel,
  };

  return (
    <div style={{ fontFamily: C.sans, background: C.bg, height: "100dvh", color: C.text, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
        background: "rgba(8,12,8,0.97)", backdropFilter: "blur(14px)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: C.green, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 15 }}>💬</div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>
            Web3<span style={{ color: C.green }}>Nova</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, fontFamily: C.mono, fontSize: 11 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 14, color: C.mid }}>
            <span style={{ color: C.accent, fontWeight: 700 }}>{selected.size}</span> sel
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 14, color: C.mid }}>
            <span style={{ color: C.green, fontWeight: 700 }}>{REGISTRANTS.length}</span> total
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {mobileContent[tab]}
      </div>

      {/* Bottom nav */}
      <nav style={{
        display: "flex", borderTop: `1px solid ${C.border}`,
        background: "rgba(8,12,8,0.97)", backdropFilter: "blur(14px)", flexShrink: 0,
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
      }}>
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const badge = t.id === "contacts" ? selected.size : t.id === "send" && selected.size > 0 ? selected.size : 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "10px 4px 10px", background: "transparent", border: "none", cursor: "pointer",
              borderTop: `2px solid ${isActive ? C.green : "transparent"}`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 3, position: "relative" }}>
                {t.emoji}
                {badge > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -8,
                    background: C.green, color: "#000",
                    fontSize: 9, fontWeight: 800, fontFamily: C.mono,
                    padding: "1px 5px", borderRadius: 10, minWidth: 16, textAlign: "center",
                  }}>{badge}</span>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? C.green : C.muted, letterSpacing: "0.3px" }}>{t.label}</div>
            </button>
          );
        })}
      </nav>

      {modal && SendModal}
    </div>
  );
}