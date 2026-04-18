import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotal, total } = useCartStore();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-heading font-bold mb-2">Səbət Boşdur</h1>
        <p className="text-muted-foreground mb-6">Məhsul əlavə edin və alış-verişə başlayın</p>
        <Link to="/products" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Məhsullara Bax
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-heading font-bold mb-8">Səbət</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={`${item.product_id}-${item.size}-${item.color}`} className="flex gap-4 p-4 rounded-xl border bg-card">
              <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">👕</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.size, item.color)} className="p-1 rounded border hover:bg-muted">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.size, item.color)} className="p-1 rounded border hover:bg-muted">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-bold">{(item.price * item.quantity).toFixed(2)} ₼</span>
                    <button onClick={() => removeItem(item.product_id, item.size, item.color)} className="p-1 text-destructive hover:bg-muted rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="rounded-2xl border bg-card p-6 sticky top-24">
            <h3 className="font-heading font-semibold text-lg mb-4">Sifariş Xülasəsi</h3>
            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ara cəm</span>
                <span>{subtotal().toFixed(2)} ₼</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Çatdırılma</span>
                <span>Pulsuz</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-heading font-bold text-lg">
                <span>Cəmi</span>
                <span>{total().toFixed(2)} ₼</span>
              </div>
            </div>
            <button
              onClick={() => navigate("/checkout")}
              className="w-full mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sifarişi Tamamla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
