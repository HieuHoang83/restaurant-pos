export type TableStatus = "empty" | "occupied" | "reserved" | "needs-cleaning"
export type OrderItemStatus = "pending" | "cooking" | "ready" | "served" | "cancelled"
export type OrderStatus = "open" | "sent" | "partial" | "complete" | "paid"
export type PaymentMethod = "cash" | "card" | "e-wallet"
export type UserRole = "server" | "cashier" | "chef" | "host" | "manager" | "admin"
export type Station = "Nướng" | "Chiên" | "Tráng miệng" | "Bar" | "Lạnh"
export type ReservationStatus = "confirmed" | "arrived" | "cancelled" | "no-show"

export interface Table {
  id: string
  number: number
  capacity: number
  status: TableStatus
  currentOrderId?: string
  reservationId?: string
  occupiedSince?: Date
  section: string
  floor: number
  isVIP?: boolean
}

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  station: Station
  description?: string
  available: boolean
  allergens?: string[]
  estimatedMinutes: number
  slaMinutes: number
}

export interface OrderItem {
  id: string
  menuItemId: string
  menuItem: MenuItem
  quantity: number
  notes?: string
  allergyNotes?: string
  status: OrderItemStatus
  startedAt?: Date
  completedAt?: Date
}

export interface Order {
  id: string
  tableId: string
  tableNumber: number
  items: OrderItem[]
  status: OrderStatus
  createdAt: Date
  sentAt?: Date
  isVIP: boolean
  serverName: string
  voucherCode?: string
  discountAmount: number
  tipAmount: number
  paymentMethod?: PaymentMethod
}

export interface Reservation {
  id: string
  guestName: string
  phone: string
  email?: string
  partySize: number
  tableId?: string
  tableNumber?: number
  dateTime: Date
  notes?: string
  status: ReservationStatus
  confirmationSent: boolean
}

export interface WaitlistEntry {
  id: string
  guestName: string
  phone: string
  partySize: number
  addedAt: Date
  estimatedWaitMinutes: number
  tableId?: string
  notified: boolean
  notifiedAt?: Date
}

export interface IngredientItem {
  id: string
  name: string
  currentStock: number
  threshold: number
  unit: string
  estimatedDepletionHours: number
  lastUpdated: Date
}

export interface StaffMember {
  id: string
  name: string
  role: UserRole
  active: boolean
  cancelCount: number
  ordersServed: number
  avgSlaCompliancePct: number
  shift: string
}

export interface AuditLog {
  id: string
  timestamp: Date
  staffId: string
  staffName: string
  action: "cancel_item" | "cancel_order" | "refund" | "modify_price" | "apply_discount" | "login" | "logout"
  detail: string
  orderId?: string
  tableNumber?: number
}

export interface RevenueHour {
  hour: string
  revenue: number
  orders: number
}

export interface TopDish {
  name: string
  sold: number
  revenue: number
}
