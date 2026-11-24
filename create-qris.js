// Vercel Serverless Function: /api/create-qris
// Membuat QRIS dinamis khusus metode QRIS (potongan ~0.7%, tanpa VA Rp4.000) via Midtrans Core API

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
  const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === "true";
  if (!SERVER_KEY) {
    return res.status(500).json({ error: "MIDTRANS_SERVER_KEY belum diisi di Vercel Environment Variables." });
  }

  const { orderId, grossAmount, buyerName, buyerEmail } = req.body || {};
  if (!orderId || !grossAmount || grossAmount < 1000) {
    return res.status(400).json({ error: "orderId dan grossAmount valid wajib dikirim." });
  }

  const baseUrl = IS_PROD ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  const auth = Buffer.from(`${SERVER_KEY}:`).toString("base64");

  try {
    const response = await fetch(`${baseUrl}/v2/charge`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: {
          order_id: String(orderId),
          gross_amount: Math.round(Number(grossAmount)),
        },
        customer_details: {
          first_name: buyerName || "Mindbuddy",
          email: buyerEmail || "member@awaremind.id",
        },
        qris: { acquirer: "gopay" },
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    const qrAction = (data.actions || []).find((a) => a.name === "generate-qr-code");
    return res.status(200).json({
      ok: true,
      orderId: data.order_id,
      transactionId: data.transaction_id,
      qrUrl: qrAction ? qrAction.url : null,
      expiryTime: data.expiry_time || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
