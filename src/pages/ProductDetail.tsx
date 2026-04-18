import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/stores/cartStore";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  category: string | null;
}

export default function ProductDetailPage() {
  const { slug: idParam } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    (async () => {
      if (!idParam) return;
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", idParam)
        .eq("is_active", true)
        .maybeSingle();
      setProduct(data as Product | null);
      setLoading(false);
    })();
  }, [idParam]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse"><div className="h-96 bg-muted rounded-2xl" /></div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-heading font-bold">Məhsul Tapılmadı</h1>
        <Link to="/products" className="text-sm text-muted-foreground hover:underline mt-4 inline-block">Məhsullara Qayıt</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image_url,
      quantity,
      size: null,
      color: null,
      custom_design_url: null,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Məhsullara Qayıt
      </Link>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square bg-muted rounded-2xl overflow-hidden mb-4">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">👕</div>
            )}
          </div>
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold mb-2">{product.name}</h1>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-heading font-bold">{Number(product.price).toFixed(2)} ₼</span>
          </div>
          {product.description && <p className="text-muted-foreground mb-6">{product.description}</p>}

          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border rounded-md">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 hover:bg-muted">
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 font-bold">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-2 hover:bg-muted">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">Stok: {product.stock}</span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <ShoppingCart className="w-5 h-5" />
            {product.stock > 0 ? "Səbətə Əlavə Et" : "Stokda Yoxdur"}
          </button>
        </div>
      </div>
    </div>
  );
}
