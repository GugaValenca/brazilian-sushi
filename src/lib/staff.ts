import { apiRequest, type PaginatedResponse } from "@/lib/api";
import type {
  CategoryApiItem,
  DeliveryZone,
  MenuApiItem,
  MenuOption,
  MenuOptionGroup,
  OrderResponse,
} from "@/lib/catalog";

export interface AdminOrderListItem extends OrderResponse {
  customer: number | null;
  delivery_address: number | null;
  coupon: number | null;
  delivery_zone: number | null;
}

export interface AdminOrderCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_verified_customer: boolean;
}

export interface AdminOrderAddress {
  id: number;
  label: string;
  recipient_name: string;
  phone_number: string;
  line_1: string;
  line_2: string;
  city: string;
  state: string;
  postal_code: string;
  delivery_notes: string;
}

export interface AdminOrderCoupon {
  id: number;
  code: string;
  discount_type: string;
  value: string;
}

export interface AdminOrderZone {
  id: number;
  name: string;
  postal_code: string;
  fee: string;
  minimum_order: string;
  average_minutes: number;
  active: boolean;
}

export interface AdminOrderDetail extends OrderResponse {
  customer: AdminOrderCustomer | null;
  delivery_address: AdminOrderAddress | null;
  coupon: AdminOrderCoupon | null;
  delivery_zone: AdminOrderZone | null;
  scheduled_for: string | null;
  updated_at: string;
  confirmed_at: string | null;
  preparation_started_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface AdminOrderListParams {
  page?: number;
  status?: string[];
  payment_status?: string;
  order_type?: string;
  search?: string;
  id?: number;
  customer?: number;
  created_after?: string;
  created_before?: string;
}

function buildOrderQuery(params: AdminOrderListParams): string {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  params.status?.forEach((value) => query.append("status", value));
  if (params.payment_status) query.set("payment_status", params.payment_status);
  if (params.order_type) query.set("order_type", params.order_type);
  if (params.search) query.set("search", params.search);
  if (params.id) query.set("id", String(params.id));
  if (params.customer) query.set("customer", String(params.customer));
  if (params.created_after) query.set("created_after", params.created_after);
  if (params.created_before) query.set("created_before", params.created_before);
  return query.toString();
}

export interface DailyRevenuePoint {
  date: string;
  revenue: string;
}

export interface StaffOrderSummary {
  received: number;
  confirmed: number;
  preparing: number;
  ready: number;
  out_for_delivery: number;
  delivered: number;
  pickup_orders: number;
  delivery_orders: number;
  revenue_last_7_days: string;
  daily_revenue: DailyRevenuePoint[];
  average_delivery_minutes: number | null;
}

export interface StaffCustomer {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  notification_preference: string;
  sms_opt_in: boolean;
  email_opt_in: boolean;
  is_verified_customer: boolean;
  verified_reason: string;
  loyalty_completed_orders: number;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  date_joined: string;
}

export interface AdminCustomerListParams {
  page?: number;
  search?: string;
  is_staff?: "true" | "false";
}

export interface AdminCustomerUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
}

export interface StaffPromotion {
  id?: number;
  title: string;
  description: string;
  audience: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  featured: boolean;
}

export interface StaffCoupon {
  id?: number;
  code: string;
  description: string;
  discount_type: string;
  value: string;
  minimum_order: string;
  verified_only: boolean;
  active: boolean;
  starts_at: string;
  ends_at: string;
}

export interface StaffReview {
  id: number;
  customer_name: string;
  rating: number;
  title: string;
  content: string;
  approval_status: string;
  created_at: string;
  user: number;
}

export interface StaffContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  created_at: string;
  resolved: boolean;
}

export function fetchStaffSummary(token: string) {
  return apiRequest<StaffOrderSummary>("/orders/summary/", { token });
}

export function fetchAdminOrders(token: string, params: AdminOrderListParams = {}) {
  const query = buildOrderQuery(params);
  return apiRequest<PaginatedResponse<AdminOrderListItem>>(`/orders/${query ? `?${query}` : ""}`, { token });
}

export function fetchAdminOrderDetail(token: string, orderId: number) {
  return apiRequest<AdminOrderDetail>(`/orders/${orderId}/`, { token });
}

export function updateOrderStatus(token: string, orderId: number, status: string, note = "") {
  return apiRequest<AdminOrderDetail>(`/orders/${orderId}/update_status/`, {
    method: "POST",
    token,
    body: JSON.stringify({ status, note }),
  });
}

