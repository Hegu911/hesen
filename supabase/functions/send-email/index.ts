// Sends emails via Gmail SMTP using app password.
// Single endpoint, body: { type, payload }
// Types:
//   - "design-request"    -> sanaymiraga64@gmail.com
//   - "order"             -> eli120124@gmail.com
//   - "collaboration"     -> samirsamiragayevagayev1121@gmail.com

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

type EmailType = "design-request" | "order" | "collaboration";

const TARGETS: Record<EmailType, string> = {
  "design-request": "sanaymiraga64@gmail.com",
  "order": "eli120124@gmail.com",
  "collaboration": "samirsamiragayevagayev1121@gmail.com",
};

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowsToHtml(rows: [string, unknown][]): string {
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600">${escapeHtml(
          k
        )}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(v)}</td></tr>`
    )
    .join("");
}

function buildEmail(type: EmailType, payload: any): { subject: string; html: string } {
  if (type === "design-request") {
    const rows: [string, unknown][] = [
      ["Ad Soyad", payload.fullName],
      ["E-poçt", payload.email],
      ["Telefon", payload.phone || "—"],
      ["Təsvir", payload.description],
      ["Şablon", payload.templateName || "—"],
      ["Şəkil", payload.imageUrl || "—"],
    ];
    return {
      subject: `🎨 Yeni Dizayn Sorğusu — ${payload.fullName ?? "Müştəri"}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px">
        <h2 style="margin:0 0 12px">Yeni Dizayn Sorğusu</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">${rowsToHtml(rows)}</table>
        ${payload.imageUrl ? `<p style="margin-top:12px"><img src="${escapeHtml(payload.imageUrl)}" style="max-width:100%;border-radius:8px"/></p>` : ""}
      </div>`,
    };
  }
  if (type === "order") {
    const items: any[] = Array.isArray(payload.items) ? payload.items : [];
    const itemsHtml = items
      .map(
        (it) =>
          `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(it.name)}</td>
           <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center">${escapeHtml(it.quantity)}</td>
           <td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right">${escapeHtml(it.price)} ₼</td></tr>`
      )
      .join("");
    const rows: [string, unknown][] = [
      ["Sifariş №", payload.orderNumber],
      ["Ad Soyad", payload.fullName],
      ["E-poçt", payload.email],
      ["Telefon", payload.phone],
      ["Ünvan", payload.address],
      ["Şəhər", payload.city],
      ["Qeyd", payload.note || "—"],
      ["Cəmi", `${payload.total} ₼`],
    ];
    return {
      subject: `🛒 Yeni Sifariş — ${payload.orderNumber}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px">
        <h2 style="margin:0 0 12px">Yeni Sifariş</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:14px">${rowsToHtml(rows)}</table>
        <h3 style="margin:8px 0">Məhsullar</h3>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <thead><tr>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left">Məhsul</th>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Miqdar</th>
            <th style="padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb;text-align:right">Qiymət</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>`,
    };
  }
  // collaboration
  const rows: [string, unknown][] = [
    ["Ad", payload.firstName],
    ["Soyad", payload.lastName],
    ["Telefon", payload.phone],
    ["Ünvan", payload.address],
    ["Poçt indeksi", payload.postalCode],
    ["Mesaj", payload.message || "—"],
  ];
  return {
    subject: `🤝 Yeni Əməkdaşlıq Sorğusu — ${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim(),
    html: `<div style="font-family:Arial,sans-serif;max-width:640px">
      <h2 style="margin:0 0 12px">Yeni Əməkdaşlıq Sorğusu</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">${rowsToHtml(rows)}</table>
    </div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!GMAIL_USER) throw new Error("GMAIL_USER is not configured");
    if (!GMAIL_APP_PASSWORD) throw new Error("GMAIL_APP_PASSWORD is not configured");

    const body = await req.json();
    const type = body.type as EmailType;
    if (!type || !TARGETS[type]) {
      return new Response(JSON.stringify({ error: "Invalid email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildEmail(type, body.payload ?? {});
    const to = TARGETS[type];

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD.replace(/\s+/g, "") },
      },
    });

    await client.send({
      from: `Chaply <${GMAIL_USER}>`,
      to,
      subject,
      html,
      content: "auto",
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true, to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
