import { apiRequest, type PaginatedResponse } from "@/lib/api";

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  notification_preference: "sms" | "email" | "both";
  sms_opt_in: boolean;
  email_opt_in: boolean;
  is_verified_customer: boolean;
  verified_reason: string;
  loyalty_completed_orders: number;
  is_staff: boolean;
  is_superuser: boolean;
  account_confirmed_at: string | null;
  can_submit_review: boolean;
}

export interface RegisterResponse {
  id: number;
  email: string;
  confirmation_channels: string[];
  confirmation_required: boolean;
}

export interface RegisterPayload {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  notification_preference: "sms" | "email" | "both";
  sms_opt_in: boolean;
  email_opt_in: boolean;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ConfirmationResponse {
  detail: string;
}

export interface AddressPayload {
  label: string;
  recipient_name: string;
  phone_number: string;
  line_1: string;
  line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  delivery_notes?: string;
  is_default?: boolean;
}

export interface Address extends AddressPayload {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface FavoriteItem {
  id: number;
  menu_item: number;
  menu_item_name: string;
  created_at: string;
}

export interface ReviewPayload {
  order_id: number;
  rating: number;
  title: string;
  content: string;
}

export interface ReviewResponse {
  id: number;
  order_id: number;
  order_item_names: string[];
  customer_name: string;
  is_verified_customer: boolean;
  rating: number;
  title: string;
  content: string;
  customer_photo: string | null;
  approval_status: string;
  created_at: string;
}

export interface EligibleReviewOrder {
  order_id: number;
  available_until: string;
  product_names: string[];
}

export interface OrderListItem {
  id: number;
  tracking_token: string;
  order_type: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  total: string;
  estimated_minutes: number;
  created_at: string;
  completed_at: string | null;
  items: Array<{
    id: number;
    menu_item: number;
    menu_item_name: string;
    quantity: number;
    line_total: string;
  }>;
}

export function login(payload: LoginPayload) {
  return apiRequest<AuthTokens>("/accounts/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterPayload) {
  return apiRequest<RegisterResponse>("/accounts/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Best-effort: invalidates the refresh token server-side (see LogoutView)
// instead of just discarding it client-side, so a token that leaked or was
// left on a shared device doesn't stay valid for its full lifetime after
// the user explicitly signs out. Deliberately not passed an access token —
// it may already be expired for an idle session, and possessing the
// refresh token itself is what authorizes blacklisting it (same model the
// refresh endpoint itself uses).
export function logout(refreshToken: string) {
  return apiRequest<void>("/accounts/logout/", {
    method: "POST",
    body: JSON.stringify({ refresh: refreshToken }),
  });
}

export function confirmAccount(token: string) {
  return apiRequest<ConfirmationResponse>("/accounts/confirm-account/", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendConfirmation(email: string) {
  return apiRequest<ConfirmationResponse>("/accounts/resend-confirmation/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function fetchProfile(token: string) {
  return apiRequest<UserProfile>("/accounts/profile/", { token });
}

export function updateProfile(token: string, payload: Partial<UserProfile>) {
  return apiRequest<UserProfile>("/accounts/profile/", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function fetchAddresses(token: string) {
  const response = await apiRequest<PaginatedResponse<Address>>("/accounts/addresses/", { token });
  return response.results;
}

export function createAddress(token: string, payload: AddressPayload) {
  return apiRequest<Address>("/accounts/addresses/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function makeDefaultAddress(token: string, addressId: number) {
  return apiRequest<{ status: string }>(`/accounts/addresses/${addressId}/make_default/`, {
    method: "POST",
    token,
  });
}

export async function fetchFavorites(token: string) {
  const response = await apiRequest<PaginatedResponse<FavoriteItem>>("/accounts/favorites/", { token });
  return response.results;
}

export function addFavorite(token: string, menuItemId: number) {
  return apiRequest<FavoriteItem>("/accounts/favorites/", {
    method: "POST",
    token,
    body: JSON.stringify({ menu_item: menuItemId }),
  });
}

export function removeFavorite(token: string, favoriteId: number) {
  return apiRequest<void>(`/accounts/favorites/${favoriteId}/`, {
    method: "DELETE",
    token,
  });
}

export async function fetchOrders(token: string) {
  const response = await apiRequest<PaginatedResponse<OrderListItem>>("/orders/", { token });
  return response.results;
}

export function reorderOrder(token: string, orderId: number) {
  return apiRequest<OrderListItem>(`/orders/${orderId}/reorder/`, {
    method: "POST",
    token,
  });
}

export function submitReview(token: string, payload: ReviewPayload) {
  return apiRequest<ReviewResponse>("/marketing/reviews/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function fetchEligibleReviewOrder(token: string) {
  return apiRequest<EligibleReviewOrder>("/marketing/reviews/eligibility/", {
    token,
  });
}

