// Vercel Serverless Function: /api/send-access-email
// Mengirim email otomatis berisi link "AKSES PRODUK KAMU DI SINI" + Link Grup WA Pembeli (Gratis via Resend, tanpa n8n)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_SECRET = process.env.ADMIN_API_SECRET;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://awaremind-growthspace.vercel.app";

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY belum diatur di Vercel Environment Variables." });
  }
  // Verifikasi wajib JWT Admin dari Supabase agar tidak bisa di-spam pihak luar
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isInternalWebhook = process.env.MIDTRANS_SERVER_KEY && req.headers["x-internal-webhook"] === process.env.MIDTRANS_SERVER_KEY;
  if (!isInternalWebhook && SUPABASE_URL && SUPABASE_ANON_KEY) {
    if (!token) return res.status(401).json({ error: "Token login admin diperlukan." });
    const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!uRes.ok) return res.status(401).json({ error: "Sesi admin tidak valid." });
  }

  const { buyerEmail, buyerName, items = [], waGroupUrl } = req.body || {};
  if (!buyerEmail) {
    return res.status(400).json({ error: "buyerEmail wajib diisi." });
  }

  const itemsHtml = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F8;font-size:14px;color:#121A4A;font-weight:700;">
          ${it.title}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F8;text-align:right;">
          ${
            it.access_url
              ? `<a href="${it.access_url}" style="display:inline-block;padding:6px 14px;background:#1A9BFF;color:#FFFFFF;text-decoration:none;border-radius:999px;font-size:12px;font-weight:700;">Buka File</a>`
              : `<a href="${SITE_URL}/#library" style="display:inline-block;padding:6px 14px;background:#43329A;color:#FFFFFF;text-decoration:none;border-radius:999px;font-size:12px;font-weight:700;">Di Library</a>`
          }
        </td>
      </tr>`
    )
    .join("");

  const waSection = waGroupUrl
    ? `
      <div style="margin-top:20px;padding:18px;background:#E6F7F4;border:1px solid #B5E5DC;border-radius:16px;text-align:center;">
        <div style="font-size:13px;font-weight:800;color:#0F6B5A;margin-bottom:6px;">
          Grup WhatsApp Komunitas Pembeli AwareMind
        </div>
        <p style="font-size:12px;color:#33544E;margin:0 0 12px;">
          Yuk gabung ke grup WA khusus pembeli untuk update bonus, sesi bareng, dan pengumuman Milestone 100 Pembeli!
        </p>
        <a href="${waGroupUrl}" style="display:inline-block;padding:11px 22px;background:#14967F;color:#FFFFFF;text-decoration:none;border-radius:999px;font-size:13px;font-weight:800;">
          Gabung Grup WA Pembeli Sekarang
        </a>
      </div>`
    : "";

  const htmlBody = `
    <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#F4F7FF;padding:28px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:24px;overflow:hidden;border:1px solid #E2E8F8;">
        <div style="background:linear-gradient(120deg,#37288E,#43329A);padding:28px 24px;color:#FFFFFF;">
          <div style="font-size:12px;font-weight:700;opacity:0.85;letter-spacing:0.08em;text-transform:uppercase;">AwareMind Growth Space</div>
          <h1 style="margin:8px 0 6px;font-size:22px;line-height:1.25;">Akses Produkmu Sudah Aktif!</h1>
          <p style="margin:0;font-size:13px;color:#DCE6FF;">Halo ${buyerName || "Mindbuddy"}, terima kasih sudah bertumbuh bersama Mindy.</p>
        </div>
        <div style="padding:24px;">
          <p style="font-size:14px;color:#121A4A;line-height:1.6;margin-top:0;">
            Semua produk berikut sudah otomatis masuk ke <strong>Library Saya</strong> di akunmu dengan akses seumur hidup (<em>lifetime</em>):
          </p>
          <table style="width:100%;border-collapse:collapse;margin:14px 0 20px;">
            ${itemsHtml}
          </table>
          <div style="text-align:center;margin:22px 0;">
            <a href="${SITE_URL}/#library" style="display:inline-block;padding:14px 28px;background:#43329A;color:#FFFFFF;text-decoration:none;border-radius:999px;font-size:14px;font-weight:800;">
              AKSES PRODUK KAMU DI SINI
            </a>
          </div>
          ${waSection}
          <p style="margin-top:24px;font-size:11px;color:#5A6484;text-align:center;line-height:1.5;">
            You Don't Have to Be Perfect to Grow. You Just Need a Space to Start.<br/>
            AwareMind Indonesia (@awaremind.id) &middot; Platform Edukasi Non-Klinis
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "AwareMind Growth Space <onboarding@resend.dev>",
        to: [buyerEmail],
        subject: "AKSES PRODUK KAMU DI SINI — AwareMind Growth Space",
        html: htmlBody,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
