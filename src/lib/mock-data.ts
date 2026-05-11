import type {
  MenuItem, Order, OrderItem, Reservation,
  WaitlistEntry, IngredientItem, StaffMember, AuditLog,
  RevenueHour, TopDish,
} from "@/types"

const now = new Date()
const ago = (min: number) => new Date(now.getTime() - min * 60000)

// ─── MENU ITEMS ─────────────────────────────────────────────────────────────
export const MENU_ITEMS: MenuItem[] = [
  // Khai vị
  { id: "m1",  name: "Gỏi cuốn tôm thịt",      price: 85000,  category: "Khai vị",    station: "Lạnh",       description: "Tôm, thịt heo, rau sống, bánh tráng",  available: true,  allergens: ["tôm", "đậu phộng"], estimatedMinutes: 8,  slaMinutes: 12 },
  { id: "m2",  name: "Chả giò hải sản",          price: 95000,  category: "Khai vị",    station: "Chiên",      description: "Tôm, mực, nấm, cà rốt",               available: true,  allergens: ["hải sản"],           estimatedMinutes: 10, slaMinutes: 15 },
  { id: "m3",  name: "Súp bào ngư vi cá",        price: 185000, category: "Khai vị",    station: "Lạnh",       description: "Bào ngư, vi cá, nấm đông cô",         available: false, allergens: ["hải sản"],           estimatedMinutes: 12, slaMinutes: 18 },
  // Món chính
  { id: "m4",  name: "Bò bít tết ribeye 300g",   price: 485000, category: "Món chính",  station: "Nướng",      description: "Bò Mỹ, khoai tây chiên, salad",        available: true,  allergens: [],                    estimatedMinutes: 18, slaMinutes: 25 },
  { id: "m5",  name: "Cá hồi áp chảo",           price: 365000, category: "Món chính",  station: "Nướng",      description: "Cá hồi Na Uy, rau củ nướng",          available: true,  allergens: ["cá"],                estimatedMinutes: 15, slaMinutes: 22 },
  { id: "m6",  name: "Gà nướng thảo mộc",        price: 265000, category: "Món chính",  station: "Nướng",      description: "Gà ta, rosemary, thyme, khoai lang",   available: true,  allergens: [],                    estimatedMinutes: 20, slaMinutes: 28 },
  { id: "m7",  name: "Mực chiên giòn",            price: 195000, category: "Món chính",  station: "Chiên",      description: "Mực tươi, bột chiên xù, sốt mayonnaise", available: true, allergens: ["hải sản", "trứng"],  estimatedMinutes: 12, slaMinutes: 18 },
  { id: "m8",  name: "Cơm chiên hải sản",        price: 145000, category: "Món chính",  station: "Chiên",      description: "Tôm, mực, cua, cơm, trứng",           available: true,  allergens: ["hải sản", "trứng"],  estimatedMinutes: 10, slaMinutes: 15 },
  { id: "m9",  name: "Pasta carbonara",           price: 175000, category: "Món chính",  station: "Chiên",      description: "Pasta, bacon, trứng, parmesan",        available: true,  allergens: ["gluten", "trứng", "sữa"], estimatedMinutes: 12, slaMinutes: 18 },
  // Tráng miệng
  { id: "m10", name: "Bánh crème brûlée",        price: 95000,  category: "Tráng miệng",station: "Tráng miệng",description: "Kem trứng, đường caramel",              available: true,  allergens: ["trứng", "sữa"],      estimatedMinutes: 5,  slaMinutes: 8  },
  { id: "m11", name: "Chocolate fondant",         price: 115000, category: "Tráng miệng",station: "Tráng miệng",description: "Bánh sô cô la chảy, kem vani",         available: true,  allergens: ["gluten", "trứng", "sữa"], estimatedMinutes: 8, slaMinutes: 12 },
  { id: "m12", name: "Kem 3 vị",                 price: 75000,  category: "Tráng miệng",station: "Tráng miệng",description: "Vani, dâu, socola",                    available: true,  allergens: ["sữa"],               estimatedMinutes: 3,  slaMinutes: 5  },
  // Đồ uống
  { id: "m13", name: "Nước ép cam tươi",         price: 65000,  category: "Đồ uống",    station: "Bar",        description: "Cam tươi, đường thốt nốt",            available: true,  allergens: [],                    estimatedMinutes: 5,  slaMinutes: 8  },
  { id: "m14", name: "Cocktail mojito",           price: 125000, category: "Đồ uống",    station: "Bar",        description: "Rum trắng, bạc hà, chanh, soda",      available: true,  allergens: [],                    estimatedMinutes: 5,  slaMinutes: 8  },
  { id: "m15", name: "Trà đào cam sả",           price: 75000,  category: "Đồ uống",    station: "Bar",        description: "Trà, đào, cam, sả tươi",              available: true,  allergens: [],                    estimatedMinutes: 5,  slaMinutes: 8  },
  { id: "m16", name: "Bia Heineken chai",         price: 55000,  category: "Đồ uống",    station: "Bar",        description: "",                                     available: true,  allergens: ["gluten"],            estimatedMinutes: 2,  slaMinutes: 4  },
]

