import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

export default function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Chaply" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm text-muted-foreground">Şablon əsaslı kanvas dizayn ilə xüsusi geyim çapı platforması.</p>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-4">Naviqasiya</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground transition-colors">Ana Səhifə</Link></li>
              <li><Link to="/products" className="hover:text-foreground transition-colors">Məhsullar</Link></li>
              <li><Link to="/designer" className="hover:text-foreground transition-colors">Dizayner</Link></li>
              <li><Link to="/request-design" className="hover:text-foreground transition-colors">Dizayn Sifariş</Link></li>
              <li><Link to="/collaboration" className="hover:text-foreground transition-colors">Əməkdaşlıq</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-4">Hesab</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/profile" className="hover:text-foreground transition-colors">Profil</Link></li>
              <li><Link to="/cart" className="hover:text-foreground transition-colors">Səbət</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-4">Əlaqə</h4>
            <p className="text-sm text-muted-foreground">info@chaply.az</p>
            <p className="text-sm text-muted-foreground">+994 50 123 45 67</p>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} CHAPLY. Bütün hüquqlar qorunur.
        </div>
      </div>
    </footer>
  );
}
