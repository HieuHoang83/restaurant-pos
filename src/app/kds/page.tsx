"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, Monitor, AlertCircle, Clock, RotateCcw,
  PauseCircle, CheckCircle2, ChefHat, Flame, Star,
  Zap, Timer, Coffee, Loader2, LogOut, RefreshCw,
} from "lucide-react"
import { formatElapsed, cn } from "@/lib/utils"
import type { Station, OrderItem, Order, MenuItem } from "@/types"
import { KitchenApi, MenuApi, TablesApi } from "@/lib/api"
import { menuItemFromApi, ticketFromApi, ticketItemStatusToApi } from "@/lib/adapters"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useRealtime, SSE_URLS } from "@/hooks/useRealtime"
import { clearToken } from "@/lib/auth"
import { ApiError } from "@/lib/api/client"

// ─── Constants ──────────────────────────────────────────────────────────────
const STATIONS: Station[] = ["Nướng", "Chiên", "Tráng miệng", "Bar", "Lạnh"]

const STATION_CFG: Record<Station, {
  color: string;
  borderColor: string;
  textColor: string;
  icon: React.ElementType;
  bg: string;
  cardBg: string;
  cardBorder: string;
  btnBg: string;
  badgeBg: string;
  barColor: string;
}> = {
  "Nướng":       { color: "border-l-orange-500", borderColor: "border-orange-500", textColor: "text-orange-400", icon: Flame,  bg: "bg-orange-500/10", cardBg: "bg-orange-950/30", cardBorder: "border-orange-900/40", btnBg: "bg-orange-500 hover:bg-orange-400", badgeBg: "bg-orange-500/20 border-orange-500/30", barColor: "bg-orange-400" },
  "Chiên":       { color: "border-l-yellow-500", borderColor: "border-yellow-500", textColor: "text-yellow-400", icon: Zap,    bg: "bg-yellow-500/10", cardBg: "bg-yellow-950/30", cardBorder: "border-yellow-900/40", btnBg: "bg-yellow-500 hover:bg-yellow-400", badgeBg: "bg-yellow-500/20 border-yellow-500/30", barColor: "bg-yellow-400" },
  "Tráng miệng": { color: "border-l-pink-400",   borderColor: "border-pink-400",   textColor: "text-pink-400",   icon: Coffee, bg: "bg-pink-500/10",   cardBg: "bg-pink-950/30",   cardBorder: "border-pink-900/40",   btnBg: "bg-pink-500 hover:bg-pink-400",     badgeBg: "bg-pink-500/20 border-pink-500/30",     barColor: "bg-pink-400"   },
  "Bar":         { color: "border-l-violet-500", borderColor: "border-violet-500", textColor: "text-violet-400", icon: Coffee, bg: "bg-violet-500/10", cardBg: "bg-violet-950/30", cardBorder: "border-violet-900/40", btnBg: "bg-violet-500 hover:bg-violet-400", badgeBg: "bg-violet-500/20 border-violet-500/30", barColor: "bg-violet-400" },
  "Lạnh":        { color: "border-l-blue-400",   borderColor: "border-blue-400",   textColor: "text-blue-400",   icon: Timer,  bg: "bg-blue-500/10",   cardBg: "bg-blue-950/30",   cardBorder: "border-blue-900/40",   btnBg: "bg-blue-500 hover:bg-blue-400",     badgeBg: "bg-blue-500/20 border-blue-500/30",     barColor: "bg-blue-400"   },
}

// ─── Ticket interface ────────────────────────────────────────────────────────
interface Ticket {
  orderId: string
  tableLabel: string  // VD: "A01", "B05", "C02" — số nguyên + section prefix
  tableSection: string // VD: "A", "B", "C" — chữ cái đầu cho UI badge
  isVIP: boolean
  item: OrderItem
  station: Station
  sentAt: Date
  slaSeconds: number
}