// ─── ORDERS ─────────────────────────────────────────────────────────────────
const makeItem = (id: string, menuId: string, qty: number, status: OrderItem["status"], notes?: string, allergy?: string): OrderItem => ({
  id, menuItemId: menuId,
  menuItem: MENU_ITEMS.find(m => m.id === menuId)!,
  quantity: qty, status,
  notes, allergyNotes: allergy,
  startedAt: status === "cooking" || status === "ready" || status === "served" ? ago(8) : undefined,
  completedAt: status === "ready" || status === "served" ? ago(2) : undefined,
})

export const ORDERS: Order[] = [
  {
    id: "o1", tableId: "t2", tableNumber: 2,
    items: [
      makeItem("oi1","m4",1,"served"),
      makeItem("oi2","m5",1,"served"),
      makeItem("oi3","m10",2,"cooking"),
      makeItem("oi4","m14",2,"served"),
    ],
    status: "sent", createdAt: ago(45), sentAt: ago(43), isVIP: false,
    serverName: "Minh Tuấn", discountAmount: 0, tipAmount: 0,
  },
  {
    id: "o2", tableId: "t4", tableNumber: 4,
    items: [
      makeItem("oi5","m1",2,"served"),
      makeItem("oi6","m6",2,"cooking","không hành","dị ứng đậu phộng"),
      makeItem("oi7","m9",1,"pending"),
      makeItem("oi8","m13",3,"served"),
    ],
    status: "sent", createdAt: ago(20), sentAt: ago(18), isVIP: true,
    serverName: "Thu Hà", discountAmount: 0, tipAmount: 0,
  },
  {
    id: "o3", tableId: "t7", tableNumber: 7,
    items: [
      makeItem("oi9","m2",1,"cooking"),
      makeItem("oi10","m8",2,"pending"),
      makeItem("oi11","m16",4,"served"),
    ],
    status: "sent", createdAt: ago(10), sentAt: ago(9), isVIP: false,
    serverName: "Minh Tuấn", discountAmount: 0, tipAmount: 0,
  },
  {
    id: "o4", tableId: "t10", tableNumber: 10,
    items: [
      makeItem("oi12","m4",2,"served"),
      makeItem("oi13","m7",1,"served"),
      makeItem("oi14","m11",2,"served"),
      makeItem("oi15","m15",4,"served"),
    ],
    status: "complete", createdAt: ago(60), sentAt: ago(58), isVIP: false,
    serverName: "Thu Hà", discountAmount: 50000, tipAmount: 100000,
  },
  {
    id: "o5", tableId: "t14", tableNumber: 14,
    items: [
      makeItem("oi16","m1",4,"served"),
      makeItem("oi17","m4",3,"served"),
      makeItem("oi18","m6",3,"cooking","ít muối",""),
      makeItem("oi19","m5",2,"cooking"),
      makeItem("oi20","m14",6,"served"),
    ],
    status: "sent", createdAt: ago(30), sentAt: ago(28), isVIP: true,
    serverName: "Quang Huy", discountAmount: 0, tipAmount: 0,
  },
]

