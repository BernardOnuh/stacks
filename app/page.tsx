"use client";

import { useState, useMemo, useCallback, useEffect, CSSProperties } from "react";

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

// ─── Data ─────────────────────────────────────────────────────────────────────

const REGISTRANTS: Registrant[] = [
  {name:"Maebi Maclean",phone:"08029373120",track:"UI/UX",location:"Futa",level:"Beginner",twitter:"@horiznmac"},
  {name:"Vivian Okosun",phone:"09079839008",track:"Blockchain",location:"Futa",level:"Beginner",twitter:"@viv_ifox"},
  {name:"Gabriel Oyinlola",phone:"09136287397",track:"Web Dev",location:"Abeokuta",level:"Intermediate",twitter:"Oyinlola Gabriel"},
  {name:"Ambrose Joseph Jere",phone:"08148708918",track:"Blockchain",location:"Jos",level:"Beginner",twitter:"@jere45updates"},
  {name:"Stephen Dauda",phone:"09064601196",track:"Blockchain",location:"Online",level:"Beginner",twitter:"Chimiofweb3"},
  {name:"Bello Habeebullah Adedipupo",phone:"08137811585",track:"UI/UX",location:"Online",level:"Beginner",twitter:"BeLLoXXii"},
  {name:"Njemurim Edem",phone:"09154495001",track:"Blockchain",location:"Online",level:"Intermediate",twitter:"Njemurim."},
  {name:"Oke Donald",phone:"09064286190",track:"UI/UX",location:"Lagos",level:"Beginner",twitter:"Donald64434oke"},
  {name:"Goodness Ikubuwaje",phone:"08147494896",track:"Blockchain",location:"Futa",level:"Beginner",twitter:"xxmonero"},
  {name:"Imadiyi Iguodala Joel",phone:"09060884117",track:"Blockchain",location:"Futa",level:"Intermediate",twitter:"Cryptomanic137"},
  {name:"Osakwe Samuel Oluwadarasimi",phone:"08122559307",track:"Web Dev",location:"Ibadan",level:"Beginner",twitter:"Osakwe Samuel"},
  {name:"Gabriel Chimezie Nwogbo",phone:"09033145602",track:"Blockchain",location:"Online",level:"Beginner",twitter:"@skylordmiles"},
  {name:"Ajibola Michael",phone:"08136878310",track:"Blockchain",location:"Futa",level:"Advanced",twitter:"AjibolaMik658"},
  {name:"Peace Ayinla",phone:"08148746237",track:"UI/UX",location:"Futa",level:"Beginner",twitter:"@AyinlaGrafix"},
  {name:"Emmanuel Omolafe Omotosho",phone:"07081889966",track:"Web Dev",location:"Akungba",level:"Beginner",twitter:"Omolafe Emmanuel"},
  {name:"Okpare Ufuoma Peace",phone:"09071141064",track:"Web Dev",location:"Online",level:"Beginner",twitter:"@OkpareU"},
  {name:"Taofeeq Mukhtar Akorede",phone:"07030130058",track:"Blockchain",location:"Ile Ife",level:"Intermediate",twitter:"@Smart0058"},
  {name:"Itoro Daniel",phone:"08130312380",track:"Blockchain",location:"Virtual",level:"Intermediate",twitter:"Adiaha_aity"},
  {name:"Patience Igwe",phone:"09033643902",track:"Blockchain",location:"Lagos",level:"Beginner",twitter:"Official_omaah_"},
  {name:"Chukwu Judith",phone:"08057219649",track:"Web Dev",location:"Abuja",level:"Advanced",twitter:"Judyyliah"},
  {name:"Nwachukwu Esther",phone:"09024409762",track:"Blockchain",location:"Abuja",level:"Beginner",twitter:"Es_ty101"},
  {name:"Edu Aisha",phone:"09011394495",track:"UI/UX",location:"Lagos",level:"Intermediate",twitter:"Eniola."},
  {name:"Oremei Akande",phone:"08028402202",track:"Blockchain",location:"Ibadan",level:"Advanced",twitter:"@OremeiPraise"},
  {name:"Eteng Obaseoyi Ikpi",phone:"09161970780",track:"UI/UX",location:"Calabar",level:"Beginner",twitter:"Dolph club"},
  {name:"Emmanuella Onuekwutu",phone:"09160087726",track:"Web Dev",location:"Lagos",level:"Beginner",twitter:"@Onuekwutunam"},
  {name:"Fajimi Abdulsamad Ayotomiwa",phone:"08169571781",track:"Blockchain",location:"Oyo State",level:"Intermediate",twitter:"Phajbaba001"},
  {name:"Abdulkarim Naja'atu",phone:"09138890055",track:"Blockchain",location:"Abuja",level:"Beginner",twitter:"atu_naja8946"},
  {name:"Olubusola Odunuga-Adebiyi",phone:"08034616060",track:"UI/UX",location:"Lagos",level:"Intermediate",twitter:"Olubusolamitee"},
  {name:"Babatunde Timileyin",phone:"08169433210",track:"Blockchain",location:"Futa",level:"Beginner",twitter:"@temmybabs105"},
  {name:"Peters Juwon Esther",phone:"07017773503",track:"Blockchain",location:"Ibadan",level:"Intermediate",twitter:"@juwon_peters_"},
  {name:"Akerele Divine",phone:"09011492036",track:"Blockchain",location:"Futa",level:"Beginner",twitter:"D_kidART"},
  {name:"Aiki Muhammad Olanrewaju",phone:"09155604600",track:"Web Dev",location:"Futa",level:"Beginner",twitter:"Iykelanre"},
  {name:"Roseline Adeola Adebayo",phone:"08163209560",track:"Blockchain",location:"Ife",level:"Beginner",twitter:"@RoselineAdebay2"},
  {name:"Michael Nkariko",phone:"08133122266",track:"Web Dev",location:"Akure",level:"Intermediate",twitter:"Michael nkariko"},
];

