import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Host · Đặt bàn & Lễ tân",
  description: "Quản lý đặt chỗ, danh sách chờ và đón tiếp khách",
}

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children
}
