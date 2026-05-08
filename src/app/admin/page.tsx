"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, LayoutDashboard, UtensilsCrossed, Package,
  BarChart3, Users, ClipboardList, AlertTriangle, TrendingUp,
  Edit2, Trash2, Plus, Download, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, Search, X, ChevronRight,
  ArrowUpRight, Minus, Phone, Loader2, LogOut, RefreshCw,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, CartesianGrid,
} from "recharts"
import {
  INGREDIENTS, STAFF, AUDIT_LOGS,
  REVENUE_BY_HOUR, TOP_DISHES,
} from "@/lib/mock-data"
import { formatCurrency, cn } from "@/lib/utils"
import type { MenuItem, IngredientItem, StaffMember } from "@/types"
import { MenuApi, AdminApi } from "@/lib/api"
import { menuItemFromApi } from "@/lib/adapters"
import { useAuthGuard } from "@/hooks/useAuthGuard"
import { clearToken } from "@/lib/auth"
import { ApiError } from "@/lib/api/client"
import type { CategoryApi } from "@/types/api"

type Tab = "overview" | "menu" | "inventory" | "reports" | "staff" | "audit"

const NAV: { id: Tab; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "overview",  label: "Tổng quan",  icon: LayoutDashboard },
  { id: "menu",      label: "Thực đơn",   icon: UtensilsCrossed },
  { id: "inventory", label: "Tồn kho",    icon: Package },
  { id: "reports",   label: "Báo cáo",    icon: BarChart3 },
  { id: "staff",     label: "Nhân sự",    icon: Users },
  { id: "audit",     label: "Audit Log",  icon: ClipboardList },
]

const ROLE_LABEL: Record<string, string> = {
  server: "Phục vụ", cashier: "Thu ngân", chef: "Bếp trưởng",
  host: "Tiếp tân", manager: "Quản lý", admin: "Admin",
}
const ACTION_LABEL: Record<string, string> = {
  cancel_item: "Hủy món", cancel_order: "Hủy đơn", refund: "Hoàn tiền",
  apply_discount: "Giảm giá", modify_price: "Sửa giá",
  login: "Đăng nhập", logout: "Đăng xuất",
}
const ACTION_CLS: Record<string, string> = {
  cancel_item:    "bg-red-50 text-red-600 border-red-200",
  cancel_order:   "bg-red-100 text-red-700 border-red-300",
  refund:         "bg-orange-50 text-orange-700 border-orange-200",
  apply_discount: "bg-blue-50 text-blue-700 border-blue-200",
  modify_price:   "bg-violet-50 text-violet-700 border-violet-200",
  login:          "bg-slate-100 text-slate-600 border-slate-200",
  logout:         "bg-slate-100 text-slate-500 border-slate-200",
}

