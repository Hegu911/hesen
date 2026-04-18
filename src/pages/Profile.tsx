import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Package, Gift, LogOut, Edit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<"profile" | "orders" | "ref">("profile");
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      (async () => {
        const { data } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        setOrders(data || []);
      })();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ full_name: fullName, phone, address } as any).eq("id", user.id);
    await refreshProfile();
    setEditing(false);
  };

  const statusLabels: Record<string, string> = {
    pending: "Gözləmədə", confirmed: "Təsdiqləndi", processing: "Hazırlanır",
    shipped: "Göndərildi", delivered: "Çatdırıldı", cancelled: "Ləğv edildi",
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-heading font-bold mb-8">Profil</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: "profile" as const, label: "Profil", icon: User },
          { id: "orders" as const, label: "Sifarişlər", icon: Package },
          { id: "ref" as const, label: "Referral", icon: Gift },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md border whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading font-semibold text-lg">Şəxsi Məlumatlar</h2>
            {!editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border hover:bg-muted">
                <Edit className="w-4 h-4" /> Redaktə
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-4">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" className="w-full px-4 py-2 rounded-md border bg-background text-sm" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" className="w-full px-4 py-2 rounded-md border bg-background text-sm" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ünvan" className="w-full px-4 py-2 rounded-md border bg-background text-sm" />
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Yadda Saxla</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted">Ləğv Et</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">E-poçt:</span> {profile?.email}</p>
              <p><span className="text-muted-foreground">Ad:</span> {profile?.full_name || "—"}</p>
              <p><span className="text-muted-foreground">Telefon:</span> {profile?.phone || "—"}</p>
              <p><span className="text-muted-foreground">Ünvan:</span> {profile?.address || "—"}</p>
              <p><span className="text-muted-foreground">Referral:</span> {profile?.referral_code}</p>
            </div>
          )}
          <button onClick={signOut} className="mt-6 flex items-center gap-2 text-sm text-destructive hover:underline">
            <LogOut className="w-4 h-4" /> Çıxış
          </button>
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Sifariş tapılmadı</p>
          ) : (
            orders.map((o: any) => (
              <div key={o.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold">{o.order_number}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted">{statusLabels[o.status] || o.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString("az-AZ")} · {Number(o.total).toFixed(2)} ₼
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "ref" && profile && (
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Referral Proqramı</h2>
          <p className="text-sm text-muted-foreground mb-4">Dostlarınızı dəvət edin və bonuslar qazanın!</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/login?ref=${profile.referral_code}`}
              className="flex-1 px-4 py-2 rounded-md border bg-muted text-sm"
            />
            <button
              onClick={() =>
                navigator.clipboard.writeText(`${window.location.origin}/login?ref=${profile.referral_code}`)
              }
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Kopyala
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Dəvət sayı: {profile.referral_count} · Səviyyə: {profile.referral_level}
          </p>
        </div>
      )}
    </div>
  );
}
