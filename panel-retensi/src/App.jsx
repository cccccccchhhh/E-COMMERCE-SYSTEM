import React, { useState, useEffect, useRef, useCallback } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

const KEYFRAMES = `
@keyframes toastIn{from{opacity:0;transform:translateX(24px) scale(.96);}to{opacity:1;transform:translateX(0) scale(1);}}
@keyframes logIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulseBlocked{0%,100%{box-shadow:0 0 0 0 oklch(0.64 0.15 25 / 0.4),inset 0 0 22px oklch(0.64 0.15 25 / 0.1);}50%{box-shadow:0 0 0 9px oklch(0.64 0.15 25 / 0),inset 0 0 38px oklch(0.64 0.15 25 / 0.2);}}
@keyframes shakeX{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(7px);}60%{transform:translateX(-5px);}80%{transform:translateX(3px);}}
@keyframes popIn{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}
@keyframes analyzePulse{0%,100%{opacity:.35;}50%{opacity:1;}}
@keyframes blockBadgeIn{0%{transform:scale(0.6) rotate(-4deg);opacity:0;}70%{transform:scale(1.06) rotate(1deg);opacity:1;}100%{transform:scale(1) rotate(0);}}
`;

// ── SP THRESHOLD: fixed, tidak bisa diubah user ──────────────────────
const SP1_HOURS = 48;   // >48 jam  → SP1
const SP2_HOURS = 72;   // >72 jam  → SP2
const SP3_HOURS = 96;   // >96 jam  → SP3
const BLOCK_HOURS = 120; // >120 jam → Diblokir + refund

function getSpLevel(hours) {
  if (hours >= BLOCK_HOURS) return 3;
  if (hours >= SP3_HOURS)   return 2;
  if (hours >= SP2_HOURS)   return 1; // SP2 reached but not yet SP3
  if (hours >= SP1_HOURS)   return 1;
  return 0;
}

// Lebih akurat: level berdasarkan threshold berlapis
function calcSpLevel(hours) {
  if (hours >= BLOCK_HOURS) return 3;
  if (hours >= SP3_HOURS)   return 2;
  if (hours >= SP1_HOURS)   return 1;
  return 0;
}

// ── RULE-BASED SENTIMENT (dengan penanganan negasi) ───────────────────
const NEGATIVE_PATTERNS = [
  "rusak", "kecewa", "jelek", "tidak sesuai", "lambat", "buruk",
  "cacat", "mengecewakan", "parah", "jangan beli", "busuk",
  "penyok", "bocor", "sobek", "patah", "menyesal", "zonk",
  "tipu", "palsu", "bau", "kotor", "hancur", "lecet", "retak",
];

// Kata yang jika muncul sebelum kata negatif, membatalkan flag
const NEGATION_WORDS = ["tidak", "bukan", "ga", "gak", "nggak", "belum", "tanpa", "anti"];

function detectSentiment(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const flaggedWords = [];

  NEGATIVE_PATTERNS.forEach((pat) => {
    const idx = lower.indexOf(pat);
    if (idx === -1) return;

    // cek apakah ada kata negasi dalam 3 kata sebelumnya
    const before = lower.slice(Math.max(0, idx - 25), idx).trim().split(/\s+/);
    const negated = before.slice(-3).some((w) => NEGATION_WORDS.includes(w));

    if (!negated) flaggedWords.push(pat);
  });

  const score = Math.min(1, flaggedWords.length / 3); // 0..1
  return { isNegative: flaggedWords.length > 0, score, flaggedWords };
}

function highlightText(text, flaggedWords) {
  if (!flaggedWords.length) return text;
  let result = text;
  flaggedWords.forEach((w) => {
    const re = new RegExp(`(${w})`, "gi");
    result = result.replace(re, `__MARK__$1__ENDMARK__`);
  });
  return result.split(/(__MARK__|__ENDMARK__)/).map((part, i) => {
    if (i % 4 === 2) return (
      <mark key={i} style={{ background: "oklch(0.64 0.15 25 / 0.35)", color: "oklch(0.9 0.1 30)", borderRadius: 3, padding: "0 2px" }}>{part}</mark>
    );
    return part;
  });
}

