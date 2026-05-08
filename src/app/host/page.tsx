"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, ConciergeBell, Plus, X, Clock, Phone,
  MessageSquare, Users, Calendar, Bell, AlertCircle,
  CheckCircle2, UserPlus, Timer, Star, MapPin,
  ChevronRight, Send, Loader2, LogOut, RefreshCw,
} from "lucide-react"
import { minutesSince, formatTime, formatPhone, cn } from "@/lib/utils"
import type { Table, Reservation, WaitlistEntry, TableStatus } from "@/types"
import { TablesApi, ReservationsApi, WaitlistApi } from "@/lib/api"
import {
  tableFromApi, reservationFromApi, waitlistFromApi, tableStatusToApi,
} from "@/lib/adapters"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import { useRealtime, SSE_URLS } from "@/hooks/useRealtime"
import { clearToken } from "@/lib/auth"
import { ApiError } from "@/lib/api/client"

// ─── Types ────────────────────────────────────────────────────────────────────
type Panel = "map" | "reservations" | "waitlist"

// ─── Config ───────────────────────────────────────────────────────────────────
const TABLE_CFG: Record<TableStatus, {
  bg: string; border: string; text: string; dot: string
  dotRing: string; label: string; labelColor: string
}> = {
  empty:           { bg: "bg-emerald-50",  border: "border-emerald-200",  text: "text-emerald-700", dot: "bg-emerald-500",  dotRing: "ring-emerald-200",  label: "Trống",    labelColor: "bg-emerald-100 text-emerald-700"  },
  occupied:        { bg: "bg-sky-50",      border: "border-sky-200",      text: "text-sky-700",     dot: "bg-sky-500",      dotRing: "ring-sky-200",      label: "Có khách", labelColor: "bg-sky-100 text-sky-700"          },
  reserved:        { bg: "bg-amber-50",    border: "border-amber-200",    text: "text-amber-700",   dot: "bg-amber-500",    dotRing: "ring-amber-200",    label: "Đặt trước",labelColor: "bg-amber-100 text-amber-700"      },
  "needs-cleaning":{ bg: "bg-red-50",      border: "border-red-200",      text: "text-red-600",     dot: "bg-red-500",      dotRing: "ring-red-200",      label: "Cần dọn",  labelColor: "bg-red-100 text-red-600"          },
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function HostPage() {
  const router = useRouter()
  const ready  = useAuthGuard()

  const [tables, setTables]             = useState<Table[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [waitlist, setWaitlist]         = useState<WaitlistEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [loadError, setLoadError]       = useState<string | null>(null)
  const [busy, setBusy]                 = useState(false)
  const [panel, setPanel]               = useState<Panel>("map")
  const [selectedId, setSelectedId]     = useState<string | null>(null)

  // Modals
  const [seatModal, setSeatModal]       = useState<{ tableId: string } | null>(null)
  const [seatSize, setSeatSize]         = useState(2)
  const [seatVIP, setSeatVIP]           = useState(false)
  const [showAddRes, setShowAddRes]     = useState(false)
  const [showAddWait, setShowAddWait]   = useState(false)
  const [editRes, setEditRes]           = useState<Reservation | null>(null)

  // New reservation form
  const [resForm, setResForm] = useState({ guestName: "", phone: "", partySize: 2, time: "19:00", notes: "" })
  // New waitlist form
  const [waitForm, setWaitForm] = useState({ guestName: "", phone: "", partySize: 2 })

  // ── Load all from BE ──
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      const [t, r, w] = await Promise.all([
        TablesApi.list(),
        ReservationsApi.list(),
        WaitlistApi.list(),
      ])
      setTables(t.map(tableFromApi))
      setReservations(r.map(reservationFromApi))
      setWaitlist(w.map(waitlistFromApi))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken()
        router.replace("/login?redirect=/host")
        return
      }
      setLoadError(err instanceof ApiError ? err.message : "Không kết nối được tới máy chủ.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { if (ready) loadAll() }, [ready, loadAll])

  // Realtime: SSE từ table-service (tables/reservations/waitlist) — refetch khi có event.
  useRealtime(ready ? [SSE_URLS.TABLES] : [], () => loadAll(true))

  const logout = useCallback(() => {
    clearToken()
    router.replace("/login")
  }, [router])

  // ── Derived ──
  const selectedTable = useMemo(() => tables.find(t => t.id === selectedId) ?? null, [tables, selectedId])
  const emptyTables   = useMemo(() => tables.filter(t => t.status === "empty"), [tables])
  const occupiedTables = useMemo(() => tables.filter(t => t.status === "occupied"), [tables])
  const reservedTables = useMemo(() => tables.filter(t => t.status === "reserved"), [tables])
  const overdueOccupied = useMemo(
    () => occupiedTables.filter(t => t.occupiedSince && minutesSince(t.occupiedSince) > 90),
    [occupiedTables]
  )
  const confirmedRes = useMemo(() => reservations.filter(r => r.status === "confirmed"), [reservations])
  const unnotified   = useMemo(() => waitlist.filter(w => !w.notified && emptyTables.some(t => t.capacity >= w.partySize)), [waitlist, emptyTables])

  // ── Actions ── (gọi BE)
  const seatGuest = useCallback(async () => {
    if (!seatModal) return
    setBusy(true)
    try {
      // BE: gọi seat endpoint với source=WALK_IN.
      await TablesApi.seat({ tableId: seatModal.tableId, source: "WALK_IN" })
      setSeatModal(null)
      setSeatVIP(false)
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi xếp khách")
    } finally { setBusy(false) }
  }, [seatModal, loadAll])

  const addReservation = useCallback(async () => {
    if (!resForm.guestName || !resForm.phone) return
    setBusy(true)
    try {
      const [h, m] = resForm.time.split(":").map(Number)
      const dt = new Date(); dt.setHours(h, m, 0, 0)
      // BE yêu cầu future date — nếu giờ chọn đã qua trong hôm nay, đẩy sang ngày mai.
      if (dt.getTime() <= Date.now()) dt.setDate(dt.getDate() + 1)
      // ISO không có timezone (BE format yyyy-MM-dd'T'HH:mm:ss).
      const pad = (n: number) => String(n).padStart(2, "0")
      const isoLocal = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`
      await ReservationsApi.create({
        customerName: resForm.guestName,
        customerPhone: resForm.phone,
        partySize: resForm.partySize,
        reservationTime: isoLocal,
        notes: resForm.notes || undefined,
      })
      setShowAddRes(false)
      setResForm({ guestName: "", phone: "", partySize: 2, time: "19:00", notes: "" })
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi tạo đặt bàn")
    } finally { setBusy(false) }
  }, [resForm, loadAll])

  const addWaitlistEntry = useCallback(async () => {
    if (!waitForm.guestName || !waitForm.phone) return
    setBusy(true)
    try {
      await WaitlistApi.add({
        customerName: waitForm.guestName,
        customerPhone: waitForm.phone,
        partySize: waitForm.partySize,
      })
      setShowAddWait(false)
      setWaitForm({ guestName: "", phone: "", partySize: 2 })
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi thêm hàng đợi")
    } finally { setBusy(false) }
  }, [waitForm, loadAll])

  const notifyGuest = useCallback(async (id: string) => {
    setBusy(true)
    try {
      await WaitlistApi.notify(id)
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi thông báo")
    } finally { setBusy(false) }
  }, [loadAll])

  const autoAssignTable = useCallback(async (waitId: string, partySize: number) => {
    setBusy(true)
    try {
      // Tìm bàn trống đủ chỗ.
      const avail = await TablesApi.available(partySize)
      if (avail.length === 0) {
        alert("Không có bàn trống đủ chỗ.")
        return
      }
      const tbl = avail[0]
      // Seat trực tiếp từ waitlist — BE sẽ cập nhật trạng thái bàn + waitlist.
      await WaitlistApi.seat(waitId, tbl.id)
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi xếp bàn tự động")
    } finally { setBusy(false) }
  }, [loadAll])

  const checkInReservation = useCallback(async (id: string) => {
    const res = reservations.find(r => r.id === id)
    if (!res) return
    if (!res.tableId) {
      alert("Đặt bàn này chưa được gán bàn cụ thể. Vui lòng confirm trước.")
      return
    }
    setBusy(true)
    try {
      await TablesApi.seat({
        tableId: res.tableId,
        source: "RESERVATION",
        sourceId: id,
      })
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi check-in")
    } finally { setBusy(false) }
  }, [reservations, loadAll])

  // Khách rời bàn → BE: OCCUPIED → CLEANING.
  const markGuestLeft = useCallback(async (tableId: string) => {
    setBusy(true)
    try {
      await TablesApi.updateStatus(tableId, { status: tableStatusToApi("needs-cleaning") })
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi cập nhật bàn")
    } finally { setBusy(false) }
  }, [loadAll])

  // Dọn xong → BE: CLEANING → AVAILABLE.
  const markCleaned = useCallback(async (tableId: string) => {
    setBusy(true)
    try {
      await TablesApi.updateStatus(tableId, { status: tableStatusToApi("empty") })
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi cập nhật bàn")
    } finally { setBusy(false) }
  }, [loadAll])

  // Bàn RESERVED nhưng không có reservation gắn → walk-in seat.
  const seatWalkInOnReserved = useCallback(async (tableId: string) => {
    setBusy(true)
    try {
      await TablesApi.seat({ tableId, source: "WALK_IN" })
      await loadAll(true)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Lỗi xếp khách")
    } finally { setBusy(false) }
  }, [loadAll])

  if (!ready) return null

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Đang tải dữ liệu...</span>
      </div>
    )
  }

  if (loadError && tables.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-semibold text-slate-700">Không tải được dữ liệu</p>
        <p className="text-xs text-slate-500 max-w-md">{loadError}</p>
        <p className="text-xs text-slate-400">Kiểm tra table-service đã chạy chưa.</p>
        <button onClick={() => loadAll()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 mt-2">
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ── Header ── */}
      <header className="h-13 bg-emerald-800 text-white flex items-center px-5 gap-3 shrink-0 shadow-sm" style={{ height: "52px" }}>
        <Link href="/" className="flex items-center gap-1.5 text-emerald-300 hover:text-white transition-colors text-sm">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="w-px h-5 bg-emerald-700" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <ConciergeBell className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm">Host · Tiếp tân</span>
        </div>

        {/* Notification badges */}
        <div className="ml-auto flex items-center gap-2">
          {unnotified.length > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-semibold animate-pulse">
              <Bell className="w-3 h-3" />{unnotified.length} khách chờ chưa thông báo
            </span>
          )}
          {overdueOccupied.length > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">
              <Clock className="w-3 h-3" />{overdueOccupied.length} bàn quá giờ
            </span>
          )}
          <div className="flex items-center gap-3 text-xs text-emerald-300 border-l border-emerald-700 pl-3 ml-1">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{emptyTables.length} trống</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />{occupiedTables.length} có khách</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{confirmedRes.length} đặt trước</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />{waitlist.length} chờ</span>
          </div>
          <div className="text-xs text-emerald-500 font-mono border-l border-emerald-700 pl-3">
            {new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing || busy}
            title="Tải lại"
            className="text-emerald-300 hover:text-white disabled:opacity-30 transition-colors p-1.5"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={logout}
            title="Đăng xuất"
            className="text-emerald-300 hover:text-white transition-colors p-1.5"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ═══ LEFT: Floor plan ═══ */}
        <div className="flex-1 bg-slate-50 border-r border-slate-200 flex flex-col min-w-0">
          {/* Legend bar */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-5 text-xs shrink-0 bg-white shadow-sm">
            {Object.entries(TABLE_CFG).map(([status, cfg]) => (
              <span key={status} className="flex items-center gap-1.5 text-slate-500">
                <span className={cn("w-2.5 h-2.5 rounded-sm", cfg.dot)} />
                {cfg.label}
              </span>
            ))}
          </div>

          {/* Overdue warning */}
          {overdueOccupied.length > 0 && (
            <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 shrink-0">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                <strong>{overdueOccupied.map(t => `Bàn ${t.number}`).join(", ")}</strong>
                {" "}ngồi quá 90 phút
              </p>
            </div>
          )}

          {/* Floor plan */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {["A", "B", "C"].map(sec => (
              <div key={sec}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Khu {sec}</h2>
                  <span className="text-[10px] text-slate-300">Tầng {sec === "C" ? 2 : 1}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[10px] text-slate-400">
                    {tables.filter(t => t.section === sec && t.status === "empty").length}/{tables.filter(t => t.section === sec).length} trống
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2.5">
                  {tables.filter(t => t.section === sec).map(t => {
                    const cfg = TABLE_CFG[t.status]
                    const isSelected = t.id === selectedId
                    const res = reservations.find(r => r.tableId === t.id && r.status === "confirmed")
                    const minutes = t.occupiedSince ? minutesSince(t.occupiedSince) : 0
                    const overtime = minutes > 90
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedId(t.id === selectedId ? null : t.id); setPanel("map") }}
                        className={cn(
                          "relative rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-95 group",
                          cfg.bg, cfg.border, cfg.text,
                          isSelected && "ring-2 ring-offset-2 ring-emerald-500 shadow-lg scale-105",
                          overtime && !isSelected && "ring-2 ring-amber-400",
                          "hover:shadow-sm hover:scale-[1.02]"
                        )}
                      >
                        {t.isVIP && (
                          <Star className="w-3 h-3 absolute top-2 right-2 fill-amber-400 text-amber-400" />
                        )}
                        <div className="font-black text-base leading-none mb-1">B{t.number}</div>
                        <div className="text-[10px] opacity-60">{t.capacity} người</div>
                        {t.status === "occupied" && minutes > 0 && (
                          <div className={cn("text-[10px] font-bold mt-1", overtime ? "text-amber-600" : "opacity-70")}>
                            {overtime ? "⚠ " : "⏱ "}{minutes}p
                          </div>
                        )}
                        {t.status === "reserved" && res && (
                          <div className="text-[9px] opacity-70 mt-1 truncate leading-tight">
                            {res.guestName}
                          </div>
                        )}
                        {t.status === "needs-cleaning" && (
                          <div className="text-[10px] font-semibold mt-1">Cần dọn</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ RIGHT: Control panel ═══ */}
        <aside className="w-80 flex flex-col bg-white shrink-0">
          {/* Tab nav */}
          <div className="bg-white border-b border-slate-100 grid grid-cols-3 shadow-sm">
            {([
              { id: "map" as Panel,          label: "Bàn",                     icon: MapPin   },
              { id: "reservations" as Panel, label: `Đặt trước ${confirmedRes.length > 0 ? `(${confirmedRes.length})` : ""}`, icon: Calendar },
              { id: "waitlist" as Panel,     label: `Chờ ${waitlist.length > 0 ? `(${waitlist.length})` : ""}`,              icon: Clock    },
            ] as { id: Panel; label: string; icon: React.ElementType }[]).map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setPanel(tab.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold border-b-2 transition-all",
                    panel === tab.id
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="leading-tight text-center px-1">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ── Map detail ── */}
            {panel === "map" && (
              <div className="p-3">
                {/* Selected table detail */}
                {selectedTable ? (
                  <div className="mb-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black", TABLE_CFG[selectedTable.status].bg, TABLE_CFG[selectedTable.status].text)}>
                            {selectedTable.number}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">Bàn {selectedTable.number}</p>
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold", TABLE_CFG[selectedTable.status].labelColor)}>
                              {TABLE_CFG[selectedTable.status].label}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-slate-50 rounded-lg p-2">
                          <p className="text-slate-400">Sức chứa</p>
                          <p className="font-bold text-slate-700 mt-0.5">{selectedTable.capacity} người</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <p className="text-slate-400">Vị trí</p>
                          <p className="font-bold text-slate-700 mt-0.5">Khu {selectedTable.section} · T{selectedTable.floor}</p>
                        </div>
                        {selectedTable.occupiedSince && (
                          <div className={cn("rounded-lg p-2", minutesSince(selectedTable.occupiedSince) > 90 ? "bg-amber-50" : "bg-slate-50")}>
                            <p className="text-slate-400">Thời gian ngồi</p>
                            <p className={cn("font-bold mt-0.5", minutesSince(selectedTable.occupiedSince) > 90 ? "text-amber-600" : "text-slate-700")}>
                              {minutesSince(selectedTable.occupiedSince)} phút
                            </p>
                          </div>
                        )}
                        {selectedTable.isVIP && (
                          <div className="bg-amber-50 rounded-lg p-2">
                            <p className="text-amber-600 font-bold flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400" />Bàn VIP</p>
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="space-y-2">
                        {selectedTable.status === "empty" && (
                          <button
                            onClick={() => setSeatModal({ tableId: selectedTable.id })}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />Xếp chỗ cho khách
                          </button>
                        )}
                        {selectedTable.status === "occupied" && (
                          <button
                            onClick={() => markGuestLeft(selectedTable.id)}
                            disabled={busy}
                            className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                          >
                            Khách đã rời bàn →
                          </button>
                        )}
                        {selectedTable.status === "needs-cleaning" && (
                          <button
                            onClick={() => markCleaned(selectedTable.id)}
                            disabled={busy}
                            className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />Đã dọn xong
                          </button>
                        )}
                        {selectedTable.status === "reserved" && (() => {
                          const linkedRes = reservations.find(r => r.tableId === selectedTable.id && r.status === "confirmed")
                          return (
                            <button
                              onClick={() => {
                                if (linkedRes) {
                                  checkInReservation(linkedRes.id)
                                } else {
                                  seatWalkInOnReserved(selectedTable.id)
                                }
                              }}
                              disabled={busy}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {linkedRes ? `Check-in · ${linkedRes.guestName}` : "Xác nhận khách đến"}
                            </button>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-8">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Chọn bàn để xem thao tác</p>
                  </div>
                )}

                {/* Empty tables list */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                    {emptyTables.length} bàn đang trống
                  </p>
                  {emptyTables.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 bg-white rounded-xl border border-slate-100">
                      Không còn bàn trống
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {emptyTables.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedId(t.id)}
                          className="w-full flex items-center justify-between bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-xl px-3 py-2.5 transition-all group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-black flex items-center justify-center">{t.number}</span>
                            <span className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700">Bàn {t.number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{t.capacity} chỗ · Khu {t.section}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Reservations ── */}
            {panel === "reservations" && (
              <div className="p-3">
                <button
                  onClick={() => setShowAddRes(true)}
                  className="w-full mb-3 py-2.5 border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />Tạo đặt bàn mới
                </button>

                <div className="space-y-2.5">
                  {reservations.map(r => {
                    const tbl = tables.find(t => t.id === r.tableId)
                    const isCancelled = r.status === "cancelled" || r.status === "no-show"
                    return (
                      <div key={r.id} className={cn(
                        "bg-white rounded-2xl border p-3.5 transition-all",
                        isCancelled ? "opacity-50 border-slate-100" : "border-slate-200 shadow-sm"
                      )}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{r.guestName}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />{formatPhone(r.phone)}
                            </p>
                          </div>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-lg font-bold border shrink-0",
                            r.status === "confirmed"  ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            r.status === "arrived"    ? "bg-sky-50 text-sky-700 border-sky-200" :
                            r.status === "cancelled"  ? "bg-slate-100 text-slate-500 border-slate-200" :
                            "bg-red-50 text-red-600 border-red-200"
                          )}>
                            {{confirmed:"✓ Xác nhận", arrived:"● Đã đến", cancelled:"✕ Đã hủy", "no-show":"✕ Không đến"}[r.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2.5 text-xs text-slate-500 mb-2.5">
                          <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg">
                            <Clock className="w-3 h-3" />{formatTime(r.dateTime)}
                          </span>
                          <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg">
                            <Users className="w-3 h-3" />{r.partySize} người
                          </span>
                          {tbl && (
                            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-semibold">
                              Bàn {tbl.number}
                            </span>
                          )}
                        </div>
                        {r.notes && (
                          <p className="text-xs text-slate-400 italic bg-slate-50 px-2.5 py-1.5 rounded-lg mb-2.5">"{r.notes}"</p>
                        )}
                        {!r.confirmationSent && r.status === "confirmed" && (
                          <p className="text-[10px] text-amber-600 flex items-center gap-1 mb-2">
                            <AlertCircle className="w-3 h-3" />Chưa gửi xác nhận SMS
                          </p>
                        )}
                        {!isCancelled && (
                          <div className="flex gap-1.5">
                            {!r.confirmationSent && (
                              <button
                                onClick={() => setReservations(prev => prev.map(x => x.id === r.id ? { ...x, confirmationSent: true } : x))}
                                className="flex-1 py-1.5 bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                              >
                                <Send className="w-3 h-3" />Gửi SMS
                              </button>
                            )}
                            {r.status === "confirmed" && (
                              <button
                                onClick={() => checkInReservation(r.id)}
                                className="flex-1 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />Check-in
                              </button>
                            )}
                            <button
                              onClick={() => setReservations(prev => prev.map(x => x.id === r.id ? { ...x, status: "cancelled" as const } : x))}
                              className="px-2 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 rounded-xl text-xs transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Waitlist ── */}
            {panel === "waitlist" && (
              <div className="p-3">
                <button
                  onClick={() => setShowAddWait(true)}
                  className="w-full mb-3 py-2.5 border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />Thêm vào hàng chờ
                </button>

                {waitlist.length === 0 ? (
                  <div className="text-center text-slate-400 py-10">
                    <Timer className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Hàng chờ trống</p>
                    <p className="text-xs mt-1 opacity-60">Không có khách chờ bàn</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {waitlist.map((w, i) => {
                      const waited = minutesSince(w.addedAt)
                      const assignedTable = tables.find(t => t.id === w.tableId)
                      const canAssign = emptyTables.some(t => t.capacity >= w.partySize)
                      return (
                        <div key={w.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                                {i + 1}
                              </span>
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{w.guestName}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />{formatPhone(w.phone)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn(
                                "text-sm font-black",
                                w.estimatedWaitMinutes <= 5 ? "text-emerald-600" :
                                w.estimatedWaitMinutes <= 15 ? "text-amber-600" : "text-slate-600"
                              )}>
                                ~{w.estimatedWaitMinutes}p
                              </p>
                              <p className="text-[9px] text-slate-400">ETA</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-2.5">
                            <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg">
                              <Users className="w-3 h-3" />{w.partySize} người
                            </span>
                            <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg">
                              <Clock className="w-3 h-3" />Đợi {waited}p
                            </span>
                            {assignedTable && (
                              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-semibold">
                                → Bàn {assignedTable.number}
                              </span>
                            )}
                          </div>

                          {w.notified && w.notifiedAt && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg mb-2.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã gửi SMS lúc {formatTime(w.notifiedAt)}
                            </div>
                          )}

                          <div className="flex gap-1.5">
                            {canAssign && !assignedTable && (
                              <button
                                onClick={() => autoAssignTable(w.id, w.partySize)}
                                className="flex-1 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                              >
                                <Bell className="w-3 h-3" />Gán bàn + SMS
                              </button>
                            )}
                            {!canAssign && !w.notified && (
                              <button
                                onClick={() => notifyGuest(w.id)}
                                className="flex-1 py-1.5 bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />Gửi SMS cập nhật
                              </button>
                            )}
                            <button
                              onClick={() => setWaitlist(prev => prev.filter(x => x.id !== w.id))}
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-500 rounded-xl text-xs transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ═══ SEAT MODAL ═══ */}
      {seatModal && (() => {
        const t = tables.find(x => x.id === seatModal.tableId)
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Xếp chỗ khách</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Bàn {t?.number} · {t?.capacity} chỗ · Khu {t?.section}</p>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-600 mb-2 block">Số người trong nhóm</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(n => {
                    const cap = t?.capacity ?? 10
                    return (
                      <button
                        key={n}
                        disabled={n > cap}
                        onClick={() => setSeatSize(n)}
                        className={cn(
                          "w-10 h-10 rounded-xl border text-sm font-bold transition-all",
                          seatSize === n ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" :
                          n > cap ? "opacity-20 cursor-not-allowed border-slate-100 text-slate-200 bg-slate-50" :
                          "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                        )}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label
                className="flex items-center gap-3 mb-5 cursor-pointer group"
                onClick={() => setSeatVIP(v => !v)}
              >
                <div className={cn(
                  "w-10 h-6 rounded-full transition-colors flex items-center px-0.5",
                  seatVIP ? "bg-amber-400" : "bg-slate-200"
                )}>
                  <div className={cn("w-5 h-5 bg-white rounded-full shadow-sm transition-transform", seatVIP ? "translate-x-4" : "translate-x-0")} />
                </div>
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Star className={cn("w-4 h-4", seatVIP ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                  Khách VIP
                </span>
              </label>
              <div className="flex gap-2.5">
                <button
                  onClick={() => { setSeatModal(null); setSeatVIP(false) }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={seatGuest}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                  Xác nhận xếp chỗ
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══ ADD RESERVATION MODAL ═══ */}
      {showAddRes && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800">Tạo đặt bàn mới</h3>
              </div>
              <button onClick={() => setShowAddRes(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Tên khách *</label>
                <input value={resForm.guestName} onChange={e => setResForm(p => ({ ...p, guestName: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                  className="w-full border border-slate-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">SĐT *</label>
                  <input value={resForm.phone} onChange={e => setResForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0901 234 567"
                    className="w-full border border-slate-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1.5 block">Giờ đến</label>
                  <input type="time" value={resForm.time} onChange={e => setResForm(p => ({ ...p, time: e.target.value }))}
                    className="w-full border border-slate-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Số người</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                    <button key={n} onClick={() => setResForm(p => ({ ...p, partySize: n }))}
                      className={cn("w-9 h-9 rounded-xl border text-sm font-bold transition-all",
                        resForm.partySize === n ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                      )}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Ghi chú</label>
                <input value={resForm.notes} onChange={e => setResForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Sinh nhật, cắm hoa, màn hình chiếu..."
                  className="w-full border border-slate-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAddRes(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Hủy</button>
              <button
                onClick={addReservation}
                disabled={!resForm.guestName || !resForm.phone}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Tạo đặt bàn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD WAITLIST MODAL ═══ */}
      {showAddWait && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800">Thêm vào hàng chờ</h3>
              </div>
              <button onClick={() => setShowAddWait(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Tên khách *</label>
                <input value={waitForm.guestName} onChange={e => setWaitForm(p => ({ ...p, guestName: e.target.value }))}
                  placeholder="Tên khách"
                  className="w-full border border-slate-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Số điện thoại *</label>
                <input value={waitForm.phone} onChange={e => setWaitForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="0901 234 567"
                  className="w-full border border-slate-200 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">Số người</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 8].map(n => (
                    <button key={n} onClick={() => setWaitForm(p => ({ ...p, partySize: n }))}
                      className={cn("w-10 h-10 rounded-xl border text-sm font-bold transition-all",
                        waitForm.partySize === n ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                      )}>{n}</button>
                  ))}
                </div>
              </div>
              <div className={cn(
                "p-3 rounded-xl border text-xs",
                emptyTables.filter(t => t.capacity >= waitForm.partySize).length > 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              )}>
                {emptyTables.filter(t => t.capacity >= waitForm.partySize).length > 0
                  ? `✓ Có bàn trống phù hợp — ETA ~5 phút`
                  : `⏱ Không có bàn trống — ETA ~${15 + waitlist.length * 8} phút`}
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAddWait(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Hủy</button>
              <button
                onClick={addWaitlistEntry}
                disabled={!waitForm.guestName || !waitForm.phone}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Thêm vào danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