// ─── RESERVATIONS ───────────────────────────────────────────────────────────
export const RESERVATIONS: Reservation[] = [
  {
    id: "r1", guestName: "Nguyễn Văn Anh", phone: "0901234567", email: "vananh@email.com",
    partySize: 4, tableId: "t3", tableNumber: 3,
    dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0),
    notes: "Sinh nhật vợ, cần cắm hoa bàn", status: "confirmed", confirmationSent: true,
  },
  {
    id: "r2", guestName: "Trần Thị Mai", phone: "0912345678",
    partySize: 3, tableId: "t12", tableNumber: 12,
    dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30),
    notes: "", status: "confirmed", confirmationSent: true,
  },
  {
    id: "r3", guestName: "Lê Minh Khoa", phone: "0987654321", email: "minhkhoa@co.vn",
    partySize: 8,
    dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30),
    notes: "Tiệc công ty, cần màn hình chiếu", status: "confirmed", confirmationSent: false,
  },
]

// ─── WAITLIST ────────────────────────────────────────────────────────────────
export const WAITLIST: WaitlistEntry[] = [
  { id: "w1", guestName: "Phạm Quốc Bảo", phone: "0934567890", partySize: 2, addedAt: ago(15), estimatedWaitMinutes: 10, notified: false },
  { id: "w2", guestName: "Hoàng Thị Lan",  phone: "0945678901", partySize: 4, addedAt: ago(25), estimatedWaitMinutes: 20, notified: true, notifiedAt: ago(5) },
  { id: "w3", guestName: "Đỗ Văn Cường",   phone: "0956789012", partySize: 6, addedAt: ago(8),  estimatedWaitMinutes: 30, notified: false },
]

// ─── INVENTORY ───────────────────────────────────────────────────────────────
export const INGREDIENTS: IngredientItem[] = [
  { id: "i1", name: "Bò ribeye",     currentStock: 3.2,  threshold: 5,   unit: "kg",  estimatedDepletionHours: 2.5, lastUpdated: ago(30) },
  { id: "i2", name: "Cá hồi",        currentStock: 1.8,  threshold: 3,   unit: "kg",  estimatedDepletionHours: 1.2, lastUpdated: ago(15) },
  { id: "i3", name: "Tôm sú",        currentStock: 4.5,  threshold: 3,   unit: "kg",  estimatedDepletionHours: 4.0, lastUpdated: ago(45) },
  { id: "i4", name: "Kem tươi",      currentStock: 0.8,  threshold: 2,   unit: "lít", estimatedDepletionHours: 0.8, lastUpdated: ago(10) },
  { id: "i5", name: "Rượu rum trắng",currentStock: 1.5,  threshold: 1,   unit: "chai",estimatedDepletionHours: 3.0, lastUpdated: ago(60) },
  { id: "i6", name: "Parmesan",      currentStock: 0.3,  threshold: 0.5, unit: "kg",  estimatedDepletionHours: 0.5, lastUpdated: ago(20) },
  { id: "i7", name: "Bào ngư",       currentStock: 0,    threshold: 1,   unit: "kg",  estimatedDepletionHours: 0,   lastUpdated: ago(5)  },
  { id: "i8", name: "Chocolate đen", currentStock: 2.1,  threshold: 1,   unit: "kg",  estimatedDepletionHours: 6.0, lastUpdated: ago(90) },
]

