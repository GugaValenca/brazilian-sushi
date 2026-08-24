import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, ShieldCheck, Truck } from "lucide-react";

import SectionHeading from "@/components/SectionHeading";
import { usePageMeta } from "@/hooks/usePageMeta";
import { trackOrder } from "@/lib/catalog";

const statusLabels: Record<string, string> = {
  received: "Order received",
  confirmed: "Confirmed",
  preparing: "In preparation",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const statusSteps = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"];

const OrderTrackingPage = () => {
  usePageMeta({
    title: "Track Order | Brazilian Sushi",
    description: "Securely track your Brazilian Sushi delivery or pickup order with live status updates.",
    robots: "noindex,nofollow",
  });

  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order") ?? "";
  const token = searchParams.get("token") ?? "";
  const paymentJustSucceeded = searchParams.get("payment") === "success";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["track-order", orderId, token],
    queryFn: () => trackOrder(orderId, token),
    enabled: Boolean(orderId && token),
    refetchInterval: 20_000,
  });

  const activeStepIndex = useMemo(() => {
    if (!data) return -1;
    return statusSteps.indexOf(data.status);
  }, [data]);

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container max-w-5xl">
        <SectionHeading
          label="Order Tracking"
          title="Track Your Order"
          subtitle="Follow each step of your order, from confirmation to pickup or delivery."
        />

        {paymentJustSucceeded && (
          <div
            role="status"
            className="max-w-3xl mx-auto mb-8 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-center font-medium"
          >
            Payment confirmed — thank you! Your order is on its way to the kitchen.
          </div>
        )}

        {!orderId || !token ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">Tracking details are missing. Please open your confirmation link or place a new order.</p>
          </div>
        ) : isLoading ? (
          <div className="bg-card border border-border rounded-2xl p-8 animate-pulse space-y-4">
            <div className="h-6 bg-secondary rounded w-1/3" />
            <div className="h-4 bg-secondary rounded w-1/2" />
            <div className="h-24 bg-secondary rounded" />
          </div>
        ) : isError || !data ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">We could not find this order. Double-check the tracking link and try again.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-primary font-medium">Order #{data.id}</p>
                  <h2 className="text-3xl font-display font-bold mt-2">{statusLabels[data.status] ?? data.status}</h2>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 justify-end"><Clock className="w-4 h-4" /> {data.estimated_minutes} min est.</p>
                  {data.average_delivery_time && <p className="mt-1">Avg. completed time: {data.average_delivery_time} min</p>}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">Order type</p>
                  <p className="font-semibold mt-1 capitalize">{data.order_type}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">Notifications</p>
                  <p className="font-semibold mt-1 uppercase">{data.notification_preference}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold mt-1">${Number(data.total).toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-4">
                {statusSteps.map((step, index) => {
                  const active = index <= activeStepIndex;
                  return (
                    <div key={step} className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${active ? "bg-gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                        {step === "out_for_delivery" ? <Truck className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium">{statusLabels[step]}</p>
                        <p className="text-sm text-muted-foreground">{active ? "In progress or already completed" : "Coming up next"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="text-xl font-display font-bold mb-3">Order Items</h3>
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 border border-border rounded-xl p-4">
                      <div>
                        <p className="font-semibold">{item.menu_item_name}</p>
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                      </div>
                      <span className="font-semibold">${Number(item.line_total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="bg-card border border-border rounded-2xl p-6 h-fit">
              <h3 className="text-xl font-display font-bold mb-4">Status Timeline</h3>
              <div className="space-y-4">
                {data.status_events.map((event) => (
                  <div key={event.id} className="border-l-2 border-primary/30 pl-4">
                    <p className="font-medium">{statusLabels[event.status] ?? event.status}</p>
                    {event.note && <p className="text-sm text-muted-foreground mt-1">{event.note}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <Link to="/menu" className="inline-flex items-center gap-2 text-primary font-semibold mt-6 hover:underline underline-offset-4">
                Start a new order <ArrowRight className="w-4 h-4" />
              </Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;
