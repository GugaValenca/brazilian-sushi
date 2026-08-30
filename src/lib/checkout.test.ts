import { describe, expect, it } from "vitest";

import type { DeliveryZone } from "@/lib/catalog";

import { canSubmitOrder, computeDeliveryFee, type GuestDeliveryAddressInput, type OrderReadinessInput } from "./checkout";

const emptyGuestAddress: GuestDeliveryAddressInput = { line1: "", city: "", state: "", postalCode: "" };
const completeGuestAddress: GuestDeliveryAddressInput = {
  line1: "123 Main St",
  city: "Tampa",
  state: "FL",
  postalCode: "33602",
};

function readiness(overrides: Partial<OrderReadinessInput> = {}): OrderReadinessInput {
  return {
    hasItems: true,
    isSignedIn: false,
    guestName: "Ava Customer",
    guestEmail: "ava@example.com",
    guestPhone: "555-0100",
    orderType: "pickup",
    deliveryZoneId: undefined,
    deliveryAddressId: undefined,
    guestDeliveryAddress: emptyGuestAddress,
    ...overrides,
  };
}

const zone: DeliveryZone = {
  id: 1,
  name: "Downtown",
  postal_code: "60601",
  fee: "4.99",
  minimum_order: "15.00",
  average_minutes: 35,
  active: true,
};

describe("canSubmitOrder", () => {
  it("allows a guest pickup order once contact details are filled in", () => {
    expect(canSubmitOrder(readiness())).toBe(true);
  });

  it("blocks submission with an empty cart", () => {
    expect(canSubmitOrder(readiness({ hasItems: false }))).toBe(false);
  });

  it("blocks a guest order missing any contact field", () => {
    expect(canSubmitOrder(readiness({ guestEmail: "" }))).toBe(false);
    expect(canSubmitOrder(readiness({ guestName: "" }))).toBe(false);
    expect(canSubmitOrder(readiness({ guestPhone: "" }))).toBe(false);
  });

  it("does not require guest contact details once signed in", () => {
    const signedIn = canSubmitOrder(
      readiness({ isSignedIn: true, guestName: "", guestEmail: "", guestPhone: "" }),
    );

    expect(signedIn).toBe(true);
  });

  it("blocks a delivery order until a delivery zone is selected", () => {
    expect(
      canSubmitOrder(readiness({ orderType: "delivery", guestDeliveryAddress: completeGuestAddress })),
    ).toBe(false);
    expect(
      canSubmitOrder(
        readiness({ orderType: "delivery", deliveryZoneId: 1, guestDeliveryAddress: completeGuestAddress }),
      ),
    ).toBe(true);
  });

  it("blocks a guest delivery order until a complete address is entered", () => {
    expect(canSubmitOrder(readiness({ orderType: "delivery", deliveryZoneId: 1 }))).toBe(false);
    expect(
      canSubmitOrder(
        readiness({ orderType: "delivery", deliveryZoneId: 1, guestDeliveryAddress: { ...completeGuestAddress, city: "" } }),
      ),
    ).toBe(false);
    expect(
      canSubmitOrder(
        readiness({ orderType: "delivery", deliveryZoneId: 1, guestDeliveryAddress: completeGuestAddress }),
      ),
    ).toBe(true);
  });

  it("blocks a signed-in delivery order until a saved address is selected", () => {
    expect(
      canSubmitOrder(readiness({ isSignedIn: true, orderType: "delivery", deliveryZoneId: 1 })),
    ).toBe(false);
    expect(
      canSubmitOrder(
        readiness({ isSignedIn: true, orderType: "delivery", deliveryZoneId: 1, deliveryAddressId: 7 }),
      ),
    ).toBe(true);
  });

  it("never requires a delivery address for a pickup order", () => {
    expect(canSubmitOrder(readiness({ orderType: "pickup" }))).toBe(true);
    expect(canSubmitOrder(readiness({ isSignedIn: true, orderType: "pickup" }))).toBe(true);
  });
});

describe("computeDeliveryFee", () => {
  it("is always zero for pickup, even if a zone happens to be selected", () => {
    expect(computeDeliveryFee("pickup", zone)).toBe(0);
  });

  it("is zero for delivery until a zone is selected", () => {
    expect(computeDeliveryFee("delivery", undefined)).toBe(0);
  });

  it("charges the selected zone's fee for delivery", () => {
    expect(computeDeliveryFee("delivery", zone)).toBe(4.99);
  });
});
