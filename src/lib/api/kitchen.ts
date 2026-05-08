import { apiFetch } from "./client"
import type {
  CreateTicketRequest,
  KitchenTicketDto,
  KitchenTicketItemDto,
  StationTypeApi,
  TicketItemStatusApi,
  TicketStatusApi,
  UUID,
} from "@/types/api"

export const KitchenApi = {
  // ─── KDS endpoints ────────────────────────────────────────────────────────
  activeTickets() {
    return apiFetch<KitchenTicketDto[]>("/api/v1/kds/tickets", { auth: false })
  },
  itemsByStation(station: StationTypeApi) {
    return apiFetch<KitchenTicketItemDto[]>(
      `/api/v1/kds/stations/${station}/items`,
      { auth: false },
    )
  },
  updateItemStatus(itemId: UUID, status: TicketItemStatusApi) {
    return apiFetch<void>(`/api/v1/kds/items/${itemId}/status`, {
      method: "PUT",
      body: { status },
      auth: false,
    })
  },
  updateTicketStatus(ticketId: UUID, status: TicketStatusApi) {
    // BE nhận raw enum trong body — gửi "PREPARING" nguyên chuỗi.
    return apiFetch<void>(`/api/v1/kds/tickets/${ticketId}/status`, {
      method: "PUT",
      body: status,
      auth: false,
    })
  },

  // ─── Kitchen ticket CRUD ──────────────────────────────────────────────────
  createTicket(body: CreateTicketRequest) {
    return apiFetch<KitchenTicketDto>("/api/v1/kitchen/tickets", {
      method: "POST",
      body,
      auth: false,
    })
  },
  getTicket(ticketId: UUID) {
    return apiFetch<KitchenTicketDto>(`/api/v1/kitchen/tickets/${ticketId}`, {
      auth: false,
    })
  },
}
