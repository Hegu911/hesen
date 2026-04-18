import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/stores/cartStore";
import { appendOrderToSheet, sendEmail } from "@/lib/templates";
import { toast } from "sonner";

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  address: z.string().min(5),
  city: z.string().min(2),
  note: z.string().optional(),
});

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCartStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", city: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = addressSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        fieldErrors[i.path[0] as string] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }
    if (!user || cart.items.length === 0) return;

    setLoading(true);
    try {
      const orderNum = `CH-${Date.now().toString(36).toUpperCase()}`;
      const itemsJson = cart.items.map((it) => ({
        product_id: it.product_id,
        name: it.name,
        image: it.image,
        quantity: it.quantity,
        price: it.price,
        size: it.size,
        color: it.color,
      }));

      const { error: orderError } = await supabase.from("orders").insert({
        user_id: user.id,
        order_number: orderNum,
        full_name: form.fullName,
        email: user.email ?? "",
        phone: form.phone,
        address: `${form.address}, ${form.city}${form.note ? ` (${form.note})` : ""}`,
        items: itemsJson,
        total: cart.total(),
        status: "pending",
      });

      if (orderError) throw orderError;

      // Mirror to Google Sheets + send email (best-effort)
      try {
        await Promise.all([
          appendOrderToSheet({
            orderNumber: orderNum,
            fullName: form.fullName,
            email: user.email ?? "",
            phone: form.phone,
            address: `${form.address}, ${form.city}`,
            total: cart.total(),
            items: cart.items.map((it) => ({
              productId: it.product_id,
              name: it.name,
              quantity: it.quantity,
              price: it.price,
            })),
          }),
          sendEmail("order", {
            orderNumber: orderNum,
            fullName: form.fullName,
            email: user.email ?? "",
            phone: form.phone,
            address: form.address,
            city: form.city,
            note: form.note,
            total: cart.total().toFixed(2),
            items: cart.items.map((it) => ({
              productId: it.product_id,
              name: it.name,
              quantity: it.quantity,
              price: it.price,
            })),
          }),
        ]);
      } catch (e) {
        console.warn("Sheets/email mirror failed:", e);
        toast.warning("Sifariş yaradıldı, lakin email/Sheets sinxronu uğursuz oldu");
      }

      cart.clearCart();
      setOrderNumber(orderNum);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error("Sifariş yaradılmadı");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-heading font-bold mb-4">Sifariş Tamamlandı! ✓</h1>
        <p className="text-muted-foreground mb-2">
          Sifariş nömrəsi: <span className="font-mono font-bold">{orderNumber}</span>
        </p>
        <p className="text-muted-foreground mb-8">Tezliklə sizinlə əlaqə saxlayacağıq.</p>
        <button
          onClick={() => navigate("/products")}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Alış-verişə Davam Et
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <button onClick={() => navigate("/cart")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Səbətə Qayıt
      </button>
      <h1 className="text-3xl font-heading font-bold mb-8">Sifariş</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {(["fullName", "phone", "address", "city"] as const).map((field) => (
          <div key={field} className="space-y-1">
            <label className="text-sm font-medium">
              {field === "fullName" ? "Ad Soyad" : field === "phone" ? "Telefon" : field === "address" ? "Ünvan" : "Şəhər"}
            </label>
            <input
              value={form[field]}
              onChange={(e) => {
                setForm((f) => ({ ...f, [field]: e.target.value }));
                setErrors((prev) => ({ ...prev, [field]: "" }));
              }}
              className="w-full px-4 py-2 rounded-md border bg-background text-sm"
            />
            {errors[field] && <p className="text-xs text-destructive">{errors[field]}</p>}
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-sm font-medium">Qeyd (istəyə bağlı)</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full px-4 py-2 rounded-md border bg-background text-sm"
            rows={3}
          />
        </div>
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cəmi</span>
            <span className="font-bold">{cart.total().toFixed(2)} ₼</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Göndərilir..." : "Sifarişi Təsdiqlə"}
        </button>
      </form>
    </div>
  );
}
