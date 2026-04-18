// köhnə layihədə əvəz et: src/components/designer/CanvasDesigner.tsx
import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import {
  Type, ImagePlus, Trash2, Download, Save, RotateCcw,
  Layers, Loader2, Palette, Sticker, LayoutTemplate,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchTemplates, saveDesign, type ClothingTemplate } from "@/lib/templates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DesignAsset {
  id: string;
  name: string;
  kind: "sticker" | "template";
  image_url: string;
  category: string | null;
}

const CANVAS_SIZE = 600;
const MAX_UPLOAD_MB = 5;

export default function CanvasDesigner() {
  const { user } = useAuth();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [templates, setTemplates] = useState<ClothingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ClothingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [activeColor, setActiveColor] = useState("#111111");
  const [hasSelection, setHasSelection] = useState(false);

  const [stickers, setStickers] = useState<DesignAsset[]>([]);
  const [bgTemplates, setBgTemplates] = useState<DesignAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  // Init canvas
  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: "#f5f5f5",
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    const updateSel = () => setHasSelection(!!canvas.getActiveObject());
    canvas.on("selection:created", updateSel);
    canvas.on("selection:updated", updateSel);
    canvas.on("selection:cleared", () => setHasSelection(false));
    return () => { canvas.dispose(); fabricRef.current = null; };
  }, []);

  // Responsive
  useEffect(() => {
    if (!containerRef.current || !fabricRef.current) return;
    const ro = new ResizeObserver(() => {
      const c = fabricRef.current!;
      const w = Math.min(containerRef.current!.clientWidth, CANVAS_SIZE);
      const scale = w / CANVAS_SIZE;
      c.setDimensions({ width: `${w}px`, height: `${w}px` }, { cssOnly: true });
      c.setZoom(scale);
      c.requestRenderAll();
      c.setDimensions({ width: CANVAS_SIZE, height: CANVAS_SIZE }, { backstoreOnly: true });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load clothing templates
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTemplates()
      .then((tpls) => {
        if (!active) return;
        setTemplates(tpls);
        if (tpls.length > 0) selectTemplate(tpls[0]);
      })
      .catch((e) => toast.error("Şablonlar yüklənmədi", { description: e.message }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  // Load design_assets (stickers + templates)
  useEffect(() => {
    let active = true;
    setAssetsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("design_assets")
        .select("id,name,kind,image_url,category")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.error("design_assets fetch error:", error);
        toast.error("Stiker / şablon kitabxanası yüklənmədi", { description: error.message });
      } else {
        const all = (data ?? []) as DesignAsset[];
        setStickers(all.filter((a) => a.kind === "sticker"));
        setBgTemplates(all.filter((a) => a.kind === "template"));
      }
      setAssetsLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const selectTemplate = async (t: ClothingTemplate) => {
    setSelectedTemplate(t);
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      const img = await fabric.FabricImage.fromURL(t.image_url, { crossOrigin: "anonymous" });
      const scale = Math.min(CANVAS_SIZE / (img.width || 1), CANVAS_SIZE / (img.height || 1));
      img.set({
        left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
        originX: "center", originY: "center",
        scaleX: scale, scaleY: scale,
        selectable: false, evented: false,
      });
      canvas.backgroundImage = img;
      canvas.requestRenderAll();
    } catch (err) {
      toast.error("Şablon şəkli yüklənmədi");
    }
  };

  const applyBackgroundTemplate = async (asset: DesignAsset) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      const img = await fabric.FabricImage.fromURL(asset.image_url, { crossOrigin: "anonymous" });
      const scale = Math.min(CANVAS_SIZE / (img.width || 1), CANVAS_SIZE / (img.height || 1));
      img.set({
        left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
        originX: "center", originY: "center",
        scaleX: scale, scaleY: scale,
        selectable: false, evented: false,
      });
      canvas.backgroundImage = img;
      canvas.requestRenderAll();
      toast.success("Şablon arxa fon kimi tətbiq olundu");
    } catch {
      toast.error("Şablon yüklənmədi");
    }
  };

  const addStickerToCanvas = async (asset: DesignAsset, x?: number, y?: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    try {
      const img = await fabric.FabricImage.fromURL(asset.image_url, { crossOrigin: "anonymous" });
      const scale = Math.min(180 / (img.width || 1), 180 / (img.height || 1));
      img.set({
        left: x ?? CANVAS_SIZE / 2, top: y ?? CANVAS_SIZE / 2,
        originX: "center", originY: "center",
        scaleX: scale, scaleY: scale,
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    } catch {
      toast.error("Stiker əlavə edilmədi");
    }
  };

  const handleStickerDragStart = (e: React.DragEvent<HTMLButtonElement>, asset: DesignAsset) => {
    e.dataTransfer.setData("application/x-sticker-id", asset.id);
    e.dataTransfer.effectAllowed = "copy";
  };
  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("application/x-sticker-id")) {
      e.preventDefault(); e.dataTransfer.dropEffect = "copy";
    }
  };
  const handleCanvasDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const id = e.dataTransfer.getData("application/x-sticker-id");
    if (!id) return;
    e.preventDefault();
    const asset = stickers.find((s) => s.id === id);
    if (!asset) return;
    const target = canvasElRef.current?.getBoundingClientRect();
    const zoom = fabricRef.current?.getZoom() || 1;
    const x = target ? (e.clientX - target.left) / zoom : CANVAS_SIZE / 2;
    const y = target ? (e.clientY - target.top) / zoom : CANVAS_SIZE / 2;
    addStickerToCanvas(asset, x, y);
  };

  const addText = () => {
    const canvas = fabricRef.current; if (!canvas) return;
    const text = new fabric.Textbox(textInput.trim() || "Mətn", {
      left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
      originX: "center", originY: "center",
      fontFamily: "Inter, system-ui, sans-serif", fontSize: 36,
      fill: activeColor, textAlign: "center", width: 250,
    });
    canvas.add(text); canvas.setActiveObject(text); canvas.requestRenderAll();
    setTextInput("");
  };

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Yalnız şəkil faylı"); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`Şəkil ${MAX_UPLOAD_MB}MB-dan kiçik olmalıdır`);
      e.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const canvas = fabricRef.current; if (!canvas) return;
      try {
        const img = await fabric.FabricImage.fromURL(dataUrl);
        const scale = Math.min(250 / (img.width || 1), 250 / (img.height || 1));
        img.set({
          left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2,
          originX: "center", originY: "center",
          scaleX: scale, scaleY: scale,
        });
        canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll();
      } catch { toast.error("Şəkil əlavə edilmədi"); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const deleteActive = () => {
    const canvas = fabricRef.current; if (!canvas) return;
    const obj = canvas.getActiveObject(); if (!obj) return;
    canvas.remove(obj); canvas.discardActiveObject(); canvas.requestRenderAll();
  };
  const bringForward = () => {
    const canvas = fabricRef.current; const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.bringObjectForward(obj); canvas.requestRenderAll();
  };
  const resetCanvas = () => {
    const canvas = fabricRef.current; if (!canvas) return;
    canvas.getObjects().forEach((o) => canvas.remove(o));
    canvas.discardActiveObject(); canvas.requestRenderAll();
  };
  const updateActiveColor = (color: string) => {
    setActiveColor(color);
    const canvas = fabricRef.current; const obj = canvas?.getActiveObject();
    if (obj && (obj as any).set) { (obj as any).set("fill", color); canvas?.requestRenderAll(); }
  };
  const exportPNG = () => {
    const canvas = fabricRef.current; if (!canvas) return;
    const url = canvas.toDataURL({ format: "png", multiplier: 2 });
    const a = document.createElement("a");
    a.href = url; a.download = `${selectedTemplate?.name ?? "design"}.png`; a.click();
  };

  const handleSave = async () => {
    if (!user) { toast.error("Yadda saxlamaq üçün daxil olun"); return; }
    if (!selectedTemplate) { toast.error("Əvvəlcə şablon seçin"); return; }
    const canvas = fabricRef.current; if (!canvas) return;
    setSaving(true);
    try {
      const json = canvas.toJSON();
      const previewUrl = canvas.toDataURL({ format: "png", multiplier: 0.5 });
      await saveDesign({
        userId: user.id,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        canvasJson: json,
        previewUrl,
      });
      toast.success("Dizayn yadda saxlandı");
    } catch (err: any) {
      toast.error("Yadda saxlanmadı", { description: err.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        {/* Clothing template strip */}
        <div>
          <label className="text-sm font-medium mb-2 block">Geyim Şablonu</label>
          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-24 h-24 rounded-xl bg-muted animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geyim şablonu tapılmadı.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`flex-shrink-0 w-24 rounded-xl border overflow-hidden transition-all ${
                    selectedTemplate?.id === t.id ? "ring-2 ring-primary border-primary" : "hover:border-foreground/30"
                  }`}
                >
                  <div className="aspect-square bg-muted">
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <p className="text-[11px] font-medium p-1.5 text-center truncate">{t.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="rounded-2xl border bg-card overflow-hidden"
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          <div className="flex items-center justify-center p-4">
            <canvas ref={canvasElRef} className="max-w-full" />
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !user}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Yadda Saxla
          </button>
          <button onClick={exportPNG} className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            <Download className="w-4 h-4" /> PNG Yüklə
          </button>
          <button onClick={resetCanvas} className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted text-destructive">
            <RotateCcw className="w-4 h-4" /> Sıfırla
          </button>
        </div>
        {!user && <p className="text-xs text-muted-foreground">Dizaynınızı yadda saxlamaq üçün daxil olun.</p>}

        {/* Sticker library */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <Sticker className="w-4 h-4" /> Stiker Kitabxanası
            <span className="text-[11px] font-normal text-muted-foreground">({stickers.length})</span>
          </h3>
          {assetsLoading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : stickers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Hələ stiker yoxdur. Admin panelindən əlavə edin.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-72 overflow-y-auto">
              {stickers.map((s) => (
                <button
                  key={s.id}
                  draggable
                  onDragStart={(e) => handleStickerDragStart(e, s)}
                  onClick={() => addStickerToCanvas(s)}
                  title={s.name}
                  className="aspect-square rounded-lg border bg-background hover:border-primary hover:shadow-sm transition-all p-1 cursor-grab active:cursor-grabbing"
                >
                  <img
                    src={s.image_url}
                    alt={s.name}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Tıklayın və ya kətanın üzərinə sürükləyin.</p>
        </div>

        {/* Background template library */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" /> Şablon Fonları
            <span className="text-[11px] font-normal text-muted-foreground">({bgTemplates.length})</span>
          </h3>
          {assetsLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : bgTemplates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Hələ şablon yoxdur. Admin panelindən əlavə edin.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
              {bgTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyBackgroundTemplate(t)}
                  title={t.name}
                  className="aspect-square rounded-lg border bg-background hover:border-primary hover:shadow-sm transition-all overflow-hidden"
                >
                  <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Tıkladıqda kətanın arxa fonu kimi təyin olunur.</p>
        </div>
      </div>

      {/* Tools sidebar */}
      <aside className="space-y-5 lg:sticky lg:top-20 self-start">
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <Type className="w-4 h-4" /> Mətn Əlavə Et
          </h3>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addText()}
            placeholder="Mətn yazın..."
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
          />
          <button onClick={addText} className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Type className="w-4 h-4" /> Əlavə Et
          </button>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <ImagePlus className="w-4 h-4" /> Şəkil Yüklə
          </h3>
          <label className="block">
            <span className="sr-only">Şəkil seç</span>
            <input
              type="file"
              accept="image/*"
              onChange={addImage}
              className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">Maks {MAX_UPLOAD_MB}MB. PNG və ya JPG.</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" /> Rəng (mətn)
          </h3>
          <input
            type="color"
            value={activeColor}
            onChange={(e) => updateActiveColor(e.target.value)}
            className="w-full h-10 rounded-md border bg-background cursor-pointer"
          />
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <h3 className="font-heading font-semibold text-sm">Obyekt</h3>
          <button
            onClick={bringForward}
            disabled={!hasSelection}
            className="w-full inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Layers className="w-4 h-4" /> Önə Gətir
          </button>
          <button
            onClick={deleteActive}
            disabled={!hasSelection}
            className="w-full inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted text-destructive disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Sil
          </button>
          <p className="text-[11px] text-muted-foreground pt-1">Seçilmiş obyekti sürüklə, böyüt/kiçilt və ya küncdən fırlat.</p>
        </div>
      </aside>
    </div>
  );
}
