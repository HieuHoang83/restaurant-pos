/** @type {import('next').NextConfig} */

// Mỗi backend service chạy ở 1 port riêng. Mặc định trỏ về localhost
// nhưng có thể override bằng biến môi trường (ví dụ khi BE chạy trong Docker).
const ADMIN    = process.env.ADMIN_SERVICE_URL    || "http://localhost:8081"
const MENU     = process.env.MENU_SERVICE_URL     || "http://localhost:8082"
const ORDER    = process.env.ORDER_SERVICE_URL    || "http://localhost:8083"
const KITCHEN  = process.env.KITCHEN_SERVICE_URL  || "http://localhost:8084"
const TABLE    = process.env.TABLE_SERVICE_URL    || "http://localhost:8085"
const PAYMENT  = process.env.PAYMENT_SERVICE_URL  || "http://localhost:8086"

const nextConfig = {
  async rewrites() {
    return [
      // ─── Admin service (auth + user/role mgmt) ────────────────────────────
      { source: "/api/v1/auth/:path*",     destination: `${ADMIN}/api/v1/auth/:path*` },
      { source: "/api/v1/admin/:path*",    destination: `${ADMIN}/api/v1/admin/:path*` },

      // ─── Menu service ─────────────────────────────────────────────────────
      { source: "/api/menu/:path*",        destination: `${MENU}/api/menu/:path*` },

      // ─── Order service ────────────────────────────────────────────────────
      { source: "/api/v1/orders/:path*",   destination: `${ORDER}/api/v1/orders/:path*` },

      // ─── Kitchen service (KDS + Kitchen tickets) ──────────────────────────
      { source: "/api/v1/kds/:path*",      destination: `${KITCHEN}/api/v1/kds/:path*` },
      { source: "/api/v1/kitchen/:path*",  destination: `${KITCHEN}/api/v1/kitchen/:path*` },

      // ─── Table service (tables + reservations + waitlist) ────────────────
      { source: "/api/tables/:path*",      destination: `${TABLE}/api/tables/:path*` },
      { source: "/api/reservations/:path*",destination: `${TABLE}/api/reservations/:path*` },
      { source: "/api/waitlist/:path*",    destination: `${TABLE}/api/waitlist/:path*` },

      // ─── Payment service ──────────────────────────────────────────────────
      { source: "/api/v1/payments/:path*", destination: `${PAYMENT}/api/v1/payments/:path*` },
    ]
  },
}

module.exports = nextConfig
