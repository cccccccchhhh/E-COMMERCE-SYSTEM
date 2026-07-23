import React, { useState, useEffect, useRef, useCallback } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

const KEYFRAMES = `
@keyframes toastIn{from{opacity:0;transform:translateX(24px) scale(.96);}to{opacity:1;transform:translateX(0) scale(1);}}
@keyframes logIn{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulseBlocked{0%,100%{box-shadow:0 0 0 0 oklch(0.64 0.15 25/0.4);}50%{box-shadow:0 0 0 9px oklch(0.64 0.15 25/0);}}
@keyframes shakeX{0%,100%{transform:translateX(0);}20%{transform:translateX(-8px);}40%{transform:translateX(7px);}60%{transform:translateX(-5px);}80%{transform:translateX(3px);}}
@keyframes popIn{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);}}
@keyframes analyzePulse{0%,100%{opacity:.35;}50%{opacity:1;}}
@keyframes blockBadgeIn{0%{transform:scale(0.6) rotate(-4deg);opacity:0;}70%{transform:scale(1.06) rotate(1deg);opacity:1;}100%{transform:scale(1) rotate(0);}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
`;

// ── SP THRESHOLDS (fixed) ─────────────────────────────────────────────
const REMIND_H = 36;  // early warning otomatis sebelum SP1
const SP1_H    = 48;
const SP2_H    = 72;
const SP3_H    = 96;
const BLOCK_H  = 120;

function calcSpLevel(h) {
  if (h >= BLOCK_H) return 3;
  if (h >= SP3_H)   return 2;
  if (h >= SP1_H)   return 1;
  return 0;
}

// ── SENTIMENT RULE-BASED ──────────────────────────────────────────────
// ── RULE-BASED SENTIMENT ENGINE (multi-layer) ─────────────────────────────
// Setiap kata/frasa negatif punya bobot (weight):
//   3 = berat (rusak, palsu, cacat)   2 = sedang (kecewa, lambat)   1 = ringan (kurang, biasa)
const NEG_LEXICON = [
  // BERAT (3) — masalah kualitas/penipuan
  {p:"rusak",w:3},{p:"cacat",w:3},{p:"palsu",w:3},{p:"tipu",w:3},{p:"zonk",w:3},
  {p:"hancur",w:3},{p:"pecah",w:3},{p:"bocor",w:3},{p:"sobek",w:3},{p:"patah",w:3},
  {p:"penyok",w:3},{p:"lecet",w:3},{p:"retak",w:3},{p:"busuk",w:3},{p:"bau",w:3},
  {p:"jangan beli",w:3},{p:"sangat mengecewakan",w:3},{p:"kecewa berat",w:3},
  {p:"penipuan",w:3},{p:"scam",w:3},{p:"tertipu",w:3},{p:"berbahaya",w:3},
  {p:"disappointed",w:3},{p:"terrible",w:3},{p:"worst",w:3},{p:"horrible",w:3},
  // SEDANG (2) — pengalaman buruk
  {p:"kecewa",w:2},{p:"jelek",w:2},{p:"buruk",w:2},{p:"parah",w:2},
  {p:"tidak sesuai",w:2},{p:"tidak sesuai gambar",w:2},{p:"tidak sesuai deskripsi",w:2},
  {p:"mengecewakan",w:2},{p:"menyesal",w:2},{p:"kotor",w:2},{p:"beli",w:0},
  {p:"tidak layak",w:2},{p:"ga sesuai",w:2},{p:"gak sesuai",w:2},
  {p:"lambat",w:2},{p:"telat",w:2},{p:"lama banget",w:2},{p:"tidak sampai",w:2},
  {p:"salah kirim",w:2},{p:"tidak lengkap",w:2},{p:"kurang dari",w:2},
  {p:"bad",w:2},{p:"poor",w:2},{p:"fake",w:2},{p:"wrong item",w:2},
  // RINGAN (1) — ketidakpuasan minor
  {p:"kurang memuaskan",w:1},{p:"kurang bagus",w:1},{p:"kurang oke",w:1},
  {p:"agak kecewa",w:1},{p:"sedikit kecewa",w:1},{p:"tidak puas",w:1},
  {p:"biasa aja",w:1},{p:"biasa saja",w:1},{p:"tidak istimewa",w:1},
  {p:"lama",w:1},{p:"ga cepat",w:1},{p:"pengiriman lama",w:1},
  // SLANG / TYPO UMUM
  {p:"jelek bgt",w:2},{p:"jelek banget",w:2},{p:"bgus sih tapi",w:1},
  {p:"gak oke",w:2},{p:"ga oke",w:2},{p:"ga bagus",w:2},{p:"gak bagus",w:2},
  {p:"minus",w:1},{p:"sayang banget",w:1},{p:"kapok",w:2},{p:"kapok beli",w:3},
];

const POS_LEXICON = [
  // BERAT (3) — sangat puas
  {p:"sempurna",w:3},{p:"terbaik",w:3},{p:"luar biasa",w:3},{p:"memuaskan banget",w:3},
  {p:"sangat bagus",w:3},{p:"sangat puas",w:3},{p:"recommended",w:3},{p:"highly recommend",w:3},
  {p:"perfect",w:3},{p:"excellent",w:3},{p:"amazing",w:3},{p:"outstanding",w:3},
  // SEDANG (2) — puas
  {p:"bagus",w:2},{p:"mantap",w:2},{p:"puas",w:2},{p:"sesuai",w:2},{p:"sesuai gambar",w:2},
  {p:"sesuai deskripsi",w:2},{p:"keren",w:2},{p:"suka",w:2},{p:"senang",w:2},
  {p:"oke",w:2},{p:"ok",w:2},{p:"cepat sampai",w:2},{p:"cepat",w:2},{p:"tepat waktu",w:2},
  {p:"recommend",w:2},{p:"rekomen",w:2},{p:"rekomendasi",w:2},{p:"worth it",w:2},
  {p:"good",w:2},{p:"great",w:2},{p:"nice",w:2},{p:"fast",w:2},
  // RINGAN (1) — cukup puas
  {p:"lumayan",w:1},{p:"cukup bagus",w:1},{p:"cukup oke",w:1},{p:"cukup puas",w:1},
  {p:"tidak mengecewakan",w:1},{p:"not bad",w:1},
  // SLANG / TYPO UMUM
  {p:"baguus",w:2},{p:"mantull",w:2},{p:"okee",w:2},{p:"okelah",w:1},
  {p:"top",w:2},{p:"top banget",w:3},{p:"gacor",w:2},{p:"gass",w:1},
  {p:"happy",w:2},{p:"baik",w:1},{p:"rapi",w:1},{p:"bersih",w:1},
];

// Kata negasi — membatalkan kata setelahnya
const NEGATIONS = ["tidak","bukan","ga","gak","nggak","belum","tanpa","anti","kurang dari","bukan berarti"];
// Kata intensifier — menambah bobot +1
const INTENSIFIERS = ["sangat","banget","bgt","sekali","amat","benar-benar","beneran","parah","ekstrem"];
// Pola kalimat tanya — kurangi bobot (ekspresi, bukan pernyataan)
const QUESTION_PATTERNS = [/apa(kah)?\s/i, /benarkah/i, /apakah\s/i, /\?$/];

