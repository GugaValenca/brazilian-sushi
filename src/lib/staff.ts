import { apiRequest, type PaginatedResponse } from "@/lib/api";
import type { OrderResponse } from "@/lib/catalog";

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
  is_active: boolean;
  date_joined: string;
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

export function fetchStaffQueue(token: string) {
  return apiRequest<OrderResponse[]>("/orders/staff_queue/", { token });
}

export function fetchStaffSummary(token: string) {
  return apiRequest<StaffOrderSummary>("/orders/summary/", { token });
}

export function updateOrderStatus(token: string, orderId: number, status: string, note = "") {
  return apiRequest<OrderResponse>(`/orders/${orderId}/update_status/`, {
    method: "POST",
    token,
    body: JSON.stringify({ status, note }),
  });
}

export async function fetchCustomers(token: string) {
  const response = await apiRequest<PaginatedResponse<StaffCustomer>>("/accounts/customers/", { token });
  return response.results;
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
