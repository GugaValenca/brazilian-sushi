import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Ban, MapPin, MessageSquareText, Receipt, RefreshCcw, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchAdminOrderDetail, refundOrder, updateOrderStatus, type AdminOrderDetail } from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import StatusBadge from "@/admin/components/StatusBadge";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

/** Next legal status per current status, mirroring the order lifecycle this
 * app models (see orders/models.py Order.Status). Delivered/cancelled are
 * terminal -- the backend rejects any transition from either, but this also
 * keeps the UI from ever offering a dead-end action in the first place. */
function nextStatusOptions(order: AdminOrderDetail): { value: string; label: string }[] {
  switch (order.status) {
    case "received":
      return [{ value: "confirmed", label: "Confirm order" }];
    case "confirmed":
      return [{ value: "preparing", label: "Start preparing" }];
    case "preparing":
      return [{ value: "ready", label: "Mark ready" }];
    case "ready":
      return order.order_type === "delivery"
        ? [{ value: "out_for_delivery", label: "Send out for delivery" }]
        : [{ value: "delivered", label: "Mark picked up" }];
    case "out_for_delivery":
      return [{ value: "delivered", label: "Mark delivered" }];
    default:
      return [];
  }
}

const OrderDetailPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const { tokens } = useAuth();
  const token = tokens?.access;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  usePageMeta({ title: `Order #${orderId} | Admin`, description: "Order detail.", robots: "noindex,nofollow" });

  const queryKey = ["admin-order", token, orderId];
  const { data: order, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAdminOrderDetail(token!, Number(orderId)),
    enabled: Boolean(token && orderId),
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: string) => updateOrderStatus(token!, Number(orderId), nextStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order status updated");
    },
    onError: () => toast.error("Could not update the order status."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => updateOrderStatus(token!, Number(orderId), "cancelled"),
    onSuccess: async () => {
      setCancelOpen(false);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Order cancelled");
    },
    onError: () => toast.error("Could not cancel the order."),
  });

  const refundMutation = useMutation({
    mutationFn: () => refundOrder(token!, Number(orderId)),
    onSuccess: async () => {
      setRefundOpen(false);
      await queryClient.invalidateQueries({ queryKey });
      // A refund changes payment_status, shown in the Payment column on
      // the orders list -- missing here the same way it was on statusMutation/
      // cancelMutation above, just never noticed since a refund is rarer.
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Payment refunded");
    },
    onError: () => toast.error("Could not process the refund. Check the Stripe configuration."),
  });

  // Called unconditionally (before the loading early-return below) since
  // hooks can't follow it -- falls back to a plain title while the order is
  // still loading, then fills in the status badges once it arrives.
  useAdminPageHeader(
    order ? `Order #${order.id}` : "Order",
    order ? `Placed ${new Date(order.created_at).toLocaleString("en-US")}` : undefined,
    order ? (
      <>
        <StatusBadge status={order.status} kind="order" />
        <StatusBadge status={order.payment_status} kind="payment" />
      </>
    ) : undefined,
  );

  if (isLoading || !order) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading order...</div>;
  }

  const isTerminal = order.status === "delivered" || order.status === "cancelled";
  const canCancel = !isTerminal;
  const canRefund = order.payment_status === "paid";

  return (
    <div>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to orders
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          {(order.has_allergy_alert || order.has_kitchen_notes) && (
            <div className="space-y-2">
              {order.allergy_notes && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-destructive">Allergy / dietary restriction</p>
                    <p className="mt-1 text-foreground">{order.allergy_notes}</p>
                  </div>
                </div>
              )}
              {order.notes && (
                <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-primary">Order notes</p>
                    <p className="mt-1 text-foreground">{order.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Items</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-foreground">
                      {item.quantity}x {item.menu_item_name}
                    </p>
                    {item.selections.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.selections.map((s) => s.option_name).join(", ")}</p>
                    )}
                    {item.special_request && <p className="mt-0.5 text-xs italic text-muted-foreground">"{item.special_request}"</p>}
                  </div>
                  <span className="shrink-0 font-medium text-foreground">${Number(item.line_total).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${Number(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery fee</span>
                <span>${Number(order.delivery_fee).toFixed(2)}</span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount{order.coupon ? ` (${order.coupon.code})` : ""}</span>
                  <span>-${Number(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground">
                <span>Total</span>
                <span>${Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 inline-flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Receipt className="h-4 w-4 text-primary" aria-hidden="true" /> Status timeline
            </h2>
            <div className="space-y-3">
              {order.status_events.map((event) => (
                <div key={event.id} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-sm font-medium text-foreground capitalize">{event.status.replaceAll("_", " ")}</p>
                  {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("en-US")}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Actions</h2>
            <div className="space-y-2">
              {nextStatusOptions(order).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  className="w-full"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(option.value)}
                >
                  {option.label}
                </Button>
              ))}
              {canRefund && (
                <Button type="button" variant="outline" className="w-full" onClick={() => setRefundOpen(true)}>
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Refund payment
                </Button>
              )}
              {canCancel && (
                <Button type="button" variant="destructive" className="w-full" onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4" aria-hidden="true" /> Cancel order
                </Button>
              )}
              {isTerminal && !canRefund && (
                <p className="text-center text-sm text-muted-foreground">This order is {order.status} -- no further actions available.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Contact</h2>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-foreground">{order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() || order.customer.email : order.guest_name}</p>
              <p className="text-muted-foreground">{order.customer?.email ?? order.guest_email}</p>
              <p className="text-muted-foreground">{order.customer?.phone_number ?? order.guest_phone}</p>
              {order.customer?.is_verified_customer && <StatusBadge status="Verified" kind="approval" />}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-bold text-foreground">
              {order.order_type === "delivery" ? <MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> : <Truck className="h-4 w-4 text-primary" aria-hidden="true" />}
              {order.order_type === "delivery" ? "Delivery" : "Pickup"}
            </h2>
            {order.order_type === "delivery" && order.delivery_address ? (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{order.delivery_address.recipient_name}</p>
                <p>
                  {order.delivery_address.line_1}
                  {order.delivery_address.line_2 ? `, ${order.delivery_address.line_2}` : ""}
                </p>
                <p>
                  {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.postal_code}
                </p>
                {order.delivery_address.delivery_notes && <p className="mt-1 italic">"{order.delivery_address.delivery_notes}"</p>}
              </div>
            ) : order.order_type === "delivery" && order.guest_delivery_line_1 ? (
              // A guest's delivery order has no accounts.Address row (its
              // user FK is required) -- the address lives directly on the
              // order instead. See orders/models.py's guest_delivery_* fields.
              <div className="text-sm text-muted-foreground">
                <p>
                  {order.guest_delivery_line_1}
                  {order.guest_delivery_line_2 ? `, ${order.guest_delivery_line_2}` : ""}
                </p>
                <p>
                  {order.guest_delivery_city}, {order.guest_delivery_state} {order.guest_delivery_postal_code}
                </p>
                {order.guest_delivery_notes && <p className="mt-1 italic">"{order.guest_delivery_notes}"</p>}
              </div>
            ) : order.order_type === "delivery" ? (
              <p className="text-sm text-muted-foreground">No address on file for this order.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Customer will pick up in store.</p>
            )}
            {order.delivery_zone && (
              <p className="mt-2 text-xs text-muted-foreground">
                Zone: {order.delivery_zone.name} &middot; est. {order.delivery_zone.average_minutes} min
              </p>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this order?"
        description="This stops the order's workflow permanently. This cannot be undone -- if the customer already paid, you'll still need to refund them separately."
        confirmLabel="Cancel order"
        destructive
        isLoading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
      />

      <ConfirmDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title="Refund this payment?"
        description={`This refunds the full $${Number(order.total).toFixed(2)} charge through Stripe. This cannot be undone.`}
        confirmLabel="Refund payment"
        destructive
        isLoading={refundMutation.isPending}
        onConfirm={() => refundMutation.mutate()}
      />
    </div>
  );
};

export default OrderDetailPage;
