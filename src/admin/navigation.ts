import {
  BadgeCheck,
  ChefHat,
  MapPin,
  MessageSquare,
  Percent,
  Store,
  Ticket,
  Truck,
  Users,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Truck;
  end?: boolean;
  superuserOnly?: boolean;
}

// Shared between AdminLayout's sidebar and the Ctrl/Cmd+K command palette so
// the two navigation surfaces can never drift out of sync.
export const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Overview", icon: Store, end: true },
  { to: "/admin/orders", label: "Orders", icon: Truck },
  { to: "/admin/menu", label: "Menu", icon: ChefHat },
  { to: "/admin/delivery-zones", label: "Delivery Zones", icon: MapPin },
  { to: "/admin/customers", label: "Customers", icon: BadgeCheck },
  { to: "/admin/staff", label: "Staff", icon: Users, superuserOnly: true },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/promotions", label: "Promotions", icon: Percent },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
];