// ─── Custom tooltip for recharts ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name || "Doanh thu"}:</span>
          <span className="font-bold text-slate-800">
            {typeof p.value === "number" && p.value > 1000 ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const ready  = useAuthGuard()

  const [tab, setTab] = useState<Tab>("overview")
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<CategoryApi[]>([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ingredients, setIngredients] = useState<IngredientItem[]>(INGREDIENTS)
  const [staff] = useState<StaffMember[]>(STAFF)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editItemCategoryId, setEditItemCategoryId] = useState<string>("")
  const [menuSearch, setMenuSearch] = useState("")
  const [auditAction, setAuditAction] = useState("")
  const [auditStaffId, setAuditStaffId] = useState("")
  const [staffModal, setStaffModal] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: "", phone: "", role: "server" as StaffMember["role"], shift: "Ca sáng" })

  // ── Load menu từ BE ──
  const loadMenu = useCallback(async () => {
    setMenuLoading(true)
    setMenuError(null)
    try {
      const [items, cats] = await Promise.all([
        MenuApi.listItems(),
        MenuApi.listCategories(),
      ])
      setMenuItems(items.map(menuItemFromApi))
      setCategories(cats)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearToken()
        router.replace("/login?redirect=/admin")
        return
      }
      setMenuError(err instanceof ApiError ? err.message : "Không tải được thực đơn.")
    } finally {
      setMenuLoading(false)
    }
  }, [router])

  useEffect(() => { if (ready) loadMenu() }, [ready, loadMenu])

  const logout = useCallback(() => {
    clearToken()
    router.replace("/login")
  }, [router])

  // Map tên category → id (để gửi POST/PUT lên BE).
  const categoryIdByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.name, c.id)
    return m
  }, [categories])

  // ── Toggle availability (BE chưa có endpoint riêng → dùng PUT /items/{id}) ──
  const toggleAvailable = useCallback(async (m: MenuItem) => {
    setBusy(true)
    const newVal = !m.available
    setMenuItems(prev => prev.map(i => i.id === m.id ? { ...i, available: newVal } : i))
    try {
      const catId = categoryIdByName.get(m.category)
      if (!catId) throw new Error("Không tìm thấy categoryId tương ứng")
      await MenuApi.updateItem(m.id, {
        name: m.name,
        description: m.description,
        price: m.price,
        categoryId: catId,
        preparationTime: m.estimatedMinutes,
        allergens: m.allergens,
        isAvailable: newVal,
      })
    } catch (err) {
      console.error(err)
      // rollback
      await loadMenu()
    } finally { setBusy(false) }
  }, [categoryIdByName, loadMenu])

  // ── Save edit ──
  const saveEdit = useCallback(async () => {
    if (!editItem) return
    setBusy(true)
    try {
      const catId = editItemCategoryId || categoryIdByName.get(editItem.category)
      if (!catId) throw new Error("Vui lòng chọn category")
      await MenuApi.updateItem(editItem.id, {
        name: editItem.name,
        description: editItem.description,
        price: editItem.price,
        categoryId: catId,
        preparationTime: editItem.estimatedMinutes,
        allergens: editItem.allergens,
        isAvailable: editItem.available,
      })
      setEditItem(null)
      setEditItemCategoryId("")
      await loadMenu()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : String(err))
    } finally { setBusy(false) }
  }, [editItem, editItemCategoryId, categoryIdByName, loadMenu])

  // ── Delete ──
  const deleteItem = useCallback(async (m: MenuItem) => {
    if (!confirm(`Xóa món "${m.name}"?`)) return
    setBusy(true)
    try {
      await MenuApi.deleteItem(m.id)
      await loadMenu()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : String(err))
    } finally { setBusy(false) }
  }, [loadMenu])

  // KPIs
  const totalRevenue = useMemo(() => REVENUE_BY_HOUR.reduce((s, h) => s + h.revenue, 0), [])
  const totalOrders  = useMemo(() => REVENUE_BY_HOUR.reduce((s, h) => s + h.orders, 0), [])
  const peakHour     = useMemo(() => REVENUE_BY_HOUR.reduce((a, b) => a.revenue > b.revenue ? a : b), [])
  const avgOrder     = useMemo(() => Math.round(totalRevenue / totalOrders), [totalRevenue, totalOrders])
  const lowStock     = useMemo(() => ingredients.filter(i => i.currentStock <= i.threshold), [ingredients])
  const flaggedStaff = useMemo(() => staff.filter(s => s.cancelCount >= 3), [staff])

  const filteredMenu = useMemo(
    () => menuItems.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase())),
    [menuItems, menuSearch]
  )
  const filteredLogs = useMemo(
    () => AUDIT_LOGS.filter(l =>
      (!auditAction || l.action === auditAction) &&
      (!auditStaffId || l.staffId === auditStaffId)
    ),
    [auditAction, auditStaffId]
  )

  if (!ready) return null

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-white border-r border-slate-100 flex flex-col shrink-0 shadow-sm">
        <div className="h-14 border-b border-slate-100 flex items-center px-4 gap-2.5">
          <Link href="/" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">Admin Panel</p>
            <p className="text-[10px] text-slate-400">RestoPOS v1.0</p>
          </div>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV.map(n => {
            const Icon = n.icon
            const alert = (n.id === "inventory" && lowStock.length > 0) ||
                          (n.id === "staff" && flaggedStaff.length > 0) ||
                          (n.id === "audit" && flaggedStaff.length > 0)
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  tab === n.id
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{n.label}</span>
                {alert && (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    tab === n.id ? "bg-white" : "bg-red-500"
                  )}/>
                )}
              </button>
            )
          })}
        </nav>
        <div className="px-4 py-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold">QH</div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-700">Quang Huy</p>
              <p className="text-[10px] text-slate-400">Manager · Ca chiều</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3 h-3" />Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto bg-slate-50">

        {/* Banner cho các tab chưa wire BE */}
        {tab !== "menu" && (
          <div className="px-6 pt-4">
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                Tab này (<b>{NAV.find(n => n.id === tab)?.label}</b>) đang dùng <b>dữ liệu mock</b>. BE
                {tab === "inventory" && " cần inventory-service (chưa code)."}
                {tab === "reports" && " cần reporting-service (chưa code)."}
                {tab === "audit" && " cần audit-log endpoint (admin-service đã có entity nhưng chưa expose)."}
                {tab === "staff" && " có /api/v1/admin/users nhưng schema khác (cần ROLE_ADMIN JWT)."}
                {tab === "overview" && " cần aggregate dashboard endpoint."}
              </div>
            </div>
          </div>
        )}

        {/* Banner lỗi tải menu */}
        {tab === "menu" && menuError && (
          <div className="px-6 pt-4">
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                Không tải được thực đơn từ <b>menu-service</b>: {menuError}
              </div>
              <button onClick={loadMenu} className="text-red-600 font-semibold hover:underline shrink-0">Thử lại</button>
            </div>
          </div>
        )}

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <div className="p-6 max-w-6xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-800">Tổng quan hôm nay</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {new Date().toLocaleDateString("vi-VN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
                </p>
              </div>
              <button className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-2 text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />Xuất báo cáo
              </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KPICard
                label="Doanh thu hôm nay" value={formatCurrency(totalRevenue)}
                sub={`${totalOrders} đơn hàng`} trend="+12%" color="violet"
                icon={<BarChart3 className="w-5 h-5"/>}
              />
              <KPICard
                label="Giờ cao điểm" value={peakHour.hour}
                sub={formatCurrency(peakHour.revenue)} color="orange"
                icon={<TrendingUp className="w-5 h-5"/>}
              />
              <KPICard
                label="Giá trị đơn TB" value={formatCurrency(avgOrder)}
                sub="+4% vs hôm qua" trend="+4%" color="blue"
                icon={<ArrowUpRight className="w-5 h-5"/>}
              />
              <KPICard
                label="Cảnh báo tồn kho" value={String(lowStock.length)}
                sub={lowStock.length > 0 ? `${lowStock.map(i=>i.name).slice(0,2).join(", ")}...` : "Tất cả OK"}
                color={lowStock.length > 0 ? "red" : "green"}
                icon={<Package className="w-5 h-5"/>}
              />
            </div>

            <div className="grid grid-cols-3 gap-5">
              {/* Revenue chart */}
              <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-800">Doanh thu theo giờ</h2>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Hôm nay</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={REVENUE_BY_HOUR} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barSize={22}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" radius={[5, 5, 0, 0]}>
                      {REVENUE_BY_HOUR.map((h, i) => (
                        <Cell key={i} fill={h.hour === peakHour.hour ? "#7c3aed" : "#ddd6fe"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top dishes */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-4">Top 5 món bán chạy</h2>
                <div className="space-y-3.5">
                  {TOP_DISHES.map((d, i) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                            i === 0 ? "bg-amber-400 text-white" :
                            i === 1 ? "bg-slate-300 text-slate-700" :
                            i === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-slate-500"
                          )}>
                            {i + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 leading-tight line-clamp-1">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">{d.sold} phần</span>
                      </div>
                      <div className="ml-7">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full transition-all"
                            style={{ width: `${(d.sold / TOP_DISHES[0].sold) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerts row */}
            {(lowStock.length > 0 || flaggedStaff.length > 0) && (
              <div className="mt-5 grid grid-cols-2 gap-4">
                {lowStock.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-red-500"/>
                    </div>
                    <div>
                      <p className="font-bold text-red-700 text-sm">{lowStock.length} nguyên liệu sắp hết</p>
                      <p className="text-xs text-red-500 mt-0.5">{lowStock.map(i=>i.name).join(" · ")}</p>
                      <button onClick={()=>setTab("inventory")} className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1 hover:underline">
                        Xem chi tiết <ChevronRight className="w-3 h-3"/>
                      </button>
                    </div>
                  </div>
                )}
                {flaggedStaff.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-600"/>
                    </div>
                    <div>
                      <p className="font-bold text-amber-700 text-sm">{flaggedStaff.length} nhân viên cần chú ý</p>
                      <p className="text-xs text-amber-600 mt-0.5">Hủy ≥ 3 lần trong ca: {flaggedStaff.map(s=>s.name).join(", ")}</p>
                      <button onClick={()=>setTab("staff")} className="text-xs text-amber-600 font-semibold mt-1.5 flex items-center gap-1 hover:underline">
                        Xem chi tiết <ChevronRight className="w-3 h-3"/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ MENU ═══ */}
        {tab === "menu" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold text-slate-800">Quản lý Thực đơn</h1>
              <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm">
                <Plus className="w-4 h-4" />Thêm món mới
              </button>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  placeholder="Tìm tên món..."
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-400 bg-white"
                />
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3">
                {filteredMenu.length} món
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Tên món & Dị ứng", "Danh mục", "Trạm bếp", "SLA", "Giá", "Trạng thái", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredMenu.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-4 py-3">
                        <p className={cn("font-semibold", m.available ? "text-slate-800" : "text-slate-400")}>{m.name}</p>
                        {m.allergens && m.allergens.length > 0 && (
                          <p className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />{m.allergens.join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium">{m.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-lg font-medium">{m.station}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.slaMinutes}p</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{formatCurrency(m.price)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={busy}
                          onClick={() => toggleAvailable(m)}
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-semibold transition-colors px-2 py-1 rounded-lg disabled:opacity-50",
                            m.available ? "text-emerald-600 hover:bg-emerald-50" : "text-red-500 hover:bg-red-50"
                          )}
                        >
                          {m.available ? <><ToggleRight className="w-4 h-4" />Còn hàng</> : <><ToggleLeft className="w-4 h-4" />Hết hàng</>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditItem(m); setEditItemCategoryId(categoryIdByName.get(m.category) ?? "") }}
                            className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItem(m)}
                            disabled={busy}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ INVENTORY ═══ */}
        {tab === "inventory" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold text-slate-800">Tồn kho & Cảnh báo</h1>
              <button className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />Xuất báo cáo
              </button>
            </div>

            {lowStock.length > 0 && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700">{lowStock.length} mặt hàng dưới ngưỡng an toàn</p>
                  <p className="text-sm text-red-600 mt-0.5">{lowStock.map(i => i.name).join(" · ")}</p>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {ingredients.map(item => {
                const pct = item.threshold > 0 ? item.currentStock / (item.threshold * 2) : 1
                const safePct = Math.min(pct, 1)
                const isCritical = item.currentStock === 0
                const isLow = !isCritical && item.currentStock <= item.threshold
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "bg-white rounded-2xl border p-4 transition-all",
                      isCritical ? "border-red-300 shadow-sm" :
                      isLow ? "border-amber-300" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                          isCritical ? "bg-red-100" : isLow ? "bg-amber-100" : "bg-emerald-100"
                        )}>
                          <Package className={cn("w-4 h-4", isCritical ? "text-red-500" : isLow ? "text-amber-600" : "text-emerald-600")} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Ngưỡng an toàn: {item.threshold} {item.unit}
                            {item.estimatedDepletionHours > 0 && (
                              <span className={cn("ml-2 font-semibold", item.estimatedDepletionHours < 2 ? "text-red-600" : "text-slate-600")}>
                                · Hết sau ~{item.estimatedDepletionHours}h
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={cn("font-bold text-lg leading-none", isCritical ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600")}>
                            {item.currentStock}
                          </p>
                          <p className="text-xs text-slate-400">{item.unit}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setIngredients(prev => prev.map(i =>
                              i.id === item.id ? { ...i, currentStock: +(i.currentStock + 1).toFixed(1), lastUpdated: new Date() } : i
                            ))}
                            className="w-7 h-7 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setIngredients(prev => prev.map(i =>
                              i.id === item.id ? { ...i, currentStock: Math.max(0, +(i.currentStock - 1).toFixed(1)), lastUpdated: new Date() } : i
                            ))}
                            className="w-7 h-7 bg-slate-100 hover:bg-red-100 hover:text-red-600 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {isCritical && (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-xl font-bold">HẾT</span>
                        )}
                        {isLow && !isCritical && (
                          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-xl font-semibold">SẮP HẾT</span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500",
                          isCritical ? "bg-red-500" : isLow ? "bg-amber-400" : "bg-emerald-400"
                        )}
                        style={{ width: `${safePct * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ REPORTS ═══ */}
        {tab === "reports" && (
          <div className="p-6 max-w-5xl">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold text-slate-800">Báo cáo & Phân tích</h1>
              <button className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />Xuất Excel
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <KPICard label="Doanh thu" value={formatCurrency(totalRevenue)} sub="+12% vs hôm qua" trend="+12%" color="violet" icon={<BarChart3 className="w-5 h-5"/>}/>
              <KPICard label="Số đơn hàng" value={String(totalOrders)} sub="+8% vs hôm qua" trend="+8%" color="blue" icon={<UtensilsCrossed className="w-5 h-5"/>}/>
              <KPICard label="Giá trị đơn TB" value={formatCurrency(avgOrder)} sub="+4% vs hôm qua" trend="+4%" color="orange" icon={<ArrowUpRight className="w-5 h-5"/>}/>
            </div>

            <div className="grid grid-cols-5 gap-5 mb-5">
              <div className="col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-800">Doanh thu & Số đơn theo giờ</h2>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={REVENUE_BY_HOUR} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="Doanh thu" radius={[4, 4, 0, 0]} fill="#7c3aed" opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-4">Top 5 món bán chạy</h2>
                <div className="space-y-4">
                  {TOP_DISHES.map((d, i) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center",
                            i===0?"bg-amber-400 text-white":i===1?"bg-slate-300 text-slate-600":i===2?"bg-orange-300 text-white":"bg-slate-100 text-slate-400"
                          )}>{i+1}</span>
                          <span className="font-semibold text-slate-700">{d.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800">{d.sold}</span>
                          <span className="text-slate-400 ml-0.5">phần</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(d.sold / TOP_DISHES[0].sold) * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 text-right">{formatCurrency(d.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STAFF ═══ */}
        {tab === "staff" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold text-slate-800">Nhân sự & Hiệu suất</h1>
              <button
                onClick={() => setStaffModal(true)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />Thêm tài khoản
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Nhân viên", "Vai trò", "Ca làm", "Đơn phục vụ", "Hủy đơn/ca", "Tuân thủ SLA", "Trạng thái"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {staff.map(s => {
                    const flagged = s.cancelCount >= 3
                    return (
                      <tr key={s.id} className={cn("transition-colors", flagged ? "bg-red-50 hover:bg-red-100/50" : "hover:bg-slate-50/70")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                              flagged ? "bg-red-200 text-red-700" : "bg-violet-100 text-violet-700"
                            )}>
                              {s.name.split(" ").pop()?.charAt(0) ?? "?"}
                            </div>
                            <div>
                              <p className={cn("font-semibold", flagged ? "text-red-700" : "text-slate-800")}>{s.name}</p>
                              {flagged && (
                                <p className="text-[10px] text-red-500 flex items-center gap-0.5 mt-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />Hủy quá {s.cancelCount} lần
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium">
                            {ROLE_LABEL[s.role] ?? s.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.shift}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{s.ordersServed}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "font-bold text-base",
                            s.cancelCount >= 3 ? "text-red-600" : s.cancelCount >= 1 ? "text-amber-600" : "text-emerald-600"
                          )}>
                            {s.cancelCount}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">lần</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                              <div
                                className={cn("h-full rounded-full", s.avgSlaCompliancePct >= 90 ? "bg-emerald-400" : s.avgSlaCompliancePct >= 75 ? "bg-amber-400" : "bg-red-400")}
                                style={{ width: `${s.avgSlaCompliancePct}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-bold",
                              s.avgSlaCompliancePct >= 90 ? "text-emerald-600" : s.avgSlaCompliancePct >= 75 ? "text-amber-600" : "text-red-600"
                            )}>
                              {s.avgSlaCompliancePct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-xs px-2.5 py-1 rounded-xl font-semibold",
                            s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {s.active ? "● Đang làm" : "○ Nghỉ"}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ AUDIT LOG ═══ */}
        {tab === "audit" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-bold text-slate-800">Audit Log</h1>
                <p className="text-sm text-slate-500 mt-0.5">Theo dõi toàn bộ thao tác nhạy cảm</p>
              </div>
              <button className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                <Download className="w-4 h-4" />Xuất log
              </button>
            </div>
            <div className="flex gap-3 mb-4">
              <select
                value={auditAction}
                onChange={e => setAuditAction(e.target.value)}
                className="border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
              >
                <option value="">Tất cả hành động</option>
                {Object.entries(ACTION_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select
                value={auditStaffId}
                onChange={e => setAuditStaffId(e.target.value)}
                className="border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
              >
                <option value="">Tất cả nhân viên</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-center">
                {filteredLogs.length} bản ghi
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Thời gian", "Nhân viên", "Hành động", "Chi tiết", "Bàn"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.map(l => {
                    const staffCancelCount = AUDIT_LOGS.filter(x =>
                      x.staffId === l.staffId && (x.action === "cancel_item" || x.action === "cancel_order")
                    ).length
                    const flagStaff = staffCancelCount >= 3
                    return (
                      <tr key={l.id} className={cn("transition-colors", flagStaff && (l.action==="cancel_item"||l.action==="cancel_order") ? "bg-red-50 hover:bg-red-100/60" : "hover:bg-slate-50/70")}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-mono font-semibold text-slate-700">
                            {l.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{l.timestamp.toLocaleDateString("vi-VN")}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                              flagStaff ? "bg-red-200 text-red-700" : "bg-slate-200 text-slate-600"
                            )}>
                              {l.staffName.split(" ").pop()?.charAt(0) ?? "?"}
                            </div>
                            <span className={cn("font-semibold text-xs", flagStaff ? "text-red-700" : "text-slate-800")}>
                              {l.staffName}
                              {flagStaff && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-lg font-bold border", ACTION_CLS[l.action] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                            {ACTION_LABEL[l.action] ?? l.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs max-w-xs">{l.detail}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-mono font-bold">
                          {l.tableNumber ? `B${l.tableNumber}` : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ═══ ADD STAFF MODAL ═══ */}
      {staffModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-violet-600" />
                </div>
                <h3 className="font-bold text-slate-800">Thêm tài khoản nhân viên</h3>
              </div>
              <button onClick={() => setStaffModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Họ tên *</label>
                <input
                  value={newStaff.name}
                  onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                  className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block flex items-center gap-1">
                  <Phone className="w-3 h-3" />Số điện thoại *
                </label>
                <input
                  value={newStaff.phone}
                  onChange={e => setNewStaff(p => ({ ...p, phone: e.target.value }))}
                  placeholder="0901 234 567"
                  className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Vai trò</label>
                  <select
                    value={newStaff.role}
                    onChange={e => setNewStaff(p => ({ ...p, role: e.target.value as StaffMember["role"] }))}
                    className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                  >
                    {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Ca làm</label>
                  <select
                    value={newStaff.shift}
                    onChange={e => setNewStaff(p => ({ ...p, shift: e.target.value }))}
                    className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                  >
                    {["Ca sáng", "Ca chiều", "Ca tối", "Ca đêm"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setStaffModal(false); setNewStaff({ name: "", phone: "", role: "server", shift: "Ca sáng" }) }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
              >Hủy</button>
              <button
                disabled={!newStaff.name || !newStaff.phone}
                onClick={() => {
                  // In a real app, would persist to DB. Here just close.
                  setStaffModal(false)
                  setNewStaff({ name: "", phone: "", role: "server", shift: "Ca sáng" })
                }}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors"
              >Tạo tài khoản</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MENU MODAL ═══ */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 text-lg">Chỉnh sửa món</h3>
              <button onClick={() => setEditItem(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Tên món</label>
                <input
                  value={editItem.name}
                  onChange={e => setEditItem({ ...editItem, name: e.target.value })}
                  className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Mô tả</label>
                <input
                  value={editItem.description ?? ""}
                  onChange={e => setEditItem({ ...editItem, description: e.target.value })}
                  className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Giá (VNĐ)</label>
                  <input
                    type="number"
                    value={editItem.price}
                    onChange={e => setEditItem({ ...editItem, price: Number(e.target.value) })}
                    className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">SLA (phút)</label>
                  <input
                    type="number"
                    value={editItem.slaMinutes}
                    onChange={e => setEditItem({ ...editItem, slaMinutes: Number(e.target.value) })}
                    className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Danh mục</label>
                  <select
                    value={editItemCategoryId || (categoryIdByName.get(editItem.category) ?? "")}
                    onChange={e => {
                      const id = e.target.value
                      setEditItemCategoryId(id)
                      const c = categories.find(cat => cat.id === id)
                      if (c) setEditItem({ ...editItem, category: c.name })
                    }}
                    className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">— chọn danh mục —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Trạm bếp</label>
                  <select
                    value={editItem.station}
                    onChange={e => setEditItem({ ...editItem, station: e.target.value as any })}
                    className="w-full border border-slate-200 focus:border-violet-400 rounded-xl px-3 py-2.5 text-sm outline-none"
                    title="Trạm bếp suy ra từ tên/category — chỉ hiển thị trên FE, không lưu xuống BE"
                  >
                    {["Nướng", "Chiên", "Tráng miệng", "Bar", "Lạnh"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setEditItem({ ...editItem, available: !editItem.available })}
                  className={cn("w-10 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer",
                    editItem.available ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <div className={cn("w-5 h-5 bg-white rounded-full shadow transition-transform", editItem.available ? "translate-x-4" : "translate-x-0")}/>
                </div>
                <span className="text-sm font-medium text-slate-700">Còn hàng</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setEditItem(null); setEditItemCategoryId("") }} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Hủy</button>
              <button
                disabled={busy}
                onClick={saveEdit}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPI_COLORS: Record<string, { bg: string; text: string; icon: string; trend: string; glow: string }> = {
  violet: { bg: "bg-gradient-to-br from-violet-600 to-violet-800", text: "text-white", icon: "bg-white/20 text-white", trend: "text-violet-200", glow: "shadow-violet-900/40" },
  blue:   { bg: "bg-gradient-to-br from-blue-500 to-blue-700",     text: "text-white", icon: "bg-white/20 text-white", trend: "text-blue-200",   glow: "shadow-blue-900/40"   },
  orange: { bg: "bg-gradient-to-br from-orange-400 to-orange-600", text: "text-white", icon: "bg-white/20 text-white", trend: "text-orange-200", glow: "shadow-orange-900/40" },
  red:    { bg: "bg-gradient-to-br from-red-500 to-red-700",       text: "text-white", icon: "bg-white/20 text-white", trend: "text-red-200",    glow: "shadow-red-900/40"    },
  green:  { bg: "bg-gradient-to-br from-emerald-500 to-emerald-700", text: "text-white", icon: "bg-white/20 text-white", trend: "text-emerald-200", glow: "shadow-emerald-900/40" },
}
function KPICard({ label, value, sub, trend, color, icon }: {
  label: string; value: string; sub: string; trend?: string; color: string; icon: React.ReactNode
}) {
  const cfg = KPI_COLORS[color] ?? KPI_COLORS.violet
  return (
    <div className={cn("rounded-2xl p-4 shadow-lg", cfg.bg, cfg.glow)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-white/70">{label}</p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", cfg.icon)}>{icon}</div>
      </div>
      <p className={cn("text-2xl font-black leading-none mb-1", cfg.text)}>{value}</p>
      <div className="flex items-center gap-1.5">
        {trend && (
          <span className={cn("text-xs font-bold flex items-center gap-0.5", cfg.trend)}>
            <TrendingUp className="w-3 h-3" />{trend}
          </span>
        )}
        <span className="text-xs text-white/50">{sub}</span>
      </div>
    </div>
  )
}
