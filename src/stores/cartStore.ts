import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
  custom_design_url: string | null;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size?: string | null, color?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, size?: string | null, color?: string | null) => void;
  clearCart: () => void;
  setCoupon: (code: string | null, discount: number) => void;
  subtotal: () => number;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,
      addItem: (item) => {
        const items = get().items;
        const existing = items.find(
          (i) => i.product_id === item.product_id && i.size === item.size && i.color === item.color
        );
        if (existing) {
          set({
            items: items.map((i) =>
              i.product_id === item.product_id && i.size === item.size && i.color === item.color
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },
      removeItem: (productId, size, color) => {
        set({
          items: get().items.filter(
            (i) => !(i.product_id === productId && i.size === size && i.color === color)
          ),
        });
      },
      updateQuantity: (productId, quantity, size, color) => {
        if (quantity <= 0) {
          get().removeItem(productId, size, color);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.product_id === productId && i.size === size && i.color === color
              ? { ...i, quantity }
              : i
          ),
        });
      },
      clearCart: () => set({ items: [], couponCode: null, couponDiscount: 0 }),
      setCoupon: (code, discount) => set({ couponCode: code, couponDiscount: discount }),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      total: () => {
        const sub = get().subtotal();
        return sub - sub * (get().couponDiscount / 100);
      },
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "chaply-cart" }
  )
);