function buildTickets(orders: Order[], tableLabelById: Map<string, string>): Ticket[] {
  const tickets: Ticket[] = []
  for (const order of orders) {
    if (!order.sentAt) continue
    const label = tableLabelById.get(order.tableId) ?? `#${order.tableNumber || "?"}`
    const section = label.match(/^[A-Za-z]+/)?.[0] ?? ""
    for (const item of order.items) {
      if (item.status === "cancelled") continue
      tickets.push({
        orderId:      order.id,
        tableLabel:   label,
        tableSection: section,
        isVIP:        order.isVIP,
        item,
        station:      item.menuItem.station,
        sentAt:       order.sentAt!,
        slaSeconds:   item.menuItem.slaMinutes * 60,
      })
    }
  }
  return tickets.sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1
    if (!a.isVIP && b.isVIP) return 1
    const aE = Date.now() - a.sentAt.getTime()
    const bE = Date.now() - b.sentAt.getTime()
    return bE - aE
  })
}

type SuspendInfo = { itemId: string; orderId: string }

// ─── Main component ──────────────────────────────────────────────────────────
export default function KDSPage() {
  const router = useRouter()
  const ready  = useAuthGuard()

  const [activeStation, setActiveStation] = useState<Station | "Tất cả">("Tất cả")
  const [orders, setOrders] = useState<Order[]>([])
  const [menu, setMenu]     = useState<MenuItem[]>([])
  const [tableLabelById, setTableLabelById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [second, setSecond] = useState(0)
  const [suspendTarget, setSuspendTarget] = useState<SuspendInfo | null>(null)
  const [suspendReason, setSuspendReason] = useState("")
  const [recalled, setRecalled] = useState<Set<string>>(new Set())
  const clockRef = useRef<ReturnType<typeof setInterval>>()

  // Tick every second
  useEffect(() => {
    clockRef.current = setInterval(() => setSecond(v => v + 1), 1000)
    return () => clearInterval(clockRef.current)
  }, [])

  // ── Load tickets from BE ──
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      // Lấy menu + tables để map id → name/number cho UI.
      const [menuApi, tablesApi, ticketsApi] = await Promise.all([
        MenuApi.listItems().catch(() => []),
        TablesApi.list().catch(() => []),
        KitchenApi.activeTickets(),
      ])
      const uiMenu = menuApi.map(menuItemFromApi)
      const menuMap = new Map(uiMenu.map((m) => [m.id, m]))
      const tableNumberById = new Map<string, number>()
      const tableLabelMap = new Map<string, string>()
      for (const t of tablesApi) {
        const n = parseInt(t.tableNumber.replace(/\D+/g, ""), 10) || 0
        tableNumberById.set(t.id, n)
        tableLabelMap.set(t.id, t.tableNumber)
      }
      setMenu(uiMenu)
      setTableLabelById(tableLabelMap)
      const uiOrders = ticketsApi.map((tk) =>
        ticketFromApi(tk, { menuMap, tableNumberById }),
      )
      setOrders(uiOrders)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken()
        router.replace("/login?redirect=/kds")
        return
      }
      setLoadError(err instanceof ApiError ? err.message : "Không kết nối được tới máy chủ.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    if (ready) loadAll()
  }, [ready, loadAll])

  // Realtime: SSE từ kitchen-service (ticket events) — refetch ngay khi có thay đổi.
  useRealtime(ready ? [SSE_URLS.KITCHEN] : [], () => loadAll(true))

  const logout = useCallback(() => {
    clearToken()
    router.replace("/login")
  }, [router])

  const tickets = buildTickets(orders, tableLabelById)
  const stationTickets = activeStation === "Tất cả"
    ? tickets
    : tickets.filter(t => t.station === activeStation)

  const groupedByStation = STATIONS.reduce<Record<string, Ticket[]>>((acc, s) => {
    acc[s] = tickets.filter(t => t.station === s)
    return acc
  }, {} as Record<string, Ticket[]>)

  const pendingCount  = tickets.filter(t => t.item.status === "pending").length
  const cookingCount  = tickets.filter(t => t.item.status === "cooking").length
  const readyCount    = tickets.filter(t => t.item.status === "ready").length
  const overdueCount  = tickets.filter(t => {
    const e = Math.floor((Date.now() - t.sentAt.getTime()) / 1000)
    return e > t.slaSeconds && t.item.status !== "ready"
  }).length

  // ── Actions ── (gọi BE qua KitchenApi.updateItemStatus)
  // Optimistic update + reload background.
  const updateItemUi = useCallback((ticketItemId: string, newStatus: OrderItem["status"]) => {
    setOrders(prev => prev.map(o => ({
      ...o,
      items: o.items.map(i =>
        i.id === ticketItemId
          ? { ...i,
              status: newStatus,
              startedAt: newStatus === "cooking" && !i.startedAt ? new Date() : i.startedAt,
              completedAt: newStatus === "ready" ? new Date() : i.completedAt,
            }
          : i,
      ),
    })))
  }, [])

  const startCooking = useCallback(async (ticket: Ticket) => {
    setBusy(true)
    updateItemUi(ticket.item.id, "cooking")
    try {
      await KitchenApi.updateItemStatus(ticket.item.id, ticketItemStatusToApi("cooking"))
    } catch (err) {
      console.error(err); await loadAll(true)
    } finally { setBusy(false) }
  }, [updateItemUi, loadAll])

  const markReady = useCallback(async (ticket: Ticket) => {
    setBusy(true)
    updateItemUi(ticket.item.id, "ready")
    try {
      await KitchenApi.updateItemStatus(ticket.item.id, ticketItemStatusToApi("ready"))
    } catch (err) {
      console.error(err); await loadAll(true)
    } finally { setBusy(false) }
  }, [updateItemUi, loadAll])

  const recallTicket = useCallback(async (ticket: Ticket) => {
    setBusy(true)
    updateItemUi(ticket.item.id, "cooking")
    setRecalled(prev => {
      const next = new Set(prev)
      next.add(ticket.item.id)
      setTimeout(() => setRecalled(s => { const n=new Set(s); n.delete(ticket.item.id); return n }), 3000)
      return next
    })
    try {
      await KitchenApi.updateItemStatus(ticket.item.id, ticketItemStatusToApi("cooking"))
    } catch (err) {
      console.error(err); await loadAll(true)
    } finally { setBusy(false) }
  }, [updateItemUi, loadAll])

  const confirmSuspend = useCallback(async () => {
    if (!suspendTarget || !suspendReason) return
    setBusy(true)
    updateItemUi(suspendTarget.itemId, "cancelled")
    setSuspendTarget(null)
    setSuspendReason("")
    try {
      await KitchenApi.updateItemStatus(suspendTarget.itemId, ticketItemStatusToApi("cancelled"))
    } catch (err) {
      console.error(err); await loadAll(true)
    } finally { setBusy(false) }
  }, [suspendTarget, suspendReason, updateItemUi, loadAll])

  const now = Date.now()

  if (!ready) return null

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d0f14] text-gray-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Đang tải tickets từ kitchen-service...</span>
      </div>
    )
  }

  if (loadError && orders.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0d0f14] text-gray-300 gap-3 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm font-semibold">Không tải được tickets</p>
        <p className="text-xs text-gray-500 max-w-md">{loadError}</p>
        <p className="text-xs text-gray-600">Kiểm tra kitchen-service đã chạy chưa.</p>
        <button onClick={() => loadAll()} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 mt-2">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white flex flex-col select-none">
      {/* ── Header ── */}
      <header className="h-14 bg-[#111318] border-b border-white/5 flex items-center px-5 gap-4 shrink-0">
        <Link href="/" className="text-gray-500 hover:text-white flex items-center gap-1.5 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />Home
        </Link>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-orange-400" />
          </div>
          <span className="font-bold text-sm tracking-wide">KDS · KITCHEN DISPLAY</span>
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-3">
          <StatPill color="text-gray-400" bg="bg-white/5" label={`${pendingCount} chờ`} icon={<Clock className="w-3 h-3"/>} />
          <StatPill color="text-amber-400" bg="bg-amber-500/10" label={`${cookingCount} đang nấu`} icon={<Flame className="w-3 h-3"/>} />
          <StatPill color="text-emerald-400" bg="bg-emerald-500/10" label={`${readyCount} sẵn sàng`} icon={<CheckCircle2 className="w-3 h-3"/>} />
          {overdueCount > 0 && (
            <StatPill color="text-red-400" bg="bg-red-500/15 animate-pulse" label={`${overdueCount} trễ SLA!`} icon={<AlertCircle className="w-3 h-3"/>} />
          )}
          <div className="text-gray-600 text-xs font-mono ml-2 border-l border-white/10 pl-3">
            {new Date().toLocaleTimeString("vi-VN")}
          </div>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing || busy}
            title="Tải lại"
            className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors p-1.5"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={logout}
            title="Đăng xuất"
            className="text-gray-500 hover:text-white transition-colors p-1.5"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Station tabs ── */}
      <div className="bg-[#111318] border-b border-white/5 px-4 py-2 flex gap-2 overflow-x-auto shrink-0">
        <StationTab
          label="Tất cả"
          count={tickets.length}
          active={activeStation === "Tất cả"}
          onClick={() => setActiveStation("Tất cả")}
          color="text-gray-300"
          activeBg="bg-gray-700"
        />
        {STATIONS.map(s => {
          const cfg = STATION_CFG[s]
          const count = groupedByStation[s]?.length ?? 0
          const Icon = cfg.icon
          return (
            <StationTab
              key={s}
              label={s}
              count={count}
              active={activeStation === s}
              onClick={() => setActiveStation(s)}
              color={cfg.textColor}
              activeBg={cfg.bg}
              icon={<Icon className="w-3.5 h-3.5" />}
            />
          )
        })}
      </div>

      {/* ── Ticket grid ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {stationTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-700">
            <ChefHat className="w-14 h-14 mb-4 opacity-30" />
            <p className="text-lg font-semibold opacity-50">Bếp đang rảnh!</p>
            <p className="text-sm opacity-30 mt-1">Không có phiếu gọi món</p>
          </div>
        ) : activeStation === "Tất cả" ? (
          // Group view
          <div className="space-y-6">
            {STATIONS.map(station => {
              const list = groupedByStation[station]
              if (!list || list.length === 0) return null
              const cfg = STATION_CFG[station]
              const Icon = cfg.icon
              return (
                <section key={station}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={cn("w-4 h-4", cfg.textColor)} />
                    <h2 className={cn("text-xs font-bold uppercase tracking-widest", cfg.textColor)}>
                      Trạm {station}
                    </h2>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", cfg.bg, cfg.textColor)}>
                      {list.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {list.map(t => (
                      <TicketCard
                        key={`${t.orderId}-${t.item.id}`}
                        ticket={t}
                        now={now}
                        second={second}
                        isRecalled={recalled.has(t.item.id)}
                        onStart={() => startCooking(t)}
                        onReady={() => markReady(t)}
                        onRecall={() => recallTicket(t)}
                        onSuspend={() => setSuspendTarget({ itemId: t.item.id, orderId: t.orderId })}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {stationTickets.map(t => (
              <TicketCard
                key={`${t.orderId}-${t.item.id}`}
                ticket={t}
                now={now}
                second={second}
                isRecalled={recalled.has(t.item.id)}
                onStart={() => startCooking(t)}
                onReady={() => markReady(t)}
                onRecall={() => recallTicket(t)}
                onSuspend={() => setSuspendTarget({ itemId: t.item.id, orderId: t.orderId })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Suspend modal ── */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d25] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <PauseCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Tạm ngưng món</h3>
                <p className="text-xs text-gray-500 mt-0.5">Chọn lý do bắt buộc</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {[
                "Hết nguyên liệu chính",
                "Nguyên liệu chưa đủ chất lượng",
                "Thiết bị bếp gặp sự cố",
                "Quá tải trạm bếp",
                "Khách đổi ý (xác nhận lại)",
              ].map(r => (
                <button
                  key={r}
                  onClick={() => setSuspendReason(r)}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl border text-sm text-left transition-all",
                    suspendReason === r
                      ? "border-amber-500 bg-amber-500/15 text-amber-300 font-semibold"
                      : "border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
                  )}
                >
                  {suspendReason === r ? "● " : "○ "}{r}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setSuspendTarget(null); setSuspendReason("") }}
                className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm text-gray-400 hover:border-white/20 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmSuspend}
                disabled={!suspendReason}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Xác nhận tạm ngưng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stat pill ───────────────────────────────────────────────────────────────
