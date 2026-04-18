// Google Sheets bridge — actions:
//   GET  ?action=canvas-products      -> read canvas_products sheet
//   GET  ?action=products             -> read products sheet
//   GET  ?action=orders               -> read orders sheet (admin)
//   POST ?action=save-design          -> append to Designs sheet
//   POST ?action=order                -> append to orders sheet
//   POST ?action=update-order-status  -> update status column for orderId
//   POST ?action=upsert-product       -> append/update products sheet row
//   POST ?action=delete-product       -> mark inactive (column H = FALSE)
//   POST ?action=upsert-canvas-product
//   POST ?action=delete-canvas-product
//
// Auth: Google Service Account JWT.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

// ---------- JWT signing ----------
function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerEnc = base64UrlEncode(JSON.stringify(header));
  const claimEnc = base64UrlEncode(JSON.stringify(claim));
  const signingInput = `${headerEnc}.${claimEnc}`;
  const keyBuf = pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n"));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(sigBuf)}`;
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed [${res.status}]: ${t}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// ---------- Sheets helpers ----------
async function readSheet(token: string, sheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets read failed [${res.status}]: ${t}`);
  }
  return await res.json();
}

async function appendSheet(token: string, sheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets append failed [${res.status}]: ${t}`);
  }
  return await res.json();
}

