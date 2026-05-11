import { apiFetch } from "./client"
import type { CategoryApi, MenuItemApi, MenuItemRequest, UUID } from "@/types/api"

export const MenuApi = {
  // ─── Categories ───────────────────────────────────────────────────────────
  listCategories() {
    return apiFetch<CategoryApi[]>("/api/menu/categories", { auth: false })
  },
  getCategory(id: UUID) {
    return apiFetch<CategoryApi>(`/api/menu/categories/${id}`, { auth: false })
  },
  createCategory(body: Partial<CategoryApi>) {
    return apiFetch<CategoryApi>("/api/menu/categories", {
      method: "POST",
      body,
      auth: false,
    })
  },
  updateCategory(id: UUID, body: Partial<CategoryApi>) {
    return apiFetch<CategoryApi>(`/api/menu/categories/${id}`, {
      method: "PUT",
      body,
      auth: false,
    })
  },
  deleteCategory(id: UUID) {
    return apiFetch<void>(`/api/menu/categories/${id}`, { method: "DELETE", auth: false })
  },

  // ─── Menu items ───────────────────────────────────────────────────────────
  listItems() {
    return apiFetch<MenuItemApi[]>("/api/menu/items", { auth: false })
  },
  getItem(id: UUID) {
    return apiFetch<MenuItemApi>(`/api/menu/items/${id}`, { auth: false })
  },
  itemsByCategory(categoryId: UUID) {
    return apiFetch<MenuItemApi[]>(`/api/menu/categories/${categoryId}/items`, {
      auth: false,
    })
  },
  createItem(body: MenuItemRequest) {
    return apiFetch<MenuItemApi>("/api/menu/items", { method: "POST", body, auth: false })
  },
  updateItem(id: UUID, body: MenuItemRequest) {
    return apiFetch<MenuItemApi>(`/api/menu/items/${id}`, {
      method: "PUT",
      body,
      auth: false,
    })
  },
  deleteItem(id: UUID) {
    return apiFetch<void>(`/api/menu/items/${id}`, { method: "DELETE", auth: false })
  },
}
