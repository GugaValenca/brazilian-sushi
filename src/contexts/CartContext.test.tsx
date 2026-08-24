import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CartProvider, useCart } from "./CartContext";
import type { NormalizedMenuItem } from "@/lib/catalog";

const roll: NormalizedMenuItem = {
  id: "1",
  apiId: 1,
  name: "Brazilian Roll",
  description: "Cream cheese, mango, salmon",
  price: 15,
  image: "/roll.jpg",
  category: "Rolls",
};

const nigiri: NormalizedMenuItem = {
  id: "2",
  apiId: 2,
  name: "Salmon Nigiri",
  description: "Fresh salmon",
  price: 9,
  image: "/nigiri.jpg",
  category: "Nigiri",
};

describe("CartContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds an item and computes subtotal/totalItems", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(roll));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalItems).toBe(1);
    expect(result.current.subtotal).toBe(15);
  });

  it("increments quantity instead of duplicating when the same item is added again", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(roll));
    act(() => result.current.addItem(roll));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.subtotal).toBe(30);
  });

  it("removes an item that reaches quantity zero via updateQuantity", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(roll));
    act(() => result.current.updateQuantity(roll.id, 0));

    expect(result.current.items).toHaveLength(0);
  });

  it("clearCart empties the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.addItem(roll));
    act(() => result.current.addItem(nigiri));
    act(() => result.current.clearCart());

    expect(result.current.items).toHaveLength(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("persists the cart to localStorage across mounts", () => {
    const first = renderHook(() => useCart(), { wrapper: CartProvider });
    act(() => first.result.current.addItem(roll));

    const second = renderHook(() => useCart(), { wrapper: CartProvider });

    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0].item.name).toBe("Brazilian Roll");
  });
});
