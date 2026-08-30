import heroImage from "@/assets/hero-sushi.jpg";
import sushiCombo from "@/assets/sushi-combo.jpg";
import sushiNigiri from "@/assets/sushi-nigiri.jpg";
import sushiRoll from "@/assets/sushi-roll.jpg";
import sushiSashimi from "@/assets/sushi-sashimi.jpg";
import sushiSoup from "@/assets/sushi-soup.jpg";
import { apiFormRequest, apiRequest, type PaginatedResponse } from "@/lib/api";

export interface MenuOption {
  id: number;
  name: string;
  price_delta: string;
  is_default: boolean;
}

export interface MenuOptionGroup {
  id: number;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  options: MenuOption[];
}

export interface MenuApiItem {
  id: number;
  category: number;
  category_name: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  price: string;
  image: string | null;
  spicy: boolean;
  vegetarian: boolean;
  featured: boolean;
  allergens: string;
  calories: number | null;
  availability: string;
  option_groups: MenuOptionGroup[];
}

export interface NormalizedMenuItem {
  id: string;
  apiId: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  spicy?: boolean;
  vegetarian?: boolean;
  allergens?: string[];
  featured?: boolean;
}

export interface CategoryApiItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

export interface PromotionApiItem {
  id: number;
  title: string;
  description: string;
  audience: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  featured: boolean;
}

export interface ReviewApiItem {
  id: number;
  customer_name: string;
  is_verified_customer: boolean;
  rating: number;
  title: string;
  content: string;
  customer_photo: string | null;
  approval_status: string;
  created_at: string;
}

export interface DeliveryZone {
  id: number;
  name: string;
  postal_code: string;
  fee: string;
  minimum_order: string;
  average_minutes: number;
  active: boolean;
}

export interface OrderTrackingEvent {
  id: number;
  status: string;
  note: string;
  created_at: string;
}

export interface OrderTrackingItem {
  id: number;
  menu_item: number;
  menu_item_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  special_request: string;
  selections: Array<{ id: number; option: number; option_name: string; price_delta: string }>;
}

export interface OrderResponse {
  id: number;
  tracking_token: string;
  order_type: string;
  status: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  notes: string;
  allergy_notes: string;
  notification_preference: string;
  has_kitchen_notes: boolean;
  has_allergy_alert: boolean;
  subtotal: string;
  delivery_fee: string;
  discount_amount: string;
  total: string;
  estimated_minutes: number;
  average_delivery_time: number | null;
  created_at: string;
  items: OrderTrackingItem[];
  status_events: OrderTrackingEvent[];
  payment_status: "not_required" | "pending" | "paid" | "failed" | "refunded";
  /** Present only on the create-order response, and only when Stripe is
   * configured on the backend — the frontend should redirect to it instead
   * of going straight to order tracking. */
  checkout_url?: string;
}

export interface ContactMessagePayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface ContactMessageResponse extends ContactMessagePayload {
  id: number;
  created_at: string;
  resolved: boolean;
}

export interface CreateOrderPayload {
  delivery_zone?: number;
  order_type: "delivery" | "pickup";
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  scheduled_for?: string;
  notes?: string;
  allergy_notes?: string;
  notification_preference?: "sms" | "email" | "both";
  items: Array<{
    menu_item_id: number;
    quantity: number;
    option_ids?: number[];
    special_request?: string;
  }>;
}

const imageMap: Record<string, string> = {
  hero: heroImage,
  nigiri: sushiNigiri,
  rolls: sushiRoll,
  sashimi: sushiSashimi,
  combos: sushiCombo,
  "soups-sides": sushiSoup,
  beverages: sushiSoup,
  default: sushiRoll,
};

function getFallbackImage(categoryName: string, itemName: string): string {
  const normalizedCategory = categoryName.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-");
  const normalizedName = itemName.toLowerCase();

  if (normalizedName.includes("combo") || normalizedName.includes("party")) return imageMap.combos;
  if (normalizedName.includes("sashimi")) return imageMap.sashimi;
  if (normalizedName.includes("nigiri")) return imageMap.nigiri;
  if (normalizedName.includes("soup") || normalizedName.includes("edamame")) return imageMap["soups-sides"];

  return imageMap[normalizedCategory] ?? imageMap.default;
}

export function normalizeAllergens(allergens: string): string[] {
  return allergens
    .split(",")
    .map((allergen) => allergen.trim())
    .filter(Boolean);
}

export function normalizeMenuItem(item: MenuApiItem): NormalizedMenuItem {
  return {
    id: String(item.id),
    apiId: item.id,
    name: item.name,
    description: item.short_description || item.description,
    price: Number(item.price),
    image: item.image || getFallbackImage(item.category_name, item.name),
    category: item.category_name,
    spicy: item.spicy,
    vegetarian: item.vegetarian,
    allergens: normalizeAllergens(item.allergens),
    featured: item.featured,
  };
}

export async function fetchMenuItems(query = "") {
  const suffix = query ? `?${query}` : "";
  const response = await apiRequest<PaginatedResponse<MenuApiItem>>(`/menu/items/${suffix}`);
  return response.results;
}

export async function fetchCategories() {
  const response = await apiRequest<PaginatedResponse<CategoryApiItem>>("/menu/categories/");
  return response.results;
}

export async function fetchFeaturedItems() {
  const items = await fetchMenuItems("featured=true");
  return items;
}

export async function fetchPromotions() {
  const response = await apiRequest<PaginatedResponse<PromotionApiItem>>("/marketing/promotions/");
  return response.results;
}

export async function fetchReviews() {
  const response = await apiRequest<PaginatedResponse<ReviewApiItem>>("/marketing/reviews/");
  return response.results;
}

export async function fetchDeliveryZones() {
  const response = await apiRequest<PaginatedResponse<DeliveryZone>>("/orders/zones/");
  return response.results;
}

export async function createOrder(payload: CreateOrderPayload, token?: string) {
  return apiRequest<OrderResponse>("/orders/", { method: "POST", token, body: JSON.stringify(payload) });
}

export async function trackOrder(orderId: string, token: string) {
  const search = new URLSearchParams({ order_id: orderId, token }).toString();
  return apiRequest<OrderResponse>(`/orders/track/?${search}`);
}

export async function submitContactMessage(payload: ContactMessagePayload) {
  return apiFormRequest<ContactMessageResponse, ContactMessagePayload>("/marketing/contact-messages/", payload);
}