function detectSentiment(text) {
  const lower = text.toLowerCase().trim();
  const isQuestion = QUESTION_PATTERNS.some(p => p.test(lower));
  const questionMult = isQuestion ? 0.5 : 1; // pertanyaan bobotnya setengah

  let negScore = 0, posScore = 0;
  const flaggedNeg = [], flaggedPos = [];

  // Fungsi cek satu leksikon
  function scanLexicon(lexicon, flagArr, scoreRef) {
    // Urutkan dari panjang ke pendek agar frasa multi-kata diperiksa duluan
    const sorted = [...lexicon].sort((a,b) => b.p.length - a.p.length);
    const usedRanges = []; // hindari double-count tumpang tindih

    sorted.forEach(({p, w}) => {
      if (w === 0) return; // skip kata netral (seperti "beli")
      let idx = lower.indexOf(p);
      while (idx !== -1) {
        const end = idx + p.length;
        // cek apakah range ini sudah tercakup
        const overlap = usedRanges.some(([s,e]) => idx < e && end > s);
        if (!overlap) {
          // cek negasi (3 kata sebelum pola)
          const beforeSlice = lower.slice(Math.max(0, idx-30), idx).trim().split(/\s+/);
          const negated = beforeSlice.slice(-3).some(b => NEGATIONS.some(n => b.startsWith(n)));

          // cek intensifier (2 kata sebelum pola)
          const intensified = beforeSlice.slice(-2).some(b => INTENSIFIERS.includes(b));
          const finalWeight = Math.round(w * (intensified ? 1.5 : 1) * questionMult);

          if (!negated && finalWeight > 0) {
            flagArr.push({word: p, weight: finalWeight});
            scoreRef.val += finalWeight;
            usedRanges.push([idx, end]);
          } else if (negated) {
            // negasi membalik polaritas dengan bobot lebih rendah
            const oppScore = Math.ceil(finalWeight * 0.5);
            // (berlawanan — diabaikan di sini, cukup tidak flag)
          }
        }
        idx = lower.indexOf(p, idx+1);
      }
    });
  }

  const negRef = {val:0}, posRef = {val:0};
  scanLexicon(NEG_LEXICON, flaggedNeg, negRef);
  scanLexicon(POS_LEXICON, flaggedPos, posRef);
  negScore = negRef.val; posScore = posRef.val;

  const totalScore = negScore + posScore || 1;
  const isNeg = negScore > 0 && negScore >= posScore;
  const isPos = posScore > 0 && posScore > negScore;
  // score 0..1 mencerminkan kekuatan sinyal
  const score = Math.min(1, Math.max(negScore, posScore) / 6);
  const dominantWords = isNeg
    ? flaggedNeg.sort((a,b)=>b.weight-a.weight).map(f=>f.word)
    : flaggedPos.sort((a,b)=>b.weight-a.weight).map(f=>f.word);

  return { isNeg, isPos, score, words: dominantWords, negScore, posScore };
}

function highlightText(text, words) {
  if (!words.length) return [text];
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return parts.map((p, i) =>
    words.some((w) => p.toLowerCase() === w.toLowerCase())
      ? <mark key={i} style={{ background:"oklch(0.64 0.15 25/0.4)", color:"oklch(0.9 0.1 30)", borderRadius:3, padding:"0 2px" }}>{p}</mark>
      : p
  );
}

// ── STATIC DATA ───────────────────────────────────────────────────────
const SEG_DEFS = [
  { name:"Champions",    color:"oklch(0.8 0.11 68)",  pop:27.9, rev:79.5, rpc:8414, treatment:"Program loyalitas eksklusif, akses awal produk baru. Hindari diskon — mengikis margin pelanggan yang sudah beli tanpa insentif." },
  { name:"At-Risk",      color:"oklch(0.64 0.14 26)", pop:23.2, rev:13.0, rpc:1655, treatment:"Win-back kampanye dengan diskon personal 10–20%. Prioritas tertinggi — histori belanja besar, mulai menghilang." },
  { name:"New/Promising",color:"oklch(0.72 0.08 178)",pop:21.1, rev:4.7,  rpc:665,  treatment:"Insentif terbatas untuk mendorong pembelian kedua. Jangan diskon besar — fokus membentuk kebiasaan." },
  { name:"Hibernating",  color:"oklch(0.6 0.02 60)",  pop:27.8, rev:2.8,  rpc:294,  treatment:"Kampanye berbiaya rendah. Tidak layak diskon besar — nilai historis dan kontribusi revenue rendah." },
];

// Tabel pelanggan RFM (30 pelanggan simulasi realistis)
const CUSTOMERS_RAW = [
  {id:"C001",name:"Budi Santoso",      R:12, F:18,M:9200, seg:"Champions"},
  {id:"C002",name:"Siti Rahma",        R:5,  F:22,M:12800,seg:"Champions"},
  {id:"C003",name:"Agus Wibowo",       R:31, F:14,M:7600, seg:"Champions"},
  {id:"C004",name:"Dewi Lestari",      R:8,  F:19,M:11200,seg:"Champions"},
  {id:"C005",name:"Hendra Kusuma",     R:18, F:16,M:8900, seg:"Champions"},
  {id:"C006",name:"Rina Marlina",      R:22, F:15,M:7100, seg:"Champions"},
  {id:"C007",name:"Joko Prasetyo",     R:45, F:11,M:6300, seg:"Champions"},
  {id:"C008",name:"Yunita Sari",       R:29, F:13,M:8100, seg:"Champions"},
  {id:"C009",name:"Fajar Nugroho",     R:260,F:5, M:1800, seg:"At-Risk"},
  {id:"C010",name:"Lina Handayani",    R:285,F:4, M:1500, seg:"At-Risk"},
  {id:"C011",name:"Eko Susanto",       R:310,F:3, M:2100, seg:"At-Risk"},
  {id:"C012",name:"Mega Wulandari",    R:240,F:6, M:2400, seg:"At-Risk"},
  {id:"C013",name:"Rudi Hartono",      R:295,F:4, M:1200, seg:"At-Risk"},
  {id:"C014",name:"Sri Wahyuni",       R:270,F:5, M:1900, seg:"At-Risk"},
  {id:"C015",name:"Teguh Prabowo",     R:320,F:3, M:1600, seg:"At-Risk"},
  {id:"C016",name:"Andi Firmansyah",   R:35, F:2, M:550,  seg:"New/Promising"},
  {id:"C017",name:"Bella Putri",       R:28, F:3, M:720,  seg:"New/Promising"},
  {id:"C018",name:"Citra Dewi",        R:42, F:2, M:480,  seg:"New/Promising"},
  {id:"C019",name:"Dian Permata",      R:15, F:2, M:610,  seg:"New/Promising"},
  {id:"C020",name:"Evan Saputra",      R:50, F:2, M:540,  seg:"New/Promising"},
  {id:"C021",name:"Fitri Handayani",   R:38, F:3, M:690,  seg:"New/Promising"},
  {id:"C022",name:"Galih Prakoso",     R:20, F:2, M:520,  seg:"New/Promising"},
  {id:"C023",name:"Hani Rahayu",       R:430,F:1, M:280,  seg:"Hibernating"},
  {id:"C024",name:"Irwan Setiawan",    R:455,F:1, M:310,  seg:"Hibernating"},
  {id:"C025",name:"Julia Kartika",     R:480,F:1, M:250,  seg:"Hibernating"},
  {id:"C026",name:"Kevin Mandala",     R:420,F:1, M:340,  seg:"Hibernating"},
  {id:"C027",name:"Laila Fitriani",    R:500,F:1, M:220,  seg:"Hibernating"},
  {id:"C028",name:"Mulyono",           R:445,F:1, M:290,  seg:"Hibernating"},
  {id:"C029",name:"Nana Supriani",     R:390,F:2, M:320,  seg:"Hibernating"},
  {id:"C030",name:"Omar Hidayat",      R:510,F:1, M:260,  seg:"Hibernating"},
];

const ORDERS_INIT = [
  {id:1, code:"ORD-88213", seller:"TokoBerkah Elektronik", elapsed:6},
  {id:2, code:"ORD-88240", seller:"Griya Fashion Store",   elapsed:44},
  {id:3, code:"ORD-88101", seller:"Sumber Rejeki Grosir",  elapsed:68},
  {id:4, code:"ORD-87950", seller:"Kios Barokah",          elapsed:90},
  {id:5, code:"ORD-88300", seller:"Anugerah Sport",        elapsed:20},
  {id:6, code:"ORD-88055", seller:"Warung Digital Store",  elapsed:55},
  {id:7, code:"ORD-88412", seller:"Cahaya Nusantara",      elapsed:10},
  {id:8, code:"ORD-88388", seller:"Maju Bersama Shop",     elapsed:33},
];

