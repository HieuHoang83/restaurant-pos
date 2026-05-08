// JWT lifecycle helpers — chạy trên client (localStorage).
// Không dùng trong Server Components.

const TOKEN_KEY = "irms_token"
const USER_KEY  = "irms_user"

export interface StoredUser {
  username: string
  // (chưa có endpoint /me nên chỉ lưu mức tối thiểu).
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function isAuthed(): boolean {
  return !!getToken()
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as StoredUser } catch { return null }
}

export function setStoredUser(user: StoredUser) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}
