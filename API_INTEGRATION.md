# Tích hợp Backend (archsoft_252-IRMS)

Frontend đã được chuyển từ mock data sang gọi thật vào 6 microservice của
`archsoft_252-IRMS`.

## Cách chạy

1. **Khởi động hạ tầng + 6 service BE** trong `archsoft_252-IRMS/`:
   ```powershell
   docker-compose up -d postgres-db redis-cache rabbitmq
   docker-compose up -d admin-service menu-service order-service kitchen-service table-service payment-service
   ```

2. **Tạo user đầu tiên** (chưa có dữ liệu seed):
   ```powershell
   curl -X POST http://localhost:8081/api/v1/auth/register `
        -H "Content-Type: application/json" `
        -d '{"username":"admin","email":"admin@test.com","password":"123456"}'
   ```

3. **Cài deps & chạy FE**:
   ```powershell
   cd restaurant-pos
   npm install
   cp .env.local.example .env.local   # chỉnh URL nếu cần
   npm run dev
   ```

4. Mở `http://localhost:3000` → bị redirect sang `/login` → đăng nhập với
   tài khoản vừa tạo.

## Kiến trúc proxy

`next.config.js` rewrites mọi request `/api/...` từ FE sang đúng port BE.
Không cần BE bật CORS, không có vấn đề preflight.

| FE path                    | BE service       | Port  |
|---------------------------|-------------------|-------|
| `/api/v1/auth/*`          | admin-service     | 8081  |
| `/api/v1/admin/*`         | admin-service     | 8081  |
| `/api/menu/*`             | menu-service      | 8082  |
| `/api/v1/orders/*`        | order-service     | 8083  |
| `/api/v1/kds/*`           | kitchen-service   | 8084  |
| `/api/v1/kitchen/*`       | kitchen-service   | 8084  |
| `/api/tables/*`           | table-service     | 8085  |
| `/api/reservations/*`     | table-service     | 8085  |
| `/api/waitlist/*`         | table-service     | 8085  |
| `/api/v1/payments/*`      | payment-service   | 8086  |

Override URL bằng env (`ADMIN_SERVICE_URL`, `MENU_SERVICE_URL`...).

## Các trang đã tích hợp

| Trang     | API gọi                                                                                  | Mock fallback             |
|-----------|------------------------------------------------------------------------------------------|---------------------------|
| `/login`  | POST /api/v1/auth/login                                                                  | —                         |
| `/pos`    | tables, menu, orders, kitchen ticket, payments                                           | voucher/VAT/tip giữ FE    |
| `/kds`    | GET /api/v1/kds/tickets · PUT /api/v1/kds/items/{id}/status (poll 5s)                    | —                         |
| `/admin`  | menu CRUD (categories + items)                                                           | inventory/staff/audit/báo cáo dùng mock — BE chưa có endpoint |
| `/host`   | tables · reservations · waitlist (poll 10s)                                              | —                         |

## Code structure mới

```
src/
├── types/
│   ├── index.ts        (UI types — giữ nguyên)
│   └── api.ts          (BE DTO 1-1, mới)
├── lib/
│   ├── auth.ts         (JWT localStorage helpers, mới)
│   ├── adapters.ts     (BE↔UI mapping, mới)
│   └── api/
│       ├── client.ts   (fetch wrapper với JWT, ApiError)
│       ├── auth.ts
│       ├── admin.ts
│       ├── menu.ts
│       ├── orders.ts
│       ├── kitchen.ts
│       ├── tables.ts
│       └── payments.ts
├── hooks/
│   └── useAuthGuard.ts (redirect /login nếu không có token)
└── app/
    ├── login/page.tsx  (mới)
    ├── pos/page.tsx    (sửa imports + handlers)
    ├── kds/page.tsx    (sửa imports + handlers, polling)
    ├── admin/page.tsx  (sửa menu tab, các tab khác có banner mock)
    └── host/page.tsx   (sửa imports + handlers, polling)
```

## Mapping enum (BE ↔ UI)

| Domain         | BE (Java)                                              | UI (TS literal)                              |
|----------------|--------------------------------------------------------|----------------------------------------------|
| TableStatus    | AVAILABLE / OCCUPIED / RESERVED / CLEANING             | empty / occupied / reserved / needs-cleaning |
| OrderStatus    | DRAFT / PENDING / COOKING / READY_TO_SERVE / SERVED / COMPLETED / CANCELLED | open / sent / partial / paid / complete |
| OrderItemStatus| PENDING / COOKING / READY_TO_SERVE / SERVED / CANCELLED | pending / cooking / ready / served / cancelled |
| TicketStatus   | PENDING / PREPARING / READY_TO_SERVE / SERVED / CANCELLED | sent / partial / complete                |
| TicketItemStatus| PENDING / COOKING / READY / CANCELLED                | pending / cooking / ready / cancelled       |
| StationType    | GRILL / FRYER / DESSERT / DRINK / GENERAL              | Nướng / Chiên / Tráng miệng / Bar / Lạnh    |
| ReservationStatus| PENDING / CONFIRMED / SEATED / CANCELLED / NO_SHOW   | confirmed / arrived / cancelled / no-show   |
| PaymentMethod  | CASH / CREDIT_CARD / E_WALLET                          | cash / card / e-wallet                       |

## Field BE chưa có

Các field FE dùng nhưng BE không trả → giữ giá trị derive/default:

- `Order.isVIP`, `serverName` → false / "—" (BE chưa lưu).
- `Order.discountAmount`, `tipAmount`, voucher → BE chưa có endpoint, giữ FE-side.
- `Table.section`, `floor`, `isVIP` → derive từ `location` + `tableNumber`.
- `MenuItem.station` → suy từ tên/category bằng heuristic regex (BE menu chưa
  có cột station).
- `MenuItem.slaMinutes` → `preparationTime + 5`.

## Endpoint BE còn thiếu (admin tab có banner cảnh báo)

- inventory-service: chưa code → tab Tồn kho dùng mock.
- reporting-service: chưa code → tab Báo cáo, tab Tổng quan KPI dùng mock.
- audit-log endpoint: admin-service đã có `AuditLog` entity nhưng chưa expose
  controller → tab Audit dùng mock.
- aggregate dashboard endpoint: chưa có.

## Auth

- Tất cả route ngoài `/login` cần JWT (qua `useAuthGuard`).
- Token lưu `localStorage["irms_token"]`.
- Thực tế chỉ admin-service yêu cầu JWT (các service khác hiện đang
  `permitAll` ở Spring Security mặc định, không có filter chain). Nếu sau này
  BE bật JWT filter cho các service khác, FE vẫn gửi `Authorization: Bearer`
  nên không phải sửa.
- Không có refresh-token → token hết hạn → 401 → tự `clearToken()` và redirect.
