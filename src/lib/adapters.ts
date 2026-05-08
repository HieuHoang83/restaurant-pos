// ============================================================================
// Adapters — chuyển đổi giữa BE DTO (types/api.ts) và UI types (types/index.ts).
//
// Mục tiêu: giữ nguyên tối đa code UI cũ. Khi page nhận data từ API, ép qua
// `fromXxx()` trước. Khi gửi đi, ép qua `toXxx()`.
//
// Lưu ý field BE chưa có → giá trị mặc định (vd: section, floor, isVIP, sla...).
// ============================================================================

import type {
  CategoryApi,
  KitchenTicketDto,
  KitchenTicketItemDto,
  MenuItemApi,
  OrderItemResponseDTO,
  OrderItemStatusApi,
  OrderResponseDTO,
  OrderStatusApi,
  PaymentMethodApi,
  ReservationApi,
  ReservationStatusApi,
  RestaurantTableApi,
  StationTypeApi,
  TableStatusApi,
  TicketItemStatusApi,
  TicketStatusApi,
  WaitlistEntryApi,
  WaitlistStatusApi,
} from "@/types/api"
import type {
  MenuItem,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  PaymentMethod,
  Reservation,
  ReservationStatus,
  Station,
  Table,
  TableStatus,
  WaitlistEntry,
} from "@/types"

