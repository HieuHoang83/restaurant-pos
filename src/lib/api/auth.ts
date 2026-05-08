import { apiFetch } from "./client"
import type { AuthRequest, AuthResponse, RegisterRequest } from "@/types/api"

export const AuthApi = {
  login(body: AuthRequest) {
    return apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body,
      auth: false,
    })
  },

  register(body: RegisterRequest) {
    return apiFetch<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body,
      auth: false,
    })
  },
}
