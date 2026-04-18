import { Link } from "react-router-dom";
import { ShoppingCart, User, Menu, X, Palette, LogOut, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/stores/cartStore";
import logo from "@/assets/logo.png";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const itemCount = useCartStore((s) => s.itemCount());

  const navLinks = [
    { to: "/", label: "Ana Səhifə" },
    { to: "/products", label: "Məhsullar" },
    { to: "/designer", label: "Dizayner" },
    { to: "/request-design", label: "Dizayn Sifariş" },
    { to: "/collaboration", label: "Əməkdaşlıq" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Chaply" className="h-10 w-auto object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label === "Dizayner" && <Palette className="w-4 h-4" />}
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/cart" className="relative p-2 hover:bg-muted rounded-lg transition-colors hidden md:block">
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="hidden md:flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin" className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
                  <Shield className="w-4 h-4" /> Admin
                </Link>
              )}
              <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-muted transition-colors">
                <User className="w-4 h-4" /> Profil
              </Link>
              <button onClick={signOut} className="p-2 hover:bg-muted rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="hidden md:inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Daxil ol
            </Link>
          )}

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col p-4 gap-3">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm font-medium">
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm font-medium">
                    <Shield className="w-4 h-4" /> Admin
                  </Link>
                )}
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm font-medium">
                  <User className="w-4 h-4" /> Profil
                </Link>
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="flex items-center gap-2 py-2 text-sm font-medium text-destructive text-left"
                >
                  <LogOut className="w-4 h-4" /> Çıxış
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-primary">
                Daxil ol
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
