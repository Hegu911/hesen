import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Palette, ShoppingCart, Handshake } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

const navItems = [
  { to: "/", label: "Ana", icon: Home },
  { to: "/products", label: "Məhsul", icon: ShoppingBag },
  { to: "/designer", label: "Dizayn", icon: Palette },
  { to: "/cart", label: "Səbət", icon: ShoppingCart },
  { to: "/collaboration", label: "Əməkdaşlıq", icon: Handshake },
];

export default function MobileNav() {
  const location = useLocation();
  const itemCount = useCartStore((s) => s.itemCount());

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.to === "/cart" && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
