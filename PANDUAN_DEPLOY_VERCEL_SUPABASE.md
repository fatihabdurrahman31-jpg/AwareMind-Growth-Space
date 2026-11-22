# Panduan Deploy AwareMind Growth Space (Vercel + Supabase + Email Otomatis)

Paket ini **100% tanpa n8n** (nol risiko blokir WhatsApp), gratis untuk tahap awal 0–100+ pembeli, dan sudah mendukung **Login Otomatis Google / Magic Link Email**, **Upload File Produk di `/admin`**, **Verifikasi QRIS/DANA**, **Email Akses Produk**, dan **Tombol Gabung Grup WA Pembeli**.

## Isi Paket
1. `index.html` — Website responsif Desktop & HP (HD Mindy + 6 Ruang + Jurnal & Level 1–3 + Checkout + Tombol Grup WA).
2. `admin.html` — Panel Admin tim (`/admin`) untuk ACC bukti transfer 1 klik, upload PDF/link Canva/Notion/Sheets, dan ubah Link Grup WA.
3. `supabase_schema.sql` — Skema 7 tabel database + Row Level Security + Storage Buckets + penghitung Milestone `0/100`.
4. `api/send-access-email.js` — Fungsi serverless Vercel + Resend untuk kirim email `"AKSES PRODUK KAMU DI SINI"` + Link Grup WA otomatis.

## Langkah Deploy (10 Menit)
1. **Setup Supabase (Database & Login Email/Google):**
   - Buka proyek Supabase → masuk menu **SQL Editor** → paste seluruh isi `supabase_schema.sql` → klik **Run**.
   - Masuk **Authentication → Providers** → aktifkan **Email (Magic Link)** dan **Google** (masukkan Client ID/Secret dari Google Cloud Console).
   - Setelah Fatih & Sofi login pertama kali, jalankan perintah SQL di baris paling bawah `supabase_schema.sql` untuk menjadikan email kalian berstatus `admin`.
2. **Setup Email Otomatis Gratis (Resend):**
   - Daftar gratis di [resend.com](https://resend.com) (kuota 3.000 email/bulan gratis) → buat **API Key**.
3. **Upload ke GitHub & Deploy di Vercel:**
   - Upload seluruh isi folder ini ke repositori GitHub proyek `awaremind-growthspace`.
   - Di Vercel → **Project Settings → Environment Variables**, tambahkan:
     - `RESEND_API_KEY` = API key Resend kamu
     - `NEXT_PUBLIC_SITE_URL` = `https://awaremind-growthspace.vercel.app`
   - Masukkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` pada bagian konfigurasi di `index.html` dan `admin.html`, lalu klik **Deploy**.
4. **Isi Link Grup WA Pembeli:**
   - Buka `https://awaremind-growthspace.vercel.app/admin.html` → Tab **Link Grup WA & QRIS** → tempel link undangan Grup WA resmi AwareMind → Simpan.
