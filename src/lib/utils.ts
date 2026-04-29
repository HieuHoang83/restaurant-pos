import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

export function minutesSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000)
}

export function secondsSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 1000)
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatPhone(phone: string): string {
  // Format: 0901 234 567
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3")
}
