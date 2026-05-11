import { apiFetch } from "./client"
import type {
  OrderItemRequestDTO,
  OrderItemResponseDTO,
  OrderItemStatusApi,
  OrderRequestDTO,
  OrderResponseDTO,
  OrderStatusApi,
  Page,
  UUID,
} from "@/types/api"

export interface ListOrdersParams {
  status?: OrderStatusApi
  waiterId?: UUID
  startDate?: string  // ISO LocalDateTime
  endDate?: string
  page?: number
  size?: number
}

export const OrdersApi = {
  list(params: ListOrdersParams = {}) {
    return apiFetch<Page<OrderResponseDTO>>("/api/v1/orders", {
      auth: false,
      query: {
        status: params.status,
        waiterId: params.waiterId,
        startDate: params.startDate,
        endDate: params.endDate,
        page: params.page,
        size: params.size,
      },
    })
  },

  /** Đơn cho bếp (dùng đến khi /api/v1/kds/tickets không trả đủ thông tin). */
  forKitchen() {
    return apiFetch<OrderResponseDTO[]>("/api/v1/orders/kitchen", { auth: false })
  },

  get(id: UUID) {
    return apiFetch<OrderResponseDTO>(`/api/v1/orders/${id}`, { auth: false })
  },

  create(body: OrderRequestDTO) {
    return apiFetch<OrderResponseDTO>("/api/v1/orders", {
      method: "POST",
      body,
      auth: false,
    })
  },

  updateStatus(id: UUID, status: OrderStatusApi) {
    return apiFetch<OrderResponseDTO>(`/api/v1/orders/${id}/status`, {
      method: "PUT",
      query: { status },
      auth: false,
    })
  },

  remove(id: UUID) {
    return apiFetch<void>(`/api/v1/orders/${id}`, { method: "DELETE", auth: false })
  },

  // ─── Order items ──────────────────────────────────────────────────────────
  addItem(orderId: UUID, body: OrderItemRequestDTO) {
    return apiFetch<OrderResponseDTO>(`/api/v1/orders/${orderId}/items`, {
      method: "POST",
      body,
      auth: false,
    })
  },
  updateItem(orderId: UUID, itemId: UUID, body: OrderItemRequestDTO) {
    return apiFetch<OrderItemResponseDTO>(
      `/api/v1/orders/${orderId}/items/${itemId}`,
      { method: "PUT", body, auth: false },
    )
  },
  updateItemStatus(orderId: UUID, itemId: UUID, status: OrderItemStatusApi) {
    return apiFetch<OrderItemResponseDTO>(
      `/api/v1/orders/${orderId}/items/${itemId}/status`,
      { method: "PUT", query: { status }, auth: false },
    )
  },
  removeItem(orderId: UUID, itemId: UUID) {
    return apiFetch<void>(`/api/v1/orders/${orderId}/items/${itemId}`, {
      method: "DELETE",
      auth: false,
    })
  },
}
