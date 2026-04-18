import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { sendEmail } from "@/lib/templates";
import { toast } from "sonner";

export default function RequestDesignPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      await sendEmail("design-request", {
        fullName: user.user_metadata?.full_name ?? user.email ?? "Müştəri",
        email: user.email ?? "",
        phone: user.user_metadata?.phone ?? "",
        description: description.trim(),
        imageDataUrl: imagePreview ?? null,
        imageFileName: imageFile?.name ?? null,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("Sorğu göndərilmədi");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Send className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-heading font-bold mb-2">Sorğunuz Göndərildi!</h1>
        <p className="text-muted-foreground mb-6">Komandamız tezliklə sizinlə əlaqə saxlayacaq.</p>
        <button
          onClick={() => {
            setSubmitted(false);
            setDescription("");
            setImageFile(null);
            setImagePreview(null);
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Yeni Sorğu
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">Dizayn Sifariş</h1>
        <p className="text-muted-foreground">Xüsusi dizayn istəyinizi bizə bildirin</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">Nə istəyirsiniz? *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dizayn haqqında ətraflı yazın..."
            rows={5}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Şəkil (istəyə bağlı)</label>
          <div className="rounded-xl border-2 border-dashed p-6 text-center">
            <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Nümunə şəkil yükləyin</p>
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
          </div>
          {imagePreview && (
            <div className="mt-3 rounded-xl border overflow-hidden">
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain bg-muted" />
            </div>
          )}
        </div>

        {!user && !authLoading && (
          <p className="text-sm text-muted-foreground">
            Sorğu göndərmək üçün{" "}
            <button type="button" onClick={() => navigate("/login")} className="text-foreground underline">
              daxil olun
            </button>
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !description.trim() || (!user && !authLoading)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Göndərilir..." : "Sorğu Göndər"}
        </button>
      </form>
    </div>
  );
}