async function updateSheet(token: string, sheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Sheets update failed [${res.status}]: ${t}`);
  }
  return await res.json();
}

async function findRowById(token: string, sheetId: string, sheetName: string, id: string): Promise<number | null> {
  const data = await readSheet(token, sheetId, `${sheetName}!A2:A10000`);
  const rows: any[][] = data.values ?? [];
  const idx = rows.findIndex((r) => String(r[0] ?? "") === String(id));
  return idx === -1 ? null : idx + 2; // +2 because A2 is row 2
}

function normalizeDriveUrl(url: string): string {
  if (!url) return url;
  const m1 = url.match(/\/file\/d\/([^/]+)/);
  const m2 = url.match(/[?&]id=([^&]+)/);
  const id = m1?.[1] || m2?.[1];
  if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
  return url;
}

const truthy = (v: unknown) => {
  const s = String(v ?? "TRUE").trim().toUpperCase();
  return s !== "FALSE" && s !== "0" && s !== "NO" && s !== "";
};

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SA_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!SA_JSON) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
    const TEMPLATES_ID = Deno.env.get("GOOGLE_SHEETS_TEMPLATES_ID") ?? "1jwwK5vKe9Xv2l_z3GArbYJJfXO3HoeDTUWEhbjVTnpU";
    const DESIGNS_ID = Deno.env.get("GOOGLE_SHEETS_DESIGNS_ID") ?? TEMPLATES_ID;

    const sa: ServiceAccount = JSON.parse(SA_JSON);
    const token = await getAccessToken(sa);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "canvas-products";

    // ----- canvas_products: id | name | base_price | image_url | width | height | material | is_available
    if (action === "canvas-products" && req.method === "GET") {
      const data = await readSheet(token, TEMPLATES_ID, "canvas_products!A2:H1000");
      const rows: any[][] = data.values ?? [];
      const products = rows
        .filter((r) => r[0] && r[3])
        .filter((r) => truthy(r[7]))
        .map((r) => ({
          id: String(r[0]),
          name: String(r[1] ?? ""),
          base_price: Number(r[2] ?? 0),
          image_url: normalizeDriveUrl(String(r[3])),
          width: String(r[4] ?? ""),
          height: String(r[5] ?? ""),
          material: String(r[6] ?? ""),
        }));
      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- products: id | name | price | description | image_url | stock | category | is_active
    if (action === "products" && req.method === "GET") {
      const data = await readSheet(token, TEMPLATES_ID, "products!A2:H1000");
      const rows: any[][] = data.values ?? [];
      const products = rows
        .filter((r) => r[0] && r[1])
        .filter((r) => truthy(r[7]))
        .map((r) => ({
          id: String(r[0]),
          name: String(r[1] ?? ""),
          price: Number(r[2] ?? 0),
          description: String(r[3] ?? ""),
          image_url: normalizeDriveUrl(String(r[4] ?? "")),
          stock: Number(r[5] ?? 0),
          category: String(r[6] ?? ""),
        }));
      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- orders: id | order_date | customer_name | customer_email | customer_phone |
    //               customer_address | product_id | quantity | total_price | status
    if (action === "orders" && req.method === "GET") {
      const data = await readSheet(token, TEMPLATES_ID, "orders!A2:J5000");
      const rows: any[][] = data.values ?? [];
      const orders = rows
        .filter((r) => r[0])
        .map((r, i) => ({
          rowIndex: i + 2,
          orderId: String(r[0]),
          date: String(r[1] ?? ""),
          customerName: String(r[2] ?? ""),
          customerEmail: String(r[3] ?? ""),
          customerPhone: String(r[4] ?? ""),
          customerAddress: String(r[5] ?? ""),
          productId: String(r[6] ?? ""),
          quantity: Number(r[7] ?? 0),
          totalPrice: Number(r[8] ?? 0),
          status: String(r[9] ?? "pending"),
        }));
      return new Response(JSON.stringify({ orders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- save canvas design (Designs sheet)
    if (action === "save-design" && req.method === "POST") {
      const body = await req.json();
      const userId = String(body.userId ?? "");
      const templateId = String(body.templateId ?? "");
      const templateName = String(body.templateName ?? "");
      const canvasJson = body.canvasJson;
      const previewUrl = String(body.previewUrl ?? "");
      if (!userId || !templateId || !canvasJson) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const json = typeof canvasJson === "string" ? canvasJson : JSON.stringify(canvasJson);
      const safeJson = json.length > 49000 ? json.slice(0, 49000) : json;
      await appendSheet(token, DESIGNS_ID, "Designs!A:G", [[
        id, userId, templateId, templateName, safeJson, createdAt, previewUrl,
      ]]);
      return new Response(JSON.stringify({ ok: true, id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- order append
    if (action === "order" && req.method === "POST") {
      const body = await req.json();
      const orderId = String(body.orderNumber ?? crypto.randomUUID());
      const date = new Date().toISOString().slice(0, 10);
      const items: any[] = Array.isArray(body.items) ? body.items : [];
      const rows = items.length
        ? items.map((it) => [
            orderId,
            date,
            body.fullName ?? "",
            body.email ?? "",
            body.phone ?? "",
            body.address ?? "",
            String(it.productId ?? it.id ?? ""),
            Number(it.quantity ?? 1),
            Number(it.price ?? 0) * Number(it.quantity ?? 1),
            "pending",
          ])
        : [[orderId, date, body.fullName ?? "", body.email ?? "", body.phone ?? "", body.address ?? "", "", 0, Number(body.total ?? 0), "pending"]];
      await appendSheet(token, TEMPLATES_ID, "orders!A:J", rows);
      return new Response(JSON.stringify({ ok: true, orderId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- update order status (all rows matching orderId)
    if (action === "update-order-status" && req.method === "POST") {
      const { orderId, status } = await req.json();
      if (!orderId || !status) {
        return new Response(JSON.stringify({ error: "orderId and status required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await readSheet(token, TEMPLATES_ID, "orders!A2:A10000");
      const rows: any[][] = data.values ?? [];
      const matchingRows: number[] = [];
      rows.forEach((r, i) => { if (String(r[0]) === String(orderId)) matchingRows.push(i + 2); });
      // Update column J (status) for each matching row
      for (const rowNum of matchingRows) {
        await updateSheet(token, TEMPLATES_ID, `orders!J${rowNum}`, [[String(status)]]);
      }
      return new Response(JSON.stringify({ ok: true, updated: matchingRows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- upsert product (DB ↔ Sheets sync helper called from app)
    if (action === "upsert-product" && req.method === "POST") {
      const p = await req.json();
      const row = [
        String(p.id),
        String(p.name ?? ""),
        Number(p.price ?? 0),
        String(p.description ?? ""),
        String(p.image_url ?? ""),
        Number(p.stock ?? 0),
        String(p.category ?? ""),
        p.is_active === false ? "FALSE" : "TRUE",
      ];
      const existingRow = await findRowById(token, TEMPLATES_ID, "products", p.id);
      if (existingRow) {
        await updateSheet(token, TEMPLATES_ID, `products!A${existingRow}:H${existingRow}`, [row]);
      } else {
        await appendSheet(token, TEMPLATES_ID, "products!A:H", [row]);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-product" && req.method === "POST") {
      const { id } = await req.json();
      const existingRow = await findRowById(token, TEMPLATES_ID, "products", id);
      if (existingRow) {
        await updateSheet(token, TEMPLATES_ID, `products!H${existingRow}`, [["FALSE"]]);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert-canvas-product" && req.method === "POST") {
      const p = await req.json();
      const row = [
        String(p.id),
        String(p.name ?? ""),
        Number(p.base_price ?? 0),
        String(p.image_url ?? ""),
        String(p.width ?? ""),
        String(p.height ?? ""),
        String(p.material ?? ""),
        p.is_available === false ? "FALSE" : "TRUE",
      ];
      const existingRow = await findRowById(token, TEMPLATES_ID, "canvas_products", p.id);
      if (existingRow) {
        await updateSheet(token, TEMPLATES_ID, `canvas_products!A${existingRow}:H${existingRow}`, [row]);
      } else {
        await appendSheet(token, TEMPLATES_ID, "canvas_products!A:H", [row]);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-canvas-product" && req.method === "POST") {
      const { id } = await req.json();
      const existingRow = await findRowById(token, TEMPLATES_ID, "canvas_products", id);
      if (existingRow) {
        await updateSheet(token, TEMPLATES_ID, `canvas_products!H${existingRow}`, [["FALSE"]]);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backward compat
    if (action === "templates" && req.method === "GET") {
      const data = await readSheet(token, TEMPLATES_ID, "canvas_products!A2:H1000");
      const rows: any[][] = data.values ?? [];
      const templates = rows
        .filter((r) => r[0] && r[3])
        .filter((r) => truthy(r[7]))
        .map((r) => ({
          id: String(r[0]),
          name: String(r[1] ?? ""),
          category: String(r[6] ?? ""),
          image_url: normalizeDriveUrl(String(r[3])),
        }));
      return new Response(JSON.stringify({ templates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-sheets error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
