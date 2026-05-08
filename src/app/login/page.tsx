"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChefHat, Lock, User, Mail, AlertCircle, Loader2,
  LogIn, UserPlus, CheckCircle2, ArrowRight,
} from "lucide-react"
import { AuthApi } from "@/lib/api"
import { setStoredUser, setToken, isAuthed } from "@/lib/auth"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type Mode = "login" | "register"

function AuthCard() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get("redirect") || "/"

  const [mode, setMode] = useState<Mode>("login")

  // Form state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail]       = useState("")
  const [confirm, setConfirm]   = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Đã login → đi luôn.
  useEffect(() => {
    if (isAuthed()) router.replace(redirect)
  }, [router, redirect])

  // Khi đổi tab thì reset thông báo + giữ username (đỡ phải gõ lại).
  function switchMode(next: Mode) {
    if (mode === next) return
    setMode(next)
    setError(null)
    setSuccess(null)
    setPassword("")
    setConfirm("")
  }

  function describeError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) return "Tên đăng nhập hoặc mật khẩu không đúng."
      if (err.status === 409) return "Tên đăng nhập hoặc email đã tồn tại."
      if (err.status === 400) return err.message || "Dữ liệu nhập vào chưa hợp lệ."
      if (err.status === 0 || err.status >= 500)
        return "Không kết nối được tới máy chủ. Kiểm tra admin-service đang chạy chưa?"
      return err.message
    }
    return "Lỗi không xác định."
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!username.trim() || !password) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.")
      return
    }
    setSubmitting(true)
    try {
      const res = await AuthApi.login({ username: username.trim(), password })
      setToken(res.token)
      setStoredUser({ username: username.trim() })
      router.replace(redirect)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!username.trim() || !email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ thông tin.")
      return
    }
    if (password.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự.")
      return
    }
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.")
      return
    }
    setSubmitting(true)
    try {
      const res = await AuthApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
      })
      // BE trả luôn token sau khi register → có thể đăng nhập ngay.
      if (res.token) {
        setToken(res.token)
        setStoredUser({ username: username.trim() })
        setSuccess("Đăng ký thành công! Đang chuyển hướng...")
        setTimeout(() => router.replace(redirect), 800)
      } else {
        setSuccess("Đăng ký thành công! Hãy đăng nhập.")
        setMode("login")
        setPassword("")
        setConfirm("")
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === "login"
  const accent = isLogin
    ? "from-orange-500 to-red-500"
    : "from-emerald-500 to-teal-500"
  const focusRing = isLogin
    ? "focus:border-orange-400 focus:ring-orange-100"
    : "focus:border-emerald-400 focus:ring-emerald-100"

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-120px] left-[-100px] w-[480px] h-[480px] rounded-full bg-orange-100/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-120px] right-[-100px] w-[420px] h-[420px] rounded-full bg-emerald-100/30 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-[10%] w-[280px] h-[280px] rounded-full bg-violet-100/30 blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* ── Brand ── */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-200/60 mb-3">
            <ChefHat className="w-7 h-7 text-white" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            Resto<span className="text-orange-500">POS</span>
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-[0.2em] mt-1">
            Hệ thống quản lý nhà hàng
          </div>
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden">
          {/* Tabs — segmented control */}
          <div className="grid grid-cols-2 p-1.5 m-3 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => switchMode("login")}
              disabled={submitting}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all",
                isLogin
                  ? "bg-white text-orange-600 shadow-sm shadow-slate-200/80"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              disabled={submitting}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all",
                !isLogin
                  ? "bg-white text-emerald-600 shadow-sm shadow-slate-200/80"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              <UserPlus className="w-4 h-4" />
              Đăng ký
            </button>
          </div>

          <form
            onSubmit={isLogin ? onLogin : onRegister}
            className="px-7 pb-7 pt-2"
          >
            {/* Tiêu đề */}
            <div className="mb-5">
              <h1 className="text-lg font-bold text-slate-800">
                {isLogin ? "Đăng nhập tài khoản" : "Tạo tài khoản mới"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isLogin
                  ? "Nhập thông tin để truy cập hệ thống"
                  : "Điền thông tin để đăng ký tài khoản nhân viên"}
              </p>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Username */}
            <Field
              label="Tên đăng nhập"
              icon={<User className="w-4 h-4" />}
              focusRing={focusRing}
            >
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                autoFocus
                autoComplete="username"
                className={cn(
                  "w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 disabled:bg-slate-50",
                  focusRing,
                )}
                placeholder={isLogin ? "admin" : "vd. nguyenvana"}
              />
            </Field>

            {/* Email — chỉ ở mode register */}
            {!isLogin && (
              <Field
                label="Email"
                icon={<Mail className="w-4 h-4" />}
                focusRing={focusRing}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  autoComplete="email"
                  className={cn(
                    "w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 disabled:bg-slate-50",
                    focusRing,
                  )}
                  placeholder="email@nhahang.vn"
                />
              </Field>
            )}

            {/* Password */}
            <Field
              label="Mật khẩu"
              icon={<Lock className="w-4 h-4" />}
              focusRing={focusRing}
              hint={!isLogin ? "Tối thiểu 6 ký tự" : undefined}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className={cn(
                  "w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 disabled:bg-slate-50",
                  focusRing,
                )}
                placeholder="••••••••"
              />
            </Field>

            {/* Confirm password — chỉ register */}
            {!isLogin && (
              <Field
                label="Xác nhận mật khẩu"
                icon={<Lock className="w-4 h-4" />}
                focusRing={focusRing}
              >
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                  autoComplete="new-password"
                  className={cn(
                    "w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 disabled:bg-slate-50",
                    focusRing,
                  )}
                  placeholder="••••••••"
                />
              </Field>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "w-full py-2.5 mt-1 rounded-lg bg-gradient-to-r text-white font-semibold hover:opacity-95 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-md",
                accent,
                isLogin ? "shadow-orange-200/60" : "shadow-emerald-200/60",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isLogin ? "Đang đăng nhập..." : "Đang đăng ký..."}
                </>
              ) : (
                <>
                  {isLogin ? "Đăng nhập" : "Tạo tài khoản"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Footer link đổi mode */}
            <p className="text-xs text-slate-500 text-center mt-5">
              {isLogin ? (
                <>
                  Chưa có tài khoản?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-emerald-600 font-semibold hover:text-emerald-700 hover:underline"
                  >
                    Đăng ký ngay
                  </button>
                </>
              ) : (
                <>
                  Đã có tài khoản?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-orange-600 font-semibold hover:text-orange-700 hover:underline"
                  >
                    Đăng nhập
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-400 text-center mt-5">
          © {new Date().getFullYear()} RestoPOS · Hệ thống IRMS
        </p>
      </div>
    </main>
  )
}

// ─── Field wrapper ──────────────────────────────────────────────────────────
function Field({
  label, icon, children, focusRing, hint,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
  focusRing: string
  hint?: string
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        {children}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">Đang tải...</div>}>
      <AuthCard />
    </Suspense>
  )
}
