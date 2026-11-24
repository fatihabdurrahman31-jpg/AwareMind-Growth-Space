# Panduan Deploy Full-Stack AwareMind Growth Space (Vercel + Supabase + Midtrans QRIS + Email Otomatis)

Paket ini **100% final, tanpa n8n** (nol risiko blokir WhatsApp), dan sudah mencakup **2 mode pembayaran sekaligus**:
- **Mode Langsung Jalan Hari Ini:** QRIS Statis / DANA + ACC 1 klik di `/admin.html`.
- **Mode 100% Otomatis 24 Jam (Midtrans QRIS):** Begitu akun Midtrans disetujui, cukup isi `MIDTRANS_SERVER_KEY` di Vercel — sistem otomatis cek lunas (SHA-512), buka Library, naikkan Milestone `0/100`, dan kirim email + Link Grup WA.

## Daftar File Lengkap dalam Paket
1. `index.html` — Storefront responsif Desktop & HP dengan 12/12 banner produk HD, banner bundling Mindy, kartu Level 1–3 HD, login Google/Magic Link, dan redirect Portal HealMind.
2. `admin.html` — Panel Admin tim (`/admin.html`) untuk upload/edit produk, ACC transfer 1 klik, dan atur Link Grup WA.
3. `supabase_schema.sql` — Skema 7 tabel + RLS keamanan ketat (role/premium terkunci, Link Grup WA hanya untuk pembeli lunas) + Storage Buckets + Milestone `0/100`.
4. `api/send-access-email.js` — Pengirim email otomatis `"AKSES PRODUK KAMU DI SINI"` + tombol `"Gabung Grup WA Pembeli"` (Resend gratis 3.000 email/bulan).
5. `api/create-qris.js` — Generator QRIS Midtrans khusus QRIS (~0,7% fee, tanpa VA Rp4.000).
6. `api/midtrans-webhook.js` — Penerima status LUNAS otomatis dari Midtrans (verifikasi SHA-512 anti-hack).

## Environment Variables di Vercel (Settings -> Environment Variables)
| Variabel | Sumber | Wajib Saat Awal? |
| :--- | :--- | :---: |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (Secret) | Ya (untuk Webhook Midtrans) |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys | Ya |
| `NEXT_PUBLIC_SITE_URL` | `https://awaremind-growthspace.vercel.app` | Ya |
| `MIDTRANS_SERVER_KEY` | Midtrans Dashboard → Settings → Access Keys | Setelah Midtrans disetujui |
| `MIDTRANS_IS_PRODUCTION` | `false` (Sandbox) atau `true` (Live) | Setelah Midtrans disetujui |

## Pengaturan Webhook di Midtrans Dashboard
Masuk ke **Midtrans Dashboard → Settings → Configuration → Payment Notification URL**, lalu isi:
`https://awaremind-growthspace.vercel.app/api/midtrans-webhook`
