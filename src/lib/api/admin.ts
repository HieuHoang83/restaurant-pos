import { apiFetch } from "./client"
import type {
  RoleResponseDTO,
  UserRequestDTO,
  UserResponseDTO,
  UUID,
} from "@/types/api"

export const AdminApi = {
  // ─── Users ────────────────────────────────────────────────────────────────
  listUsers() {
    return apiFetch<UserResponseDTO[]>("/api/v1/admin/users")
  },
  getUser(id: UUID) {
    return apiFetch<UserResponseDTO>(`/api/v1/admin/users/${id}`)
  },
  createUser(body: UserRequestDTO) {
    return apiFetch<UserResponseDTO>("/api/v1/admin/users", { method: "POST", body })
  },
  updateUser(id: UUID, body: UserRequestDTO) {
    return apiFetch<UserResponseDTO>(`/api/v1/admin/users/${id}`, { method: "PUT", body })
  },
  deleteUser(id: UUID) {
    return apiFetch<void>(`/api/v1/admin/users/${id}`, { method: "DELETE" })
  },

  // ─── Roles ────────────────────────────────────────────────────────────────
  listRoles() {
    return apiFetch<RoleResponseDTO[]>("/api/v1/admin/roles")
  },
}
