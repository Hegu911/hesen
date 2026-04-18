// köhnə layihədə əvəz et: src/pages/Admin.tsx
// DƏYIŞIKLIKLƏR (köhnə versiya ilə müqayisədə):
//  - admin yoxlaması upload-dan əvvəl client-də (RLS xətasını qabaqcadan tutur)
//  - fayl ölçüsü (5MB) + MIME validasiyası
//  - upload() çağrışlarında contentType + cacheControl əlavə olundu
//  - daha aydın xəta mesajları (Storage / Sheets / DB ayrı-ayrı)
//  - Sheets sinxron uğursuzluğu artıq toast.warning ilə bildirilir (silent deyil)

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, ShoppingCart, Users, Image as ImageIcon, Palette, Plus, Trash2, Edit, Loader2,
  Shield, ShieldOff, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  syncProductToSheet, deleteProductFromSheet,
  syncCanvasProductToSheet, deleteCanvasProductFromSheet,
  updateOrderStatusInSheet,
} from "@/lib/templates";

type TabKey = "products" | "canvas" | "orders" | "users" | "assets";

interface Product {
  id: string; name: string; description: string | null; price: number;
  image_url: string | null; stock: number; category: string | null; is_active: boolean;
}
interface CanvasProduct {
  id: string; name: string; base_price: number; image_url: string;
  width: string | null; height: string | null; material: string | null; is_available: boolean;
}
interface Order {
  id: string; order_number: string; full_name: string; email: string;
  phone: string | null; address: string | null; items: any; total: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  created_at: string;
}
interface UserRow {
  id: string; email: string; full_name: string | null; created_at: string; is_admin: boolean;
}
interface DesignAsset {
  id: string; name: string; kind: "sticker" | "template"; image_url: string;
  category: string | null; is_active: boolean; created_at: string;
}

const ORDER_STATUSES: Order["status"][] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Gözləyir", confirmed: "Təsdiqləndi", processing: "Hazırlanır",
  shipped: "Göndərildi", delivered: "Çatdırıldı", cancelled: "Ləğv edildi",
};

const MAX_UPLOAD_MB = 5;

// ----- Shared upload helper with validation + better errors -----
async function validateAndUpload(
  file: File,
  bucket: "product-images" | "design-assets",
  folder: string,
  isAdmin: boolean
): Promise<string> {
  if (!isAdmin) {
    throw new Error("Şəkil yükləmək üçün admin səlahiyyəti lazımdır");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Yalnız şəkil faylı qəbul olunur (PNG, JPG, WEBP)");
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`Şəkil ${MAX_UPLOAD_MB}MB-dan kiçik olmalıdır`);
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) {
    console.error("Storage upload error:", error);
    if (error.message?.toLowerCase().includes("row-level security") || (error as any).statusCode === "403") {
      throw new Error("İcazə yoxdur (RLS). Admin rolunuzu yoxlayın və yenidən daxil olun.");
    }
    throw new Error(`Şəkil yüklənmədi: ${error.message}`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("products");

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (!user || !isAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-heading font-bold mb-2">Admin Panel</h1>
      <p className="text-muted-foreground mb-8">Mağaza, sifariş və istifadəçi idarəsi</p>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { id: "products" as const, label: "Məhsullar", icon: Package },
          { id: "canvas" as const, label: "Kətan məhsulları", icon: Palette },
          { id: "orders" as const, label: "Sifarişlər", icon: ShoppingCart },
          { id: "users" as const, label: "İstifadəçilər", icon: Users },
          { id: "assets" as const, label: "Dizayn şəkilləri", icon: ImageIcon },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md border whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab isAdmin={isAdmin} />}
      {tab === "canvas" && <CanvasTab isAdmin={isAdmin} />}
      {tab === "orders" && <OrdersTab />}
      {tab === "users" && <UsersTab />}
      {tab === "assets" && <AssetsTab isAdmin={isAdmin} />}
    </div>
  );
}

