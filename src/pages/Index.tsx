import { Link } from "react-router-dom";
import { Palette, Truck, Sparkles, ArrowRight } from "lucide-react";

const features = [
  { icon: Palette, title: "Kanvas Dizayner", desc: "Şablon üzərində mətn və şəkillərlə dizayn et" },
  { icon: Sparkles, title: "Xüsusi Çap", desc: "Yüksək keyfiyyətli çap texnologiyası" },
  { icon: Truck, title: "Sürətli Çatdırılma", desc: "Azərbaycan daxili pulsuz çatdırılma" },
];

const steps = [
  { num: "01", title: "Şablon Seçin", desc: "Geyim şablonları arasından seçim edin" },
  { num: "02", title: "Dizayn Edin", desc: "Mətn, logo və şəkillər əlavə edin" },
  { num: "03", title: "Sifariş Verin", desc: "Sifarişi tamamlayın, biz çap edib göndərək" },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-foreground mb-6">
              <Palette className="w-4 h-4" />
              Kanvas əsaslı dizayn studiyası
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight leading-tight mb-6">
              Xəyalınızdakı dizaynı
              <span className="text-muted-foreground"> öz əlinizlə yaradın</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
              Şablon seçin, mətn və şəkillərlə dizayn edin. Biz çap edib qapınıza çatdıraq.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/designer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Palette className="w-5 h-5" />
                Dizayner
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                Məhsullara Bax
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 border-t">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="group rounded-2xl border bg-card p-8 hover:shadow-lg hover:border-foreground/20 transition-all">
                  <div className="h-12 w-12 rounded-xl bg-muted text-foreground flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Necə İşləyir?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Sadəcə 3 addımda xüsusi geyiminizi əldə edin</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <span className="text-5xl font-heading font-bold text-muted-foreground/30">{s.num}</span>
                <h3 className="font-heading font-semibold text-lg mt-2 mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-foreground text-background p-12 md:p-20 text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Hazırsınız?</h2>
            <p className="text-background/70 mb-8 max-w-lg mx-auto">
              İlk dizaynınızı indi yaradın və sifariş verin.
            </p>
            <Link
              to="/designer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-background text-foreground px-6 py-3 text-sm font-medium transition-colors hover:bg-background/90"
            >
              <Palette className="w-5 h-5" />
              Başla
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