function StatPill({ color, bg, label, icon }: { color: string; bg: string; label: string; icon: React.ReactNode }) {
  return (
    <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", bg, color)}>
      {icon}{label}
    </span>
  )
}

// ─── Station tab ─────────────────────────────────────────────────────────────
function StationTab({ label, count, active, onClick, color, activeBg, icon }: {
  label: string; count: number; active: boolean; onClick: () => void;
  color: string; activeBg: string; icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all",
        active
          ? cn(activeBg, color, "ring-1 ring-white/10")
          : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
      )}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          active ? "bg-white/20 text-white" : "bg-white/5 text-gray-500"
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Ticket Card ─────────────────────────────────────────────────────────────
interface TicketCardProps {
  ticket: Ticket
  now: number
  second: number   // passed to force re-render every tick
  isRecalled: boolean
  onStart: () => void
  onReady: () => void
  onRecall: () => void
  onSuspend: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TicketCard({ ticket: t, second: _second, isRecalled, onStart, onReady, onRecall, onSuspend }: TicketCardProps) {
  const elapsed   = Math.floor((Date.now() - t.sentAt.getTime()) / 1000)
  const slaPct    = Math.min(elapsed / t.slaSeconds, 1.5)
  const isOverdue = elapsed > t.slaSeconds && t.item.status !== "ready" && t.item.status !== "served"
  const isWarn    = slaPct >= 0.8 && !isOverdue && t.item.status !== "ready" && t.item.status !== "served"
  const isDone    = t.item.status === "ready" || t.item.status === "served"
  const isServed  = t.item.status === "served"
  const isCooking = t.item.status === "cooking"
  const isPending = t.item.status === "pending"

  const stationCfg = STATION_CFG[t.station]

  // Bar color — keep state colors (done/overdue/warn) but use station tone for normal
  const barColor = isDone ? "bg-emerald-500" : isOverdue ? "bg-red-500" : isWarn ? "bg-amber-400" : stationCfg.barColor
  const barWidth = isDone ? "100%" : `${Math.min(slaPct * 100, 100)}%`

  // Card background — done/overdue/warn keep their semantic colors, otherwise tint with station color
  const cardBg = isDone
    ? (isServed ? "bg-[#0d161f] border-sky-800/50" : "bg-[#0d1f14] border-emerald-800/50")
    : isOverdue
    ? "bg-[#1f0d0d] border-red-800/40"
    : isWarn
    ? "bg-[#1a180a] border-amber-800/40"
    : cn(stationCfg.cardBg, stationCfg.cardBorder)

  return (
    <div className={cn(
      "rounded-2xl border-2 border-l-4 p-0 flex flex-col overflow-hidden transition-all duration-300",
      stationCfg.color, cardBg,
      isDone && "opacity-60",
      isOverdue && "shadow-[0_0_20px_rgba(239,68,68,0.15)]"
    )}>
      {/* Card header */}
      <div className={cn("px-3 pt-3 pb-2", isDone && "opacity-60")}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-white text-lg leading-none">Bàn {t.tableLabel}</span>
            {t.tableSection && (
              <span className="text-[9px] bg-slate-700/60 border border-slate-600 text-slate-300 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                Khu {t.tableSection}
              </span>
            )}
            {t.isVIP && (
              <span className="inline-flex items-center gap-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                <Star className="w-2.5 h-2.5 fill-amber-400" />VIP
              </span>
            )}
            {isRecalled && (
              <span className="text-[9px] bg-blue-500/20 border border-blue-500/30 text-blue-400 px-1.5 py-0.5 rounded-md font-bold">
                RECALL
              </span>
            )}
          </div>
          {/* Timer — uses station color when cooking, keeps semantic colors for special states */}
          <div className={cn(
            "font-mono text-sm font-black tabular-nums",
            isServed ? "text-sky-400" : isDone ? "text-emerald-400" : isOverdue ? "text-red-400" : isWarn ? "text-amber-400" : isCooking ? stationCfg.textColor : "text-gray-400"
          )}>
            {formatElapsed(elapsed)}
          </div>
        </div>

        {/* Item name */}
        <p className="font-bold text-white text-sm leading-snug mb-1">
          {t.item.menuItem.name}
          {t.item.quantity > 1 && <span className="text-gray-500 text-xs ml-1.5 font-normal">×{t.item.quantity}</span>}
        </p>

        {/* Allergy note — highlighted red */}
        {t.item.allergyNotes && (
          <div className="flex items-start gap-1.5 bg-red-950/60 border border-red-700/50 rounded-lg p-2 mt-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 font-bold leading-snug">{t.item.allergyNotes}</p>
          </div>
        )}

        {/* Cook notes — always show if present */}
        {t.item.notes && (
          <p className="text-[10px] text-gray-500 italic mt-1">📝 {t.item.notes}</p>
        )}
      </div>

      {/* SLA bar */}
      <div className="h-1 bg-white/5 mx-3">
        <div
          className={cn("h-full rounded-full transition-all duration-1000", barColor, isOverdue && "animate-pulse")}
          style={{ width: barWidth }}
        />
      </div>
      <p className="text-[9px] text-gray-700 px-3 pt-1 pb-0.5 font-mono">
        SLA {t.item.menuItem.slaMinutes}m
        {isCooking && t.item.startedAt && (
          <> · nấu {Math.floor((Date.now()-t.item.startedAt.getTime())/60000)}p</>
        )}
      </p>

      {/* Status badge — cooking uses station color, done stays emerald (universal "complete" signal) */}
      <div className="px-3 pb-2">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-md font-bold",
          isPending  && "bg-gray-700/60 text-gray-400",
          isCooking  && cn("border", stationCfg.badgeBg, stationCfg.textColor),
          isDone && !isServed && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
          isServed && "bg-sky-500/20 text-sky-400 border border-sky-500/30",
        )}>
          {isPending ? "● Chờ" : isCooking ? "🔥 Đang nấu" : isServed ? "🍽 Đã phục vụ" : "✓ Sẵn sàng"}
        </span>
      </div>

