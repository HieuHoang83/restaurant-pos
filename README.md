# RestoPOS — Hệ thống quản lý nhà hàng

Ứng dụng Next.js 14 · Tailwind CSS · shadcn/ui với 4 giao diện chuyên biệt.

## Cài đặt & chạy

```bash
cd restaurant-pos
npm install
npm run dev
```

Mở trình duyệt tại **http://localhost:3000**

## Các giao diện

| URL | Vai trò | Mô tả |
|-----|---------|-------|
| `/pos` | Server · Cashier | Sơ đồ bàn, đặt món, gửi bếp, thanh toán |
| `/kds` | Chef · Kitchen | Phiếu gọi món theo trạm, SLA countdown |
| `/admin` | Manager · Admin | Thực đơn, tồn kho, báo cáo, nhân sự, audit log |
| `/host` | Host | Sơ đồ bàn real-time, đặt trước, waitlist, SMS |

## Tính năng

### POS (UC01–UC23)
- Sơ đồ bàn màu sắc theo trạng thái
- Tạo đơn từ thực đơn điện tử, ghi chú dị ứng
- Gửi đơn xuống bếp KDS
- Theo dõi tiến độ (Chờ → Đang nấu → Sẵn sàng → Đã phục vụ)
- Hóa đơn VAT 8% + phí dịch vụ 5%
- Áp mã voucher (`HAPPY20`, `SAVE50K`)
- Chia hóa đơn theo người
- Thanh toán: tiền mặt / thẻ / ví điện tử + tip

### KDS (UC13–UC18)
- Tickets nhóm theo trạm (Nướng, Chiên, Tráng miệng, Bar, Lạnh)
- Ghi chú dị ứng nổi bật đỏ
- VIP orders ưu tiên đầu
- Start → Cooking (vàng + đếm giây) → Ready (xóa khỏi màn hình)
- SLA bar: xanh → vàng (80%) → đỏ nhấp nháy (100%)
- Hoàn tác qua nút Recall
- Tạm ngưng kèm lý do (hết nguyên liệu, v.v.)

### Admin (UC24–UC30)
- CRUD thực đơn: sửa giá, trạm bếp, bật/tắt có hàng
- Dashboard tồn kho cảnh báo đỏ/vàng + cập nhật thủ công
- Biểu đồ doanh thu theo giờ (recharts)
- Top 5 món bán chạy
- Bảng hiệu suất nhân viên + tỷ lệ SLA
- Tô đỏ nhân viên hủy ≥ 3 lần/ca
- Audit log với bộ lọc hành động & nhân viên

### Host (UC08–UC12)
- Sơ đồ bàn real-time: trạng thái + thời gian ngồi
- Cảnh báo vàng khi bàn quá 90p
- Tạo/hủy/check-in đặt bàn, gửi SMS xác nhận
- Waitlist với ETA tự cập nhật mỗi phút
- Gán bàn tự động / gửi SMS "bàn sẵn sàng"
- Xếp chỗ cho khách vãng lai

## Tech stack

- **Next.js 14** App Router
- **Tailwind CSS 3.4** + CSS variables
- **recharts** — biểu đồ doanh thu
- **lucide-react** — icons
- **TypeScript** — type-safe toàn bộ

> Data: mock tĩnh trong `src/lib/mock-data.ts`, không cần backend.
