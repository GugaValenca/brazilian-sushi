import type { DeliveryZone } from "@/lib/catalog";

export interface GuestDeliveryAddressInput {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface OrderReadinessInput {
  hasItems: boolean;
  isSignedIn: boolean;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  orderType: "delivery" | "pickup";
  deliveryZoneId: number | undefined;
  /** A signed-in customer's selected saved address. Ignored for guests. */
  deliveryAddressId: number | undefined;
  /** A guest's inline delivery address fields. Ignored once signed in. */
  guestDeliveryAddress: GuestDeliveryAddressInput;
}

function hasCompleteGuestAddress(address: GuestDeliveryAddressInput): boolean {
  return Boolean(address.line1 && address.city && address.state && address.postalCode);
}

/** Whether the checkout form has everything it needs to submit an order.
 * Guests must supply contact details (an account already has them on file),
 * and a delivery order needs a zone selected so a fee can be charged --
 * plus an actual place to deliver to: one of the customer's saved
 * addresses once signed in, or a complete inline address for a guest.
 * Without this, a delivery order could be placed with a fee charged and
 * nowhere for the kitchen to actually send it. */
export function canSubmitOrder(input: OrderReadinessInput): boolean {
  if (!input.hasItems) return false;
  if (!input.isSignedIn && !(input.guestName && input.guestEmail && input.guestPhone)) return false;
  if (input.orderType === "delivery") {
    if (!input.deliveryZoneId) return false;
    if (input.isSignedIn) {
      if (!input.deliveryAddressId) return false;
    } else if (!hasCompleteGuestAddress(input.guestDeliveryAddress)) {
      return false;
    }
  }
  return true;
}

/** Pickup orders never carry a delivery fee; a delivery order does only once
 * a zone is selected — the fee always comes from the zone the server also
 * has on record, never typed in by the customer. */
export function computeDeliveryFee(orderType: "delivery" | "pickup", selectedZone: DeliveryZone | undefined): number {
  if (orderType !== "delivery" || !selectedZone) return 0;
  return Number(selectedZone.fee);
}