export function refundOrder(token: string, orderId: number) {
  return apiRequest<AdminOrderDetail>(`/orders/${orderId}/refund/`, {
    method: "POST",
    token,
  });
}

export function fetchAdminCustomers(token: string, params: AdminCustomerListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.search) query.set("search", params.search);
  if (params.is_staff) query.set("is_staff", params.is_staff);
  const suffix = query.toString();
  return apiRequest<PaginatedResponse<StaffCustomer>>(`/accounts/customers/${suffix ? `?${suffix}` : ""}`, { token });
}

export function fetchAdminCustomerDetail(token: string, customerId: number) {
  return apiRequest<StaffCustomer>(`/accounts/customers/${customerId}/`, { token });
}

export function updateCustomer(token: string, customerId: number, payload: AdminCustomerUpdatePayload) {
  return apiRequest<StaffCustomer>(`/accounts/customers/${customerId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function setCustomerPassword(token: string, customerId: number, password: string) {
  return apiRequest<{ detail: string }>(`/accounts/customers/${customerId}/set_password/`, {
    method: "POST",
    token,
    body: JSON.stringify({ password }),
  });
}

export function verifyCustomer(token: string, customerId: number) {
  return apiRequest<StaffCustomer>(`/accounts/customers/${customerId}/verify/`, {
    method: "POST",
    token,
  });
}

export function removeCustomerVerification(token: string, customerId: number) {
  return apiRequest<StaffCustomer>(`/accounts/customers/${customerId}/remove_verification/`, {
    method: "POST",
    token,
  });
}

export async function fetchPromotionsAdmin(token: string) {
  const response = await apiRequest<PaginatedResponse<StaffPromotion>>("/marketing/promotions/", { token });
  return response.results;
}

export function createPromotion(token: string, payload: StaffPromotion) {
  return apiRequest<StaffPromotion>("/marketing/promotions/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updatePromotion(token: string, promotionId: number, payload: Partial<StaffPromotion>) {
  return apiRequest<StaffPromotion>(`/marketing/promotions/${promotionId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function deletePromotion(token: string, promotionId: number) {
  return apiRequest<void>(`/marketing/promotions/${promotionId}/`, { method: "DELETE", token });
}

export async function fetchCouponsAdmin(token: string) {
  const response = await apiRequest<PaginatedResponse<StaffCoupon>>("/marketing/coupons/", { token });
  return response.results;
}

export function createCoupon(token: string, payload: StaffCoupon) {
  return apiRequest<StaffCoupon>("/marketing/coupons/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateCoupon(token: string, couponId: number, payload: Partial<StaffCoupon>) {
  return apiRequest<StaffCoupon>(`/marketing/coupons/${couponId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteCoupon(token: string, couponId: number) {
  return apiRequest<void>(`/marketing/coupons/${couponId}/`, { method: "DELETE", token });
}

export async function fetchReviewsAdmin(token: string) {
  const response = await apiRequest<PaginatedResponse<StaffReview>>("/marketing/reviews/", { token });
  return response.results;
}

export function updateReviewStatus(token: string, reviewId: number, approval_status: string) {
  return apiRequest<StaffReview>(`/marketing/reviews/${reviewId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ approval_status }),
  });
}

export function deleteReview(token: string, reviewId: number) {
  return apiRequest<void>(`/marketing/reviews/${reviewId}/`, { method: "DELETE", token });
}

export async function fetchContactMessagesAdmin(token: string) {
  const response = await apiRequest<PaginatedResponse<StaffContactMessage>>("/marketing/contact-messages/", { token });
  return response.results;
}

export function updateContactMessage(token: string, messageId: number, resolved: boolean) {
  return apiRequest<StaffContactMessage>(`/marketing/contact-messages/${messageId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ resolved }),
  });
}

export function deleteContactMessage(token: string, messageId: number) {
  return apiRequest<void>(`/marketing/contact-messages/${messageId}/`, { method: "DELETE", token });
}

// -- Menu management ---------------------------------------------------

export interface AdminMenuItemPayload {
  category: number;
  name: string;
  slug: string;
  short_description: string;
  description?: string;
  price: string;
  spicy?: boolean;
  vegetarian?: boolean;
  featured?: boolean;
  allergens?: string;
  calories?: number | null;
  availability?: "available" | "sold_out" | "hidden";
}

export function fetchAdminMenuItems(token: string, params: { category?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  const suffix = query.toString();
  return apiRequest<PaginatedResponse<MenuApiItem>>(`/menu/items/${suffix ? `?${suffix}` : ""}`, { token });
}

export function createMenuItem(token: string, payload: AdminMenuItemPayload) {
  return apiRequest<MenuApiItem>("/menu/items/", { method: "POST", token, body: JSON.stringify(payload) });
}

export function updateMenuItem(token: string, itemId: number, payload: Partial<AdminMenuItemPayload>) {
  return apiRequest<MenuApiItem>(`/menu/items/${itemId}/`, { method: "PATCH", token, body: JSON.stringify(payload) });
}

export function deleteMenuItem(token: string, itemId: number) {
  return apiRequest<void>(`/menu/items/${itemId}/`, { method: "DELETE", token });
}

export function fetchMenuItemDetail(token: string, itemId: number) {
  return apiRequest<MenuApiItem>(`/menu/items/${itemId}/`, { token });
}

export interface AdminCategoryPayload {
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
}

export async function fetchAdminCategories(token: string) {
  const response = await apiRequest<PaginatedResponse<CategoryApiItem>>("/menu/categories/", { token });
  return response.results;
}

export function createCategory(token: string, payload: AdminCategoryPayload) {
  return apiRequest<CategoryApiItem>("/menu/categories/", { method: "POST", token, body: JSON.stringify(payload) });
}

export function updateCategory(token: string, categoryId: number, payload: Partial<AdminCategoryPayload>) {
  return apiRequest<CategoryApiItem>(`/menu/categories/${categoryId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteCategory(token: string, categoryId: number) {
  return apiRequest<void>(`/menu/categories/${categoryId}/`, { method: "DELETE", token });
}

export interface AdminOptionGroupPayload {
  menu_item: number;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
}

export function createOptionGroup(token: string, payload: AdminOptionGroupPayload) {
  return apiRequest<MenuOptionGroup>("/menu/option-groups/", { method: "POST", token, body: JSON.stringify(payload) });
}

export function updateOptionGroup(token: string, groupId: number, payload: Partial<AdminOptionGroupPayload>) {
  return apiRequest<MenuOptionGroup>(`/menu/option-groups/${groupId}/`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function deleteOptionGroup(token: string, groupId: number) {
  return apiRequest<void>(`/menu/option-groups/${groupId}/`, { method: "DELETE", token });
}

export interface AdminMenuOptionPayload {
  group: number;
  name: string;
  price_delta: string;
  is_default: boolean;
}

export function createMenuOption(token: string, payload: AdminMenuOptionPayload) {
  return apiRequest<MenuOption>("/menu/options/", { method: "POST", token, body: JSON.stringify(payload) });
}

export function updateMenuOption(token: string, optionId: number, payload: Partial<AdminMenuOptionPayload>) {
  return apiRequest<MenuOption>(`/menu/options/${optionId}/`, { method: "PATCH", token, body: JSON.stringify(payload) });
}

export function deleteMenuOption(token: string, optionId: number) {
  return apiRequest<void>(`/menu/options/${optionId}/`, { method: "DELETE", token });
}

// -- Delivery zones ------------------------------------------------------

export interface AdminDeliveryZonePayload {
  name: string;
  postal_code: string;
  fee: string;
  minimum_order: string;
  average_minutes: number;
  active: boolean;
}

export function fetchAdminDeliveryZones(token: string, params: { search?: string; active?: "true" | "false" } = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.active) query.set("active", params.active);
  const suffix = query.toString();
  return apiRequest<PaginatedResponse<DeliveryZone>>(`/orders/zones/${suffix ? `?${suffix}` : ""}`, { token });
}

export function createDeliveryZone(token: string, payload: AdminDeliveryZonePayload) {
  return apiRequest<DeliveryZone>("/orders/zones/", { method: "POST", token, body: JSON.stringify(payload) });
}

export function updateDeliveryZone(token: string, zoneId: number, payload: Partial<AdminDeliveryZonePayload>) {
  return apiRequest<DeliveryZone>(`/orders/zones/${zoneId}/`, { method: "PATCH", token, body: JSON.stringify(payload) });
}

export function deleteDeliveryZone(token: string, zoneId: number) {
  return apiRequest<void>(`/orders/zones/${zoneId}/`, { method: "DELETE", token });
}
