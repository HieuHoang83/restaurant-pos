"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  UtensilsCrossed, Monitor, LayoutDashboard, ConciergeBell,
  ArrowRight, ChefHat, LogOut, Loader2, RefreshCw,
  Users, Flame, Clock, CalendarDays, Activity, Wifi, WifiOff,
} from "lucide-react"
import { TablesApi, OrdersApi, KitchenApi, WaitlistApi, MenuApi } from "@/lib/api"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import { clearToken, getStoredUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

// ─── Module config ──────────────────────────────────────────────────────────
type ModuleCfg = {
  href: string
  icon: React.ElementType
  label: string
  sub: string
  desc: string
  // gradient cho card
  gradient: string
  // accent color cho icon container, badge...
  iconBg: string
  iconText: string
  ring: string
  glow: string
}

const MODULES: ModuleCfg[] = [
  {
    href: "/pos",
    icon: UtensilsCrossed,
    label: "POS",
    sub: "Thu ngân & Phục vụ",
    desc: "Sơ đồ bàn · Đặt món · Gửi bếp · Thanh toán",
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    ring: "ring-blue-200",
    glow: "shadow-blue-200/60",
  },
  {
    href: "/kds",
    icon: Monitor,
    label: "KDS",
    sub: "Màn hình Bếp",
    desc: "Phiếu gọi món theo trạm · SLA · Cập nhật tiến độ",
    gradient: "from-orange-500 to-red-500",
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    ring: "ring-orange-200",
    glow: "shadow-orange-200/60",
  },
  {
    href: "/admin",
    icon: LayoutDashboard,
    label: "Admin",
    sub: "Quản lý & Báo cáo",
    desc: "Thực đơn · Tồn kho · Doanh thu · Nhân sự",
    gradient: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    ring: "ring-violet-200",
    glow: "shadow-violet-200/60",
  },
  {
    href: "/host",
    icon: ConciergeBell,
    label: "Host",
    sub: "Tiếp tân",
    desc: "Sơ đồ bàn · Đặt trước · Danh sách chờ",
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    ring: "ring-emerald-200",
    glow: "shadow-emerald-200/60",
  },
]

// ─── Stats type ─────────────────────────────────────────────────────────────
type Stats = {
  tablesEmpty: number
  tablesTotal: number
  activeOrders: number
  pendingTickets: number
  waitlist: number
  menuItems: number
  online: boolean
  loading: boolean
}

const EMPTY_STATS: Stats = {
  tablesEmpty: 0, tablesTotal: 0, activeOrders: 0,
  pendingTickets: 0, waitlist: 0, menuItems: 0,
  online: false, loading: true,
}

// ─── Per-module count map ───────────────────────────────────────────────────
function moduleCount(href: string, s: Stats): { value: string; label: string } {
  switch (href) {
    case "/pos":
      return { value: `${s.tablesEmpty}/${s.tablesTotal}`, label: "bàn trống" }
    case "/kds":
      return { value: String(s.pendingTickets), label: "phiếu đang chờ" }
    case "/admin":
      return { value: String(s.menuItems), label: "món trong menu" }
    case "/host":
      return { value: String(s.waitlist), label: "khách đang chờ" }
    default:
      return { value: "—", label: "" }
  }
}

export default function Home() {
  const router = useRouter()
  const ready  = useAuthGuard()

  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [username, setUsername] = useState<string>("")

  // Cập nhật đồng hồ mỗi giây.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Lấy username từ storage.
  useEffect(() => {
    if (!ready) return
    const u = getStoredUser()
    if (u?.username) setUsername(u.username)
  }, [ready])

  // Load live stats.
  const loadStats = useCallback(async () => {
    setRefreshing(true)
    try {
      const [tables, ticketsRes, waitlistRes, menuRes, ordersRes] = await Promise.allSettled([
        TablesApi.list(),
        KitchenApi.activeTickets(),
        WaitlistApi.list(),
        MenuApi.listItems(),
        OrdersApi.list({ size: 200 }),
      ])

      const tablesArr = tables.status === "fulfilled" ? tables.value : []
      const ticketsArr = ticketsRes.status === "fulfilled" ? ticketsRes.value : []
      const waitlistArr = waitlistRes.status === "fulfilled" ? waitlistRes.value : []
      const menuArr = menuRes.status === "fulfilled" ? menuRes.value : []
      const ordersPage = ordersRes.status === "fulfilled" ? ordersRes.value : null

      const activeStatuses = new Set(["DRAFT", "PENDING", "COOKING", "READY_TO_SERVE", "SERVED"])
      const activeOrders = ordersPage
        ? (ordersPage.content ?? []).filter(o => activeStatuses.has(o.status)).length
        : 0

      const anyOk = [tables, ticketsRes, waitlistRes, menuRes, ordersRes].some(r => r.status === "fulfilled")

      setStats({
        tablesEmpty: tablesArr.filter(t => t.status === "AVAILABLE").length,
        tablesTotal: tablesArr.length,
        activeOrders,
        pendingTickets: ticketsArr.length,
        waitlist: waitlistArr.filter(w => w.status === "WAITING" || w.status === "NOTIFIED").length,
        menuItems: menuArr.length,
        online: anyOk,
        loading: false,
      })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (ready) loadStats()
  }, [ready, loadStats])

  // Polling mỗi 15s.
  useEffect(() => {
    if (!ready) return
    const id = setInterval(loadStats, 15000)
    return () => clearInterval(id)
  }, [ready, loadStats])

  const logout = useCallback(() => {
    clearToken()
    router.replace("/login")
  }, [router])

  if (!ready) return null

  const greeting =
    now.getHours() < 11 ? "Chào buổi sáng" :
    now.getHours() < 14 ? "Chào buổi trưa" :
    now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối"

  const dateStr = now.toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })
  const timeStr = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit", minute: "2-digit",
  })

  return (
    <main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* ── Background blobs ── */}
      <div className="absolute top-[-120px] left-[-100px] w-[500px] h-[500px] rounded-full bg-blue-100/40 blur-[100px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-100px] w-[400px] h-[400px] rounded-full bg-orange-100/30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-120px] left-[30%] w-[480px] h-[480px] rounded-full bg-violet-100/30 blur-[100px] pointer-events-none" />

      {/* ── Top bar ── */}
      <header className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-200/60">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-800">
              Resto<span className="text-orange-500">POS</span>
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">IRMS Dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* System status pill */}
          <span
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border",
              stats.loading
                ? "border-slate-200 bg-slate-50 text-slate-500"
                : stats.online
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-600",
            )}
          >
            {stats.loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : stats.online ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {stats.loading ? "Kiểm tra..." : stats.online ? "Backend kết nối" : "Backend mất kết nối"}
          </span>

          <button
            onClick={loadStats}
            disabled={refreshing}
            title="Tải lại số liệu"
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>

          {/* User chip + logout */}
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold text-slate-700">{username || "Guest"}</span>
              <span className="text-[10px] text-slate-400">đang trực ca</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-md">
              {(username || "?").slice(0, 1).toUpperCase()}
            </div>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition flex items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero / greeting ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 mt-10 mb-7">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mb-1">
              {greeting}
              {username && <span className="text-slate-500 normal-case tracking-normal">, {username} 👋</span>}
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-800">
              Chọn giao diện làm việc
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span className="capitalize">{dateStr}</span>
            <span className="w-px h-4 bg-slate-200" />
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-mono font-semibold text-slate-700">{timeStr}</span>
          </div>
        </div>
      </section>

      {/* ── Quick stats ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 mb-7">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Bàn trống"
            value={`${stats.tablesEmpty}/${stats.tablesTotal}`}
            tint="emerald"
            loading={stats.loading}
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Đơn đang xử lý"
            value={String(stats.activeOrders)}
            tint="blue"
            loading={stats.loading}
          />
          <StatCard
            icon={<Flame className="w-4 h-4" />}
            label="Phiếu bếp chờ"
            value={String(stats.pendingTickets)}
            tint="orange"
            loading={stats.loading}
          />
          <StatCard
            icon={<ConciergeBell className="w-4 h-4" />}
            label="Khách đang chờ"
            value={String(stats.waitlist)}
            tint="violet"
            loading={stats.loading}
          />
        </div>
      </section>

      {/* ── Module cards ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {MODULES.map((m) => {
            const Icon = m.icon
            const count = moduleCount(m.href, stats)
            return (
              <Link
                key={m.href}
                href={m.href}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm",
                  "hover:-translate-y-1 hover:shadow-2xl transition-all duration-300",
                  m.glow,
                )}
              >
                {/* Gradient overlay khi hover */}
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    m.gradient,
                  )}
                  aria-hidden="true"
                />
                {/* Glow ring */}
                <div className={cn(
                  "absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-0 group-hover:opacity-30 blur-3xl transition-opacity duration-300 bg-gradient-to-br",
                  m.gradient,
                )} aria-hidden="true" />

                <div className="relative z-10 flex items-start justify-between mb-5">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                      m.iconBg,
                      "group-hover:bg-white/20 group-hover:backdrop-blur-sm group-hover:ring-1 group-hover:ring-white/30",
                    )}
                  >
                    <Icon className={cn("w-7 h-7 transition-colors duration-300", m.iconText, "group-hover:text-white")} />
                  </div>
                  {/* Live count badge */}
                  <div
                    className={cn(
                      "text-right transition-colors duration-300",
                      "text-slate-700 group-hover:text-white",
                    )}
                  >
                    <div className="text-2xl font-black leading-none">{count.value}</div>
                    <div className={cn(
                      "text-[10px] uppercase tracking-wider font-medium mt-1 transition-colors duration-300",
                      "text-slate-400 group-hover:text-white/80",
                    )}>
                      {count.label}
                    </div>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={cn(
                      "text-2xl font-bold tracking-tight transition-colors duration-300",
                      "text-slate-800 group-hover:text-white",
                    )}>
                      {m.label}
                    </h3>
                    <span className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors duration-300",
                      "bg-slate-100 text-slate-500",
                      "group-hover:bg-white/20 group-hover:text-white",
                    )}>
                      {m.sub}
                    </span>
                  </div>
                  <p className={cn(
                    "text-sm leading-relaxed transition-colors duration-300",
                    "text-slate-500 group-hover:text-white/85",
                  )}>
                    {m.desc}
                  </p>

                  <div className={cn(
                    "mt-5 flex items-center gap-1 text-sm font-semibold transition-colors duration-300",
                    "text-slate-400 group-hover:text-white",
                  )}>
                    <span>Mở giao diện</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pb-6 text-center">
        <p className="text-[11px] text-slate-400">
          © {now.getFullYear()} RestoPOS · IRMS Microservices · Polling mỗi 15s
        </p>
      </footer>
    </main>
  )
}

