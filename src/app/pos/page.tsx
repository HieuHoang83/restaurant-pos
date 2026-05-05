"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  UtensilsCrossed, ChevronLeft, ChevronDown, ChevronRight, Plus, Minus, Trash2,
  CreditCard, SplitSquareHorizontal, Tag, Star, AlertCircle,
  CheckCircle2, Clock, X, Printer, Receipt, ChefHat,
  Bell, Flame,
} from "lucide-react"
import { TABLES, MENU_ITEMS, ORDERS } from "@/lib/mock-data"
import { formatCurrency, minutesSince, cn } from "@/lib/utils"
import type { Table, MenuItem, OrderItem, Order, TableStatus } from "@/types"

// ─── Constants ──────────────────────────────────────────────────────────────
const VAT    = 0.08
const SVC    = 0.05
const VOUCHERS: Record<string, number | ((sub: number) => number)> = {
  HAPPY20: (sub) => Math.round(sub * 0.2),
  SAVE50K: () => 50000,
  VIP100K: () => 100000,
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function calcBill(items: OrderItem[], discountAmt: number) {
  const subtotal = items.reduce((s, i) => s + i.menuItem.price * i.quantity, 0)
  const vat      = Math.round(subtotal * VAT)
  const service  = Math.round(subtotal * SVC)
  const total    = Math.max(0, subtotal + vat + service - discountAmt)
  return { subtotal, vat, service, total }
}

const STATUS_CFG: Record<TableStatus, { bg: string; ring: string; text: string; dot: string; label: string }> = {
  empty:           { bg: "bg-emerald-50",  ring: "border-emerald-200 hover:border-emerald-400", text: "text-emerald-700", dot: "bg-emerald-500", label: "Trống"    },
  occupied:        { bg: "bg-sky-50",      ring: "border-sky-200 hover:border-sky-400",         text: "text-sky-700",    dot: "bg-sky-500",    label: "Có khách" },
  reserved:        { bg: "bg-amber-50",    ring: "border-amber-200 hover:border-amber-400",     text: "text-amber-700",  dot: "bg-amber-500",  label: "Đặt trước"},
  "needs-cleaning":{ bg: "bg-red-50",      ring: "border-red-200 hover:border-red-400",         text: "text-red-600",    dot: "bg-red-500",    label: "Cần dọn"  },
  waiting:         { bg: "bg-violet-50",   ring: "border-violet-200 hover:border-violet-400",   text: "text-violet-700", dot: "bg-violet-500", label: "Chờ dọn"  },
}

const ITEM_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ gửi",    cls: "bg-slate-100 text-slate-500"      },
  cooking: { label: "Đang nấu",   cls: "bg-amber-100 text-amber-700"      },
  ready:   { label: "Sẵn sàng",   cls: "bg-emerald-100 text-emerald-700"  },
  served:  { label: "Đã phục vụ", cls: "bg-sky-100 text-sky-700"          },
  cancelled:{ label: "Đã hủy",   cls: "bg-red-100 text-red-500"           },
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function POSPage() {
  const [tables, setTables]       = useState(TABLES)
  const [orders, setOrders]       = useState<Order[]>(ORDERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [draftItems, setDraftItems] = useState<OrderItem[]>([])
  const [menuCat, setMenuCat]     = useState("Tất cả")
  const [menuSearch, setMenuSearch] = useState("")

  // Payment state
  const [showPay, setShowPay]     = useState(false)
  const [voucherInput, setVoucherInput] = useState("")
  const [appliedVoucher, setAppliedVoucher] = useState("")
  const [splitBy, setSplitBy]     = useState(0)
  const [tip, setTip]             = useState(0)
  const [payMethod, setPayMethod] = useState<"cash"|"card"|"e-wallet">("cash")
  const [rating, setRating]       = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedback, setFeedback]   = useState("")

  // Note modal
  const [noteTarget, setNoteTarget] = useState<OrderItem | null>(null)
  const [noteText, setNoteText]   = useState("")
  const [allergyText, setAllergyText] = useState("")

  // Toast
  const [toast, setToast]         = useState<{ msg: string; type: "success"|"info" } | null>(null)
  // Live clock
  const [clockStr, setClockStr]   = useState(() => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))
  useEffect(() => {
    const t = setInterval(() => setClockStr(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })), 10000)
    return () => clearInterval(t)
  }, [])

  const showToast = useCallback((msg: string, type: "success"|"info" = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  const selectedTable = useMemo(() => tables.find(t => t.id === selectedId) ?? null, [tables, selectedId])
  const currentOrder  = useMemo(
    () => orders.find(o => o.tableId === selectedId && o.status !== "paid") ?? null,
    [orders, selectedId]
  )
  const sentItems  = currentOrder?.items ?? []
  const allItems   = useMemo(() => [...sentItems, ...draftItems], [sentItems, draftItems])

  const categories = useMemo(
    () => ["Tất cả", ...Array.from(new Set(MENU_ITEMS.map(m => m.category)))],
    []
  )
  const filteredMenu = useMemo(
    () => MENU_ITEMS.filter(m => {
      const catOk = menuCat === "Tất cả" || m.category === menuCat
      const searchOk = menuSearch === "" || m.name.toLowerCase().includes(menuSearch.toLowerCase())
      return catOk && searchOk
    }),
    [menuCat, menuSearch]
  )

  const discountAmt = useMemo(() => {
    if (!appliedVoucher) return 0
    const fn = VOUCHERS[appliedVoucher]
    if (!fn) return 0
    const sub = allItems.reduce((s, i) => s + i.menuItem.price * i.quantity, 0)
    return typeof fn === "function" ? fn(sub) : 0
  }, [appliedVoucher, allItems])

  const bill = useMemo(() => calcBill(allItems, discountAmt), [allItems, discountAmt])

  // ── Table selection ──
  const selectTable = useCallback((t: Table) => {
    setSelectedId(t.id)
    setDraftItems([])
    setAppliedVoucher("")
    setVoucherInput("")
    setTip(0)
    setSplitBy(0)
    setShowPay(false)
    setRating(0)
    setHoverRating(0)
    setFeedback("")
  }, [])

  // ── Menu → Draft ──
  const addItem = useCallback((menuItem: MenuItem) => {
    if (!menuItem.available) return
    setDraftItems(prev => {
      const ex = prev.find(i => i.menuItemId === menuItem.id)
      if (ex) return prev.map(i => i.id === ex.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        id: `d-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        menuItemId: menuItem.id, menuItem,
        quantity: 1, status: "pending",
      }]
    })
  }, [])

  const changeDraftQty = useCallback((id: string, delta: number) => {
    setDraftItems(prev =>
      prev.flatMap(i => {
        if (i.id !== id) return [i]
        const q = i.quantity + delta
        return q <= 0 ? [] : [{ ...i, quantity: q }]
      })
    )
  }, [])

  const removeDraftItem = useCallback((id: string) => {
    setDraftItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const markServed = useCallback((orderId: string, itemId: string) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, items: o.items.map(i => i.id === itemId ? { ...i, status: "served" as const } : i) }
        : o
    ))
    showToast("Đã đánh dấu phục vụ ✓")
  }, [showToast])

  const cancelSentItem = useCallback((orderId: string, itemId: string) => {
    if (!confirm("Hủy món này? Bếp sẽ không nấu nữa.")) return
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, items: o.items.map(i => i.id === itemId ? { ...i, status: "cancelled" as const } : i) }
        : o
    ))
    showToast("Đã hủy món ✕", "info")
  }, [showToast])

  // ── Send to kitchen ──
  const sendToKitchen = useCallback(() => {
    if (draftItems.length === 0) return
    setOrders(prev => {
      const existing = prev.find(o => o.tableId === selectedId && o.status !== "paid")
      if (existing) {
        return prev.map(o => o.id === existing.id
          ? { ...o, items: [...o.items, ...draftItems.map(i=>({...i,status:"pending" as const}))], status: "sent" as const, sentAt: new Date() }
          : o
        )
      }
      const table = tables.find(t => t.id === selectedId)!
      return [...prev, {
        id: `o-${Date.now()}`, tableId: selectedId!, tableNumber: table.number,
        items: draftItems, status: "sent" as const, createdAt: new Date(), sentAt: new Date(),
        isVIP: table.isVIP ?? false, serverName: "Nhân viên",
        discountAmount: 0, tipAmount: 0,
      }]
    })
    setTables(prev => prev.map(t =>
      t.id === selectedId ? { ...t, status: "occupied" as const, occupiedSince: t.occupiedSince ?? new Date() } : t
    ))
    const count = draftItems.reduce((s, i) => s + i.quantity, 0)
    setDraftItems([])
    showToast(`Đã gửi ${count} món xuống bếp 🍳`, "info")
  }, [draftItems, selectedId, tables, showToast])

  // ── Apply voucher ──
  const applyVoucher = useCallback(() => {
    const code = voucherInput.trim().toUpperCase()
    if (VOUCHERS[code]) {
      setAppliedVoucher(code)
      showToast(`Áp mã ${code} thành công!`)
    } else {
      showToast("Mã không hợp lệ ✕", "info")
    }
  }, [voucherInput, showToast])

  // ── Payment ──
  const processPayment = useCallback(() => {
    setOrders(prev => prev.map(o =>
      o.tableId === selectedId && o.status !== "paid"
        ? { ...o, status: "paid" as const, discountAmount: discountAmt, tipAmount: tip, paymentMethod: payMethod }
        : o
    ))
    setTables(prev => prev.map(t =>
      t.id === selectedId ? { ...t, status: "needs-cleaning" as const, currentOrderId: undefined, occupiedSince: undefined } : t
    ))
    setShowPay(false)
    const ratingMsg = rating > 0 ? ` · ${rating}★` : ""
    showToast(`Thanh toán thành công ${formatCurrency(bill.total + tip)}${ratingMsg} 🎉`)
    setTimeout(() => { setSelectedId(null); setDraftItems([]); setRating(0); setHoverRating(0); setFeedback("") }, 1500)
  }, [selectedId, discountAmt, tip, payMethod, bill.total, rating, showToast])

  // Stats for header
  const occupiedCount  = tables.filter(t => t.status === "occupied").length
  const emptyCount     = tables.filter(t => t.status === "empty").length
  const newItemCount   = draftItems.reduce((s, i) => s + i.quantity, 0)
  const readyItems     = sentItems.filter(i => i.status === "ready")

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* ── Top bar ── */}
      <header className="h-13 bg-slate-900 text-white flex items-center px-4 gap-3 shrink-0 shadow-sm" style={{height:"52px"}}>
        <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="w-px h-5 bg-slate-700"/>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <UtensilsCrossed className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">POS · Thu ngân & Phục vụ</span>
        </div>

        <div className="ml-auto flex items-center gap-5 text-xs">
          {readyItems.length > 0 && (
            <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full animate-pulse">
              <Bell className="w-3 h-3" />
              {readyItems.length} món sẵn sàng phục vụ
            </span>
          )}
          <div className="flex items-center gap-3 text-slate-400">
            {(["empty","occupied","reserved","needs-cleaning"] as TableStatus[]).map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_CFG[s].dot}`}/>
                {STATUS_CFG[s].label}
              </span>
            ))}
          </div>
          <div className="text-slate-500 text-xs border-l border-slate-700 pl-4 font-mono">
            {clockStr}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ═══ LEFT: Table map ═══ */}
        <aside className="w-[336px] bg-white border-r border-slate-100 flex flex-col shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sơ đồ bàn</span>
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-600 font-semibold">{emptyCount} trống</span>
              <span className="text-slate-300">·</span>
              <span className="text-sky-600 font-semibold">{occupiedCount} có khách</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50">
            {["A", "B", "C"].map(sec => {
              const sectionTables = tables.filter(t => t.section === sec)
              const isCollapsed = collapsedSections.has(sec)
              const sectionEmpty = sectionTables.filter(t => t.status === "empty").length
              const sectionOccupied = sectionTables.filter(t => t.status === "occupied").length
              return (
                <div key={sec}>
                  <button
                    onClick={() => setCollapsedSections(prev => {
                      const next = new Set(prev)
                      if (next.has(sec)) next.delete(sec); else next.add(sec)
                      return next
                    })}
                    className="w-full flex items-center justify-between mb-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <span className="flex items-center gap-1.5">
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />}
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Khu {sec} · Tầng {sec === "C" ? "2" : "1"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-emerald-600 font-semibold">{sectionEmpty}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-sky-600 font-semibold">{sectionOccupied}</span>
                      <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold ml-1">
                        {sectionTables.length}
                      </span>
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-3 gap-2">
                      {sectionTables.map(t => {
                        const cfg = STATUS_CFG[t.status]
                        const isSelected = t.id === selectedId
                        const minutes = t.occupiedSince ? minutesSince(t.occupiedSince) : 0
                        const overtime = minutes > 90
                        const orderInfo = orders.find(o => o.tableId === t.id && o.status !== "paid")
                        const pendingReady = orderInfo?.items.filter(i => i.status === "ready").length ?? 0
                        return (
                          <button
                            key={t.id}
                            onClick={() => selectTable(t)}
                            className={cn(
                              "relative rounded-xl border-2 p-2.5 text-left transition-all duration-150 active:scale-95",
                              cfg.bg, cfg.ring, cfg.text,
                              isSelected && "ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-md",
                              overtime && !isSelected && "ring-2 ring-amber-400"
                            )}
                          >
                            {t.isVIP && (
                              <Star className="w-3 h-3 absolute top-2 right-2 fill-amber-400 text-amber-400" />
                            )}
                            {pendingReady > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                                {pendingReady}
                              </span>
                            )}
                            <div className="font-bold text-[17px] leading-tight">B{t.number}</div>
                            <div className="text-[12px] opacity-60 mt-0.5">{t.capacity} chỗ</div>
                            {t.status === "occupied" && minutes > 0 && (
                              <div className={cn("text-[12px] font-semibold mt-0.5", overtime ? "text-amber-600" : "opacity-70")}>
                                {overtime ? "⚠ " : ""}{minutes}p
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ═══ MIDDLE: Menu ═══ */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Category + search bar */}
          <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 shrink-0 shadow-sm">
            <div className="flex gap-1.5 overflow-x-auto flex-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setMenuCat(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                    menuCat === cat
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder="Tìm món..."
              className="w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 bg-white shrink-0"
            />
          </div>

          {/* No table selected */}
          {!selectedId && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <UtensilsCrossed className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">Chọn bàn để bắt đầu đặt món</p>
              <p className="text-xs opacity-60">{emptyCount} bàn đang trống</p>
            </div>
          )}

          {/* Menu grid */}
          {selectedId && (
            <div className="flex-1 overflow-y-auto p-3">
              {filteredMenu.length === 0 && (
                <p className="text-center text-slate-400 text-sm mt-8">Không tìm thấy món</p>
              )}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                {filteredMenu.map(item => {
                  const draftQ = draftItems.find(i => i.menuItemId === item.id)?.quantity ?? 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      disabled={!item.available}
                      className={cn(
                        "group bg-white rounded-xl border text-left p-3 transition-all duration-150 relative",
                        item.available
                          ? "border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 active:scale-[0.98] cursor-pointer"
                          : "opacity-40 cursor-not-allowed border-slate-100 bg-slate-50"
                      )}
                    >
                      {draftQ > 0 && (
                        <span className="absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {draftQ}
                        </span>
                      )}
                      <div className="pr-6">
                        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{item.name}</p>
                      </div>
                      {item.description && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{item.description}</p>
                      )}
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <AlertCircle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          <span className="text-[9px] text-amber-600 font-medium line-clamp-1">{item.allergens.join(" · ")}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-blue-700 font-bold text-sm">{formatCurrency(item.price)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{item.station}</span>
                          {!item.available && <span className="text-[9px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-md">Hết</span>}
                        </div>
                      </div>
                      {item.available && (
                        <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors pointer-events-none">
                          <Plus className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Order panel ═══ */}
        <aside className="w-[390px] bg-white flex flex-col shrink-0 border-l border-slate-100">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-base">
              <div className="text-center">
                <Receipt className="w-12 h-12 mx-auto mb-2.5 opacity-30" />
                <p>Chưa chọn bàn</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold", STATUS_CFG[selectedTable?.status ?? "empty"].bg, STATUS_CFG[selectedTable?.status ?? "empty"].text)}>
                      {selectedTable?.number}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-base leading-none">Bàn {selectedTable?.number}</p>
                      <p className="text-xs text-slate-400 mt-1">{selectedTable?.capacity} chỗ · {STATUS_CFG[selectedTable?.status ?? "empty"].label}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {splitBy === 0 ? (
                      <button
                        onClick={() => setSplitBy(2)}
                        title="Chia hóa đơn"
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <SplitSquareHorizontal className="w-5 h-5" />
                      </button>
                    ) : (
                      <span className="text-sm bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-medium">{splitBy} người</span>
                    )}
                    <button onClick={() => setSelectedId(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {/* Sent items */}
                {sentItems.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                      <ChefHat className="w-3.5 h-3.5" />Đã gửi bếp
                    </p>
                    <div className="space-y-1.5">
                      {sentItems.filter(i => i.status !== "cancelled").map(item => {
                        const cfg = ITEM_STATUS_CFG[item.status]
                        return (
                          <div key={item.id}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2.5 group",
                              item.status === "ready" ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-semibold truncate", item.status === "ready" ? "text-emerald-800" : "text-slate-700")}>
                                {item.quantity > 1 && <span className="mr-1 text-slate-500">×{item.quantity}</span>}
                                {item.menuItem.name}
                              </p>
                              {item.allergyNotes && (
                                <p className="text-[11px] text-red-500 flex items-center gap-0.5 mt-0.5">
                                  <AlertCircle className="w-2.5 h-2.5" />{item.allergyNotes}
                                </p>
                              )}
                              {item.notes && <p className="text-[11px] text-slate-400 mt-0.5 italic">{item.notes}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn("text-[11px] px-2 py-0.5 rounded font-semibold", cfg.cls)}>
                                {cfg.label}
                              </span>
                              {item.status === "pending" && currentOrder && (
                                <button
                                  onClick={() => cancelSentItem(currentOrder.id, item.id)}
                                  className="w-6 h-6 bg-red-100 hover:bg-red-500 hover:text-white text-red-500 rounded-full flex items-center justify-center transition-colors"
                                  title="Hủy món"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {item.status === "ready" && currentOrder && (
                                <button
                                  onClick={() => markServed(currentOrder.id, item.id)}
                                  className="w-6 h-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center transition-colors"
                                  title="Đánh dấu đã phục vụ"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Draft items */}
                {draftItems.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />Món mới · chưa gửi
                    </p>
                    <div className="space-y-1.5">
                      {draftItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-blue-900 truncate">{item.menuItem.name}</p>
                            {item.allergyNotes && <p className="text-[11px] text-red-500">{item.allergyNotes}</p>}
                            {item.notes && <p className="text-[11px] text-blue-500 italic">{item.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => changeDraftQty(item.id, -1)}
                              className="w-6 h-6 rounded-md bg-blue-200 hover:bg-blue-300 text-blue-800 flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold text-blue-800">{item.quantity}</span>
                            <button
                              onClick={() => changeDraftQty(item.id, +1)}
                              className="w-6 h-6 rounded-md bg-blue-200 hover:bg-blue-300 text-blue-800 flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => { setNoteTarget(item); setNoteText(item.notes ?? ""); setAllergyText(item.allergyNotes ?? "") }}
                            className="text-[11px] text-blue-500 hover:text-blue-700 px-1 font-medium shrink-0"
                          >
                            Ghi chú
                          </button>
                          <button onClick={() => removeDraftItem(item.id)} className="text-red-400 hover:text-red-600 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {allItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-36 text-slate-300">
                    <UtensilsCrossed className="w-10 h-10 mb-2.5 opacity-40" />
                    <p className="text-sm">Chưa có món — chọn từ menu</p>
                  </div>
                )}
              </div>

              {/* Voucher */}
              <div className="px-4 py-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    value={voucherInput}
                    onChange={e => setVoucherInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyVoucher()}
                    placeholder="Mã khuyến mãi"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-slate-50"
                  />
                  <button
                    onClick={applyVoucher}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5" />Áp
                  </button>
                </div>
                {appliedVoucher && (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />Mã {appliedVoucher} — -{formatCurrency(discountAmt)}
                    </p>
                    <button onClick={() => setAppliedVoucher("")} className="text-xs text-slate-400 hover:text-red-500">✕ Bỏ</button>
                  </div>
                )}
              </div>

              {/* Bill summary */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-sm space-y-1.5">
                <div className="flex justify-between text-slate-500"><span>Tạm tính</span><span>{formatCurrency(bill.subtotal)}</span></div>
                <div className="flex justify-between text-slate-500"><span>VAT 8%</span><span>{formatCurrency(bill.vat)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Phí dịch vụ 5%</span><span>{formatCurrency(bill.service)}</span></div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium"><span>Giảm giá</span><span>-{formatCurrency(discountAmt)}</span></div>
                )}
                {splitBy > 0 && (
                  <div className="flex justify-between text-blue-600 font-medium">
                    <span>Mỗi người ({splitBy})</span>
                    <span>{formatCurrency(Math.ceil(bill.total / splitBy))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 text-base pt-2 border-t border-slate-200 mt-1.5">
                  <span>Tổng cộng</span>
                  <span className="text-blue-700">{formatCurrency(bill.total)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 space-y-2.5">
                {draftItems.length > 0 && (
                  <button
                    onClick={sendToKitchen}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 text-base font-bold flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-[0.98]"
                  >
                    <Flame className="w-5 h-5" />
                    Gửi bếp ({newItemCount} món)
                  </button>
                )}
                <button
                  onClick={() => setShowPay(true)}
                  disabled={allItems.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-xl py-3 text-base font-bold flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-[0.98]"
                >
                  <Receipt className="w-5 h-5" />
                  Thanh toán {allItems.length > 0 ? formatCurrency(bill.total) : ""}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ═══ NOTE MODAL ═══ */}
      {noteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">Ghi chú món</h3>
              <button onClick={() => setNoteTarget(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-3 font-medium">{noteTarget.menuItem.name}</p>

            {noteTarget.menuItem.allergens && noteTarget.menuItem.allergens.length > 0 && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-700">⚠ Dị ứng tiềm ẩn</p>
                  <p className="text-xs text-amber-600 mt-0.5">{noteTarget.menuItem.allergens.join(", ")}</p>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-red-500 mb-1 block flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />Ghi chú dị ứng (bếp sẽ thấy màu đỏ)
                </label>
                <input
                  value={allergyText}
                  onChange={e => setAllergyText(e.target.value)}
                  placeholder="dị ứng đậu phộng, không hải sản..."
                  className="w-full border border-red-200 focus:border-red-400 rounded-lg px-3 py-2 text-sm outline-none bg-red-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Ghi chú nấu</label>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="ít muối, không hành, chín kỹ..."
                  className="w-full border border-slate-200 focus:border-blue-400 rounded-lg px-3 py-2 text-sm outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setNoteTarget(null)} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
              <button
                onClick={() => {
                  setDraftItems(prev => prev.map(i =>
                    i.id === noteTarget.id ? { ...i, notes: noteText, allergyNotes: allergyText } : i
                  ))
                  setNoteTarget(null)
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAYMENT MODAL ═══ */}
      {showPay && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Hóa đơn Bàn {selectedTable?.number}</h3>
                  <p className="text-xs text-slate-400">{allItems.reduce((s,i)=>s+i.quantity,0)} món · {selectedTable?.capacity} chỗ</p>
                </div>
              </div>
              <button onClick={() => setShowPay(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {/* Split */}
              {splitBy > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                    <SplitSquareHorizontal className="w-3.5 h-3.5" />Chia hóa đơn
                  </p>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setSplitBy(n)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                          splitBy === n ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
                        )}
                      >
                        {n} người<br />
                        <span className="font-bold">{formatCurrency(Math.ceil(bill.total / n))}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bill */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="space-y-1.5 text-sm">
                  {allItems.filter(i=>i.status!=="cancelled").map(i => (
                    <div key={i.id} className="flex justify-between text-slate-600 text-xs">
                      <span>{i.menuItem.name} ×{i.quantity}</span>
                      <span>{formatCurrency(i.menuItem.price * i.quantity)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-slate-500 text-xs"><span>Tạm tính</span><span>{formatCurrency(bill.subtotal)}</span></div>
                    <div className="flex justify-between text-slate-500 text-xs"><span>VAT 8%</span><span>{formatCurrency(bill.vat)}</span></div>
                    <div className="flex justify-between text-slate-500 text-xs"><span>Phí dịch vụ 5%</span><span>{formatCurrency(bill.service)}</span></div>
                    {discountAmt > 0 && (
                      <div className="flex justify-between text-emerald-600 text-xs font-medium">
                        <span>Giảm ({appliedVoucher})</span><span>-{formatCurrency(discountAmt)}</span>
                      </div>
                    )}
                    {tip > 0 && (
                      <div className="flex justify-between text-amber-600 text-xs font-medium">
                        <span>Tiền tip</span><span>+{formatCurrency(tip)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-300 pt-2 mt-2">
                    <span>TỔNG CỘNG</span>
                    <span className="text-blue-700">{formatCurrency(bill.total + tip)}</span>
                  </div>
                </div>
              </div>

              {/* Tip */}
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-600 mb-2 block">Tiền tip</label>
                <div className="flex gap-2">
                  {[0, 20000, 50000, 100000, 200000].map(t => (
                    <button
                      key={t}
                      onClick={() => setTip(t)}
                      className={cn(
                        "flex-1 py-2 rounded-xl border text-xs font-semibold transition-all",
                        tip === t ? "bg-amber-500 border-amber-500 text-white shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {t === 0 ? "Không" : `+${t/1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment method */}
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-600 mb-2 block">Phương thức thanh toán</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "card", "e-wallet"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPayMethod(m)}
                      className={cn(
                        "py-3 rounded-xl border font-semibold text-sm transition-all",
                        payMethod === m ? "bg-blue-600 border-blue-600 text-white shadow-md" : "border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                      )}
                    >
                      {m === "cash" ? "💵 Tiền mặt" : m === "card" ? "💳 Thẻ" : "📱 Ví điện tử"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div className="mb-3">
                <label className="text-xs font-bold text-slate-600 mb-2 block">Đánh giá phục vụ</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => {
                    const filled = (hoverRating || rating) >= n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n === rating ? 0 : n)}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110 active:scale-95"
                        title={`${n} sao`}
                      >
                        <Star
                          className={cn(
                            "w-7 h-7 transition-colors",
                            filled ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"
                          )}
                        />
                      </button>
                    )
                  })}
                  {(hoverRating || rating) > 0 && (
                    <span className="ml-2 text-sm font-medium text-slate-600">
                      {((hoverRating || rating) === 5) ? "Tuyệt vời" :
                       ((hoverRating || rating) === 4) ? "Hài lòng" :
                       ((hoverRating || rating) === 3) ? "Bình thường" :
                       ((hoverRating || rating) === 2) ? "Chưa tốt" : "Kém"}
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback */}
              <div className="mb-5">
                <label className="text-xs font-bold text-slate-600 mb-2 block">
                  Phản hồi <span className="font-normal text-slate-400">(không bắt buộc)</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={2}
                  placeholder="Lời nhắn cho nhà hàng — món ăn, dịch vụ, không gian..."
                  className="w-full border border-slate-200 focus:border-blue-400 rounded-xl px-3 py-2 text-sm outline-none resize-none bg-white"
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />In hóa đơn
                </button>
                <button
                  onClick={processPayment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors active:scale-[0.99]"
                >
                  <CreditCard className="w-4 h-4" />
                  Xác nhận · {formatCurrency(bill.total + tip)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all",
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-slate-800 text-white"
        )}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
