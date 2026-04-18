import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function LoginPage() {
  const [params] = useSearchParams();
  const refFromUrl = params.get("ref") || "";
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const translateError = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes("invalid login")) return "E-poçt və ya şifrə yanlışdır";
    if (m.includes("email not confirmed")) return "E-poçt təsdiqlənməyib";
    if (m.includes("user already registered") || m.includes("already been registered")) return "Bu e-poçt artıq qeydiyyatdadır";
    if (m.includes("password should be at least")) return "Şifrə ən azı 6 simvol olmalıdır";
    if (m.includes("unable to validate email")) return "E-poçt formatı yanlışdır";
    return msg;
  };

  const ADMIN_EMAIL = "chaplyazerbaijan@gmail.com";

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/");
    if (user.email?.toLowerCase() === ADMIN_EMAIL) return navigate("/admin");
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    navigate(data === true ? "/admin" : "/profile");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        await redirectByRole();
      } else {
        const { error: signUpError } = await signUp(email, password, fullName, referralCode || undefined);
        if (signUpError) throw signUpError;
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
        await redirectByRole();
      }
    } catch (err: any) {
      setError(translateError(err.message || "Xəta baş verdi"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-card p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-heading font-bold">{isLogin ? "Daxil Ol" : "Qeydiyyat"}</h1>
            <p className="text-muted-foreground text-sm mt-2">
              {isLogin ? "Hesabınıza daxil olun" : "Yeni hesab yaradın"}
            </p>
          </div>

          {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Ad Soyad</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm"
                    required
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">E-poçt</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Şifrə</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 rounded-md border bg-background text-sm"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Referral Kodu (istəyə bağlı)</label>
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Referral kodu"
                  className="w-full px-4 py-2 rounded-md border bg-background text-sm"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Gözləyin..." : isLogin ? "Daxil Ol" : "Qeydiyyatdan Keç"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">və ya</span>
            </div>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border px-6 py-2.5 text-sm font-medium hover:bg-muted"
          >
            Google ilə Daxil Ol
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "Hesabınız yoxdur?" : "Artıq hesabınız var?"}{" "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-foreground hover:underline font-medium">
              {isLogin ? "Qeydiyyatdan keçin" : "Daxil olun"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