// ─── Quick stat card ────────────────────────────────────────────────────────
const STAT_TINTS: Record<string, { dot: string; ring: string; iconBg: string; iconText: string }> = {
  emerald: { dot: "bg-emerald-500", ring: "ring-emerald-100", iconBg: "bg-emerald-50",  iconText: "text-emerald-600" },
  blue:    { dot: "bg-blue-500",    ring: "ring-blue-100",    iconBg: "bg-blue-50",     iconText: "text-blue-600" },
  orange:  { dot: "bg-orange-500",  ring: "ring-orange-100",  iconBg: "bg-orange-50",   iconText: "text-orange-600" },
  violet:  { dot: "bg-violet-500",  ring: "ring-violet-100",  iconBg: "bg-violet-50",   iconText: "text-violet-600" },
}

function StatCard({
  icon, label, value, tint, loading,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tint: keyof typeof STAT_TINTS
  loading: boolean
}) {
  const cfg = STAT_TINTS[tint]
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 hover:shadow-md transition-shadow flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", cfg.iconBg, cfg.iconText)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">{label}</div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <div className="h-6 w-12 bg-slate-100 rounded animate-pulse mt-1" />
          ) : (
            <span className="text-2xl font-black text-slate-800 leading-none mt-0.5">{value}</span>
          )}
        </div>
      </div>
    </div>
  )
}
