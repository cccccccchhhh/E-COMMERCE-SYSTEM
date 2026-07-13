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

const NEGATIVE_WORDS = ["rusak", "kecewa", "kecewa berat", "jelek", "tidak sesuai", "lambat", "buruk", "cacat", "mengecewakan", "parah", "jangan beli", "busuk", "penyok", "bocor", "sobek", "patah", "menyesal"];

const SEGMENT_DEFS = [
  { name: "Champions", color: "oklch(0.8 0.11 68)", pop: 27.9, rev: 79.5, revPerCustomer: 8414, treatment: "Prioritaskan akses awal produk baru dan program loyalitas eksklusif." },
  { name: "At-Risk", color: "oklch(0.64 0.14 26)", pop: 23.2, rev: 13.0, revPerCustomer: null, treatment: "Kirim voucher win-back personal dan follow-up CS proaktif secepatnya." },
  { name: "New/Promising", color: "oklch(0.72 0.08 178)", pop: 21.1, rev: 4.7, revPerCustomer: null, treatment: "Dorong repeat purchase kedua dengan insentif onboarding." },
  { name: "Hibernating", color: "oklch(0.6 0.02 60)", pop: 27.8, rev: 2.8, revPerCustomer: null, treatment: "Kampanye reaktivasi berbiaya rendah; evaluasi retensi vs churn." },
];

const ORDER_DEFS = [
  { id: 1, code: "ORD-88213", seller: "TokoBerkah Elektronik", elapsedHours: 6 },
  { id: 2, code: "ORD-88240", seller: "Griya Fashion Store", elapsedHours: 44 },
  { id: 3, code: "ORD-88101", seller: "Sumber Rejeki Grosir", elapsedHours: 92 },
  { id: 4, code: "ORD-87950", seller: "Kios Barokah", elapsedHours: 140 },
  { id: 5, code: "ORD-88300", seller: "Anugerah Sport", elapsedHours: 20 },
  { id: 6, code: "ORD-88055", seller: "Warung Digital Store", elapsedHours: 70 },
];

const PRESET_DEFS = [
  { label: "Konsisten (positif)", rating: 5, text: "Barang sampai dengan cepat, kualitas bagus dan sesuai foto. Recommended seller!" },
  { label: "Mismatch", rating: 5, text: "Kecewa berat, barang rusak dan tidak sesuai deskripsi." },
  { label: "Konsisten (negatif)", rating: 2, text: "Pengiriman lambat dan barangnya jelek, tidak sesuai ekspektasi." },
];

const SP_COLORS = ["oklch(0.74 0.09 160)", "oklch(0.8 0.11 78)", "oklch(0.72 0.14 45)", "oklch(0.68 0.15 25)"];
const SP_LABELS = ["Aman", "SP1 terkirim", "SP2 — eskalasi", "Diblokir dan refund"];

