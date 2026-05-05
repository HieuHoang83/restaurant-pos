import Link from "next/link"
import { UtensilsCrossed, Monitor, LayoutDashboard, ConciergeBell, ArrowRight, ChefHat } from "lucide-react"

const modules = [
  {
    href: "/pos",
    icon: UtensilsCrossed,
    label: "POS",
    sub: "Thu ngân & Phục vụ",
    desc: "Quản lý bàn, đặt món, gửi bếp, thanh toán nhanh chóng",
    accent: "bg-blue-600",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    border: "hover:border-blue-300",
    badge: "bg-blue-50 text-blue-600",
    shadow: "hover:shadow-blue-100",
  },
  {
    href: "/kds",
    icon: Monitor,
    label: "KDS",
    sub: "Màn hình Bếp",
    desc: "Tiếp nhận phiếu gọi món, cập nhật trạng thái nấu",
    accent: "bg-orange-500",
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    border: "hover:border-orange-300",
    badge: "bg-orange-50 text-orange-600",
    shadow: "hover:shadow-orange-100",
  },
  {
    href: "/admin",
    icon: LayoutDashboard,
    label: "Admin",
    sub: "Quản lý & Báo cáo",
    desc: "Thực đơn, tồn kho, doanh thu, nhân sự, audit log",
    accent: "bg-violet-600",
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    border: "hover:border-violet-300",
    badge: "bg-violet-50 text-violet-600",
    shadow: "hover:shadow-violet-100",
  },
  {
    href: "/host",
    icon: ConciergeBell,
    label: "Host",
    sub: "Tiếp tân",
    desc: "Sơ đồ bàn, đặt bàn trước, danh sách chờ, SMS khách",
    accent: "bg-emerald-600",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    border: "hover:border-emerald-300",
    badge: "bg-emerald-50 text-emerald-600",
    shadow: "hover:shadow-emerald-100",
  },
]

export default function Home() {
  return (
    <main className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-8">
      {/* Subtle background circles */}
      <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-blue-100/40 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[350px] h-[350px] rounded-full bg-violet-100/40 blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="mb-12 text-center z-10">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-200">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-slate-800">
            Resto<span className="text-orange-500">POS</span>
          </span>
        </div>
        <p className="text-slate-400 text-sm tracking-widest uppercase font-medium">
          Chọn giao diện để bắt đầu
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl z-10">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`group bg-white rounded-2xl border border-slate-200 ${m.border} p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${m.shadow} relative overflow-hidden`}
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${m.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />

              <div className={`w-11 h-11 rounded-xl ${m.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${m.iconText}`} />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-slate-800 text-base">{m.label}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.badge}`}>
                      {m.sub}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{m.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-150 shrink-0 mt-1" />
              </div>
            </Link>
          )
        })}
      </div>

    </main>
  )
}
