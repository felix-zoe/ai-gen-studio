import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmailInput from "@/components/EmailInput";

/* Brand Logo SVG */
function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="18" cy="5" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="6" cy="18" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/* Decorative abstract pattern for the brand panel */
function BrandDecoration() {
  return (
    <svg
      className="absolute bottom-0 right-0 w-[80%] h-auto opacity-[0.07]"
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="200" cy="200" r="180" stroke="white" strokeWidth="0.5" />
      <circle cx="200" cy="200" r="140" stroke="white" strokeWidth="0.5" />
      <circle cx="200" cy="200" r="100" stroke="white" strokeWidth="0.5" />
      <circle cx="200" cy="200" r="60" stroke="white" strokeWidth="0.5" />
      <path d="M200 20L200 380" stroke="white" strokeWidth="0.3" />
      <path d="M20 200L380 200" stroke="white" strokeWidth="0.3" />
      <path d="M72 72L328 328" stroke="white" strokeWidth="0.3" />
      <path d="M328 72L72 328" stroke="white" strokeWidth="0.3" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/generate/image");
    } catch (err: any) {
      setError(err.response?.data?.detail || "登录失败，请检查邮箱和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(145deg, hsl(233 51% 50%) 0%, hsl(233 51% 38%) 100%)",
        }}
      >
        <BrandDecoration />

        <div className="relative z-10 flex flex-col items-center text-center px-8">
          <BrandLogo className="h-14 w-14 text-white mb-6" />
          <h2 className="text-[28px] font-semibold text-white tracking-[-0.02em] leading-tight">
            AI Gen Studio
          </h2>
          <p className="mt-3 text-[15px] text-white/70 max-w-[280px] leading-relaxed">
            用 AI 释放创意潜能，生成精美图片与视频
          </p>
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-[12px] text-white/40 tracking-wider uppercase" style={{ letterSpacing: "0.08em" }}>
            Powered by AI
          </p>
        </div>
      </div>

      {/* Right: Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-[380px]">
          {/* Header */}
          <div className="mb-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <BrandLogo className="h-7 w-7 text-primary" />
              <span className="text-[14px] font-semibold tracking-[-0.3px] text-foreground">
                AI Gen Studio
              </span>
            </div>
            <h1 className="text-[24px] font-semibold text-foreground tracking-[-0.02em]">
              欢迎回来
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              登录 AI Gen Studio 继续创作
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border-l-[3px] border-destructive bg-destructive/5 px-4 py-3">
              <p className="text-[13px] text-destructive">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-medium text-foreground">
                邮箱
              </Label>
              <EmailInput
                id="email"
                value={email}
                onChange={setEmail}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
                密码
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[13px] text-muted-foreground">
              还没有账号？{" "}
              <Link
                to="/register"
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                注册账号
              </Link>
            </p>
          </div>

          {/* Copyright */}
          <div className="mt-12 text-center">
            <p className="text-[11px] text-quaternary" style={{ color: "hsl(var(--foreground-quaternary))" }}>
              &copy; 2026 AI Gen Studio
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
