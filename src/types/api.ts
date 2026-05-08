// ============================================================================
// API DTOs — mirror chính xác các class Java DTO ở backend (archsoft_252-IRMS).
// Sửa file này khi BE thay đổi DTO. KHÔNG dùng các type này trực tiếp trong UI;
// hãy convert qua adapters trong `lib/adapters.ts` để map về UI types ở `types/index.ts`.
// ============================================================================

// ─── Common ────────────────────────────────────────────────────────────────
/** UUID dạng chuỗi do BE trả ra (java.util.UUID).  */
export type UUID = string

/** ISO-8601 LocalDateTime "yyyy-MM-ddTHH:mm:ss[.SSSSSS]".  */
export type IsoDateTime = string

/** Spring Data Page<T> wrapper.  */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

// ─── Admin Service ─────────────────────────────────────────────────────────
export interface AuthRequest {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface RoleResponseDTO {
  id: UUID
  name: string
  description?: string
}

export interface UserRequestDTO {
  username: string
  password?: string
  email: string
  active: boolean
  roleNames: string[]
}

export interface UserResponseDTO {
  id: UUID
  username: string
  email: string
  active: boolean
  roles: RoleResponseDTO[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

// ─── Menu Service ──────────────────────────────────────────────────────────
export interface CategoryApi {
  id: UUID
  name: string
  displayOrder: number
  createdAt?: IsoDateTime
  updatedAt?: IsoDateTime
}

export interface MenuItemApi {
  id: UUID
  name: string
  description?: string
  price: number          // BigDecimal sang JSON là số
  isAvailable: boolean
  preparationTime?: number
  imageUrl?: string
  allergens?: string[]
  category?: CategoryApi
  createdAt?: IsoDateTime
  updatedAt?: IsoDateTime
}

export interface MenuItemRequest {
  name: string
  description?: string
  price: number
  categoryId: UUID
  preparationTime?: number
  imageUrl?: string
  allergens?: string[]
  isAvailable?: boolean
}

// ─── Order Service ─────────────────────────────────────────────────────────
export type OrderStatusApi =
  | "DRAFT"
  | "PENDING"
  | "COOKING"
  | "READY_TO_SERVE"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED"

export type OrderItemStatusApi =
  | "PENDING"
  | "COOKING"
  | "READY_TO_SERVE"
  | "SERVED"
  | "CANCELLED"

export type OrderTypeApi = "DINE_IN" | "TAKEAWAY" | "DELIVERY"

export interface OrderItemRequestDTO {
  menuItemId: UUID
  quantity: number
  note?: string
}

export interface OrderItemResponseDTO {
  id: UUID
  menuItemId: UUID
  menuItemName: string
  quantity: number
  price: number
  note?: string
  status: OrderItemStatusApi
}

export interface OrderRequestDTO {
  tableId?: UUID
  waiterId?: UUID
  type: OrderTypeApi
  specialNote?: string
  items: OrderItemRequestDTO[]
}

export interface OrderResponseDTO {
  id: UUID
  tableId?: UUID
  waiterId?: UUID
  status: OrderStatusApi
  type: OrderTypeApi
  totalAmount: number
  specialNote?: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  items: OrderItemResponseDTO[]
}

// ─── Kitchen Service ───────────────────────────────────────────────────────
export type StationTypeApi = "GRILL" | "FRYER" | "DESSERT" | "DRINK" | "GENERAL"

export type TicketStatusApi =
  | "PENDING"
  | "PREPARING"
  | "READY_TO_SERVE"
  | "SERVED"
  | "CANCELLED"

export type TicketItemStatusApi = "PENDING" | "COOKING" | "READY" | "CANCELLED"

export interface KitchenTicketItemDto {
  id: UUID
  ticketId: UUID
  menuItemId: UUID
  menuItemName: string
  quantity: number
  notes?: string
  station: StationTypeApi
  status: TicketItemStatusApi
  createdAt: IsoDateTime
}

export interface KitchenTicketDto {
  id: UUID
  orderId: UUID
  tableId?: UUID
  status: TicketStatusApi
  expectedReadyTime?: IsoDateTime
  createdAt: IsoDateTime
  items: KitchenTicketItemDto[]
  isBreached: boolean
  isAtRisk: boolean
}

export interface CreateTicketItemRequest {
  menuItemId: UUID
  menuItemName: string
  quantity: number
  notes?: string
}

export interface CreateTicketRequest {
  orderId: UUID
  tableId?: UUID
  items: CreateTicketItemRequest[]
}

export interface UpdateItemStatusRequest {
  status: TicketItemStatusApi
}

// ─── Table Service ─────────────────────────────────────────────────────────
export type TableStatusApi = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING"

export interface RestaurantTableApi {
  id: UUID
  tableNumber: string
  capacity: number
  status: TableStatusApi
  location?: string
  currentOrderId?: UUID
  seatedAt?: IsoDateTime
  createdAt?: IsoDateTime
  updatedAt?: IsoDateTime
}

export interface TableRequest {
  tableNumber: string
  capacity: number
  location?: string
}

export interface TableStatusUpdateRequest {
  status: TableStatusApi
  currentOrderId?: UUID
}

export interface SeatGuestRequest {
  tableId: UUID
  source?: "RESERVATION" | "WAITLIST" | "WALK_IN"
  sourceId?: UUID
}

export type ReservationStatusApi =
  | "PENDING"
  | "CONFIRMED"
  | "SEATED"
  | "CANCELLED"
  | "NO_SHOW"

export interface ReservationApi {
  id: UUID
  customerName: string
  customerPhone: string
  partySize: number
  reservationTime: IsoDateTime
  status: ReservationStatusApi
  notes?: string
  table?: RestaurantTableApi
  expectedDurationMinutes?: number
  createdAt?: IsoDateTime
  updatedAt?: IsoDateTime
}

export interface ReservationRequest {
  customerName: string
  customerPhone: string
  partySize: number
  reservationTime: IsoDateTime
  notes?: string
}

export type WaitlistStatusApi = "WAITING" | "NOTIFIED" | "SEATED" | "LEFT"

export interface WaitlistEntryApi {
  id: UUID
  customerName: string
  customerPhone: string
  partySize: number
  status: WaitlistStatusApi
  estimatedWaitMinutes?: number
  notifiedAt?: IsoDateTime
  queuePosition?: number
  createdAt?: IsoDateTime
  updatedAt?: IsoDateTime
}

export interface WaitlistRequest {
  customerName: string
  customerPhone: string
  partySize: number
}

// ─── Payment Service ───────────────────────────────────────────────────────
export type PaymentMethodApi = "CASH" | "CREDIT_CARD" | "E_WALLET"
export type PaymentStatusApi = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"

export interface PaymentRequestDTO {
  orderId: UUID
  method: PaymentMethodApi
  amount: number
}

export interface PaymentResponseDTO {
  id: UUID
  orderId: UUID
  amount: number
  method: PaymentMethodApi
  status: PaymentStatusApi
  transactionId?: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
