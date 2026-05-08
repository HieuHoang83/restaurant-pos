import { getToken, clearToken } from "../auth"

/**
 * Lỗi từ server. `status` là HTTP status, `body` là JSON body nếu có.
 */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  body?: unknown
  /** Thêm vào query string nếu có. Giá trị undefined sẽ bị bỏ. */
  query?: Record<string, string | number | boolean | undefined | null>
  /** Mặc định true. Đặt false nếu endpoint không cần JWT (vd: /auth/login). */
  auth?: boolean
  /** Thêm header tùy chọn. */
  headers?: Record<string, string>
  /** Bỏ qua parse JSON (vd: 204 No Content). */
  raw?: boolean
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!query) return path
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    sp.append(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : path
}

/**
 * Fetch wrapper trung tâm.
 *
 * - Tự đính kèm `Authorization: Bearer <token>` nếu có và `auth !== false`.
 * - Tự stringify body JSON.
 * - Throw `ApiError` khi !response.ok.
 * - 401 → clear token (UI có thể bắt và redirect /login).
 * - 204 → trả về undefined.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true, headers = {}, raw = false } = opts

  const finalHeaders: Record<string, string> = { Accept: "application/json", ...headers }
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json"
  }

  if (auth) {
    const token = getToken()
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
        ? body
        : JSON.stringify(body),
    cache: "no-store",
  })

  if (res.status === 401) {
    // Token hết hạn / không hợp lệ. Xoá để buộc login lại.
    clearToken()
  }

  if (res.status === 204) return undefined as T

  let parsed: unknown = undefined
  const text = await res.text()
  if (text) {
    try { parsed = JSON.parse(text) } catch { parsed = text }
  }

  if (!res.ok) {
    const msg =
      (typeof parsed === "object" && parsed && "message" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).message)
        : null) || res.statusText || `HTTP ${res.status}`
    throw new ApiError(res.status, msg, parsed)
  }

  return (raw ? text : parsed) as T
}