// ─── STAFF ───────────────────────────────────────────────────────────────────
export const STAFF: StaffMember[] = [
  { id: "s1", name: "Minh Tuấn",  role: "server",  active: true,  cancelCount: 1, ordersServed: 18, avgSlaCompliancePct: 94, shift: "Ca chiều" },
  { id: "s2", name: "Thu Hà",     role: "server",  active: true,  cancelCount: 4, ordersServed: 22, avgSlaCompliancePct: 87, shift: "Ca chiều" },
  { id: "s3", name: "Quang Huy",  role: "cashier", active: true,  cancelCount: 0, ordersServed: 31, avgSlaCompliancePct: 99, shift: "Ca chiều" },
  { id: "s4", name: "Bích Ngọc",  role: "chef",    active: true,  cancelCount: 0, ordersServed: 48, avgSlaCompliancePct: 91, shift: "Ca chiều" },
  { id: "s5", name: "Văn Long",   role: "chef",    active: true,  cancelCount: 0, ordersServed: 36, avgSlaCompliancePct: 96, shift: "Ca chiều" },
  { id: "s6", name: "Mai Linh",   role: "host",    active: true,  cancelCount: 0, ordersServed: 0,  avgSlaCompliancePct: 100, shift: "Ca chiều" },
  { id: "s7", name: "Hải Đăng",   role: "server",  active: false, cancelCount: 2, ordersServed: 5,  avgSlaCompliancePct: 78, shift: "Ca sáng" },
]

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
export const AUDIT_LOGS: AuditLog[] = [
  { id: "a1",  timestamp: ago(5),  staffId: "s2", staffName: "Thu Hà",    action: "cancel_item",  detail: "Hủy 1x Cá hồi áp chảo — khách đổi ý",           orderId: "o2", tableNumber: 4 },
  { id: "a2",  timestamp: ago(12), staffId: "s2", staffName: "Thu Hà",    action: "cancel_order", detail: "Hủy đơn bàn 6 — khách rời đi",                                 tableNumber: 6 },
  { id: "a3",  timestamp: ago(18), staffId: "s1", staffName: "Minh Tuấn", action: "apply_discount",detail: "Áp mã HAPPY20 — giảm 20%",                       orderId: "o1", tableNumber: 2 },
  { id: "a4",  timestamp: ago(25), staffId: "s2", staffName: "Thu Hà",    action: "cancel_item",  detail: "Hủy 2x Gà nướng — hết hàng",                     orderId: "o2", tableNumber: 4 },
  { id: "a5",  timestamp: ago(35), staffId: "s3", staffName: "Quang Huy", action: "refund",       detail: "Hoàn tiền 185.000đ — chất lượng món kém",         orderId: "o4", tableNumber: 10},
  { id: "a6",  timestamp: ago(42), staffId: "s2", staffName: "Thu Hà",    action: "cancel_item",  detail: "Hủy 1x Súp bào ngư — hết hàng bếp báo",          orderId: "o5", tableNumber: 14},
  { id: "a7",  timestamp: ago(50), staffId: "s1", staffName: "Minh Tuấn", action: "modify_price", detail: "Điều chỉnh giá Cocktail: 125k → 100k — lỗi menu",  orderId: "o3", tableNumber: 7 },
  { id: "a8",  timestamp: ago(55), staffId: "s2", staffName: "Thu Hà",    action: "cancel_order", detail: "Hủy đơn bàn 9 — đặt nhầm bàn",                               tableNumber: 9 },
  { id: "a9",  timestamp: ago(62), staffId: "s2", staffName: "Thu Hà",    action: "cancel_item",  detail: "Hủy 1x Chả giò — khách dị ứng không khai trước", orderId: "o2", tableNumber: 4 },
]

// ─── REVENUE DATA ────────────────────────────────────────────────────────────
export const REVENUE_BY_HOUR: RevenueHour[] = [
  { hour: "10h", revenue: 1250000, orders: 4 },
  { hour: "11h", revenue: 3480000, orders: 12 },
  { hour: "12h", revenue: 8920000, orders: 28 },
  { hour: "13h", revenue: 7650000, orders: 24 },
  { hour: "14h", revenue: 2340000, orders: 8  },
  { hour: "15h", revenue: 1890000, orders: 6  },
  { hour: "16h", revenue: 2100000, orders: 7  },
  { hour: "17h", revenue: 4560000, orders: 15 },
  { hour: "18h", revenue: 9870000, orders: 31 },
  { hour: "19h", revenue: 12450000, orders: 38},
  { hour: "20h", revenue: 10230000, orders: 32},
  { hour: "21h", revenue: 6780000, orders: 21 },
]

export const TOP_DISHES: TopDish[] = [
  { name: "Bò bít tết ribeye", sold: 47, revenue: 22795000 },
  { name: "Cá hồi áp chảo",   sold: 38, revenue: 13870000 },
  { name: "Gà nướng thảo mộc",sold: 34, revenue: 9010000  },
  { name: "Cocktail mojito",   sold: 62, revenue: 7750000  },
  { name: "Chocolate fondant", sold: 51, revenue: 5865000  },
]
