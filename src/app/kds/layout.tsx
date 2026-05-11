import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "KDS · Màn hình bếp",
  description: "Kitchen Display System — phiếu gọi món theo trạm bếp",
}

export default function KDSLayout({ children }: { children: React.ReactNode }) {
  return children
}