function fmt1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export default function App() {
  const [threshold, setThreshold] = useState(48);
  const [orders, setOrders] = useState(() =>
    ORDER_DEFS.map((o) => ({ ...o, spLevel: Math.min(3, Math.floor(o.elapsedHours / 48)), blocked: o.elapsedHours >= 144 }))
  );
  const [toasts, setToasts] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [clock, setClock] = useState(new Date());
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [resultBanner, setResultBanner] = useState(null);
  const [shake, setShake] = useState(false);

  const logRef = useRef(null);
  const logSeq = useRef(0);

  useEffect(() => {
    const clockTimer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const tickTimer = setInterval(() => {
      const nowStr = new Date().toLocaleTimeString("id-ID", { hour12: false });
      const newLogs = [];
      const newToasts = [];

      setOrders((prevOrders) =>
        prevOrders.map((o) => {
          if (o.spLevel >= 3) return o;
          const elapsed = o.elapsedHours + 0.9;
          const newLevel = Math.min(3, Math.floor(elapsed / threshold));
          let order = { ...o, elapsedHours: elapsed };
          if (newLevel > o.spLevel) {
            for (let lvl = o.spLevel + 1; lvl <= newLevel; lvl++) {
              const id = ++logSeq.current;
              if (lvl === 1) {
                newLogs.push({ id, time: nowStr, color: SP_COLORS[1], text: `Peringatan SP1 otomatis terkirim ke ${o.seller} — pesanan ${o.code} melewati ${threshold} jam.` });
                newToasts.push({ id: "toast-" + id, title: "SP1 terkirim", titleColor: SP_COLORS[1], body: `${o.code} · ${o.seller} melewati ambang batas ${threshold} jam.` });
              } else if (lvl === 2) {
                newLogs.push({ id, time: nowStr, color: SP_COLORS[2], text: `Eskalasi SP2 ke ${o.seller} — pesanan ${o.code} belum ada progres pengiriman.` });
                newToasts.push({ id: "toast-" + id, title: "Eskalasi SP2", titleColor: SP_COLORS[2], body: `${o.code} · ${o.seller} masuk eskalasi tahap kedua.` });
              } else if (lvl === 3) {
                newLogs.push({ id, time: nowStr, color: SP_COLORS[3], text: `SP3: Toko ${o.seller} diblokir sementara — refund pesanan ${o.code} diproses otomatis.` });
                newToasts.push({ id: "toast-" + id, title: "SP3 — toko diblokir", titleColor: SP_COLORS[3], body: `${o.code} · ${o.seller}: refund diproses otomatis ke pelanggan.` });
              }
            }
            order.spLevel = newLevel;
            order.blocked = newLevel >= 3;
          }
          return order;
        })
      );

      if (newLogs.length) {
        setLogEntries((prev) => [...newLogs.reverse(), ...prev].slice(0, 40));
      }
      if (newToasts.length) {
        setToasts((prev) => [...prev, ...newToasts]);
        newToasts.forEach((t) => {
          setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 5200);
        });
      }
    }, 1000);
    return () => clearInterval(tickTimer);
  }, [threshold]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logEntries]);

  const applyPreset = useCallback((preset) => {
    setRating(preset.rating);
    setReviewText(preset.text);
    setResultBanner(null);
  }, []);

  const submitReview = useCallback(() => {
    if (!rating || !reviewText.trim()) return;
    setAnalyzing(true);
    setResultBanner(null);
    setTimeout(() => {
      const text = reviewText.toLowerCase();
      const hasNegative = NEGATIVE_WORDS.some((w) => text.includes(w));
      const isMismatch = rating >= 4 && hasNegative;
      setAnalyzing(false);
      if (isMismatch) {
        setResultBanner({
          icon: "\u26A0",
          text: "Rating dan ulasan Anda tidak konsisten. Mohon periksa kembali sebelum mengirim.",
          bg: "oklch(0.24 0.05 40)",
          border: "oklch(0.68 0.15 40 / 0.5)",
          fg: "oklch(0.85 0.09 55)",
        });
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        setResultBanner({
          icon: "\u2713",
          text: "Ulasan terkirim — rating dan teks konsisten.",
          bg: "oklch(0.24 0.05 160)",
          border: "oklch(0.72 0.1 160 / 0.5)",
          fg: "oklch(0.85 0.09 160)",
        });
      }
    }, 900);
  }, [rating, reviewText]);

  const mono = "'IBM Plex Mono',monospace";
  const sans = "'Hanken Grotesk',sans-serif";
  const serif = "'Instrument Serif',serif";

  return (
    <div style={{ minHeight: "100vh", background: "oklch(0.16 0.006 55)", fontFamily: sans, color: "oklch(0.72 0.008 60)", padding: "32px 28px 60px", position: "relative", borderRadius: 20 }}>
      <style>{FONTS}{KEYFRAMES}{`.num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}`}</style>

      <div style={{ position: "fixed", top: 22, right: 22, zIndex: 200, display: "flex", flexDirection: "column", gap: 10, width: 340 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ display: "flex", gap: 11, alignItems: "flex-start", background: "oklch(0.22 0.006 55)", border: `1px solid ${t.titleColor.replace(")", " / 0.4)")}`, borderRadius: 13, padding: "14px 16px", boxShadow: "0 12px 32px oklch(0.1 0.01 55 / 0.5)", animation: "toastIn .3s cubic-bezier(.2,.9,.3,1.2)" }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: t.titleColor }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: `600 12.5px ${sans}`, color: t.titleColor, marginBottom: 3 }}>{t.title}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "oklch(0.68 0.008 60)" }}>{t.body}</div>
            </div>
          </div>
        ))}
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 20, paddingBottom: 22, borderBottom: "1px solid oklch(1 0 0 / 0.07)" }}>
        <div>
          <div style={{ font: `500 11px ${mono}`, letterSpacing: ".22em", textTransform: "uppercase", color: "oklch(0.8 0.11 68)", marginBottom: 12 }}>Internal ops console</div>
          <h1 style={{ font: `400 34px/1.05 ${serif}`, margin: "0 0 10px", color: "oklch(0.96 0.005 70)", letterSpacing: "-0.01em" }}>
            Panel retensi &amp; operasional <span style={{ fontStyle: "italic", color: "oklch(0.8 0.11 68)" }}>e-commerce</span>
          </h1>
          <div style={{ fontSize: 14, color: "oklch(0.6 0.008 60)", maxWidth: 620, lineHeight: 1.55 }}>Memantau kesehatan pelanggan dari tiga sisi — segmentasi nilai pelanggan, kepatuhan pengiriman seller, dan kesesuaian rating vs ulasan.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="num" style={{ font: `400 26px ${serif}`, color: "oklch(0.96 0.005 70)", letterSpacing: ".02em" }}>{clock.toLocaleTimeString("id-ID", { hour12: false })}</div>
          <div style={{ fontSize: 10, color: "oklch(0.5 0.008 60)", letterSpacing: ".14em", textTransform: "uppercase", fontFamily: mono }}>Waktu sistem</div>
        </div>
      </header>

      <section style={{ background: "oklch(0.205 0.006 55)", border: "1px solid oklch(1 0 0 / 0.07)", borderRadius: 18, padding: "26px 26px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ font: `500 10.5px ${mono}`, letterSpacing: ".18em", textTransform: "uppercase", color: "oklch(0.8 0.11 68)", marginBottom: 7 }}>Modul 01</div>
            <h2 style={{ font: `400 22px ${serif}`, margin: 0, color: "oklch(0.96 0.005 70)" }}>Peta pelanggan</h2>
          </div>
          <div style={{ fontSize: 12, color: "oklch(0.5 0.008 60)", fontFamily: mono }}>RFM + K-Means · k=4</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 28 }}>
          <div>
            <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "oklch(0.6 0.008 60)" }}><span style={{ width: 16, height: 4, borderRadius: 2, background: "oklch(0.8 0.11 68)", display: "inline-block" }} />% populasi</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "oklch(0.6 0.008 60)" }}><span style={{ width: 16, height: 4, borderRadius: 2, background: "oklch(0.55 0.008 60)", display: "inline-block" }} />% kontribusi revenue</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {SEGMENT_DEFS.map((seg) => (
                <div key={seg.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, font: `600 14px ${sans}`, color: "oklch(0.92 0.006 60)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, display: "inline-block" }} />{seg.name}
                    </span>
                    <span className="num" style={{ font: `500 12px ${mono}`, color: "oklch(0.56 0.008 60)" }}>
                      {seg.revPerCustomer ? `Rp${seg.revPerCustomer.toLocaleString("id-ID")}rb / pelanggan` : `${fmt1(seg.rev / seg.pop)}x rev/populasi`}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ height: 9, background: "oklch(0.145 0.006 55)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${seg.pop}%`, background: seg.color, borderRadius: 5, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} />
                    </div>
                    <div style={{ height: 9, background: "oklch(0.145 0.006 55)", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${seg.rev}%`, background: "oklch(0.55 0.008 60)", borderRadius: 5, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} />
                    </div>
                  </div>
                  <div className="num" style={{ display: "flex", justifyContent: "space-between", font: `400 11px ${mono}`, color: "oklch(0.48 0.008 60)", marginTop: 5 }}>
                    <span>{seg.pop}% populasi</span><span>{seg.rev}% revenue</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, background: "oklch(0.145 0.006 55)", border: "1px solid oklch(0.8 0.11 68 / 0.25)", borderRadius: 14, padding: 20 }}>
            <div style={{ font: `500 10px ${mono}`, letterSpacing: ".14em", textTransform: "uppercase", color: "oklch(0.8 0.11 68)" }}>Sorotan</div>
            <div className="num" style={{ font: `400 42px/1 ${serif}`, color: "oklch(0.96 0.005 70)" }}>79.5%</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "oklch(0.6 0.008 60)" }}>revenue dihasilkan oleh <span style={{ color: "oklch(0.8 0.11 68)" }}>Champions</span> — hanya 27.9% dari basis pelanggan.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 24 }}>
          {SEGMENT_DEFS.map((seg) => (
            <div key={seg.name} style={{ background: "oklch(0.145 0.006 55)", borderRadius: 14, padding: 16, borderTop: `2px solid ${seg.color}` }}>
              <div style={{ font: `600 13.5px ${sans}`, marginBottom: 8, color: seg.color }}>{seg.name}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "oklch(0.62 0.008 60)" }}>{seg.treatment}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "oklch(0.205 0.006 55)", border: "1px solid oklch(1 0 0 / 0.07)", borderRadius: 18, padding: "26px 26px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ font: `500 10.5px ${mono}`, letterSpacing: ".18em", textTransform: "uppercase", color: "oklch(0.8 0.11 68)", marginBottom: 7 }}>Modul 02</div>
            <h2 style={{ font: `400 22px ${serif}`, margin: "0 0 5px", color: "oklch(0.96 0.005 70)" }}>Monitor kepatuhan pengiriman seller</h2>
            <div style={{ fontSize: 12.5, color: "oklch(0.55 0.008 60)" }}>Eskalasi otomatis SP1 → SP2 → SP3. Tidak ada aksi manual.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "oklch(0.145 0.006 55)", border: "1px solid oklch(1 0 0 / 0.06)", borderRadius: 12, padding: "10px 16px" }}>
            <div style={{ font: `500 10px ${mono}`, color: "oklch(0.55 0.008 60)", textTransform: "uppercase", letterSpacing: ".1em" }}>Ambang SP1</div>
            <input type="range" min="12" max="96" step="12" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: 130, accentColor: "oklch(0.8 0.11 68)" }} />
            <div className="num" style={{ font: `500 15px ${mono}`, color: "oklch(0.8 0.11 68)", minWidth: 52 }}>{threshold} jam</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 }}>
            {orders.map((o) => {
              const cycleBase = o.spLevel * threshold;
              const target = (o.spLevel + 1) * threshold;
              const pct = o.spLevel >= 3 ? 1 : Math.max(0, Math.min(1, (o.elapsedHours - cycleBase) / threshold));
              const color = SP_COLORS[o.spLevel];
              const label = SP_LABELS[o.spLevel];
              const remainingText = o.spLevel >= 3 ? "Toko ditutup otomatis — refund diproses." : `${fmt1(target - o.elapsedHours)} jam menuju ${o.spLevel === 0 ? "SP1" : o.spLevel === 1 ? "SP2" : "SP3"}`;
              const ringPctDeg = Math.round(pct * 360);
              const blocked = o.spLevel >= 3;
              return (
                <div key={o.id} style={{ background: blocked ? "oklch(0.24 0.06 25)" : "oklch(0.16 0.006 55)", border: blocked ? "1px solid oklch(0.68 0.15 25 / 0.7)" : "1px solid oklch(1 0 0 / 0.06)", borderRadius: 14, padding: "14px 15px", animation: blocked ? "pulseBlocked 1.6s ease infinite" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div className="num" style={{ font: `500 13px ${mono}`, color: "oklch(0.9 0.006 60)" }}>{o.code}</div>
                      <div style={{ fontSize: 11.5, color: "oklch(0.55 0.008 60)", marginTop: 3 }}>{o.seller}</div>
                    </div>
                    <div style={{ font: `500 10.5px ${mono}`, letterSpacing: ".02em", color, background: color.replace(")", " / 0.14)"), padding: "4px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(${color} ${ringPctDeg}deg, oklch(0.28 0.006 55) ${ringPctDeg}deg 360deg)`, display: "flex", alignItems: "center", justifyContent: "center", animation: blocked ? "pulseBlocked 1.6s ease infinite" : "none" }}>
                      <div style={{ width: 41, height: 41, borderRadius: "50%", background: "oklch(0.205 0.006 55)", display: "flex", alignItems: "center", justifyContent: "center", color }}>
                        <div className="num" style={{ font: `500 12px ${mono}` }}>{fmt1(o.elapsedHours)}h</div>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11.5, color: "oklch(0.58 0.008 60)", lineHeight: 1.45 }}>{remainingText}</div>
                    </div>
                  </div>
                  {blocked && (
                    <div style={{ marginTop: 11, background: "oklch(0.6 0.17 25)", color: "oklch(0.98 0.01 60)", font: `700 11px ${sans}`, padding: "7px 9px", borderRadius: 9, textAlign: "center", animation: "blockBadgeIn .5s cubic-bezier(.34,1.56,.64,1)" }}>
                      Toko diblokir — refund diproses
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ background: "oklch(0.115 0.006 55)", border: "1px solid oklch(1 0 0 / 0.05)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", height: 400 }}>
            <div style={{ font: `500 10px ${mono}`, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.55 0.008 60)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "oklch(0.74 0.09 160)", animation: "analyzePulse 2s ease infinite", display: "inline-block" }} />
              Log aktivitas sistem — real-time
            </div>
            <div ref={logRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column-reverse", gap: 6 }}>
              {logEntries.map((l) => (
                <div key={l.id} style={{ animation: "logIn .35s ease", font: `400 11.5px/1.5 ${mono}`, color: l.color, borderLeft: `2px solid ${l.color}`, padding: "6px 10px", background: "oklch(0.16 0.006 55)", borderRadius: "0 7px 7px 0" }}>
                  <span style={{ color: "oklch(0.44 0.008 60)" }}>[{l.time}]</span> {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: "oklch(0.205 0.006 55)", border: "1px solid oklch(1 0 0 / 0.07)", borderRadius: 18, padding: "26px 26px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ font: `500 10.5px ${mono}`, letterSpacing: ".18em", textTransform: "uppercase", color: "oklch(0.8 0.11 68)", marginBottom: 7 }}>Modul 03</div>
          <h2 style={{ font: `400 22px ${serif}`, margin: "0 0 5px", color: "oklch(0.96 0.005 70)" }}>Deteksi kesesuaian rating vs ulasan</h2>
          <div style={{ fontSize: 12.5, color: "oklch(0.55 0.008 60)" }}>Simulasi deteksi mismatch sentimen dengan pattern matching kata kunci (placeholder untuk model TF-IDF terlatih).</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ animation: shake ? "shakeX .45s ease" : "none" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {PRESET_DEFS.map((p) => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{ background: "oklch(0.145 0.006 55)", border: "1px solid oklch(1 0 0 / 0.08)", color: "oklch(0.68 0.008 60)", font: `500 11.5px ${mono}`, padding: "8px 13px", borderRadius: 9, cursor: "pointer" }}>{p.label}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => { setRating(n); setResultBanner(null); }} style={{ background: "none", border: "none", fontSize: 30, cursor: "pointer", lineHeight: 1, padding: 0, color: n <= rating ? "oklch(0.8 0.11 68)" : "oklch(0.32 0.006 55)", transition: "color .15s ease" }}>★</button>
              ))}
            </div>

            <textarea placeholder="Tulis ulasan di sini..." value={reviewText} onChange={(e) => { setReviewText(e.target.value); setResultBanner(null); }} style={{ width: "100%", minHeight: 110, background: "oklch(0.145 0.006 55)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 12, color: "oklch(0.9 0.006 60)", font: `400 14px/1.5 ${sans}`, padding: 13, resize: "vertical", boxSizing: "border-box" }} />

            <button onClick={submitReview} style={{ marginTop: 12, width: "100%", background: "oklch(0.8 0.11 68)", border: "none", color: "oklch(0.2 0.04 60)", font: `700 14px ${sans}`, padding: 13, borderRadius: 12, cursor: "pointer" }}>Kirim ulasan</button>

            {analyzing && (
              <div style={{ marginTop: 12, font: `500 12px ${mono}`, color: "oklch(0.8 0.11 68)", animation: "analyzePulse 1s ease infinite" }}>Menganalisis teks ulasan…</div>
            )}
            {resultBanner && (
              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start", background: resultBanner.bg, border: `1px solid ${resultBanner.border}`, color: resultBanner.fg, padding: "13px 15px", borderRadius: 12, animation: "popIn .3s ease" }}>
                <div style={{ fontSize: 18 }}>{resultBanner.icon}</div>
                <div style={{ font: `500 13px/1.45 ${sans}` }}>{resultBanner.text}</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "oklch(0.145 0.006 55)", borderRadius: 14, padding: 20 }}>
              <div style={{ font: `500 10px ${mono}`, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.55 0.008 60)", marginBottom: 14 }}>Penyebab ulasan negatif — historis</div>
              <div style={{ display: "flex", height: 34, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                <div className="num" style={{ width: "48.2%", background: "oklch(0.72 0.08 178)", display: "flex", alignItems: "center", justifyContent: "center", font: `600 12.5px ${sans}`, color: "oklch(0.18 0.03 178)" }}>48.2%</div>
                <div className="num" style={{ width: "51.8%", background: "oklch(0.8 0.11 68)", display: "flex", alignItems: "center", justifyContent: "center", font: `600 12.5px ${sans}`, color: "oklch(0.2 0.04 60)" }}>51.8%</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "oklch(0.6 0.008 60)", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "oklch(0.72 0.08 178)", display: "inline-block" }} />Terkait pengiriman/kemasan</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "oklch(0.8 0.11 68)", display: "inline-block" }} />Penyebab lain <span style={{ background: "oklch(0.8 0.11 68 / 0.16)", color: "oklch(0.8 0.11 68)", font: `500 10px ${mono}`, padding: "2px 7px", borderRadius: 5 }}>belum tergali</span></div>
              </div>
            </div>
            <div style={{ background: "oklch(0.145 0.006 55)", borderRadius: 14, padding: 20, fontSize: 13, lineHeight: 1.65, color: "oklch(0.62 0.008 60)" }}>
              Lebih dari separuh ulasan negatif tidak berkaitan dengan pengiriman — sistem ini membantu memisahkan sinyal kualitas produk, layanan, dan ekspektasi lain yang belum dianalisis dari isu operasional yang sudah dikenal.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