// ─── Date helpers ──────────────────────────────────────────────────────────
function toDate(s?: string): Date | undefined {
  if (!s) return undefined
  // BE trả ISO local "yyyy-MM-ddTHH:mm:ss" → Date sẽ parse như local timezone.
  // Với Z hoặc offset thì Date xử lý chuẩn.
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

// ─── Station ───────────────────────────────────────────────────────────────
const STATION_API_TO_UI: Record<StationTypeApi, Station> = {
  GRILL:   "Nướng",
  FRYER:   "Chiên",
  DESSERT: "Tráng miệng",
  DRINK:   "Bar",
  GENERAL: "Lạnh",
}
const STATION_UI_TO_API: Record<Station, StationTypeApi> = {
  "Nướng":       "GRILL",
  "Chiên":       "FRYER",
  "Tráng miệng": "DESSERT",
  "Bar":         "DRINK",
  "Lạnh":        "GENERAL",
}
export const stationFromApi = (s: StationTypeApi): Station => STATION_API_TO_UI[s] ?? "Lạnh"
export const stationToApi   = (s: Station): StationTypeApi => STATION_UI_TO_API[s] ?? "GENERAL"

// ─── Order item status (FE chỉ có 5 trạng thái — BE READY_TO_SERVE map sang "ready") ──
const ORDER_ITEM_STATUS_API_TO_UI: Record<OrderItemStatusApi, OrderItemStatus> = {
  PENDING:        "pending",
  COOKING:        "cooking",
  READY_TO_SERVE: "ready",
  SERVED:         "served",
  CANCELLED:      "cancelled",
}
const ORDER_ITEM_STATUS_UI_TO_API: Record<OrderItemStatus, OrderItemStatusApi> = {
  pending:   "PENDING",
  cooking:   "COOKING",
  ready:     "READY_TO_SERVE",
  served:    "SERVED",
  cancelled: "CANCELLED",
}
export const orderItemStatusFromApi = (s: OrderItemStatusApi): OrderItemStatus =>
  ORDER_ITEM_STATUS_API_TO_UI[s] ?? "pending"
export const orderItemStatusToApi = (s: OrderItemStatus): OrderItemStatusApi =>
  ORDER_ITEM_STATUS_UI_TO_API[s] ?? "PENDING"

// ─── Ticket item status (KDS) ──────────────────────────────────────────────
const TICKET_ITEM_STATUS_API_TO_UI: Record<TicketItemStatusApi, OrderItemStatus> = {
  PENDING:   "pending",
  COOKING:   "cooking",
  READY:     "ready",
  CANCELLED: "cancelled",
}
const TICKET_ITEM_STATUS_UI_TO_API: Partial<Record<OrderItemStatus, TicketItemStatusApi>> = {
  pending:   "PENDING",
  cooking:   "COOKING",
  ready:     "READY",
  cancelled: "CANCELLED",
}
export const ticketItemStatusFromApi = (s: TicketItemStatusApi): OrderItemStatus =>
  TICKET_ITEM_STATUS_API_TO_UI[s] ?? "pending"
export const ticketItemStatusToApi = (s: OrderItemStatus): TicketItemStatusApi =>
  TICKET_ITEM_STATUS_UI_TO_API[s] ?? "PENDING"

// ─── Order status ──────────────────────────────────────────────────────────
const ORDER_STATUS_API_TO_UI: Record<OrderStatusApi, OrderStatus> = {
  DRAFT:          "open",
  PENDING:        "sent",
  COOKING:        "partial",
  READY_TO_SERVE: "partial",
  SERVED:         "complete",
  COMPLETED:      "paid",
  CANCELLED:      "complete",
}
export const orderStatusFromApi = (s: OrderStatusApi): OrderStatus =>
  ORDER_STATUS_API_TO_UI[s] ?? "open"

// ─── Ticket status ─────────────────────────────────────────────────────────
const TICKET_STATUS_API_TO_UI: Record<TicketStatusApi, OrderStatus> = {
  PENDING:        "sent",
  PREPARING:      "partial",
  READY_TO_SERVE: "partial",
  SERVED:         "complete",
  CANCELLED:      "complete",
}
export const ticketStatusFromApi = (s: TicketStatusApi): OrderStatus =>
  TICKET_STATUS_API_TO_UI[s] ?? "sent"

// ─── Table status ──────────────────────────────────────────────────────────
const TABLE_STATUS_API_TO_UI: Record<TableStatusApi, TableStatus> = {
  AVAILABLE: "empty",
  OCCUPIED:  "occupied",
  RESERVED:  "reserved",
  CLEANING:  "needs-cleaning",
}
const TABLE_STATUS_UI_TO_API: Record<TableStatus, TableStatusApi> = {
  empty:             "AVAILABLE",
  occupied:          "OCCUPIED",
  reserved:          "RESERVED",
  "needs-cleaning":  "CLEANING",
}
export const tableStatusFromApi = (s: TableStatusApi): TableStatus =>
  TABLE_STATUS_API_TO_UI[s] ?? "empty"
export const tableStatusToApi = (s: TableStatus): TableStatusApi =>
  TABLE_STATUS_UI_TO_API[s]

// ─── Reservation status ────────────────────────────────────────────────────
const RES_STATUS_API_TO_UI: Record<ReservationStatusApi, ReservationStatus> = {
  PENDING:   "confirmed",   // FE chưa có "pending" — coi như đã xác nhận
  CONFIRMED: "confirmed",
  SEATED:    "arrived",
  CANCELLED: "cancelled",
  NO_SHOW:   "no-show",
}
export const reservationStatusFromApi = (s: ReservationStatusApi): ReservationStatus =>
  RES_STATUS_API_TO_UI[s] ?? "confirmed"

// ─── Payment method ────────────────────────────────────────────────────────
const PAY_METHOD_UI_TO_API: Record<PaymentMethod, PaymentMethodApi> = {
  cash:       "CASH",
  card:       "CREDIT_CARD",
  "e-wallet": "E_WALLET",
}
const PAY_METHOD_API_TO_UI: Record<PaymentMethodApi, PaymentMethod> = {
  CASH:        "cash",
  CREDIT_CARD: "card",
  E_WALLET:    "e-wallet",
}
export const payMethodToApi   = (m: PaymentMethod): PaymentMethodApi => PAY_METHOD_UI_TO_API[m]
export const payMethodFromApi = (m: PaymentMethodApi): PaymentMethod => PAY_METHOD_API_TO_UI[m]

// ─── Heuristic: chọn station từ tên category/món (BE menu chưa có cột station) ──
function inferStation(item: { name?: string; category?: { name?: string } | null }): Station {
  const text = `${item.name ?? ""} ${item.category?.name ?? ""}`.toLowerCase()
  if (/(bar|trà|cà phê|coffee|trà sữa|nước|bia|rượu|drink|juice)/.test(text)) return "Bar"
  if (/(tráng miệng|dessert|kem|chè|bánh ngọt|sweet)/.test(text)) return "Tráng miệng"
  if (/(nướng|grill|bbq|bò|gà nướng)/.test(text)) return "Nướng"
  if (/(chiên|fry|fried|gà rán|khoai|chips)/.test(text)) return "Chiên"
  if (/(salad|gỏi|lạnh|cold)/.test(text)) return "Lạnh"
  return "Lạnh"
}

// ─── MenuItem: BE → UI ─────────────────────────────────────────────────────
export function menuItemFromApi(api: MenuItemApi): MenuItem {
  return {
    id: api.id,
    name: api.name,
    price: typeof api.price === "string" ? parseFloat(api.price as unknown as string) : api.price,
    category: api.category?.name ?? "Khác",
    station: inferStation(api),
    description: api.description,
    available: api.isAvailable,
    allergens: api.allergens ?? [],
    estimatedMinutes: api.preparationTime ?? 10,
    slaMinutes: (api.preparationTime ?? 10) + 5,
  }
}

// ─── Table: BE → UI ────────────────────────────────────────────────────────
export function tableFromApi(api: RestaurantTableApi): Table {
  // tableNumber có thể là "B1", "12", "VIP-3"... cố parse số.
  const num = parseInt(api.tableNumber.replace(/\D+/g, ""), 10) || 0
  return {
    id: api.id,
    number: num || 0,
    capacity: api.capacity,
    status: tableStatusFromApi(api.status),
    currentOrderId: api.currentOrderId,
    occupiedSince: toDate(api.seatedAt),
    section: api.location ?? "Tầng 1",
    floor: 1,
    isVIP: /vip/i.test(api.tableNumber) || /vip/i.test(api.location ?? ""),
  }
}

// ─── OrderItem: BE → UI ────────────────────────────────────────────────────
// Cần truyền vào danh sách MenuItem để gắn lại object (UI cần `menuItem.price`,
// `menuItem.station`, ...). Nếu không tìm thấy menuItem, tạo stub.
export function orderItemFromApi(
  api: OrderItemResponseDTO,
  menuMap: Map<string, MenuItem>,
): OrderItem {
  const mi = menuMap.get(api.menuItemId) ?? {
    id: api.menuItemId,
    name: api.menuItemName,
    price: api.price,
    category: "Khác",
    station: "Lạnh" as Station,
    available: true,
    estimatedMinutes: 10,
    slaMinutes: 15,
  }
  return {
    id: api.id,
    menuItemId: api.menuItemId,
    menuItem: mi,
    quantity: api.quantity,
    notes: api.note,
    status: orderItemStatusFromApi(api.status),
  }
}

// ─── Order: BE → UI ────────────────────────────────────────────────────────
export function orderFromApi(
  api: OrderResponseDTO,
  ctx: { menuMap: Map<string, MenuItem>; tableNumberById?: Map<string, number> } = {
    menuMap: new Map(),
  },
): Order {
  return {
    id: api.id,
    tableId: api.tableId ?? "",
    tableNumber: api.tableId ? ctx.tableNumberById?.get(api.tableId) ?? 0 : 0,
    items: api.items.map((it) => orderItemFromApi(it, ctx.menuMap)),
    status: orderStatusFromApi(api.status),
    createdAt: toDate(api.createdAt) ?? new Date(),
    sentAt: api.status !== "DRAFT" ? toDate(api.updatedAt) : undefined,
    isVIP: false,                  // BE chưa có field này
    serverName: api.waiterId ?? "—",
    discountAmount: 0,             // BE chưa có voucher → giữ FE-side
    tipAmount: 0,
  }
}

// ─── Kitchen ticket → "Order"-shape cho KDS UI ─────────────────────────────
export function ticketItemFromApi(
  api: KitchenTicketItemDto,
  menuMap: Map<string, MenuItem>,
): OrderItem {
  const mi = menuMap.get(api.menuItemId) ?? {
    id: api.menuItemId,
    name: api.menuItemName,
    price: 0,
    category: "Khác",
    station: stationFromApi(api.station),
    available: true,
    estimatedMinutes: 10,
    slaMinutes: 15,
  }
  return {
    id: api.id,
    menuItemId: api.menuItemId,
    menuItem: { ...mi, station: stationFromApi(api.station) },
    quantity: api.quantity,
    notes: api.notes,
    status: ticketItemStatusFromApi(api.status),
    startedAt: toDate(api.createdAt),
  }
}

export function ticketFromApi(
  api: KitchenTicketDto,
  ctx: { menuMap: Map<string, MenuItem>; tableNumberById?: Map<string, number> } = {
    menuMap: new Map(),
  },
): Order {
  return {
    id: api.id,
    tableId: api.tableId ?? "",
    tableNumber: api.tableId ? ctx.tableNumberById?.get(api.tableId) ?? 0 : 0,
    items: api.items.map((it) => ticketItemFromApi(it, ctx.menuMap)),
    status: ticketStatusFromApi(api.status),
    createdAt: toDate(api.createdAt) ?? new Date(),
    sentAt: toDate(api.createdAt),
    isVIP: false,
    serverName: "—",
    discountAmount: 0,
    tipAmount: 0,
  }
}

// ─── Reservation: BE → UI ──────────────────────────────────────────────────
export function reservationFromApi(api: ReservationApi): Reservation {
  return {
    id: api.id,
    guestName: api.customerName,
    phone: api.customerPhone,
    partySize: api.partySize,
    tableId: api.table?.id,
    tableNumber: api.table ? parseInt(api.table.tableNumber.replace(/\D+/g, ""), 10) || 0 : undefined,
    dateTime: toDate(api.reservationTime) ?? new Date(),
    notes: api.notes,
    status: reservationStatusFromApi(api.status),
    confirmationSent: api.status === "CONFIRMED" || api.status === "SEATED",
  }
}

// ─── Waitlist: BE → UI ─────────────────────────────────────────────────────
export function waitlistFromApi(api: WaitlistEntryApi): WaitlistEntry {
  return {
    id: api.id,
    guestName: api.customerName,
    phone: api.customerPhone,
    partySize: api.partySize,
    addedAt: toDate(api.createdAt) ?? new Date(),
    estimatedWaitMinutes: api.estimatedWaitMinutes ?? 0,
    notified: api.status === "NOTIFIED",
    notifiedAt: toDate(api.notifiedAt),
  }
}

// ─── Re-export trạng thái Waitlist phòng khi UI cần ───────────────────────
export type { WaitlistStatusApi, CategoryApi }