// ============================================================
// PRODUCTS TAB
// ============================================================
function ProductsTab({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Məhsullar yüklənmədi", { description: error.message });
    setItems((data ?? []) as Product[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing({ name: "", description: "", price: 0, image_url: "", stock: 0, category: "", is_active: true });
    setImageFile(null);
  };

  const save = async () => {
    if (!editing || !editing.name) { toast.error("Ad mütləqdir"); return; }
    setSaving(true);
    try {
      let image_url = editing.image_url ?? "";
      if (imageFile) {
        image_url = await validateAndUpload(imageFile, "product-images", "products", isAdmin);
      }

      const payload = {
        name: editing.name!,
        description: editing.description ?? "",
        price: Number(editing.price ?? 0),
        image_url,
        stock: Number(editing.stock ?? 0),
        category: editing.category ?? "",
        is_active: editing.is_active ?? true,
      };

      let saved: Product | null = null;
      if (editing.id) {
        const { data, error } = await supabase.from("products").update(payload).eq("id", editing.id).select().single();
        if (error) throw new Error(`DB xətası: ${error.message}`);
        saved = data as Product;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw new Error(`DB xətası: ${error.message}`);
        saved = data as Product;
      }

      if (saved) {
        try { await syncProductToSheet(saved); }
        catch (e: any) { toast.warning("Sheets sinxron uğursuz oldu", { description: e?.message }); }
      }
      toast.success("Yadda saxlandı");
      setEditing(null);
      setImageFile(null);
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Xəta");
    }
    setSaving(false);
  };

  const remove = async (p: Product) => {
    if (!confirm(`"${p.name}" silinsin?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(`DB xətası: ${error.message}`); return; }
    try { await deleteProductFromSheet(p.id); }
    catch (e: any) { toast.warning("Sheets sinxron uğursuz oldu", { description: e?.message }); }
    toast.success("Silindi");
    load();
  };

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-heading font-semibold text-lg">Məhsullar ({items.length})</h2>
        <button onClick={startNew} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">
          <Plus className="w-4 h-4" /> Yeni məhsul
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border bg-card p-6 mb-6 space-y-4">
          <h3 className="font-medium">{editing.id ? "Redaktə et" : "Yeni məhsul"}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Ad *" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Input label="Kateqoriya" value={editing.category ?? ""} onChange={(v) => setEditing({ ...editing, category: v })} />
            <Input label="Qiymət (₼)" type="number" value={String(editing.price ?? 0)} onChange={(v) => setEditing({ ...editing, price: Number(v) })} />
            <Input label="Stok" type="number" value={String(editing.stock ?? 0)} onChange={(v) => setEditing({ ...editing, stock: Number(v) })} />
          </div>
          <Textarea label="Təsvir" value={editing.description ?? ""} onChange={(v) => setEditing({ ...editing, description: v })} />
          <div>
            <label className="text-sm font-medium block mb-1">Şəkil (maks {MAX_UPLOAD_MB}MB)</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" />
            {imageFile && <p className="text-xs text-muted-foreground mt-1">{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</p>}
            {!imageFile && editing.image_url && (
              <img src={editing.image_url} alt="" className="mt-2 w-24 h-24 object-cover rounded border" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            Aktivdir
          </label>
          <div className="flex gap-2">
            <button disabled={saving} onClick={save} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yadda saxla"}
            </button>
            <button onClick={() => { setEditing(null); setImageFile(null); }} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">
              Ləğv et
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">👕</div>}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{p.name}</h4>
                <p className="text-xs text-muted-foreground">{Number(p.price).toFixed(2)} ₼ · Stok: {p.stock}{p.category ? ` · ${p.category}` : ""}{!p.is_active ? " · Deaktiv" : ""}</p>
              </div>
              <button onClick={() => { setEditing(p); setImageFile(null); }} className="p-2 rounded-md hover:bg-muted"><Edit className="w-4 h-4" /></button>
              <button onClick={() => remove(p)} className="p-2 rounded-md hover:bg-muted text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-8">Məhsul yoxdur</p>}
        </div>
      )}
    </section>
  );
}

// ============================================================
// CANVAS PRODUCTS TAB
// ============================================================
function CanvasTab({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<CanvasProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CanvasProduct> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("canvas_products").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Kətan məhsulları yüklənmədi", { description: error.message });
    setItems((data ?? []) as CanvasProduct[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing || !editing.name) { toast.error("Ad mütləqdir"); return; }
    setSaving(true);
    try {
      let image_url = editing.image_url ?? "";
      if (imageFile) {
        image_url = await validateAndUpload(imageFile, "product-images", "canvas", isAdmin);
      }
      if (!image_url) { toast.error("Şəkil mütləqdir"); setSaving(false); return; }

      const payload = {
        name: editing.name!,
        base_price: Number(editing.base_price ?? 0),
        image_url,
        width: editing.width ?? "",
        height: editing.height ?? "",
        material: editing.material ?? "",
        is_available: editing.is_available ?? true,
      };

      let saved: CanvasProduct | null = null;
      if (editing.id) {
        const { data, error } = await supabase.from("canvas_products").update(payload).eq("id", editing.id).select().single();
        if (error) throw new Error(`DB xətası: ${error.message}`);
        saved = data as CanvasProduct;
      } else {
        const { data, error } = await supabase.from("canvas_products").insert(payload).select().single();
        if (error) throw new Error(`DB xətası: ${error.message}`);
        saved = data as CanvasProduct;
      }

      if (saved) {
        try { await syncCanvasProductToSheet(saved); }
        catch (e: any) { toast.warning("Sheets sinxron uğursuz oldu", { description: e?.message }); }
      }
      toast.success("Yadda saxlandı");
      setEditing(null);
      setImageFile(null);
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Xəta");
    }
    setSaving(false);
  };

  const remove = async (p: CanvasProduct) => {
    if (!confirm(`"${p.name}" silinsin?`)) return;
    const { error } = await supabase.from("canvas_products").delete().eq("id", p.id);
    if (error) { toast.error(`DB xətası: ${error.message}`); return; }
    try { await deleteCanvasProductFromSheet(p.id); }
    catch (e: any) { toast.warning("Sheets sinxron uğursuz oldu", { description: e?.message }); }
    toast.success("Silindi");
    load();
  };

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-heading font-semibold text-lg">Kətan məhsulları ({items.length})</h2>
        <button
          onClick={() => { setEditing({ name: "", base_price: 0, image_url: "", width: "", height: "", material: "", is_available: true }); setImageFile(null); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground"
        >
          <Plus className="w-4 h-4" /> Yeni kətan
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border bg-card p-6 mb-6 space-y-4">
          <h3 className="font-medium">{editing.id ? "Redaktə et" : "Yeni kətan məhsulu"}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Ad *" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Input label="Qiymət (₼)" type="number" value={String(editing.base_price ?? 0)} onChange={(v) => setEditing({ ...editing, base_price: Number(v) })} />
            <Input label="En" value={editing.width ?? ""} onChange={(v) => setEditing({ ...editing, width: v })} placeholder="məs: 30 sm" />
            <Input label="Hündürlük" value={editing.height ?? ""} onChange={(v) => setEditing({ ...editing, height: v })} placeholder="məs: 40 sm" />
            <Input label="Material" value={editing.material ?? ""} onChange={(v) => setEditing({ ...editing, material: v })} placeholder="məs: Pambıq" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Şəkil * (maks {MAX_UPLOAD_MB}MB)</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" />
            {imageFile && <p className="text-xs text-muted-foreground mt-1">{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</p>}
            {!imageFile && editing.image_url && (
              <img src={editing.image_url} alt="" className="mt-2 w-24 h-24 object-cover rounded border" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.is_available ?? true} onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })} />
            Mövcuddur
          </label>
          <div className="flex gap-2">
            <button disabled={saving} onClick={save} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yadda saxla"}
            </button>
            <button onClick={() => { setEditing(null); setImageFile(null); }} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Ləğv et</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{p.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {Number(p.base_price).toFixed(2)} ₼
                  {p.width || p.height ? ` · ${p.width ?? "?"}×${p.height ?? "?"}` : ""}
                  {p.material ? ` · ${p.material}` : ""}
                  {!p.is_available ? " · Deaktiv" : ""}
                </p>
              </div>
              <button onClick={() => { setEditing(p); setImageFile(null); }} className="p-2 rounded-md hover:bg-muted"><Edit className="w-4 h-4" /></button>
              <button onClick={() => remove(p)} className="p-2 rounded-md hover:bg-muted text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-8">Kətan məhsulu yoxdur</p>}
        </div>
      )}
    </section>
  );
}

// ============================================================
// ORDERS TAB
// ============================================================
function OrdersTab() {
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Sifarişlər yüklənmədi", { description: error.message });
    setItems((data ?? []) as Order[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const changeStatus = async (o: Order, status: Order["status"]) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) { toast.error(`DB xətası: ${error.message}`); return; }
    try {
      await updateOrderStatusInSheet(o.order_number, status);
      toast.success(`Status: ${STATUS_LABEL[status]} (Sheets sinxronlandı)`);
    } catch (e: any) {
      toast.warning(`Status: ${STATUS_LABEL[status]} — amma Sheets sinxronu uğursuz: ${e?.message}`);
    }
    load();
  };

  return (
    <section>
      <h2 className="font-heading font-semibold text-lg mb-4">Sifarişlər ({items.length})</h2>
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Sifariş yoxdur</p>
      ) : (
        <div className="space-y-3">
          {items.map((o) => {
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <div key={o.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-mono text-sm font-bold">{o.order_number}</span>
                  <select
                    value={o.status}
                    onChange={(e) => changeStatus(o, e.target.value as Order["status"])}
                    className="text-xs rounded-md border px-2 py-1 bg-background"
                  >
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{o.full_name} · {o.email}</p>
                  {o.phone && <p className="text-muted-foreground text-xs">📞 {o.phone}</p>}
                  {o.address && <p className="text-muted-foreground text-xs">📍 {o.address}</p>}
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                    {items.map((it: any, i: number) => (
                      <li key={i}>{it.name} × {it.quantity} — {Number(it.price * it.quantity).toFixed(2)} ₼</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm font-bold">Cəmi: {Number(o.total).toFixed(2)} ₼</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(o.created_at).toLocaleString("az-AZ")}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================
// USERS TAB
// ============================================================
function UsersTab() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles, error: profErr }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profErr) toast.error("İstifadəçilər yüklənmədi", { description: profErr.message });
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    setItems((profiles ?? []).map((p: any) => ({ ...p, is_admin: adminIds.has(p.id) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleAdmin = async (u: UserRow) => {
    if (u.is_admin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin");
      if (error) { toast.error(error.message); return; }
      toast.success("Admin ləğv edildi");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
      if (error) { toast.error(error.message); return; }
      toast.success("Admin edildi");
    }
    load();
  };

  return (
    <section>
      <h2 className="font-heading font-semibold text-lg mb-4">İstifadəçilər ({items.length})</h2>
      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">İstifadəçi yoxdur</p>
      ) : (
        <div className="space-y-2">
          {items.map((u) => (
            <div key={u.id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{u.full_name || u.email}</h4>
                <p className="text-xs text-muted-foreground">{u.email} · {new Date(u.created_at).toLocaleDateString("az-AZ")}</p>
              </div>
              {u.is_admin && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Admin</span>
              )}
              <button
                onClick={() => toggleAdmin(u)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border ${u.is_admin ? "text-destructive hover:bg-muted" : "hover:bg-muted"}`}
              >
                {u.is_admin ? <><ShieldOff className="w-3.5 h-3.5" /> Ləğv et</> : <><Shield className="w-3.5 h-3.5" /> Admin et</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// DESIGN ASSETS TAB
// ============================================================
function AssetsTab({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<DesignAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"sticker" | "template">("sticker");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("design_assets").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Şəkillər yüklənmədi", { description: error.message });
    setItems((data ?? []) as DesignAsset[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file || !name.trim()) { toast.error("Ad və şəkil mütləqdir"); return; }
    setUploading(true);
    try {
      const publicUrl = await validateAndUpload(file, "design-assets", kind, isAdmin);

      const { error } = await supabase.from("design_assets").insert({
        name: name.trim(),
        kind,
        category: category.trim() || null,
        image_url: publicUrl,
        is_active: true,
        created_by: user?.id ?? null,
      });
      if (error) throw new Error(`DB xətası: ${error.message}`);

      toast.success("Şəkil yükləndi");
      setName(""); setCategory(""); setFile(null);
      // reset file input visually
      const fileInput = document.getElementById("asset-file-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Xəta");
    }
    setUploading(false);
  };

  const remove = async (a: DesignAsset) => {
    if (!confirm(`"${a.name}" silinsin?`)) return;
    const { error } = await supabase.from("design_assets").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Silindi");
    load();
  };

  const toggleActive = async (a: DesignAsset) => {
    const { error } = await supabase.from("design_assets").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <section>
      <h2 className="font-heading font-semibold text-lg mb-4">Dizayn şəkilləri ({items.length})</h2>

      <div className="rounded-xl border bg-card p-6 mb-6 space-y-3">
        <h3 className="font-medium flex items-center gap-2"><Upload className="w-4 h-4" /> Yeni şəkil yüklə</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Ad *" value={name} onChange={setName} />
          <Input label="Kateqoriya" value={category} onChange={setCategory} placeholder="məs: Loqolar, Çiçəklər" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div>
            <label className="text-sm font-medium block mb-1">Növ</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="px-3 py-2 rounded-md border bg-background text-sm">
              <option value="sticker">Stiker (üzərinə yapışdırılır)</option>
              <option value="template">Şablon (arxa fon)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium block mb-1">Şəkil * (maks {MAX_UPLOAD_MB}MB)</label>
            <input
              id="asset-file-input"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
          </div>
        </div>
        <button
          disabled={uploading || !file || !name.trim()}
          onClick={upload}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Yüklə
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((a) => (
            <div key={a.id} className={`rounded-xl border bg-card overflow-hidden ${!a.is_active ? "opacity-50" : ""}`}>
              <div className="aspect-square bg-muted">
                <img src={a.image_url} alt={a.name} className="w-full h-full object-contain" />
              </div>
              <div className="p-2 space-y-1">
                <p className="text-xs font-medium truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground">{a.kind === "sticker" ? "Stiker" : "Şablon"}{a.category ? ` · ${a.category}` : ""}</p>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(a)} className="flex-1 px-2 py-1 text-[10px] rounded border hover:bg-muted">
                    {a.is_active ? "Gizlət" : "Göstər"}
                  </button>
                  <button onClick={() => remove(a)} className="px-2 py-1 text-[10px] rounded border text-destructive hover:bg-muted">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground py-8 col-span-full">Şəkil yoxdur</p>}
        </div>
      )}
    </section>
  );
}

// ============================================================
// SMALL HELPERS
// ============================================================
function Input({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md border bg-background text-sm"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 rounded-md border bg-background text-sm"
      />
    </div>
  );
}
