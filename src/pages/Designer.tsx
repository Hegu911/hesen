import CanvasDesigner from "@/components/designer/CanvasDesigner";

export default function DesignerPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Dizayn Studiyası</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Şablon seçin, üzərinə mətn və şəkil əlavə edin, dizaynı yadda saxlayın.
        </p>
      </div>
      <CanvasDesigner />
    </div>
  );
}
