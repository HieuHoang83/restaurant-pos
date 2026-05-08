"use client"

import { useEffect, useRef } from "react"

/**
 * Mở SSE connection tới các endpoint do BE expose, gọi `onEvent` mỗi khi có event
 * (trừ "ping" heartbeat và "hello" handshake).
 *
 * URLs được join bằng "|" để effect deps stable. Callback nên được wrap bằng useCallback
 * để tránh reconnect mỗi render.
 */
export function useRealtime(urls: string[], onEvent: () => void) {
  const cbRef = useRef(onEvent)
  cbRef.current = onEvent

  // Dùng JSON để dependency stable bất kể identity của mảng
  const key = urls.join("|")

  useEffect(() => {
    if (!key) return
    const list = key.split("|")
    const sources: EventSource[] = []
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const fire = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      // Debounce 200ms — gộp nhiều event sát nhau thành 1 lần refetch
      debounceTimer = setTimeout(() => cbRef.current(), 200)
    }

    for (const url of list) {
      try {
        const es = new EventSource(url)
        // Default 'message' (BE không gửi cái này nhưng phòng hờ)
        es.onmessage = fire
        // BE đặt tên event: "order.created", "ticket.itemStatus", "table.status", v.v.
        // EventSource yêu cầu addEventListener cho từng tên — wildcard không hỗ trợ.
        // Workaround: lắng nghe tất cả các tên đã biết.
        const events = [
          "order.created", "order.status", "order.deleted", "order.itemAdded",
          "order.itemStatus", "order.itemStatus.sync",
          "ticket.created", "ticket.itemStatus", "ticket.itemStatus.sync", "ticket.status",
          "table.created", "table.status", "table.seated", "table.moved",
          "reservation.changed", "waitlist.changed",
        ]
        for (const ev of events) es.addEventListener(ev, fire)
        // ping/hello: bỏ qua
        es.onerror = () => {
          // Tự reconnect là behavior mặc định của EventSource — chỉ log
          // console.debug("SSE error", url)
        }
        sources.push(es)
      } catch (e) {
        console.warn("EventSource failed:", url, e)
      }
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      sources.forEach((es) => es.close())
    }
  }, [key])
}

/** URL cho từng service. Đường dẫn tương đối → đi qua Next rewrite. */
export const SSE_URLS = {
  ORDERS: "/api/v1/orders/events/stream",
  KITCHEN: "/api/v1/kitchen/events/stream",
  TABLES: "/api/tables/events/stream",
} as const
