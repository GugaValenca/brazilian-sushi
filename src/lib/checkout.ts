import type { DeliveryZone } from "@/lib/catalog";

export interface OrderReadinessInput {
  hasItems: boolean;
  isSignedIn: boolean;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  orderType: "delivery" | "pickup";
  deliveryZoneId: number | undefined;
}

/** Whether the checkout form has everything it needs to submit an order.
 * Guests must supply contact details (an account already has them on file),
 * and a delivery order needs a zone selected so a fee can be charged. */
export function canSubmitOrder(input: OrderReadinessInput): boolean {
  if (!input.hasItems) return false;
  if (!input.isSignedIn && !(input.guestName && input.guestEmail && input.guestPhone)) return false;
  if (input.orderType === "delivery" && !input.deliveryZoneId) return false;
  return true;
}

/** Pickup orders never carry a delivery fee; a delivery order does only once
 * a zone is selected — the fee always comes from the zone the server also
 * has on record, never typed in by the customer. */
export function computeDeliveryFee(orderType: "delivery" | "pickup", selectedZone: DeliveryZone | undefined): number {
  if (orderType !== "delivery" || !selectedZone) return 0;
  return Number(selectedZone.fee);
}
