import { apiFetch } from "./client"
import type {
  ReservationApi,
  ReservationRequest,
  ReservationStatusApi,
  RestaurantTableApi,
  SeatGuestRequest,
  TableRequest,
  TableStatusApi,
  TableStatusUpdateRequest,
  UUID,
  WaitlistEntryApi,
  WaitlistRequest,
} from "@/types/api"

export const TablesApi = {
  list(status?: TableStatusApi) {
    return apiFetch<RestaurantTableApi[]>("/api/tables", {
      auth: false,
      query: { status },
    })
  },
  available(partySize = 1) {
    return apiFetch<RestaurantTableApi[]>("/api/tables/available", {
      auth: false,
      query: { partySize },
    })
  },
  get(id: UUID) {
    return apiFetch<RestaurantTableApi>(`/api/tables/${id}`, { auth: false })
  },
  create(body: TableRequest) {
    return apiFetch<RestaurantTableApi>("/api/tables", {
      method: "POST",
      body,
      auth: false,
    })
  },
  updateStatus(id: UUID, body: TableStatusUpdateRequest) {
    return apiFetch<RestaurantTableApi>(`/api/tables/${id}/status`, {
      method: "PUT",
      body,
      auth: false,
    })
  },
  seat(body: SeatGuestRequest) {
    return apiFetch<RestaurantTableApi>("/api/tables/seat", {
      method: "POST",
      body,
      auth: false,
    })
  },
  move(fromId: UUID, toId: UUID) {
    return apiFetch<RestaurantTableApi>(`/api/tables/${fromId}/move/${toId}`, {
      method: "PUT",
      auth: false,
    })
  },
}

export const ReservationsApi = {
  list(status?: ReservationStatusApi) {
    return apiFetch<ReservationApi[]>("/api/reservations", {
      auth: false,
      query: { status },
    })
  },
  between(from: string, to: string) {
    return apiFetch<ReservationApi[]>("/api/reservations/between", {
      auth: false,
      query: { from, to },
    })
  },
  get(id: UUID) {
    return apiFetch<ReservationApi>(`/api/reservations/${id}`, { auth: false })
  },
  create(body: ReservationRequest) {
    return apiFetch<ReservationApi>("/api/reservations", {
      method: "POST",
      body,
      auth: false,
    })
  },
  confirm(id: UUID, tableId: UUID) {
    return apiFetch<ReservationApi>(`/api/reservations/${id}/confirm`, {
      method: "PUT",
      query: { tableId },
      auth: false,
    })
  },
  cancel(id: UUID) {
    return apiFetch<ReservationApi>(`/api/reservations/${id}/cancel`, {
      method: "PUT",
      auth: false,
    })
  },
  noShow(id: UUID) {
    return apiFetch<ReservationApi>(`/api/reservations/${id}/no-show`, {
      method: "PUT",
      auth: false,
    })
  },
}

export const WaitlistApi = {
  list() {
    return apiFetch<WaitlistEntryApi[]>("/api/waitlist", { auth: false })
  },
  add(body: WaitlistRequest) {
    return apiFetch<WaitlistEntryApi>("/api/waitlist", {
      method: "POST",
      body,
      auth: false,
    })
  },
  notify(id: UUID) {
    return apiFetch<WaitlistEntryApi>(`/api/waitlist/${id}/notify`, {
      method: "PUT",
      auth: false,
    })
  },
  seat(id: UUID, tableId: UUID) {
    return apiFetch<WaitlistEntryApi>(`/api/waitlist/${id}/seat`, {
      method: "PUT",
      query: { tableId },
      auth: false,
    })
  },
  remove(id: UUID) {
    return apiFetch<WaitlistEntryApi>(`/api/waitlist/${id}`, {
      method: "DELETE",
      auth: false,
    })
  },
  recalculate() {
    return apiFetch<void>("/api/waitlist/recalculate", { method: "POST", auth: false })
  },
}
