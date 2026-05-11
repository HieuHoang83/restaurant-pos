import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "POS · Thu ngân & Phục vụ",
  description: "Hệ thống thu ngân, đặt món và thanh toán cho bàn ăn",
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return children
}
