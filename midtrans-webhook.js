// Vercel Serverless Function: /api/midtrans-webhook
// Daftarkan URL: https://awaremind-growthspace.vercel.app/api/midtrans-webhook di Midtrans Dashboard -> Payment Notification URL

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://awaremind-growthspace.vercel.app";

  if (!SERVER_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Environment variables Midtrans / Supabase belum lengkap." });
  }

  const { order_id, status_code, gross_amount, signature_key, transaction_status } = req.body || {};

  // 1. Verifikasi SHA-512 Signature Midtrans (Anti-spoofing / anti-hack!)
  const expectedSig = crypto
    .createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${SERVER_KEY}`)
    .digest("hex");

  if (signature_key !== expectedSig) {
    return res.status(403).json({ error: "Signature tidak valid." });
  }

  if (transaction_status !== "settlement" && transaction_status !== "capture") {
    return res.status(200).json({ ok: true, ignored: transaction_status });
  }

  const sbHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // 2. Ambil data order dari Supabase
    const ordRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order_id)}&select=*`, {
      headers: sbHeaders,
    });
    const orders = await ordRes.json();
    const order = orders && orders[0];
    if (!order || order.status === "paid") {
      return res.status(200).json({ ok: true, note: "Order tidak ditemukan atau sudah lunas." });
    }

    // 3. Tandai Order LUNAS (Otomatis menaikkan Milestone 0/100!)
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order_id)}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString() }),
    });

    // 4. Buka akses produk di user_library atau aktifkan Premium Lifetime
    for (const item of order.items || []) {
      if (item.kind === "premium" && order.user_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${order.user_id}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({ is_premium: true }),
        });
      } else if (order.user_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/user_library`, {
          method: "POST",
          headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            user_id: order.user_id,
            product_id: item.id,
            product_title: item.title,
            product_meta: item.meta || "",
            access_url: item.access_url || "",
          }),
        });
      }
    }

    // 5. Ambil Link Grup WA Pembeli & kirim Email Akses Otomatis via Resend
    if (RESEND_API_KEY && order.buyer_email) {
      const setRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.wa_group_url&select=value`, {
        headers: sbHeaders,
      });
      const setRows = await setRes.json();
      const waGroupUrl = setRows && setRows[0] ? setRows[0].value : "";

      await fetch(`${SITE_URL}/api/send-access-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-webhook": SERVER_KEY,
        },
        body: JSON.stringify({
          buyerEmail: order.buyer_email,
          buyerName: order.buyer_name,
          items: order.items || [],
          waGroupUrl,
        }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(order_id)}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({ email_sent: true }),
      });
    }

    return res.status(200).json({ ok: true, orderId: order_id, status: "paid" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
