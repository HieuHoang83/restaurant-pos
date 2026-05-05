import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin · Quản lý nhà hàng",
  description: "Bảng điều khiển quản trị · doanh thu, nhân sự, kho",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