const DEFAULT_MSG = `Hi {{name}}! 👋

I'm the founder of Web3Nova. I saw your application to learn *{{track}}* and I'm impressed by your interest! 🚀

We'd love to have you join us officially — register for *Cohort III* here 👇

https://web3nova.org/register

Cohort III kicks off the *first week of April* — spots are limited, so register soon!

See you on the inside 💪
— Web3Nova`;

const TEMPLATES: Template[] = [
  { title:"Cohort III Invite", emoji:"🚀", text: DEFAULT_MSG },
  { title:"Welcome", emoji:"👋", text:`Hi {{name}}! 👋\n\nWelcome to Web3Nova Bootcamp! 🚀\n\nWe're thrilled to have you on the *{{track}}* track. Get ready for an incredible journey!\n\nStay active in our community channels — see you soon! 💪` },
  { title:"Kickoff", emoji:"🎉", text:`Hello {{name}}! 🎉\n\nOur Web3Nova Cohort officially kicks off this week!\n\nYou're registered for *{{track}}* — check your email for onboarding details and the Zoom link.\n\nSee you there! 🔥` },
  { title:"Class Reminder", emoji:"⏰", text:`Hey {{name}}! ⏰\n\nQuick reminder — your *{{track}}* class holds today.\n\nGet your tools ready and show up to learn. Let's build something great together! 👨‍💻` },
  { title:"Assignment", emoji:"📋", text:`Hi {{name}} 👩‍💻\n\nA new assignment just dropped for *{{track}}*!\n\nLog in to your dashboard to view details. Deadline is 72 hours — don't wait! Good luck! 🙌` },
  { title:"Custom", emoji:"✏️", text:`` },
];

const TRACK_STYLE: Record<string, TrackStyle> = {
  "Blockchain": { bg:"rgba(37,211,102,0.12)", color:"#25D366",  border:"rgba(37,211,102,0.25)" },
  "Web Dev":    { bg:"rgba(168,255,120,0.1)",  color:"#a8ff78",  border:"rgba(168,255,120,0.25)" },
  "UI/UX":      { bg:"rgba(255,209,102,0.1)",  color:"#ffd166",  border:"rgba(255,209,102,0.25)" },
};

