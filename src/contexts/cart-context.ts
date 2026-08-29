import { createContext } from "react";

import type { NormalizedMenuItem } from "@/lib/catalog";

export interface CartItem {
  item: NormalizedMenuItem;
  quantity: number;
}

export interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: NormalizedMenuItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

// Split from CartContext.tsx (which only exports the CartProvider component)
// and useCart.ts (which only exports the hook) so each file exports exactly
// one thing and Fast Refresh can hot-reload the provider reliably.
export const CartContext = createContext<CartContextValue | undefined>(undefined);
