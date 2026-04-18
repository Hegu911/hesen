import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ITEMS_PER_PAGE = 12;

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  category: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);
      if (selectedCategory) query = query.eq("category", selectedCategory);
      if (search) query = query.ilike("name", `%${search}%`);
      const { data, count } = await query;
      setProducts((data ?? []) as Product[]);
      setTotal(count || 0);
      setLoading(false);
    })();
  }, [page, selectedCategory, search]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [products]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Məhsullar</h1>
        <p className="text-muted-foreground">Xüsusi çap üçün geyim kataloqu</p>
      </div>
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Məhsul axtar..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setSelectedCategory(null); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${!selectedCategory ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Hamısı
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => { setSelectedCategory(c); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedCategory === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card animate-pulse">
              <div className="aspect-square bg-muted rounded-t-2xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-lg">Məhsul tapılmadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <Link key={p.id} to={`/products/${p.id}`} className="group block">
              <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:border-foreground/20 transition-all">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span className="text-4xl">👕</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-sm mb-1 group-hover:text-muted-foreground transition-colors line-clamp-2">{p.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold">{Number(p.price).toFixed(2)} ₼</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 rounded-md border hover:bg-muted disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground px-4">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-2 rounded-md border hover:bg-muted disabled:opacity-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
