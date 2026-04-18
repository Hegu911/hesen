import { useState } from "react";
import { Send, Handshake } from "lucide-react";
import { z } from "zod";
import { sendEmail } from "@/lib/templates";
import { toast } from "sonner";

const schema = z.object({
  firstName: z.string().trim().min(2, "Ad ən az 2 simvol"),
  lastName: z.string().trim().min(2, "Soyad ən az 2 simvol"),
  phone: z.string().trim().min(7, "Telefon nömrəsi qısadır").max(30),
  address: z.string().trim().min(5, "Ünvan ən az 5 simvol"),
  postalCode: z.string().trim().min(3, "Poçt indeksi qısadır").max(20),
  message: z.string().trim().max(2000).optional(),
});

export default function CollaborationPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    postalCode: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((i) => (fe[i.path[0] as string] = i.message));
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      await sendEmail("collaboration", result.data);
      setDone(true);
      toast.success("Sorğunuz göndərildi");
    } catch (err: any) {
      console.error(err);
      toast.error("Göndərmə uğursuz", { description: err?.message ?? "Yenidən cəhd edin" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Handshake className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-heading font-bold mb-2">Təşəkkürlər!</h1>
        <p className="text-muted-foreground mb-6">
          Əməkdaşlıq sorğunuz qəbul edildi. Komandamız tezliklə sizinlə əlaqə saxlayacaq.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setForm({ firstName: "", lastName: "", phone: "", address: "", postalCode: "", message: "" });
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Yeni Sorğu
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Əməkdaşlıq</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Bizimlə əməkdaşlıq etmək istəyirsiniz? Məlumatlarınızı yazın, sizinlə əlaqə saxlayaq.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ad" value={form.firstName} onChange={(v) => update("firstName", v)} error={errors.firstName} />
          <Field label="Soyad" value={form.lastName} onChange={(v) => update("lastName", v)} error={errors.lastName} />
        </div>
        <Field
          label="Telefon"
          type="tel"
          value={form.phone}
          onChange={(v) => update("phone", v)}
          error={errors.phone}
          placeholder="+994 50 123 45 67"
        />
        <Field label="Ünvan" value={form.address} onChange={(v) => update("address", v)} error={errors.address} />
        <Field
          label="Poçt indeksi"
          value={form.postalCode}
          onChange={(v) => update("postalCode", v)}
          error={errors.postalCode}
          placeholder="AZ1000"
        />
        <div className="space-y-1">
          <label className="text-sm font-medium">Mesaj (istəyə bağlı)</label>
          <textarea
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            rows={4}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Bizə əməkdaşlıq haqqında qısa məlumat verin..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Göndərilir..." : "Sorğu Göndər"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
