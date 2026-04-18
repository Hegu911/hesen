import { supabase } from "@/integrations/supabase/client";

export interface ClothingTemplate {
  id: string;
  name: string;
  category: string;
  image_url: string;
  base_price?: number;
  width?: string;
  height?: string;
  material?: string;
}

export interface SheetProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  stock: number;
  category: string;
}

async function invoke<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  const { data, error } = await supabase.functions.invoke(path, {
    method: init.method,
    body: init.body,
  });
  if (error) throw error;
  if (!data || (data as any).error) throw new Error((data as any)?.error || "Request failed");
  return data as T;
}

// ========== Public reads ==========
export async function fetchTemplates(): Promise<ClothingTemplate[]> {
  // Prefer DB (authoritative), fallback to Sheets if empty.
  const { data, error } = await supabase
    .from("canvas_products")
    .select("*")
    .eq("is_available", true)
    .order("created_at", { ascending: false });
  if (!error && data && data.length) {
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.material ?? "",
      image_url: p.image_url,
      base_price: Number(p.base_price ?? 0),
      width: p.width ?? "",
      height: p.height ?? "",
      material: p.material ?? "",
    }));
  }
  // Fallback to Sheets
  try {
    const sheetData = await invoke<{ products: any[] }>("google-sheets?action=canvas-products", { method: "GET" });
    return (sheetData.products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.material ?? "",
      image_url: p.image_url,
      base_price: p.base_price,
      width: p.width,
      height: p.height,
      material: p.material,
    }));
  } catch {
    return [];
  }
}

export async function fetchSheetProducts(): Promise<SheetProduct[]> {
  const data = await invoke<{ products: SheetProduct[] }>("google-sheets?action=products", { method: "GET" });
  return data.products ?? [];
}

// ========== Designs ==========
export async function saveDesign(payload: {
  userId: string;
  templateId: string;
  templateName: string;
  canvasJson: unknown;
  previewUrl?: string;
}): Promise<{ ok: boolean; id?: string }> {
  // Save to DB first
  const { error } = await supabase.from("saved_designs").insert({
    user_id: payload.userId,
    template_id: payload.templateId,
    template_name: payload.templateName,
    canvas_json: payload.canvasJson as any,
    preview_url: payload.previewUrl ?? null,
  });
  if (error) throw error;
  // Best-effort mirror to Sheets
  try {
    await invoke("google-sheets?action=save-design", { method: "POST", body: payload });
  } catch (e) {
    console.warn("Sheets mirror failed:", e);
  }
  return { ok: true };
}

// ========== Orders ==========
export async function appendOrderToSheet(payload: {
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  total: number;
  items: { productId?: string; id?: string; name: string; quantity: number; price: number }[];
}): Promise<void> {
  await invoke("google-sheets?action=order", { method: "POST", body: payload });
}

export async function updateOrderStatusInSheet(orderId: string, status: string): Promise<void> {
  await invoke("google-sheets?action=update-order-status", {
    method: "POST",
    body: { orderId, status },
  });
}

export async function fetchOrdersFromSheet(): Promise<any[]> {
  const data = await invoke<{ orders: any[] }>("google-sheets?action=orders", { method: "GET" });
  return data.orders ?? [];
}

// ========== Email ==========
export async function sendEmail(
  type: "design-request" | "order" | "collaboration",
  payload: Record<string, unknown>
): Promise<void> {
  await invoke("send-email", { method: "POST", body: { type, payload } });
}

// ========== Admin sync helpers ==========
export async function syncProductToSheet(p: {
  id: string; name: string; price: number; description?: string | null;
  image_url?: string | null; stock: number; category?: string | null; is_active: boolean;
}): Promise<void> {
  try {
    await invoke("google-sheets?action=upsert-product", { method: "POST", body: p });
  } catch (e) {
    console.warn("Product sheet sync failed:", e);
  }
}

export async function deleteProductFromSheet(id: string): Promise<void> {
  try {
    await invoke("google-sheets?action=delete-product", { method: "POST", body: { id } });
  } catch (e) {
    console.warn("Product sheet delete failed:", e);
  }
}

export async function syncCanvasProductToSheet(p: {
  id: string; name: string; base_price: number; image_url: string;
  width?: string | null; height?: string | null; material?: string | null; is_available: boolean;
}): Promise<void> {
  try {
    await invoke("google-sheets?action=upsert-canvas-product", { method: "POST", body: p });
  } catch (e) {
    console.warn("Canvas product sheet sync failed:", e);
  }
}

export async function deleteCanvasProductFromSheet(id: string): Promise<void> {
  try {
    await invoke("google-sheets?action=delete-canvas-product", { method: "POST", body: { id } });
  } catch (e) {
    console.warn("Canvas product sheet delete failed:", e);
  }
}