const PRESET_DEFS = [
  {label:"★5 konsisten",   rating:5, text:"Barang sampai cepat, kualitas bagus dan sesuai gambar. Sangat puas, recommended!"},
  {label:"★5 mismatch",    rating:5, text:"Kecewa berat, barang rusak dan tidak sesuai deskripsi sama sekali. Zonk!"},
  {label:"★2 konsisten",   rating:2, text:"Pengiriman sangat lambat dan barangnya jelek, tidak sesuai ekspektasi."},
  {label:"★1 mismatch",    rating:1, text:"Barang bagus banget, mantap dan sesuai deskripsi. Puas dengan pelayanannya."},
  {label:"Negasi",         rating:5, text:"Barang tidak rusak sama sekali, kondisi sempurna. Ga ada yang kurang."},
  {label:"Campuran",       rating:4, text:"Barangnya sih oke dan cepat sampai, tapi packaging kurang rapi dan ada lecet kecil."},
  {label:"Intensifier",    rating:5, text:"Sangat mengecewakan, barang benar-benar rusak parah dan tidak sesuai sama sekali."},
];

const SP_COLORS = ["oklch(0.74 0.09 160)","oklch(0.8 0.11 78)","oklch(0.72 0.14 45)","oklch(0.68 0.15 25)"];
const SP_LABELS = ["Aman","SP1 terkirim","SP2 — eskalasi","Diblokir + refund"];

function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }

// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]           = useState("monitor");
  const [orders, setOrders]     = useState(() => ORDERS_INIT.map(o => ({...o, spLevel:calcSpLevel(o.elapsed), remindSent:o.elapsed>=REMIND_H})));
  const [customers, setCustomers] = useState(CUSTOMERS_RAW);
  const [toasts, setToasts]     = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [clock, setClock]       = useState(new Date());
  const [simSpeed, setSimSpeed] = useState(1); // 1x, 5x, 20x
  const [isSimRunning, setIsSimRunning] = useState(true);

  // RFM tab state
  const [filterSeg, setFilterSeg]   = useState("Semua");
  const [voucherSent, setVoucherSent] = useState(new Set());
  const [alerts, setAlerts]         = useState([]);

  // Modul 03 state
  const [rating, setRating]         = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [analyzing, setAnalyzing]   = useState(false);
  const [resultBanner, setResultBanner] = useState(null);
  const [shake, setShake]           = useState(false);
  const [flagHistory, setFlagHistory] = useState([]);

  const logRef  = useRef(null);
  const logSeq  = useRef(0);
  const simRef  = useRef(simSpeed);
  simRef.current = simSpeed;

  const mono  = "'IBM Plex Mono',monospace";
  const sans  = "'Hanken Grotesk',sans-serif";
  const serif = "'Instrument Serif',serif";
  const gold  = "oklch(0.8 0.11 68)";
  const dim   = "oklch(0.55 0.008 60)";
  const bg0   = "oklch(0.16 0.006 55)";
  const bg1   = "oklch(0.205 0.006 55)";
  const bg2   = "oklch(0.145 0.006 55)";

  // clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── TICK: simulasi waktu ────────────────────────────────────────────
  useEffect(() => {
    const TICK_MS   = 1000;
    const SIM_H_PER_TICK = (simSpeed / 60); // simSpeed menit per detik

    const tick = setInterval(() => {
      if (!isSimRunning) return;
      const nowStr = new Date().toLocaleTimeString("id-ID", {hour12:false});
      const newLogs = [], newToasts = [];

      setOrders(prev => prev.map(o => {
        if (o.spLevel >= 3) return o;
        const elapsed  = o.elapsed + SIM_H_PER_TICK;
        const newLevel = calcSpLevel(elapsed);
        let order      = {...o, elapsed};

        // Early warning otomatis di jam ke-36 (sebelum SP1)
        if (!o.remindSent && o.elapsed < REMIND_H && elapsed >= REMIND_H) {
          const id = ++logSeq.current;
          newLogs.push({id, time:nowStr, col:"oklch(0.78 0.1 78)", text:`⏰ Reminder → ${o.seller} (${o.code}): ${REMIND_H} jam berlalu, belum ada konfirmasi pengiriman. SP1 dalam ${SP1_H - REMIND_H} jam jika tidak ada tindakan.`});
          newToasts.push({id:"t"+id, title:"Reminder pengiriman", tc:"oklch(0.78 0.1 78)", body:`${o.code} · ${o.seller} — ${SP1_H - REMIND_H} jam menuju SP1`});
          order.remindSent = true;
        }

        if (newLevel > o.spLevel) {
          for (let lvl = o.spLevel + 1; lvl <= newLevel; lvl++) {
            const id = ++logSeq.current;
            if (lvl === 1) {
              newLogs.push({id, time:nowStr, col:SP_COLORS[1], text:`🔔 SP1 otomatis → ${o.seller} (${o.code}) melewati ${SP1_H} jam tanpa konfirmasi pengiriman.`});
              newToasts.push({id:"t"+id, title:"SP1 terkirim", tc:SP_COLORS[1], body:`${o.code} · ${o.seller}`});
            } else if (lvl === 2) {
              newLogs.push({id, time:nowStr, col:SP_COLORS[2], text:`⚠️ SP2 eskalasi → ${o.seller} (${o.code}) melewati ${SP2_H} jam. Upload produk dibatasi.`});
              newToasts.push({id:"t"+id, title:"Eskalasi SP2", tc:SP_COLORS[2], body:`${o.code} · ${o.seller}`});
            } else {
              newLogs.push({id, time:nowStr, col:SP_COLORS[3], text:`🚫 SP3: ${o.seller} diblokir otomatis — refund ${o.code} diproses ke pembeli (>${BLOCK_H} jam).`});
              newToasts.push({id:"t"+id, title:"SP3 — Toko diblokir", tc:SP_COLORS[3], body:`${o.code} · refund diproses ke pelanggan.`});
            }
          }
          order.spLevel = newLevel;
        }
        return order;
      }));

      if (newLogs.length) setLogEntries(p => [...newLogs, ...p].slice(0,50));
      if (newToasts.length) {
        setToasts(p => [...p, ...newToasts]);
        newToasts.forEach(t => setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 5200));
      }
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [simSpeed, isSimRunning]);

  // ── RFM helpers ──────────────────────────────────────────────────────
  const sendVoucher = useCallback((custId) => {
    setVoucherSent(p => new Set([...p, custId]));
    const nowStr = new Date().toLocaleTimeString("id-ID", {hour12:false});
    const cust = customers.find(c => c.id === custId);
    const id = ++logSeq.current;
    const entry = {id, time:nowStr, col:"oklch(0.72 0.08 178)", text:`🎫 Win-back voucher diskon 15% terkirim ke ${cust?.name} (${custId}) — segmen At-Risk. Berlaku 7 hari.`};
    setLogEntries(p => [entry, ...p].slice(0,50));
  }, [customers]);

  const sendCampaign = useCallback(() => {
    const atRisk = customers.filter(c => c.seg === "At-Risk");
    const nowStr = new Date().toLocaleTimeString("id-ID", {hour12:false});
    setVoucherSent(new Set(atRisk.map(c => c.id)));
    const id = ++logSeq.current;
    const totalM = atRisk.reduce((s,c)=>s+c.M,0);
    const entry = {id, time:nowStr, col:"oklch(0.72 0.08 178)", text:`🚀 Kampanye win-back diluncurkan: ${atRisk.length} pelanggan At-Risk menerima voucher diskon 15%. Estimasi recovery: Rp${(totalM*0.3/1000).toFixed(0)} jt.`};
    setLogEntries(p => [entry, ...p].slice(0,50));
  }, [customers]);

  // Simulasi alert: dua pelanggan At-Risk yang "baru bergeser" dari Champions
  const rfmAlerts = [
    {id:"C009", name:"Fajar Nugroho",   from:"Champions", to:"At-Risk", lastSeen:"12 hari lalu"},
    {id:"C012", name:"Mega Wulandari",  from:"Champions", to:"At-Risk", lastSeen:"18 hari lalu"},
  ];

  // ── MODUL 03 ─────────────────────────────────────────────────────────
  const applyPreset = useCallback((p) => {
    setRating(p.rating); setReviewText(p.text); setResultBanner(null);
  }, []);

  const submitReview = useCallback(() => {
    if (!rating || !reviewText.trim()) return;
    setAnalyzing(true); setResultBanner(null);
    setTimeout(() => {
      const {isNeg, isPos, score, words, negScore, posScore} = detectSentiment(reviewText);
      // Mismatch arah 1: rating tinggi (>=4) tapi sentimen negatif
      const mismatchHigh = rating >= 4 && isNeg;
      // Mismatch arah 2: rating rendah (<=2) tapi sentimen positif
      const mismatchLow  = rating <= 2 && isPos;
      const isMismatch   = mismatchHigh || mismatchLow;
      setAnalyzing(false);
      const confLabel = score === 0 ? "—" : score < 0.25 ? "rendah" : score < 0.55 ? "sedang" : score < 0.8 ? "tinggi" : "sangat tinggi";

      if (isMismatch) {
        const mismatchMsg = mismatchHigh
          ? `Rating ${rating}★ tinggi tapi teks bernada negatif. Kata kunci: ${words.join(", ")}.`
          : `Rating ${rating}★ rendah tapi teks bernada positif. Kata kunci: ${words.join(", ")}.`;
        setResultBanner({type:"mismatch", words, text:reviewText, icon:"⚠",
          msg: mismatchMsg, neg:negScore, pos:posScore,
          conf:confLabel, bg:"oklch(0.24 0.05 40)", border:"oklch(0.68 0.15 40/0.5)", fg:"oklch(0.85 0.09 55)"});
        setShake(true); setTimeout(() => setShake(false), 500);
        setFlagHistory(p => [{id:Date.now(), time:new Date().toLocaleTimeString("id-ID",{hour12:false}), rating, text:reviewText, words, type:mismatchHigh?"high":"low"}, ...p].slice(0,10));
      } else if (isNeg) {
        // konsisten negatif (rating rendah + teks negatif)
        setResultBanner({type:"ok", icon:"✓",
          msg:`Ulasan terkirim — rating ${rating}★ konsisten dengan sentimen negatif.`,
          neg:negScore, pos:posScore,
          conf:confLabel, bg:"oklch(0.22 0.03 200)", border:"oklch(0.6 0.08 200/0.5)", fg:"oklch(0.8 0.07 200)"});
      } else {
        setResultBanner({type:"ok", icon:"✓",
          msg:`Ulasan terkirim — rating dan teks konsisten.`,
          neg:negScore, pos:posScore,
          conf:confLabel, bg:"oklch(0.24 0.05 160)", border:"oklch(0.72 0.1 160/0.5)", fg:"oklch(0.85 0.09 160)"});
      }
    }, 900);
  }, [rating, reviewText]);

  // ── STYLES ────────────────────────────────────────────────────────────
  const card  = {background:bg1, border:"1px solid oklch(1 0 0/0.07)", borderRadius:16, padding:"22px 24px"};
  const inner = {background:bg2, borderRadius:12, padding:"16px 18px"};

  const TAB_DEFS = [
    {id:"overview",  label:"SilentGuard"},
    {id:"rfm",       label:"Peta Pelanggan"},
    {id:"monitor",   label:"Monitor Pengiriman"},
    {id:"detection", label:"Deteksi Ulasan"},
  ];

  const filteredCustomers = filterSeg === "Semua"
    ? customers
    : customers.filter(c => c.seg === filterSeg);

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh", background:bg0, fontFamily:sans, color:"oklch(0.72 0.008 60)", padding:"0 0 60px"}}>
      <style>{FONTS}{KEYFRAMES}{`.num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}scrollbar-width:thin;scrollbar-color:oklch(0.3 0.006 55) transparent;`}</style>

      {/* TOASTS */}
      <div style={{position:"fixed", top:16, right:16, zIndex:300, display:"flex", flexDirection:"column", gap:8, width:320}}>
        {toasts.map(t => (
          <div key={t.id} style={{display:"flex", gap:10, alignItems:"flex-start", background:"oklch(0.22 0.006 55)", border:`1px solid ${t.tc.replace(")","/0.4)")}`, borderRadius:12, padding:"12px 14px", boxShadow:"0 8px 24px oklch(0.1 0.01 55/0.5)", animation:"toastIn .3s cubic-bezier(.2,.9,.3,1.2)"}}>
            <div style={{width:7, height:7, borderRadius:"50%", marginTop:4, flexShrink:0, background:t.tc}}/>
            <div style={{flex:1}}>
              <div style={{font:`600 12px ${sans}`, color:t.tc, marginBottom:2}}>{t.title}</div>
              <div style={{fontSize:12, lineHeight:1.45, color:"oklch(0.62 0.008 60)"}}>{t.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* HEADER + NAV */}
      <div style={{background:bg1, borderBottom:"1px solid oklch(1 0 0/0.07)", padding:"0 32px", position:"sticky", top:0, zIndex:200}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:18, paddingBottom:0, flexWrap:"wrap", gap:12}}>
          <div style={{display:"flex", alignItems:"baseline", gap:12}}>
            <h1 style={{font:`400 22px/1 ${serif}`, margin:0, color:"oklch(0.96 0.005 70)", letterSpacing:"-0.01em"}}>
              Silent<span style={{fontStyle:"italic", color:gold}}>Guard</span>
              <span style={{font:`500 11px ${mono}`, color:dim, letterSpacing:".12em", marginLeft:10, verticalAlign:"middle"}}>OPS CONSOLE</span>
            </h1>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:14}}>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <span style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".08em"}}>Kecepatan</span>
              <button onClick={() => setIsSimRunning(p => !p)} style={{background:isSimRunning?"oklch(0.72 0.08 178/0.2)":"oklch(0.28 0.006 55)", border:`1px solid ${isSimRunning?"oklch(0.72 0.08 178/0.5)":"oklch(1 0 0/0.08)"}`, color:isSimRunning?"oklch(0.72 0.08 178)":"oklch(0.55 0.008 60)", font:`500 11px ${mono}`, padding:"5px 11px", borderRadius:8, cursor:"pointer"}}>
                {isSimRunning ? "⏸" : "▶"}
              </button>
              {[1,5,20].map(spd => (
                <button key={spd} onClick={() => setSimSpeed(spd)} style={{background:simSpeed===spd?"oklch(0.8 0.11 68/0.2)":"none", border:`1px solid ${simSpeed===spd?"oklch(0.8 0.11 68/0.5)":"oklch(1 0 0/0.08)"}`, color:simSpeed===spd?gold:dim, font:`500 11px ${mono}`, padding:"5px 11px", borderRadius:8, cursor:"pointer"}}>
                  {spd}×
                </button>
              ))}
            </div>
            <div className="num" style={{font:`400 16px ${serif}`, color:"oklch(0.96 0.005 70)"}}>{clock.toLocaleTimeString("id-ID",{hour12:false})}</div>
          </div>
        </div>

        {/* TAB BAR */}
        <div style={{display:"flex", gap:0, marginTop:14}}>
          {TAB_DEFS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background:"none", border:"none", borderBottom: tab===t.id ? `2px solid ${gold}` : "2px solid transparent",
              color: tab===t.id ? gold : dim, font:`${tab===t.id?"600":"400"} 13.5px ${sans}`,
              padding:"10px 20px", cursor:"pointer", transition:"all .15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"28px 32px", animation:"fadeIn .25s ease"}}>

        {/* ══════════════════════════════════════════════════════
            TAB: OVERVIEW (SilentGuard)
        ══════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div style={{display:"flex", flexDirection:"column", gap:20, animation:"fadeIn .25s ease"}}>
            <div>
              <div style={{font:`500 11px ${mono}`, color:gold, letterSpacing:".18em", textTransform:"uppercase", marginBottom:10}}>Platform ringkasan</div>
              <p style={{fontSize:14, lineHeight:1.65, color:dim, maxWidth:680, margin:"0 0 24px"}}>
                SilentGuard memantau kesehatan e-commerce dari tiga dimensi — segmentasi nilai pelanggan (RFM), kepatuhan pengiriman seller (Anti-Delay), dan kesesuaian rating vs teks ulasan (AI Text Engine). Sistem ini terintegrasi langsung ke backend platform, bukan dashboard manual.
              </p>
            </div>

            {/* 3 modul overview cards */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16}}>
              {[
                {tab:"rfm",      color:"oklch(0.8 0.11 68)",  label:"Peta Pelanggan", sub:"RFM · K-Means k=4",
                  stat:"79,5%", statLabel:"revenue dari Champions", desc:"Segmentasi 5.878 pelanggan ke 4 cluster — identifikasi yang berisiko churn sebelum terlambat."},
                {tab:"monitor",  color:SP_COLORS[1], label:"Monitor Pengiriman", sub:"Anti-Delay System",
                  stat:orders.filter(o=>o.spLevel>=3).length+"", statLabel:"toko diblokir saat ini", desc:`Eskalasi otomatis SP1 (>${SP1_H}j) → SP2 (>${SP2_H}j) → SP3 (>${SP3_H}j) → Blokir (>${BLOCK_H}j).`},
                {tab:"detection",color:"oklch(0.72 0.08 178)", label:"Deteksi Ulasan", sub:"Rule-based Engine",
                  stat:"48,2%", statLabel:"keluhan terkait pengiriman", desc:"Deteksi mismatch rating vs sentimen teks — menangkap kekecewaan tersembunyi di balik bintang tinggi."},
              ].map(m => (
                <div key={m.tab} onClick={() => setTab(m.tab)} style={{...card, borderTop:`2px solid ${m.color}`, cursor:"pointer", transition:"background .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="oklch(0.22 0.006 55)"}
                  onMouseLeave={e=>e.currentTarget.style.background=bg1}>
                  <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6}}>{m.sub}</div>
                  <div style={{font:`400 17px ${serif}`, color:"oklch(0.96 0.005 70)", marginBottom:12}}>{m.label}</div>
                  <div className="num" style={{font:`400 36px/1 ${serif}`, color:m.color, marginBottom:4}}>{m.stat}</div>
                  <div style={{fontSize:12, color:dim, marginBottom:10}}>{m.statLabel}</div>
                  <div style={{fontSize:12.5, lineHeight:1.55, color:"oklch(0.6 0.008 60)"}}>{m.desc}</div>
                  <div style={{marginTop:14, font:`500 11.5px ${sans}`, color:m.color}}>Buka tab →</div>
                </div>
              ))}
            </div>

            {/* key insight */}
            <div style={{...card, borderLeft:`3px solid ${gold}`}}>
              <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10}}>Insight utama · triangulasi 3 dataset</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16}}>
                {[
                  ["27,9% → 79,5%","Champions menopang hampir seluruh revenue. At-Risk = 13% yang hampir hilang."],
                  ["8,7% terlambat",`Pesanan melewati ${SP1_H} jam sebelum sampai ke kurir — belum termasuk last-mile.`],
                  ["11,9% tak tercatat","Pesanan tanpa catatan pengiriman sama sekali. Potensi pelanggan hilang tanpa notifikasi."],
                  ["0,4% mismatch","Rating ≥4 tapi sentimen negatif — lolos dari dashboard rating konvensional."],
                ].map(([stat, desc]) => (
                  <div key={stat} style={{...inner}}>
                    <div className="num" style={{font:`600 15px ${sans}`, color:gold, marginBottom:6}}>{stat}</div>
                    <div style={{fontSize:12, lineHeight:1.5, color:dim}}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: PETA PELANGGAN (RFM)
        ══════════════════════════════════════════════════════ */}
        {tab === "rfm" && (
          <div style={{display:"flex", flexDirection:"column", gap:20, animation:"fadeIn .25s ease"}}>

            {/* ALERT PERGESERAN SEGMEN */}
            {rfmAlerts.length > 0 && (
              <div style={{background:"oklch(0.24 0.06 25)", border:"1px solid oklch(0.64 0.14 26/0.5)", borderRadius:14, padding:"14px 18px"}}>
                <div style={{font:`600 11px ${mono}`, color:"oklch(0.64 0.14 26)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:10}}>⚠ Alert Pergeseran Segmen</div>
                <div style={{display:"flex", flexDirection:"column", gap:8}}>
                  {rfmAlerts.map(a => (
                    <div key={a.id} style={{display:"flex", alignItems:"center", gap:12, fontSize:13, color:"oklch(0.8 0.006 60)"}}>
                      <span style={{fontFamily:mono, color:dim, fontSize:11}}>[{a.id}]</span>
                      <span style={{fontWeight:600}}>{a.name}</span>
                      <span style={{color:dim}}>bergeser dari</span>
                      <span style={{color:gold}}>Champions</span>
                      <span style={{color:dim}}>→</span>
                      <span style={{color:"oklch(0.64 0.14 26)"}}>At-Risk</span>
                      <span style={{color:dim, fontSize:11}}>· terakhir aktif {a.lastSeen}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DISTRIBUSI */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
              {/* Bar populasi vs revenue */}
              <div style={{...card}}>
                <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:14}}>Distribusi segmen</div>
                <div style={{display:"flex", flexDirection:"column", gap:14}}>
                  {SEG_DEFS.map(s => (
                    <div key={s.name} onClick={() => setFilterSeg(filterSeg===s.name?"Semua":s.name)} style={{cursor:"pointer"}}>
                      <div style={{display:"flex", justifyContent:"space-between", marginBottom:5}}>
                        <span style={{display:"flex", alignItems:"center", gap:8, font:`600 13px ${sans}`, color:"oklch(0.9 0.006 60)"}}>
                          <span style={{width:8, height:8, borderRadius:"50%", background:s.color, display:"inline-block"}}/>
                          {s.name} {filterSeg===s.name && <span style={{font:`500 10px ${mono}`, color:s.color}}>◀ aktif</span>}
                        </span>
                        <span className="num" style={{font:`500 11px ${mono}`, color:dim}}>Rp{s.rpc.toLocaleString("id-ID")}rb/org</span>
                      </div>
                      <div style={{height:8, background:bg0, borderRadius:4, overflow:"hidden", marginBottom:3}}>
                        <div style={{height:"100%", width:`${s.pop}%`, background:s.color, borderRadius:4}}/>
                      </div>
                      <div style={{height:8, background:bg0, borderRadius:4, overflow:"hidden"}}>
                        <div style={{height:"100%", width:`${s.rev}%`, background:"oklch(0.5 0.008 60)", borderRadius:4}}/>
                      </div>
                      <div className="num" style={{display:"flex", justifyContent:"space-between", font:`400 10px ${mono}`, color:"oklch(0.44 0.008 60)", marginTop:4}}>
                        <span>{s.pop}% populasi</span><span>{s.rev}% revenue</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12, display:"flex", gap:12}}>
                  <div style={{display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:dim}}><span style={{width:12, height:3, borderRadius:2, background:SEG_DEFS[0].color, display:"inline-block"}}/>populasi</div>
                  <div style={{display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:dim}}><span style={{width:12, height:3, borderRadius:2, background:"oklch(0.5 0.008 60)", display:"inline-block"}}/>revenue</div>
                </div>
              </div>

              {/* Heatmap RFM */}
              <div style={{...card}}>
                <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:14}}>Profil rata-rata RFM per segmen</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                    <thead>
                      <tr>
                        {["Segmen","Recency (hari)","Frequency","Monetary (rb)","Status"].map(h => (
                          <th key={h} style={{textAlign:h==="Segmen"?"left":"center", padding:"6px 10px", font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".06em", borderBottom:"1px solid oklch(1 0 0/0.07)"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[{name:"Champions",R:31.5,F:15.8,M:8414,ok:true},
                        {name:"At-Risk",R:277,F:4.5,M:1655,ok:false},
                        {name:"New/Promising",R:39.9,F:2.4,M:665,ok:null},
                        {name:"Hibernating",R:431,F:1.2,M:294,ok:false}].map((r,i) => {
                        const seg = SEG_DEFS.find(s=>s.name===r.name);
                        return (
                          <tr key={r.name} style={{background:i%2===0?"transparent":bg2}}>
                            <td style={{padding:"8px 10px", color:seg.color, fontWeight:600}}>{r.name}</td>
                            <td style={{textAlign:"center", padding:"8px 10px", fontFamily:mono, color:r.R>200?"oklch(0.64 0.14 26)":r.R<50?"oklch(0.74 0.09 160)":dim, fontWeight:500}}>{r.R}</td>
                            <td style={{textAlign:"center", padding:"8px 10px", fontFamily:mono, color:r.F>10?"oklch(0.74 0.09 160)":r.F<3?"oklch(0.64 0.14 26)":dim, fontWeight:500}}>{r.F}</td>
                            <td style={{textAlign:"center", padding:"8px 10px", fontFamily:mono, color:r.M>5000?gold:r.M<500?"oklch(0.64 0.14 26)":dim, fontWeight:500}}>{r.M.toLocaleString("id-ID")}</td>
                            <td style={{textAlign:"center", padding:"8px 10px"}}>
                              <span style={{fontSize:10, fontFamily:mono, padding:"3px 8px", borderRadius:5, background:r.ok===true?"oklch(0.72 0.09 160/0.2)":r.ok===false?"oklch(0.64 0.14 26/0.2)":"oklch(0.8 0.11 68/0.15)", color:r.ok===true?"oklch(0.74 0.09 160)":r.ok===false?"oklch(0.64 0.14 26)":gold}}>
                                {r.ok===true?"Aman":r.ok===false?"Perlu tindakan":"Monitor"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* TABEL PELANGGAN */}
            <div style={{...card}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10}}>
                <div>
                  <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:4}}>Daftar pelanggan</div>
                  <div style={{fontSize:13, color:"oklch(0.9 0.006 60)"}}>
                    Menampilkan {filteredCustomers.length} dari {CUSTOMERS_RAW.length} pelanggan
                    {filterSeg !== "Semua" && <span style={{marginLeft:8, padding:"2px 8px", background:`${SEG_DEFS.find(s=>s.name===filterSeg)?.color.replace(")","/0.2)")}`, borderRadius:6, fontSize:11, fontFamily:mono, color:SEG_DEFS.find(s=>s.name===filterSeg)?.color}}>{filterSeg}</span>}
                  </div>
                </div>
                <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"center"}}>
                  {["Semua",...SEG_DEFS.map(s=>s.name)].map(f => {
                    const seg = SEG_DEFS.find(s=>s.name===f);
                    const active = filterSeg === f;
                    return (
                      <button key={f} onClick={() => setFilterSeg(f)} style={{background:active?(seg?seg.color.replace(")","/0.2)"):"oklch(0.8 0.11 68/0.15)"):"none", border:`1px solid ${active?(seg?seg.color.replace(")","/0.5)"):"oklch(0.8 0.11 68/0.5)"):"oklch(1 0 0/0.08)"}`, color:active?(seg?seg.color:gold):dim, font:`500 11.5px ${sans}`, padding:"6px 13px", borderRadius:8, cursor:"pointer"}}>
                        {f}
                      </button>
                    );
                  })}
                  <div style={{marginLeft:"auto"}}>
                    <button onClick={sendCampaign} style={{background:"oklch(0.64 0.14 26/0.2)", border:"1px solid oklch(0.64 0.14 26/0.5)", color:"oklch(0.64 0.14 26)", font:`600 11.5px ${sans}`, padding:"6px 16px", borderRadius:8, cursor:"pointer"}}>
                      🚀 Luncurkan kampanye At-Risk
                    </button>
                  </div>
                </div>
              </div>

              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%", borderCollapse:"collapse", fontSize:12.5}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid oklch(1 0 0/0.08)"}}>
                      {["ID","Nama","Recency","Frequency","Monetary","Segmen","Aksi"].map(h => (
                        <th key={h} style={{textAlign:["Recency","Frequency","Monetary"].includes(h)?"center":"left", padding:"8px 12px", font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".06em"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c, i) => {
                      const seg = SEG_DEFS.find(s => s.name === c.seg);
                      const sent = voucherSent.has(c.id);
                      return (
                        <tr key={c.id} style={{borderBottom:"1px solid oklch(1 0 0/0.04)", background:i%2===0?"transparent":bg2, animation:"slideIn .2s ease"}}>
                          <td style={{padding:"9px 12px", fontFamily:mono, fontSize:11, color:dim}}>{c.id}</td>
                          <td style={{padding:"9px 12px", color:"oklch(0.88 0.005 60)", fontWeight:500}}>{c.name}</td>
                          <td style={{padding:"9px 12px", textAlign:"center", fontFamily:mono, color:c.R>200?"oklch(0.64 0.14 26)":c.R<50?"oklch(0.74 0.09 160)":"oklch(0.8 0.006 60)"}}>{c.R}</td>
                          <td style={{padding:"9px 12px", textAlign:"center", fontFamily:mono, color:c.F>10?"oklch(0.74 0.09 160)":c.F<3?"oklch(0.64 0.14 26)":"oklch(0.8 0.006 60)"}}>{c.F}</td>
                          <td className="num" style={{padding:"9px 12px", textAlign:"center", fontFamily:mono, color:c.M>5000?gold:c.M<500?"oklch(0.64 0.14 26)":"oklch(0.8 0.006 60)"}}>Rp{c.M.toLocaleString("id-ID")}</td>
                          <td style={{padding:"9px 12px"}}>
                            <span style={{fontSize:11, fontFamily:mono, padding:"3px 9px", borderRadius:5, background:seg?.color.replace(")","/0.18)"), color:seg?.color}}>{c.seg}</span>
                          </td>
                          <td style={{padding:"9px 12px"}}>
                            {c.seg === "At-Risk" && (
                              <button onClick={() => sendVoucher(c.id)} disabled={sent} style={{background:sent?"oklch(0.74 0.09 160/0.15)":"oklch(0.64 0.14 26/0.2)", border:`1px solid ${sent?"oklch(0.74 0.09 160/0.4)":"oklch(0.64 0.14 26/0.4)"}`, color:sent?"oklch(0.74 0.09 160)":"oklch(0.64 0.14 26)", font:`500 11px ${sans}`, padding:"5px 11px", borderRadius:7, cursor:sent?"default":"pointer", transition:"all .15s"}}>
                                {sent ? "✓ Terkirim" : "Kirim diskon 15%"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TREATMENT per segmen */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12}}>
              {SEG_DEFS.map(s => (
                <div key={s.name} style={{...inner, borderTop:`2px solid ${s.color}`}}>
                  <div style={{font:`600 13px ${sans}`, color:s.color, marginBottom:8}}>{s.name}</div>
                  <div style={{fontSize:12, lineHeight:1.6, color:dim}}>{s.treatment}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: MONITOR PENGIRIMAN
        ══════════════════════════════════════════════════════ */}
        {tab === "monitor" && (
          <div style={{display:"flex", flexDirection:"column", gap:20, animation:"fadeIn .25s ease"}}>

            {/* threshold info */}
            <div style={{...card}}>
              <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:14}}>Eskalasi otomatis — threshold tetap</div>
              <div style={{display:"flex", gap:12, flexWrap:"wrap", marginBottom:14}}>
                {[[`> ${REMIND_H} jam`,"Reminder","Peringatan awal otomatis sebelum SP1","oklch(0.78 0.1 78)"],
                  [`> ${SP1_H} jam`,"SP1","Surat peringatan pertama dikirim ke seller",SP_COLORS[1]],
                  [`> ${SP2_H} jam`,"SP2","SP kedua, upload produk dibatasi",SP_COLORS[2]],
                  [`> ${SP3_H} jam`,"SP3","SP ketiga, penjualan dibekukan",SP_COLORS[3]],
                  [`> ${BLOCK_H} jam`,"Blokir","Toko diblokir, refund otomatis ke pembeli",SP_COLORS[4]]].map(([time,label,desc,col]) => (
                  <div key={label} style={{flex:1, minWidth:150, background:bg2, border:`1px solid ${col.replace(")","/0.3)")}`, borderRadius:10, padding:"12px 14px"}}>
                    <div className="num" style={{font:`700 13px ${mono}`, color:col, marginBottom:4}}>{time}</div>
                    <div style={{font:`600 12px ${sans}`, color:"oklch(0.85 0.005 60)", marginBottom:4}}>{label}</div>
                    <div style={{fontSize:11.5, lineHeight:1.5, color:dim}}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{font:`400 12px ${mono}`, color:dim}}>
                Order masuk otomatis dari sistem — tidak ada input manual.
                Saat ini: <span style={{color:"oklch(0.74 0.09 160)"}}>{orders.filter(o=>o.spLevel===0).length} aman</span> ·{" "}
                <span style={{color:SP_COLORS[1]}}>{orders.filter(o=>o.spLevel===1).length} SP1</span> ·{" "}
                <span style={{color:SP_COLORS[2]}}>{orders.filter(o=>o.spLevel===2).length} SP2</span> ·{" "}
                <span style={{color:SP_COLORS[3]}}>{orders.filter(o=>o.spLevel===3).length} SP3</span> ·{" "}
                <span style={{color:SP_COLORS[4]}}>{orders.filter(o=>o.spLevel>=4).length} diblokir</span>
              </div>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:20, alignItems:"start"}}>
              {/* ORDER CARDS */}
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12}}>
                {orders.map(o => {
                  const thArr = [0, SP1_H, SP2_H, SP3_H, BLOCK_H];
                  const start  = thArr[Math.min(o.spLevel, 3)];
                  const target = thArr[Math.min(o.spLevel+1, 4)];
                  const pct    = o.spLevel >= 4 ? 1 : Math.max(0, Math.min(1, (o.elapsed - start)/(target - start)));
                  const col    = SP_COLORS[o.spLevel];
                  const nextTh = [SP1_H, SP2_H, SP3_H, BLOCK_H][Math.min(o.spLevel, 3)];
                  const rem    = Math.max(0, nextTh - o.elapsed);
                  const remTxt = o.spLevel >= 4 ? "Toko ditutup — refund diproses." : `${fmt1(rem)} jam menuju ${["SP1","SP2","SP3","Blokir"][o.spLevel]}`;
                  const deg    = Math.round(pct*360);
                  return (
                    <div key={o.id} style={{background:o.spLevel>=3?"oklch(0.22 0.06 25)":bg2, border:o.spLevel>=3?"1px solid oklch(0.64 0.14 26/0.5)":"1px solid oklch(1 0 0/0.06)", borderRadius:14, padding:"14px 15px", animation:o.spLevel>=3?"pulseBlocked 2s ease infinite":"none"}}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12}}>
                        <div>
                          <div className="num" style={{font:`500 13px ${mono}`, color:"oklch(0.9 0.006 60)"}}>{o.code}</div>
                          <div style={{fontSize:11, color:dim, marginTop:3}}>{o.seller}</div>
                        </div>
                        <div style={{font:`500 10px ${mono}`, color:col, background:col.replace(")","/0.14)"), padding:"4px 9px", borderRadius:6, whiteSpace:"nowrap"}}>{SP_LABELS[o.spLevel]}</div>
                      </div>
                      <div style={{display:"flex", alignItems:"center", gap:12}}>
                        <div style={{width:50, height:50, borderRadius:"50%", flexShrink:0, background:`conic-gradient(${col} ${deg}deg, oklch(0.26 0.006 55) ${deg}deg 360deg)`, display:"flex", alignItems:"center", justifyContent:"center"}}>
                          <div style={{width:39, height:39, borderRadius:"50%", background:o.spLevel>=3?"oklch(0.22 0.06 25)":bg1, display:"flex", alignItems:"center", justifyContent:"center", color:col}}>
                            <div className="num" style={{font:`500 11px ${mono}`}}>{fmt1(o.elapsed)}h</div>
                          </div>
                        </div>
                        <div style={{flex:1, fontSize:11.5, color:dim, lineHeight:1.45}}>{remTxt}</div>
                      </div>
                      {o.spLevel >= 4 && (
                        <div style={{marginTop:10, background:"oklch(0.6 0.17 25)", color:"oklch(0.98 0.01 60)", font:`700 11px ${sans}`, padding:"6px 9px", borderRadius:8, textAlign:"center", animation:"blockBadgeIn .5s cubic-bezier(.34,1.56,.64,1)"}}>
                          Toko diblokir — refund diproses
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* LOG */}
              <div style={{background:"oklch(0.115 0.006 55)", border:"1px solid oklch(1 0 0/0.05)", borderRadius:14, padding:16, display:"flex", flexDirection:"column", height:440}}>
                <div style={{font:`500 10px ${mono}`, letterSpacing:".12em", textTransform:"uppercase", color:dim, marginBottom:12, display:"flex", alignItems:"center", gap:8}}>
                  <span style={{width:6, height:6, borderRadius:"50%", background:"oklch(0.74 0.09 160)", animation:"analyzePulse 2s ease infinite", display:"inline-block"}}/>
                  Log aktivitas sistem
                </div>
                <div ref={logRef} style={{flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:5}}>
                  {logEntries.length === 0 && <div style={{fontSize:12, color:"oklch(0.38 0.006 55)", textAlign:"center", padding:"30px 0"}}>Menunggu aktivitas…</div>}
                  {logEntries.map(l => (
                    <div key={l.id} style={{animation:"logIn .3s ease", font:`400 11px/1.5 ${mono}`, color:l.col, borderLeft:`2px solid ${l.col}`, padding:"5px 9px", background:bg0, borderRadius:"0 7px 7px 0"}}>
                      <span style={{color:"oklch(0.4 0.008 60)"}}>[{l.time}]</span> {l.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB: DETEKSI ULASAN
        ══════════════════════════════════════════════════════ */}
        {tab === "detection" && (
          <div style={{display:"flex", flexDirection:"column", gap:20, animation:"fadeIn .25s ease"}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20}}>

              {/* INPUT */}
              <div style={{...card, animation:shake?"shakeX .45s ease":"none"}}>
                <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:14}}>Simulasi deteksi ulasan</div>
                <div style={{fontSize:12.5, color:dim, marginBottom:16, lineHeight:1.5}}>
                  Rule-based dengan penanganan negasi — "tidak rusak" tidak ter-flag. Placeholder untuk model Linear SVM (F1 = 0,93).
                </div>

                <div style={{display:"flex", gap:7, marginBottom:14, flexWrap:"wrap"}}>
                  {PRESET_DEFS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p)} style={{background:bg2, border:"1px solid oklch(1 0 0/0.08)", color:dim, font:`500 11px ${mono}`, padding:"7px 12px", borderRadius:8, cursor:"pointer"}}>{p.label}</button>
                  ))}
                </div>

                <div style={{display:"flex", gap:6, marginBottom:12}}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => { setRating(n); setResultBanner(null); }} style={{background:"none", border:"none", fontSize:28, cursor:"pointer", lineHeight:1, padding:0, color:n<=rating?gold:"oklch(0.3 0.006 55)", transition:"color .15s"}}>★</button>
                  ))}
                  {rating > 0 && <span style={{font:`400 11px ${mono}`, color:dim, alignSelf:"center", marginLeft:4}}>{rating} bintang</span>}
                </div>

                <textarea placeholder="Tulis ulasan di sini…" value={reviewText} onChange={e => { setReviewText(e.target.value); setResultBanner(null); }}
                  style={{width:"100%", minHeight:100, background:bg2, border:"1px solid oklch(1 0 0/0.08)", borderRadius:11, color:"oklch(0.9 0.006 60)", font:`400 13.5px/1.5 ${sans}`, padding:12, resize:"vertical", boxSizing:"border-box"}}/>

                <button onClick={submitReview} disabled={!rating || !reviewText.trim()} style={{marginTop:12, width:"100%", background:(!rating||!reviewText.trim())?"oklch(0.8 0.11 68/0.3)":gold, border:"none", color:"oklch(0.2 0.04 60)", font:`700 13.5px ${sans}`, padding:12, borderRadius:11, cursor:(!rating||!reviewText.trim())?"not-allowed":"pointer", transition:"all .15s"}}>
                  Kirim ulasan
                </button>

                {analyzing && <div style={{marginTop:10, font:`500 11px ${mono}`, color:gold, animation:"analyzePulse 1s ease infinite"}}>Menganalisis teks ulasan…</div>}

                {resultBanner && (
                  <div style={{marginTop:12, background:resultBanner.bg, border:`1px solid ${resultBanner.border}`, color:resultBanner.fg, padding:"13px 15px", borderRadius:12, animation:"popIn .3s ease"}}>
                    <div style={{display:"flex", gap:9, alignItems:"flex-start", marginBottom: resultBanner.type==="mismatch" ? 8 : 0}}>
                      <div style={{fontSize:18}}>{resultBanner.icon}</div>
                      <div style={{font:`500 13px/1.45 ${sans}`}}>{resultBanner.msg}</div>
                    </div>
                    {resultBanner.type === "mismatch" && resultBanner.words.length > 0 && (
                      <div style={{fontSize:12.5, lineHeight:1.6, marginTop:6, padding:"8px 10px", background:"oklch(0 0 0/0.2)", borderRadius:8}}>
                        <span style={{fontFamily:mono, fontSize:11, color:"oklch(0.6 0.008 60)", marginRight:6}}>teks ter-flag:</span>
                        {highlightText(reviewText, resultBanner.words)}
                      </div>
                    )}
                    <div style={{marginTop:8, font:`500 10px ${mono}`, color:"oklch(0.55 0.01 60)", letterSpacing:".04em"}}>
                      sinyal: {resultBanner.neg>0?`negatif ${resultBanner.neg}pt`:""}{resultBanner.pos>0?` / positif ${resultBanner.pos}pt`:""} · confidence: <span style={{color:resultBanner.fg}}>{resultBanner.conf}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* KANAN */}
              <div style={{display:"flex", flexDirection:"column", gap:14}}>
                {/* statistik */}
                <div style={{...card}}>
                  <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:12}}>Penyebab ulasan negatif — historis (PRDECT-ID)</div>
                  <div style={{display:"flex", height:32, borderRadius:8, overflow:"hidden", marginBottom:10}}>
                    <div className="num" style={{width:"48.2%", background:"oklch(0.72 0.08 178)", display:"flex", alignItems:"center", justifyContent:"center", font:`600 12px ${sans}`, color:"oklch(0.18 0.03 178)"}}>48.2%</div>
                    <div className="num" style={{width:"51.8%", background:gold, display:"flex", alignItems:"center", justifyContent:"center", font:`600 12px ${sans}`, color:"oklch(0.2 0.04 60)"}}>51.8%</div>
                  </div>
                  <div style={{display:"flex", justifyContent:"space-between", fontSize:11.5, color:dim, gap:8}}>
                    <div style={{display:"flex", alignItems:"center", gap:5}}><span style={{width:8, height:8, borderRadius:2, background:"oklch(0.72 0.08 178)", display:"inline-block"}}/>Terkait pengiriman/kemasan</div>
                    <div style={{display:"flex", alignItems:"center", gap:5}}><span style={{width:8, height:8, borderRadius:2, background:gold, display:"inline-block"}}/>Penyebab lain</div>
                  </div>
                </div>

                {/* kasus mismatch */}
                <div style={{...card}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                    <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em"}}>Riwayat ulasan ter-flag ({flagHistory.length})</div>
                    {flagHistory.length > 0 && <button onClick={() => setFlagHistory([])} style={{background:"none", border:"none", color:"oklch(0.45 0.008 60)", font:`500 10px ${mono}`, cursor:"pointer"}}>hapus semua</button>}
                  </div>
                  {flagHistory.length === 0 ? (
                    <div style={{fontSize:12, color:"oklch(0.4 0.008 60)", textAlign:"center", padding:"20px 0"}}>Belum ada ulasan ter-flag sesi ini</div>
                  ) : (
                    <div style={{display:"flex", flexDirection:"column", gap:7, maxHeight:260, overflowY:"auto"}}>
                      {flagHistory.map(f => (
                        <div key={f.id} style={{padding:"9px 12px", background:bg2, borderLeft:"2px solid oklch(0.64 0.14 26)", borderRadius:"0 8px 8px 0"}}>
                          <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
                            <span style={{font:`600 11px ${mono}`, color:"oklch(0.64 0.14 26)"}}>★{f.rating} mismatch {f.type==="low" ? "(positif→rendah)" : "(negatif→tinggi)"}</span>
                            <span style={{font:`400 10px ${mono}`, color:"oklch(0.44 0.008 60)"}}>[{f.time}]</span>
                          </div>
                          <div style={{fontSize:12, color:"oklch(0.62 0.008 60)", lineHeight:1.4}}>
                            {f.text.length > 80 ? f.text.slice(0,80)+"…" : f.text}
                          </div>
                          <div style={{marginTop:4, fontSize:11, color:dim, fontFamily:mono}}>kata kunci: {f.words.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* contoh kasus nyata */}
                <div style={{...card}}>
                  <div style={{font:`500 10px ${mono}`, color:dim, textTransform:"uppercase", letterSpacing:".1em", marginBottom:12}}>Contoh kasus mismatch nyata (dari dataset)</div>
                  {[
                    {r:5, e:"Anger",    t:"Ngirim barang gak sesuai pesanan, ngeselinnn !!!"},
                    {r:5, e:"Sadness",  t:"barang tdk sesuai harus dtng 16 pc, kecewa banget"},
                    {r:4, e:"Sadness",  t:"Sayang banget dicuci pake mesin cuci langsung rusak"},
                  ].map((c,i) => (
                    <div key={i} style={{padding:"9px 12px", background:bg2, borderRadius:9, marginBottom:7, borderLeft:"2px solid oklch(0.64 0.14 26)"}}>
                      <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:4}}>
                        <span style={{fontFamily:mono, fontSize:11, color:gold}}>★{c.r}</span>
                        <span style={{fontSize:10, padding:"2px 7px", borderRadius:5, background:"oklch(0.64 0.14 26/0.2)", color:"oklch(0.64 0.14 26)", fontFamily:mono}}>{c.e}</span>
                      </div>
                      <div style={{fontSize:12, color:dim, lineHeight:1.45}}>{c.t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