const SEGMENT_DEFS = [
  { name: "Champions",    color: "oklch(0.8 0.11 68)",  pop: 27.9, rev: 79.5, revPerCustomer: 8414, treatment: "Prioritaskan akses awal produk baru dan program loyalitas eksklusif." },
  { name: "At-Risk",      color: "oklch(0.64 0.14 26)", pop: 23.2, rev: 13.0, revPerCustomer: 1655, treatment: "Kirim voucher win-back personal 10–20% dan follow-up CS proaktif secepatnya." },
  { name: "New/Promising",color: "oklch(0.72 0.08 178)",pop: 21.1, rev: 4.7,  revPerCustomer: 665,  treatment: "Dorong repeat purchase kedua dengan insentif onboarding." },
  { name: "Hibernating",  color: "oklch(0.6 0.02 60)",  pop: 27.8, rev: 2.8,  revPerCustomer: 294,  treatment: "Kampanye reaktivasi berbiaya rendah; evaluasi retensi vs churn." },
];

const ORDER_DEFS = [
  { id: 1, code: "ORD-88213", seller: "TokoBerkah Elektronik", elapsedHours: 6 },
  { id: 2, code: "ORD-88240", seller: "Griya Fashion Store",   elapsedHours: 44 },
  { id: 3, code: "ORD-88101", seller: "Sumber Rejeki Grosir",  elapsedHours: 68 },
  { id: 4, code: "ORD-87950", seller: "Kios Barokah",          elapsedHours: 90 },
  { id: 5, code: "ORD-88300", seller: "Anugerah Sport",        elapsedHours: 20 },
  { id: 6, code: "ORD-88055", seller: "Warung Digital Store",  elapsedHours: 55 },
];

const PRESET_DEFS = [
  { label: "Konsisten (positif)", rating: 5, text: "Barang sampai dengan cepat, kualitas bagus dan sesuai foto. Recommended seller!" },
  { label: "Mismatch",            rating: 5, text: "Kecewa berat, barang rusak dan tidak sesuai deskripsi." },
  { label: "Konsisten (negatif)", rating: 2, text: "Pengiriman lambat dan barangnya jelek, tidak sesuai ekspektasi." },
  { label: "Negasi (tidak rusak)",rating: 5, text: "Barang tidak rusak sama sekali, kondisi sempurna dan cepat sampai." },
];

const SP_COLORS = ["oklch(0.74 0.09 160)", "oklch(0.8 0.11 78)", "oklch(0.72 0.14 45)", "oklch(0.68 0.15 25)"];
const SP_LABELS = ["Aman", "SP1 terkirim", "SP2 — eskalasi", "Diblokir + refund"];

let nextOrderId = ORDER_DEFS.length + 1;

function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

