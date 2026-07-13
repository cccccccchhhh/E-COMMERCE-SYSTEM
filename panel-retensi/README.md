# Panel Retensi & Operasional E-Commerce

Prototipe dashboard interaktif (React + Vite) untuk TECHFEST 2026 — segmentasi RFM,
kepatuhan pengiriman seller, dan deteksi mismatch rating vs ulasan.

## Menjalankan secara lokal
```bash
npm install
npm run dev
```
Buka http://localhost:5173

## Build produksi
```bash
npm run build      # output ke folder dist/
npm run preview    # cek hasil build
```

## Deploy ke Vercel

### Cara A — via GitHub (disarankan)
1. Push folder ini ke repository GitHub.
2. Buka https://vercel.com → **Add New Project** → import repo.
3. Vercel otomatis mendeteksi Vite. Klik **Deploy**.

### Cara B — via CLI
```bash
npm install -g vercel
vercel
```
Ikuti prompt. Framework Vite terdeteksi otomatis (build: `npm run build`, output: `dist`).
