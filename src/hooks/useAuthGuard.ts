"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { isAuthed } from "@/lib/auth"

/**
 * Bảo vệ route phía client. Gọi ở đầu component:
 *
 *   const ready = useAuthGuard()
 *   if (!ready) return null
 *
 * Nếu chưa có token → redirect /login?redirect=<pathname>.
 */
export function useAuthGuard(): boolean {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthed()) {
      const target = `/login?redirect=${encodeURIComponent(pathname || "/")}`
      router.replace(target)
    } else {
      setReady(true)
    }
  }, [router, pathname])

  return ready
}