export default function App() {
  const [orders, setOrders] = useState(() =>
    ORDER_DEFS.map((o) => ({ ...o, spLevel: calcSpLevel(o.elapsedHours), blocked: o.elapsedHours >= BLOCK_HOURS }))
  );
  const [toasts, setToasts]       = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [clock, setClock]         = useState(new Date());
  const [rating, setRating]       = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [resultBanner, setResultBanner] = useState(null);
  const [shake, setShake]         = useState(false);
  const [flagHistory, setFlagHistory] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null);

  // tambah order form
  const [newSeller, setNewSeller] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const logRef  = useRef(null);
  const logSeq  = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── SIMULASI WAKTU: 1 detik nyata = 2 menit simulasi ─────────────
  useEffect(() => {
    const SIM_MINUTES_PER_TICK = 2; // 1 detik = 2 menit simulasi
    const SIM_HOURS_PER_TICK   = SIM_MINUTES_PER_TICK / 60;

    const tickTimer = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString("id-ID", { hour12: false });
      const newLogs   = [];
      const newToasts = [];

      setOrders((prevOrders) =>
        prevOrders.map((o) => {
          if (o.spLevel >= 3) return o;
          const elapsed   = o.elapsedHours + SIM_HOURS_PER_TICK;
          const newLevel  = calcSpLevel(elapsed);
          let order       = { ...o, elapsedHours: elapsed };

          if (newLevel > o.spLevel) {
            for (let lvl = o.spLevel + 1; lvl <= newLevel; lvl++) {
              const id = ++logSeq.current;
              const thresholds = [SP1_HOURS, SP2_HOURS, SP3_HOURS, BLOCK_HOURS];
              const passed = thresholds[lvl - 1];
              if (lvl === 1) {
                newLogs.push({ id, time: nowStr, color: SP_COLORS[1], text: `SP1 otomatis terkirim ke ${o.seller} — pesanan ${o.code} melewati ${SP1_HOURS} jam.` });
                newToasts.push({ id: "t"+id, title: "SP1 terkirim", titleColor: SP_COLORS[1], body: `${o.code} · ${o.seller} melewati ${SP1_HOURS} jam.` });
              } else if (lvl === 2) {
                newLogs.push({ id, time: nowStr, color: SP_COLORS[2], text: `Eskalasi SP2 ke ${o.seller} — ${o.code} belum ada progres setelah ${SP2_HOURS} jam.` });
                newToasts.push({ id: "t"+id, title: "Eskalasi SP2", titleColor: SP_COLORS[2], body: `${o.code} · ${o.seller} — eskalasi tahap dua.` });
              } else if (lvl === 3) {
                newLogs.push({ id, time: nowStr, color: SP_COLORS[3], text: `SP3: ${o.seller} diblokir — refund ${o.code} diproses otomatis setelah ${BLOCK_HOURS} jam.` });
                newToasts.push({ id: "t"+id, title: "SP3 — toko diblokir", titleColor: SP_COLORS[3], body: `${o.code} · refund diproses ke pelanggan.` });
              }
              order.spLevel = lvl;
            }
            order.spLevel = newLevel;
            order.blocked = newLevel >= 3;
          }
          return order;
        })
      );

      if (newLogs.length) setLogEntries((p) => [...newLogs.reverse(), ...p].slice(0, 40));
      if (newToasts.length) {
        setToasts((p) => [...p, ...newToasts]);
        newToasts.forEach((t) => setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 5200));
      }
    }, 1000);
    return () => clearInterval(tickTimer);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [logEntries]);

  const applyPreset = useCallback((preset) => {
    setRating(preset.rating); setReviewText(preset.text); setResultBanner(null);
  }, []);

  const submitReview = useCallback(() => {
    if (!rating || !reviewText.trim()) return;
    setAnalyzing(true); setResultBanner(null);
    setTimeout(() => {
      const { isNegative, score, flaggedWords } = detectSentiment(reviewText);
      const isMismatch = rating >= 4 && isNegative;
      setAnalyzing(false);

      const confidenceLabel = score === 0 ? "—"
        : score < 0.34  ? "rendah"
        : score < 0.67  ? "sedang"
        : "tinggi";

      if (isMismatch) {
        setResultBanner({
          type: "mismatch",
          flaggedWords,
          text: reviewText,
          icon: "⚠",
          msg: `Rating ${rating}★ tidak konsisten dengan sentimen teks. Kata kunci terdeteksi: ${flaggedWords.join(", ")}.`,
          confidence: confidenceLabel,
          bg: "oklch(0.24 0.05 40)", border: "oklch(0.68 0.15 40 / 0.5)", fg: "oklch(0.85 0.09 55)",
        });
        setShake(true); setTimeout(() => setShake(false), 500);
        setFlagHistory((p) => [
          { id: Date.now(), time: new Date().toLocaleTimeString("id-ID", {hour12:false}), rating, text: reviewText, words: flaggedWords },
          ...p,
        ].slice(0, 10));
      } else {
        setResultBanner({
          type: "ok",
          icon: "✓",
          msg: isNegative
            ? `Sentimen negatif terdeteksi, konsisten dengan rating ${rating}★.`
            : `Ulasan terkirim — rating dan teks konsisten.`,
          confidence: confidenceLabel,
          bg: "oklch(0.24 0.05 160)", border: "oklch(0.72 0.1 160 / 0.5)", fg: "oklch(0.85 0.09 160)",
        });
      }
    }, 900);
  }, [rating, reviewText]);

  const addOrder = useCallback(() => {
    if (!newSeller.trim()) return;
    const code = `ORD-${89000 + nextOrderId}`;
    const newOrder = {
      id: nextOrderId++,
      code,
      seller: newSeller.trim(),
      elapsedHours: 0,
      spLevel: 0,
      blocked: false,
    };
    setOrders((p) => [...p, newOrder]);
    const id = ++logSeq.current;
    const nowStr = new Date().toLocaleTimeString("id-ID", {hour12:false});
    setLogEntries((p) => [{id, time: nowStr, color: SP_COLORS[0], text: `Order baru ${code} dari ${newOrder.seller} masuk ke sistem monitoring.`}, ...p].slice(0,40));
    setNewSeller(""); setShowAddForm(false);
  }, [newSeller]);

  const mono  = "'IBM Plex Mono',monospace";
  const sans  = "'Hanken Grotesk',sans-serif";
  const serif = "'Instrument Serif',serif";

  return (
    <div style={{ minHeight:"100vh", background:"oklch(0.16 0.006 55)", fontFamily:sans, color:"oklch(0.72 0.008 60)", padding:"32px 28px 60px", position:"relative", borderRadius:20 }}>
      <style>{FONTS}{KEYFRAMES}{`.num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}`}</style>

      {/* TOASTS */}
      <div style={{ position:"fixed", top:22, right:22, zIndex:200, display:"flex", flexDirection:"column", gap:10, width:340 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ display:"flex", gap:11, alignItems:"flex-start", background:"oklch(0.22 0.006 55)", border:`1px solid ${t.titleColor.replace(")","/0.4)")}`, borderRadius:13, padding:"14px 16px", boxShadow:"0 12px 32px oklch(0.1 0.01 55/0.5)", animation:"toastIn .3s cubic-bezier(.2,.9,.3,1.2)" }}>
            <div style={{ width:9, height:9, borderRadius:"50%", marginTop:5, flexShrink:0, background:t.titleColor }} />
            <div style={{flex:1}}>
              <div style={{ font:`600 12.5px ${sans}`, color:t.titleColor, marginBottom:3 }}>{t.title}</div>
              <div style={{ fontSize:12.5, lineHeight:1.45, color:"oklch(0.68 0.008 60)" }}>{t.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <header style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:32, flexWrap:"wrap", gap:20, paddingBottom:22, borderBottom:"1px solid oklch(1 0 0/0.07)" }}>
        <div>
          <div style={{ font:`500 11px ${mono}`, letterSpacing:".22em", textTransform:"uppercase", color:"oklch(0.8 0.11 68)", marginBottom:12 }}>Internal ops console</div>
          <h1 style={{ font:`400 34px/1.05 ${serif}`, margin:"0 0 10px", color:"oklch(0.96 0.005 70)", letterSpacing:"-0.01em" }}>
            Panel retensi &amp; operasional <span style={{ fontStyle:"italic", color:"oklch(0.8 0.11 68)" }}>e-commerce</span>
          </h1>
          <div style={{ fontSize:14, color:"oklch(0.6 0.008 60)", maxWidth:620, lineHeight:1.55 }}>Memantau kesehatan pelanggan dari tiga sisi — segmentasi nilai pelanggan, kepatuhan pengiriman seller, dan kesesuaian rating vs ulasan.</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div className="num" style={{ font:`400 26px ${serif}`, color:"oklch(0.96 0.005 70)", letterSpacing:".02em" }}>{clock.toLocaleTimeString("id-ID", {hour12:false})}</div>
          <div style={{ fontSize:10, color:"oklch(0.5 0.008 60)", letterSpacing:".14em", textTransform:"uppercase", fontFamily:mono }}>Waktu sistem</div>
        </div>
      </header>

      {/* ── MODUL 01: RFM ─────────────────────────────────────────── */}
      <section style={{ background:"oklch(0.205 0.006 55)", border:"1px solid oklch(1 0 0/0.07)", borderRadius:18, padding:"26px 26px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:22, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ font:`500 10.5px ${mono}`, letterSpacing:".18em", textTransform:"uppercase", color:"oklch(0.8 0.11 68)", marginBottom:7 }}>Modul 01</div>
            <h2 style={{ font:`400 22px ${serif}`, margin:0, color:"oklch(0.96 0.005 70)" }}>Peta pelanggan</h2>
          </div>
          <div style={{ fontSize:12, color:"oklch(0.5 0.008 60)", fontFamily:mono }}>RFM + K-Means · k=4 · klik segmen untuk sorot</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 200px", gap:28 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:11.5, color:"oklch(0.6 0.008 60)" }}><span style={{ width:16, height:4, borderRadius:2, background:"oklch(0.8 0.11 68)", display:"inline-block" }} />% populasi</div>
              <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:11.5, color:"oklch(0.6 0.008 60)" }}><span style={{ width:16, height:4, borderRadius:2, background:"oklch(0.55 0.008 60)", display:"inline-block" }} />% kontribusi revenue</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              {SEGMENT_DEFS.map((seg) => {
                const isActive = activeSegment === seg.name;
                return (
                  <div key={seg.name} onClick={() => setActiveSegment(isActive ? null : seg.name)}
                    style={{ cursor:"pointer", padding:"6px 8px", borderRadius:10, transition:"background .15s", background: isActive ? "oklch(0.145 0.006 55)" : "transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                      <span style={{ display:"flex", alignItems:"center", gap:9, font:`600 14px ${sans}`, color:"oklch(0.92 0.006 60)" }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", background:seg.color, display:"inline-block" }} />{seg.name}
                      </span>
                      <span className="num" style={{ font:`500 12px ${mono}`, color:"oklch(0.56 0.008 60)" }}>
                        Rp{seg.revPerCustomer.toLocaleString("id-ID")}rb/pelanggan
                      </span>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <div style={{ height:9, background:"oklch(0.145 0.006 55)", borderRadius:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${seg.pop}%`, background:seg.color, borderRadius:5, transition:"width 1s cubic-bezier(.2,.8,.2,1)" }} />
                      </div>
                      <div style={{ height:9, background:"oklch(0.145 0.006 55)", borderRadius:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${seg.rev}%`, background:"oklch(0.55 0.008 60)", borderRadius:5, transition:"width 1s cubic-bezier(.2,.8,.2,1)" }} />
                      </div>
                    </div>
                    <div className="num" style={{ display:"flex", justifyContent:"space-between", font:`400 11px ${mono}`, color:"oklch(0.48 0.008 60)", marginTop:5 }}>
                      <span>{seg.pop}% populasi</span><span>{seg.rev}% revenue</span>
                    </div>
                    {isActive && (
                      <div style={{ marginTop:10, padding:"8px 12px", background:"oklch(0.17 0.008 55)", borderLeft:`3px solid ${seg.color}`, borderRadius:"0 8px 8px 0", fontSize:12.5, color:"oklch(0.7 0.008 60)", lineHeight:1.5 }}>
                        {seg.treatment}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:8, background:"oklch(0.145 0.006 55)", border:"1px solid oklch(0.8 0.11 68/0.25)", borderRadius:14, padding:20 }}>
            <div style={{ font:`500 10px ${mono}`, letterSpacing:".14em", textTransform:"uppercase", color:"oklch(0.8 0.11 68)" }}>Sorotan</div>
            <div className="num" style={{ font:`400 42px/1 ${serif}`, color:"oklch(0.96 0.005 70)" }}>79.5%</div>
            <div style={{ fontSize:12.5, lineHeight:1.5, color:"oklch(0.6 0.008 60)" }}>revenue dihasilkan oleh <span style={{ color:"oklch(0.8 0.11 68)" }}>Champions</span> — hanya 27.9% dari basis pelanggan.</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:24 }}>
          {SEGMENT_DEFS.map((seg) => (
            <div key={seg.name} style={{ background:"oklch(0.145 0.006 55)", borderRadius:14, padding:16, borderTop:`2px solid ${seg.color}` }}>
              <div style={{ font:`600 13.5px ${sans}`, marginBottom:8, color:seg.color }}>{seg.name}</div>
              <div style={{ fontSize:12.5, lineHeight:1.55, color:"oklch(0.62 0.008 60)" }}>{seg.treatment}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MODUL 02: ANTI-DELAY ─────────────────────────────────── */}
      <section style={{ background:"oklch(0.205 0.006 55)", border:"1px solid oklch(1 0 0/0.07)", borderRadius:18, padding:"26px 26px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:16, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ font:`500 10.5px ${mono}`, letterSpacing:".18em", textTransform:"uppercase", color:"oklch(0.8 0.11 68)", marginBottom:7 }}>Modul 02</div>
            <h2 style={{ font:`400 22px ${serif}`, margin:"0 0 5px", color:"oklch(0.96 0.005 70)" }}>Monitor kepatuhan pengiriman seller</h2>
            <div style={{ fontSize:12.5, color:"oklch(0.55 0.008 60)" }}>Eskalasi otomatis SP1 → SP2 → SP3 → Blokir. Tidak ada aksi manual.</div>
          </div>

          {/* threshold info — read only, tidak bisa diubah */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {[["SP1", SP1_HOURS, SP_COLORS[1]], ["SP2", SP2_HOURS, SP_COLORS[2]], ["SP3", SP3_HOURS, SP_COLORS[3]], ["Blokir", BLOCK_HOURS, SP_COLORS[3]]].map(([label, h, col]) => (
              <div key={label} style={{ background:"oklch(0.145 0.006 55)", border:`1px solid ${col.replace(")","/0.3)")}`, borderRadius:10, padding:"7px 13px", textAlign:"center" }}>
                <div style={{ font:`500 10px ${mono}`, color:"oklch(0.5 0.008 60)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{label}</div>
                <div className="num" style={{ font:`600 14px ${mono}`, color:col }}>{">"+h}j</div>
              </div>
            ))}
          </div>
        </div>

        {/* tambah order */}
        <div style={{ marginBottom:16, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {showAddForm ? (
            <>
              <input
                value={newSeller} onChange={(e) => setNewSeller(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addOrder()}
                placeholder="Nama seller baru…"
                style={{ flex:1, minWidth:200, background:"oklch(0.145 0.006 55)", border:"1px solid oklch(1 0 0/0.1)", color:"oklch(0.9 0.006 60)", font:`400 13px ${sans}`, padding:"9px 13px", borderRadius:10 }}
              />
              <button onClick={addOrder} style={{ background:"oklch(0.8 0.11 68)", border:"none", color:"oklch(0.2 0.04 60)", font:`600 13px ${sans}`, padding:"9px 16px", borderRadius:10, cursor:"pointer" }}>
                Tambah Order
              </button>
              <button onClick={() => setShowAddForm(false)} style={{ background:"none", border:"1px solid oklch(1 0 0/0.08)", color:"oklch(0.55 0.008 60)", font:`500 13px ${sans}`, padding:"9px 13px", borderRadius:10, cursor:"pointer" }}>
                Batal
              </button>
            </>
          ) : (
            <button onClick={() => setShowAddForm(true)} style={{ background:"oklch(0.145 0.006 55)", border:"1px solid oklch(1 0 0/0.08)", color:"oklch(0.68 0.008 60)", font:`500 13px ${sans}`, padding:"9px 16px", borderRadius:10, cursor:"pointer" }}>
              + Simulasi order baru
            </button>
          )}
          <div style={{ fontSize:12, color:"oklch(0.45 0.008 60)", fontFamily:mono }}>
            Simulasi: 1 detik = 2 menit · {orders.filter(o=>o.blocked).length} toko diblokir
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:20, alignItems:"start" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:12 }}>
            {orders.map((o) => {
              // hitung progress dalam range SP saat ini
              const thresholds = [0, SP1_HOURS, SP2_HOURS, SP3_HOURS, BLOCK_HOURS];
              const start  = thresholds[Math.min(o.spLevel, 3)];
              const target = thresholds[Math.min(o.spLevel + 1, 4)];
              const pct    = o.spLevel >= 3 ? 1 : Math.max(0, Math.min(1, (o.elapsedHours - start) / (target - start)));
              const color  = SP_COLORS[o.spLevel];
              const label  = SP_LABELS[o.spLevel];
              const nextThreshold = [SP1_HOURS, SP2_HOURS, SP3_HOURS, BLOCK_HOURS][Math.min(o.spLevel, 3)];
              const remaining = Math.max(0, nextThreshold - o.elapsedHours);
              const remainingText = o.spLevel >= 3
                ? "Toko ditutup — refund diproses."
                : `${fmt1(remaining)} jam menuju ${["SP1","SP2","SP3","Blokir"][o.spLevel]}`;
              const ringPctDeg = Math.round(pct * 360);
              return (
                <div key={o.id} style={{ background: o.blocked ? "oklch(0.24 0.06 25)" : "oklch(0.16 0.006 55)", border: o.blocked ? "1px solid oklch(0.68 0.15 25/0.7)" : "1px solid oklch(1 0 0/0.06)", borderRadius:14, padding:"14px 15px", animation: o.blocked ? "pulseBlocked 1.6s ease infinite" : "none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <div className="num" style={{ font:`500 13px ${mono}`, color:"oklch(0.9 0.006 60)" }}>{o.code}</div>
                      <div style={{ fontSize:11.5, color:"oklch(0.55 0.008 60)", marginTop:3 }}>{o.seller}</div>
                    </div>
                    <div style={{ font:`500 10.5px ${mono}`, letterSpacing:".02em", color, background:color.replace(")","/0.14)"), padding:"4px 9px", borderRadius:6, whiteSpace:"nowrap" }}>{label}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:52, height:52, borderRadius:"50%", flexShrink:0, background:`conic-gradient(${color} ${ringPctDeg}deg, oklch(0.28 0.006 55) ${ringPctDeg}deg 360deg)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ width:41, height:41, borderRadius:"50%", background:"oklch(0.205 0.006 55)", display:"flex", alignItems:"center", justifyContent:"center", color }}>
                        <div className="num" style={{ font:`500 12px ${mono}` }}>{fmt1(o.elapsedHours)}h</div>
                      </div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11.5, color:"oklch(0.58 0.008 60)", lineHeight:1.45 }}>{remainingText}</div>
                    </div>
                  </div>
                  {o.blocked && (
                    <div style={{ marginTop:11, background:"oklch(0.6 0.17 25)", color:"oklch(0.98 0.01 60)", font:`700 11px ${sans}`, padding:"7px 9px", borderRadius:9, textAlign:"center", animation:"blockBadgeIn .5s cubic-bezier(.34,1.56,.64,1)" }}>
                      Toko diblokir — refund diproses
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* LOG */}
          <div style={{ background:"oklch(0.115 0.006 55)", border:"1px solid oklch(1 0 0/0.05)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", height:420 }}>
            <div style={{ font:`500 10px ${mono}`, letterSpacing:".12em", textTransform:"uppercase", color:"oklch(0.55 0.008 60)", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"oklch(0.74 0.09 160)", animation:"analyzePulse 2s ease infinite", display:"inline-block" }} />
              Log aktivitas sistem — real-time
            </div>
            <div ref={logRef} style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
              {logEntries.map((l) => (
                <div key={l.id} style={{ animation:"logIn .35s ease", font:`400 11.5px/1.5 ${mono}`, color:l.color, borderLeft:`2px solid ${l.color}`, padding:"6px 10px", background:"oklch(0.16 0.006 55)", borderRadius:"0 7px 7px 0" }}>
                  <span style={{ color:"oklch(0.44 0.008 60)" }}>[{l.time}]</span> {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MODUL 03: AI TEXT ENGINE ──────────────────────────────── */}
      <section style={{ background:"oklch(0.205 0.006 55)", border:"1px solid oklch(1 0 0/0.07)", borderRadius:18, padding:"26px 26px" }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ font:`500 10.5px ${mono}`, letterSpacing:".18em", textTransform:"uppercase", color:"oklch(0.8 0.11 68)", marginBottom:7 }}>Modul 03</div>
          <h2 style={{ font:`400 22px ${serif}`, margin:"0 0 5px", color:"oklch(0.96 0.005 70)" }}>Deteksi kesesuaian rating vs ulasan</h2>
          <div style={{ fontSize:12.5, color:"oklch(0.55 0.008 60)" }}>Rule-based: pencocokan kata kunci dengan penanganan negasi ("tidak rusak" tidak ter-flag). Placeholder untuk model TF-IDF/SVM terlatih.</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          {/* INPUT */}
          <div style={{ animation: shake ? "shakeX .45s ease" : "none" }}>
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              {PRESET_DEFS.map((p) => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{ background:"oklch(0.145 0.006 55)", border:"1px solid oklch(1 0 0/0.08)", color:"oklch(0.68 0.008 60)", font:`500 11.5px ${mono}`, padding:"8px 13px", borderRadius:9, cursor:"pointer" }}>{p.label}</button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14 }}>
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => { setRating(n); setResultBanner(null); }} style={{ background:"none", border:"none", fontSize:30, cursor:"pointer", lineHeight:1, padding:0, color: n<=rating ? "oklch(0.8 0.11 68)" : "oklch(0.32 0.006 55)", transition:"color .15s ease" }}>★</button>
              ))}
            </div>
            <textarea placeholder="Tulis ulasan di sini…" value={reviewText} onChange={(e) => { setReviewText(e.target.value); setResultBanner(null); }}
              style={{ width:"100%", minHeight:110, background:"oklch(0.145 0.006 55)", border:"1px solid oklch(1 0 0/0.08)", borderRadius:12, color:"oklch(0.9 0.006 60)", font:`400 14px/1.5 ${sans}`, padding:13, resize:"vertical", boxSizing:"border-box" }} />
            <button onClick={submitReview} style={{ marginTop:12, width:"100%", background:"oklch(0.8 0.11 68)", border:"none", color:"oklch(0.2 0.04 60)", font:`700 14px ${sans}`, padding:13, borderRadius:12, cursor:"pointer" }}>Kirim ulasan</button>

            {analyzing && <div style={{ marginTop:12, font:`500 12px ${mono}`, color:"oklch(0.8 0.11 68)", animation:"analyzePulse 1s ease infinite" }}>Menganalisis teks ulasan…</div>}

            {resultBanner && (
              <div style={{ marginTop:12, background:resultBanner.bg, border:`1px solid ${resultBanner.border}`, color:resultBanner.fg, padding:"13px 15px", borderRadius:12, animation:"popIn .3s ease" }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ fontSize:18 }}>{resultBanner.icon}</div>
                  <div style={{ font:`500 13px/1.45 ${sans}` }}>{resultBanner.msg}</div>
                </div>
                {resultBanner.type === "mismatch" && resultBanner.flaggedWords.length > 0 && (
                  <div style={{ fontSize:12.5, lineHeight:1.6, fontFamily:sans, marginTop:6, padding:"8px 10px", background:"oklch(0 0 0/0.2)", borderRadius:8 }}>
                    <span style={{ fontFamily:mono, fontSize:11, color:"oklch(0.6 0.008 60)", marginRight:6 }}>teks ter-flag:</span>
                    {highlightText(reviewText, resultBanner.flaggedWords)}
                  </div>
                )}
                <div style={{ marginTop:8, font:`500 11px ${mono}`, color:"oklch(0.6 0.01 60)", letterSpacing:".05em" }}>
                  Confidence sinyal negatif: <span style={{ color:resultBanner.fg }}>{resultBanner.confidence}</span>
                </div>
              </div>
            )}
          </div>

          {/* KANAN: statistik + riwayat flag */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:"oklch(0.145 0.006 55)", borderRadius:14, padding:20 }}>
              <div style={{ font:`500 10px ${mono}`, letterSpacing:".12em", textTransform:"uppercase", color:"oklch(0.55 0.008 60)", marginBottom:14 }}>Penyebab ulasan negatif — historis</div>
              <div style={{ display:"flex", height:34, borderRadius:10, overflow:"hidden", marginBottom:10 }}>
                <div className="num" style={{ width:"48.2%", background:"oklch(0.72 0.08 178)", display:"flex", alignItems:"center", justifyContent:"center", font:`600 12.5px ${sans}`, color:"oklch(0.18 0.03 178)" }}>48.2%</div>
                <div className="num" style={{ width:"51.8%", background:"oklch(0.8 0.11 68)", display:"flex", alignItems:"center", justifyContent:"center", font:`600 12.5px ${sans}`, color:"oklch(0.2 0.04 60)" }}>51.8%</div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11.5, color:"oklch(0.6 0.008 60)", flexWrap:"wrap", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:8, height:8, borderRadius:2, background:"oklch(0.72 0.08 178)", display:"inline-block" }} />Terkait pengiriman/kemasan</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ width:8, height:8, borderRadius:2, background:"oklch(0.8 0.11 68)", display:"inline-block" }} />Penyebab lain</div>
              </div>
            </div>

            {/* RIWAYAT FLAG */}
            <div style={{ background:"oklch(0.145 0.006 55)", borderRadius:14, padding:16, flex:1 }}>
              <div style={{ font:`500 10px ${mono}`, letterSpacing:".12em", textTransform:"uppercase", color:"oklch(0.55 0.008 60)", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>Riwayat ulasan ter-flag ({flagHistory.length})</span>
                {flagHistory.length > 0 && (
                  <button onClick={() => setFlagHistory([])} style={{ background:"none", border:"none", color:"oklch(0.48 0.008 60)", font:`500 10px ${mono}`, cursor:"pointer" }}>hapus</button>
                )}
              </div>
              {flagHistory.length === 0 ? (
                <div style={{ fontSize:12, color:"oklch(0.42 0.008 60)", textAlign:"center", padding:"20px 0" }}>Belum ada ulasan ter-flag sesi ini</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:220, overflowY:"auto" }}>
                  {flagHistory.map((f) => (
                    <div key={f.id} style={{ padding:"9px 12px", background:"oklch(0.17 0.008 55)", borderLeft:"2px solid oklch(0.64 0.14 26)", borderRadius:"0 8px 8px 0" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ font:`600 11px ${mono}`, color:"oklch(0.64 0.14 26)" }}>★{f.rating} mismatch</span>
                        <span style={{ font:`400 10px ${mono}`, color:"oklch(0.44 0.008 60)" }}>[{f.time}]</span>
                      </div>
                      <div style={{ fontSize:12, color:"oklch(0.62 0.008 60)", lineHeight:1.4 }}>
                        {f.text.length > 80 ? f.text.slice(0, 80) + "…" : f.text}
                      </div>
                      <div style={{ marginTop:4, fontSize:11, color:"oklch(0.55 0.008 60)", fontFamily:mono }}>
                        kata kunci: {f.words.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
