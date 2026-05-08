import { apiFetch } from "./client"
import type { PaymentRequestDTO, PaymentResponseDTO, UUID } from "@/types/api"

export const PaymentsApi = {
  create(body: PaymentRequestDTO) {
    return apiFetch<PaymentResponseDTO>("/api/v1/payments", {
      method: "POST",
      body,
      auth: false,
    })
  },
  process(paymentId: UUID) {
    return apiFetch<PaymentResponseDTO>(`/api/v1/payments/${paymentId}/process`, {
      method: "POST",
      auth: false,
    })
  },
  get(paymentId: UUID) {
    return apiFetch<PaymentResponseDTO>(`/api/v1/payments/${paymentId}`, { auth: false })
  },
}