const FILTERS: string[] = ["All","Blockchain","Web Dev","UI/UX","Futa","Online"];

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Web3NovaDMTool() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState<string>("");
  const [message, setMessage] = useState<string>(DEFAULT_MSG);
  const [activeTpl, setActiveTpl] = useState<number>(0);
  const [modal, setModal] = useState<boolean>(false);
  const [sendIdx, setSendIdx] = useState<number>(0);
  const [sendQueue, setSendQueue] = useState<Registrant[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [done, setDone] = useState<boolean>(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
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
        (filter === "Futa" && r.location.toLowerCase().includes("futa")) ||
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
      setSelected((prev) => {
        const n = new Set(prev);
        visible.forEach((r) => n.add(REGISTRANTS.indexOf(r)));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        visible.forEach((r) => n.delete(REGISTRANTS.indexOf(r)));
        return n;
      });
    }
  };

  const pickTemplate = (i: number) => {
    setActiveTpl(i);
    setMessage(TEMPLATES[i].text);
  };

  const insertVar = (v: string) => {
    const ta = document.getElementById("msg-ta") as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart ?? message.length;
    const e = ta.selectionEnd ?? message.length;
    setMessage(message.slice(0, s) + v + message.slice(e));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + v.length, s + v.length);
    }, 0);
  };

  const previewContact: Registrant =
    selected.size > 0 ? REGISTRANTS[[...selected][0]] : REGISTRANTS[0];
  const previewMsg = message
    ? resolveMsg(message, previewContact)
    : "Your message will appear here…";

  const canSend = selected.size > 0 && message.trim() !== "";

  const openNext = (
    queue: Registrant[],
    idx: number,
    currentLogs: LogEntry[]
  ): LogEntry[] | undefined => {
    if (idx >= queue.length) {
      setDone(true);
      return;
    }
    const r = queue[idx];
    const phone = normalizePhone(r.phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(resolveMsg(message, r))}`;
    window.open(url, "_blank");
    const newLog: LogEntry = { text: `✅ Opened chat for ${r.name}`, type: "ok" };
    const updated = [...currentLogs, newLog];
    setLogs(updated);
    setSendIdx(idx + 1);
    if (idx + 1 >= queue.length) setDone(true);
    return updated;
  };

  const startSending = () => {
    const queue = [...selected].map((i) => REGISTRANTS[i]);
    setSendQueue(queue);
    setSendIdx(0);
    setLogs([]);
    setDone(false);
    setModal(true);
    openNext(queue, 0, []);
  };

  const progress = sendQueue.length
    ? Math.round((sendIdx / sendQueue.length) * 100)
    : 0;

  // ── Styles ──────────────────────────────────────────────────────────────────

  const root: CSSProperties = {
    fontFamily: "'Syne', sans-serif",
    background: "#080c08",
    minHeight: "100vh",
    color: "#e4ede4",
    backgroundImage:
      "radial-gradient(ellipse at 15% 25%, rgba(37,211,102,0.06) 0%, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(168,255,120,0.03) 0%, transparent 50%)",
  };

  return (
    <div style={root}>
      {/* HEADER */}
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px", borderBottom: "1px solid #1a2a1a",
          background: "rgba(8,12,8,0.85)", backdropFilter: "blur(14px)",
          position: "sticky", top: 0, zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, background: "#25D366", borderRadius: 10,
            display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0,
          }}>💬</div>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.4px" }}>
            Web3<span style={{ color: "#25D366" }}>Nova</span>{" "}
            <span style={{ color: "#4a5e4a", fontWeight: 500, fontSize: 14 }}>DM Tool</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
          {[
            { label: "registrants", val: REGISTRANTS.length, accent: false },
            { label: "selected", val: selected.size, accent: true },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#111811", border: "1px solid #1a2a1a",
              padding: "6px 14px", borderRadius: 20, color: "#5a7a5a",
            }}>
              <span style={{ color: s.accent ? "#a8ff78" : "#25D366", fontWeight: 600 }}>{s.val}</span>{" "}{s.label}
            </div>
          ))}
        </div>
      </header>

      {/* LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "calc(100vh - 69px)" }}>

        {/* SIDEBAR */}
        <aside style={{ borderRight: "1px solid #1a2a1a", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Search */}
          <div style={{ padding: "16px", borderBottom: "1px solid #1a2a1a", background: "#0e140e" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#4a5e4a", marginBottom: 10 }}>
              Registrants
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#4a5e4a" }}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, track, city…"
                style={{
                  width: "100%", background: "#141c14", border: "1px solid #1a2a1a",
                  color: "#e4ede4", fontFamily: "'DM Mono',monospace", fontSize: 12,
                  padding: "9px 12px 9px 34px", borderRadius: 8, outline: "none",
                }}
              />
            </div>
          </div>

          {/* Filters */}
          <div style={{
            display: "flex", gap: 6, padding: "10px 14px", borderBottom: "1px solid #1a2a1a",
            background: "#0e140e", overflowX: "auto",
          }}>
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                whiteSpace: "nowrap", fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700,
                padding: "5px 12px", borderRadius: 20, border: "1px solid",
                cursor: "pointer", transition: "all .15s",
                borderColor: filter === f ? "#25D366" : "#1a2a1a",
                background: filter === f ? "rgba(37,211,102,0.12)" : "transparent",
                color: filter === f ? "#25D366" : "#4a5e4a",
              }}>{f}</button>
            ))}
          </div>

          {/* Select All */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 14px", borderBottom: "1px solid #1a2a1a",
            background: "#0e140e", fontSize: 12,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#5a7a5a" }}>
              <input
                type="checkbox"
                onChange={(e) => toggleAll(e.target.checked)}
                checked={visible.length > 0 && visible.every((r) => selected.has(REGISTRANTS.indexOf(r)))}
                style={{ accentColor: "#25D366" }}
              />
              Select all visible
            </label>
            <span style={{ fontFamily: "'DM Mono',monospace", color: "#a8ff78", fontWeight: 600, fontSize: 11 }}>
              {selected.size} selected
            </span>
          </div>

          {/* Contact List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {visible.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4a5e4a", fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>No results
              </div>
            ) : (
              visible.map((r) => {
                const idx = REGISTRANTS.indexOf(r);
                const isSel = selected.has(idx);
                const ts: TrackStyle = TRACK_STYLE[r.track] ?? TRACK_STYLE["Blockchain"];
                return (
                  <div
                    key={idx}
                    onClick={() => toggle(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: 11,
                      padding: "11px 14px", cursor: "pointer",
                      borderBottom: "1px solid rgba(26,42,26,0.5)",
                      background: isSel ? "rgba(37,211,102,0.07)" : "transparent",
                      transition: "background .12s",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `1.5px solid ${isSel ? "#25D366" : "#1a2a1a"}`,
                      background: isSel ? "#25D366" : "#141c14",
                      display: "grid", placeItems: "center",
                      fontSize: 11, color: "#000", fontWeight: 700, transition: "all .15s",
                    }}>{isSel ? "✓" : ""}</div>

                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "#1a2a1a", color: "#a8ff78",
                      display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800,
                    }}>{getInitials(r.name)}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#4a5e4a", marginTop: 1 }}>{r.phone}</div>
                    </div>

                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                      background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>{r.track}</span>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ padding: "24px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Templates */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#4a5e4a", marginBottom: 12 }}>
              Quick Templates
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px,1fr))", gap: 10 }}>
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => pickTemplate(i)} style={{
                  background: activeTpl === i ? "rgba(37,211,102,0.07)" : "#111811",
                  border: `1px solid ${activeTpl === i ? "#25D366" : "#1a2a1a"}`,
                  borderRadius: 10, padding: "13px 14px", cursor: "pointer",
                  textAlign: "left", transition: "all .15s", color: "inherit",
                  position: "relative", overflow: "hidden",
                }}>
                  {activeTpl === i && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#25D366,#a8ff78)" }} />
                  )}
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{t.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: activeTpl === i ? "#25D366" : "#e4ede4" }}>{t.title}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Composer */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#4a5e4a", marginBottom: 12 }}>
              Compose Message
            </div>
            <div style={{ background: "#111811", border: "1px solid #1a2a1a", borderRadius: 12, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 14px", borderBottom: "1px solid #1a2a1a", background: "#0e140e",
              }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {["{{name}}", "{{track}}", "{{location}}", "{{level}}"].map((v) => (
                    <button key={v} onClick={() => insertVar(v)} style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 500,
                      padding: "4px 10px", borderRadius: 6, border: "1px solid #1a2a1a",
                      background: "transparent", color: "#25D366", cursor: "pointer",
                    }}>{v}</button>
                  ))}
                </div>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#4a5e4a" }}>{message.length} chars</span>
              </div>
              <textarea
                id="msg-ta"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={"Type your message here…\n\nUse {{name}}, {{track}}, {{location}} as placeholders."}
                rows={8}
                style={{
                  width: "100%", background: "transparent", border: "none",
                  color: "#e4ede4", fontFamily: "'DM Mono',monospace", fontSize: 13,
                  lineHeight: 1.75, padding: "16px", outline: "none", resize: "none",
                  minHeight: 170,
                }}
              />
            </div>
          </section>

          {/* Preview */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#4a5e4a", marginBottom: 12 }}>
              Preview
            </div>
            <div style={{ background: "#111811", border: "1px solid #1a2a1a", borderRadius: 12, padding: 20 }}>
              <div style={{
                background: "#182818", borderRadius: 18, padding: "16px 16px 20px",
                maxWidth: 300, margin: "0 auto", border: "1px solid #1a2a1a",
                boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 14,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", background: "#25D366",
                    display: "grid", placeItems: "center", fontSize: 15, flexShrink: 0,
                  }}>👤</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{previewContact.name.split(" ")[0]}</div>
                    <div style={{ fontSize: 11, color: "#25D366", fontFamily: "'DM Mono',monospace" }}>online</div>
                  </div>
                </div>
                <div style={{
                  background: "#005c4b", borderRadius: "8px 8px 0 8px",
                  padding: "10px 13px", fontSize: 13, lineHeight: 1.65,
                  fontFamily: "'DM Mono',monospace", color: "#e8f5e8",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{previewMsg}</div>
                <div style={{ textAlign: "right", fontSize: 10, color: "rgba(232,245,232,0.4)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          </section>

          {/* Send */}
          <div style={{
            background: "#111811", border: "1px solid #1a2a1a", borderRadius: 12,
            padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          }}>
            <div style={{ fontSize: 13, color: "#5a7a5a" }}>
              Ready to send to{" "}
              <span style={{ color: "#e4ede4", fontWeight: 700 }}>{selected.size} {selected.size === 1 ? "person" : "people"}</span>
              {selected.size > 10 && (
                <><br /><span style={{ color: "#ffd166", fontSize: 12 }}>⚠ WhatsApp will open for each recipient</span></>
              )}
            </div>
            <button
              onClick={startSending}
              disabled={!canSend}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                background: canSend ? "#25D366" : "#1a2a1a",
                color: canSend ? "#000" : "#3a4e3a",
                fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800,
                padding: "12px 26px", border: "none", borderRadius: 10,
                cursor: canSend ? "pointer" : "not-allowed", transition: "all .2s",
                boxShadow: canSend ? "0 4px 20px rgba(37,211,102,0.25)" : "none",
              }}
            >
              💬 Open in WhatsApp
            </button>
          </div>
        </main>
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
          display: "grid", placeItems: "center", zIndex: 1000, backdropFilter: "blur(8px)",
        }}>
          <div style={{
            background: "#111811", border: "1px solid #1a2a1a", borderRadius: 16,
            padding: 28, width: 460, maxWidth: "94vw",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {done ? "🎉 All Done!" : "💬 Sending Messages"}
            </div>
            <div style={{ fontSize: 13, color: "#5a7a5a", marginBottom: 18 }}>
              {done
                ? "All chats opened in WhatsApp. Send each message manually."
                : `${sendIdx} / ${sendQueue.length} opened…`}
            </div>

            <div style={{ background: "#1a2a1a", borderRadius: 4, height: 6, marginBottom: 18, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: "linear-gradient(90deg,#25D366,#a8ff78)",
                width: `${progress}%`, transition: "width .3s",
              }} />
            </div>

            <div style={{
              background: "#080c08", borderRadius: 8, padding: 14,
              height: 150, overflowY: "auto",
              fontFamily: "'DM Mono',monospace", fontSize: 12, lineHeight: 2,
            }}>
              {logs.map((l, i) => (
                <div key={i} style={{ color: l.type === "ok" ? "#25D366" : l.type === "err" ? "#ff6b6b" : "#4a5e4a" }}>
                  {l.text}
                </div>
              ))}
              {!done && sendIdx < sendQueue.length && (
                <div style={{ color: "#4a5e4a" }}>Next: {sendQueue[sendIdx]?.name}…</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{
                fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                padding: "9px 18px", borderRadius: 8, border: "1px solid #1a2a1a",
                background: "transparent", color: "#e4ede4", cursor: "pointer",
              }}>Close</button>

              {!done && sendIdx < sendQueue.length && (
                <button
                  onClick={() => {
                    const updated = openNext(sendQueue, sendIdx, logs);
                    if (updated) setLogs(updated);
                  }}
                  style={{
                    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                    padding: "9px 18px", borderRadius: 8, border: "none",
                    background: "#25D366", color: "#000", cursor: "pointer",
                  }}
                >
                  Open Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}