      {/* Action buttons */}
      <div className="px-2 pb-2.5 space-y-1.5">
        {isPending && (
          <div className="flex gap-1.5">
            <button
              onClick={onStart}
              className={cn(
                "flex-1 py-2 text-white rounded-xl text-xs font-black transition-colors active:scale-95",
                stationCfg.btnBg
              )}
            >
              🔥 Bắt đầu
            </button>
            <button
              onClick={onSuspend}
              className="w-9 h-9 bg-white/5 hover:bg-white/10 text-gray-500 rounded-xl flex items-center justify-center transition-colors"
              title="Tạm ngưng"
            >
              <PauseCircle className="w-4 h-4" />
            </button>
          </div>
        )}
        {isCooking && (
          <div className="flex gap-1.5">
            <button
              onClick={onReady}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black transition-colors active:scale-95 flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />Sẵn sàng
            </button>
            <button
              onClick={onSuspend}
              className="w-9 h-9 bg-white/5 hover:bg-white/10 text-gray-500 rounded-xl flex items-center justify-center transition-colors"
            >
              <PauseCircle className="w-4 h-4" />
            </button>
          </div>
        )}
        {isDone && !isServed && (
          <button
            onClick={onRecall}
            className="w-full py-2 bg-white/5 hover:bg-white/8 text-gray-600 hover:text-gray-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3 h-3" />Hoàn tác
          </button>
        )}
      </div>
    </div>
  )
}
