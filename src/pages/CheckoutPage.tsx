import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, MapPin, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import SectionHeading from "@/components/SectionHeading";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { usePageMeta } from "@/hooks/usePageMeta";
import { createOrder, fetchDeliveryZones } from "@/lib/catalog";

const CheckoutPage = () => {
  usePageMeta({
    title: "Checkout | Brazilian Sushi",
    description: "Finalize your Brazilian Sushi order with delivery or pickup, preferences, notes, and secure guest checkout.",
    robots: "noindex,nofollow",
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentWasCancelled = searchParams.get("payment") === "cancelled";
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const { user, tokens, isAuthenticated } = useAuth();
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [allergyNotes, setAllergyNotes] = useState("");
  const [notificationPreference, setNotificationPreference] = useState<"sms" | "email" | "both">("both");
  const [deliveryZoneId, setDeliveryZoneId] = useState<number | undefined>(undefined);

  const { data: deliveryZones } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: fetchDeliveryZones,
    staleTime: 1000 * 60 * 30,
  });

  const selectedZone = useMemo(
    () => deliveryZones?.find((zone) => zone.id === deliveryZoneId),
    [deliveryZoneId, deliveryZones],
  );

  const deliveryFee = orderType === "delivery" ? Number(selectedZone?.fee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const isSignedIn = Boolean(isAuthenticated && user && tokens?.access);

  const orderMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createOrder>[0]) => createOrder(payload, tokens?.access),
    onSuccess: (order) => {
      // When Stripe is configured on the backend, the order response
      // includes a checkout_url priced entirely from what the server just
      // computed — send the customer there to actually pay. The cart is
      // kept until payment is confirmed: if they cancel on Stripe and land
      // back on /checkout, their items are still here to try again.
      // Without Stripe configured, checkout_url is simply absent and
      // nothing here changes from before payments existed.
      if (order.checkout_url) {
        window.location.assign(order.checkout_url);
        return;
      }
      clearCart();
      toast.success("Order placed successfully");
      navigate(`/track-order?order=${order.id}&token=${order.tracking_token}`);
    },
    onError: () => {
      toast.error("We could not place your order right now.");
    },
  });

  const canSubmit = items.length > 0 && (isSignedIn || (guestName && guestEmail && guestPhone)) && (orderType === "pickup" || deliveryZoneId);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    orderMutation.mutate({
      order_type: orderType,
      delivery_zone: orderType === "delivery" ? deliveryZoneId : undefined,
      guest_name: isSignedIn ? undefined : guestName,
      guest_email: isSignedIn ? undefined : guestEmail,
      guest_phone: isSignedIn ? undefined : guestPhone,
      notes,
      allergy_notes: allergyNotes,
      notification_preference: isSignedIn ? undefined : notificationPreference,
      items: items.map((entry) => ({
        menu_item_id: entry.item.apiId,
        quantity: entry.quantity,
      })),
    });
  };

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container">
        <SectionHeading
          label="Checkout"
          title="Complete Your Order"
          subtitle="Review your selections, choose delivery or pickup, and confirm the order notes our kitchen should see before service begins."
        />

        {paymentWasCancelled && (
          <div
            role="status"
            className="max-w-2xl mx-auto mb-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-center text-destructive"
          >
            Payment was cancelled. Your cart is unchanged — review your order and try again whenever you're ready.
          </div>
        )}

        {items.length === 0 ? (
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-10 text-center">
            <ShoppingBag className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold mb-3">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add a few favorites from the menu to begin your delivery or pickup order.</p>
            <Link to="/menu" className="inline-flex items-center gap-2 bg-gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold">
              Browse Menu <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-8 max-w-6xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-xl font-display font-bold mb-4">Order Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button type="button" onClick={() => setOrderType("delivery")} className={`rounded-xl border p-4 text-left ${orderType === "delivery" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <span className="font-semibold">Delivery</span>
                    <p className="text-sm text-muted-foreground mt-1">Freshly prepared and sent to your address.</p>
                  </button>
                  <button type="button" onClick={() => setOrderType("pickup")} className={`rounded-xl border p-4 text-left ${orderType === "pickup" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <span className="font-semibold">Pickup</span>
                    <p className="text-sm text-muted-foreground mt-1">Skip the delivery fee and pick it up at your convenience.</p>
                  </button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-display font-bold">{isSignedIn ? "Account Details" : "Guest Details"}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isSignedIn
                        ? "These details come directly from your account profile. Edit them in your account if anything needs to change."
                        : "Enter the contact details we should use for this order and its updates."}
                    </p>
                  </div>
                  {isSignedIn ? (
                    <Link
                      to="/account"
                      className="inline-flex items-center justify-center rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold"
                    >
                      Edit Information
                    </Link>
                  ) : null}
                </div>

                {isSignedIn ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Full name</p>
                      <p className="mt-2 text-base font-semibold whitespace-normal break-words">{`${user.first_name} ${user.last_name}`.trim() || user.username}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Phone</p>
                      <p className="mt-2 text-base font-semibold whitespace-normal break-words">{user.phone_number || "Not provided"}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/60 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Email</p>
                      <p className="mt-2 text-base font-semibold whitespace-normal break-all">{user.email}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/60 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Notification preference</p>
                      <p className="mt-2 text-base font-semibold">
                        {user.notification_preference === "both"
                          ? "SMS + Email updates"
                          : user.notification_preference === "sms"
                            ? "SMS updates"
                            : "Email updates"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="guest-name" className="text-sm font-semibold">Full Name</label>
                        <input id="guest-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} required placeholder="Full name" className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="guest-phone" className="text-sm font-semibold">Phone Number</label>
                        <input id="guest-phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required placeholder="Phone number" className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="guest-email" className="text-sm font-semibold">Email Address</label>
                      <input id="guest-email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required type="email" placeholder="Email address" className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Notification Preference</p>
                      <div className="grid sm:grid-cols-3 gap-3">
                        {([
                          ["sms", "SMS"],
                          ["email", "Email"],
                          ["both", "SMS + Email"],
                        ] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setNotificationPreference(value)}
                            className={`rounded-xl border px-4 py-3 text-sm font-medium ${notificationPreference === value ? "border-primary bg-primary/5" : "border-border"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-xl font-display font-bold">Order Details</h3>
                <p className="text-sm text-muted-foreground">
                  Add only what the kitchen and delivery team should know for this specific order.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="order-notes" className="text-sm font-semibold">Order Notes</label>
                    <textarea id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Extra napkins, sauce preferences, pickup timing, or any special request for this order" className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="order-allergy-notes" className="text-sm font-semibold text-destructive">Allergies or Dietary Restrictions</label>
                    <textarea id="order-allergy-notes" value={allergyNotes} onChange={(e) => setAllergyNotes(e.target.value)} rows={4} placeholder="Tell us about any allergy, ingredient restriction, or dietary concern that must be treated with extra care" className="w-full bg-background border border-destructive/40 rounded-lg px-4 py-3 text-sm resize-none" />
                    <p className="text-xs text-destructive/90">Orders with allergy or dietary restriction notes are highlighted for the kitchen.</p>
                  </div>
                </div>
              </div>

              {orderType === "delivery" && (
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <h3 className="text-xl font-display font-bold">Delivery Zone</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {deliveryZones?.map((zone) => (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => setDeliveryZoneId(zone.id)}
                        className={`rounded-xl border p-4 text-left ${deliveryZoneId === zone.id ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold">{zone.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1"><MapPin className="w-4 h-4" /> {zone.postal_code}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${Number(zone.fee).toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4" /> {zone.average_minutes} min</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" disabled={!canSubmit || orderMutation.isPending} className="w-full bg-gradient-gold text-primary-foreground py-4 rounded-xl font-semibold disabled:opacity-70">
                {orderMutation.isPending ? "Sending your order..." : "Place Order"}
              </button>
            </form>

            <aside className="bg-card border border-border rounded-2xl p-6 h-fit sticky top-28">
              <h3 className="text-xl font-display font-bold mb-5">Order Summary</h3>
              <div className="space-y-4">
                {items.map((entry) => (
                  <div key={entry.item.id} className="border-b border-border pb-4">
                    <div className="flex gap-4">
                      <img
                        src={entry.item.image || "/favicon.ico"}
                        alt={entry.item.name}
                        loading="lazy"
                        decoding="async"
                        className="w-20 h-20 rounded-lg object-cover bg-secondary/50"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{entry.item.name}</p>
                            <p className="text-sm text-muted-foreground">${entry.item.price.toFixed(2)} each</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(entry.item.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${entry.item.name} from cart`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="inline-flex items-center border border-border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateQuantity(entry.item.id, entry.quantity - 1)}
                              className="px-3 py-2"
                              aria-label={`Decrease quantity of ${entry.item.name}`}
                            >
                              <Minus className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <span className="px-3 text-sm font-medium" aria-live="polite">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(entry.item.id, entry.quantity + 1)}
                              className="px-3 py-2"
                              aria-label={`Increase quantity of ${entry.item.name}`}
                            >
                              <Plus className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <span className="font-semibold">${(entry.item.price * entry.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 mt-6 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>${deliveryFee.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-semibold pt-3 border-t border-border"><span>Total</span><span>${total.toFixed(2)}</span></div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;
