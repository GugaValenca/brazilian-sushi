import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, BadgeCheck, MessageSquare, Percent, ShieldCheck, Ticket, TrendingUp, Truck } from "lucide-react";
import { toast } from "sonner";

import SectionHeading from "@/components/SectionHeading";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  createCoupon,
  createPromotion,
  fetchContactMessagesAdmin,
  fetchCouponsAdmin,
  fetchCustomers,
  fetchPromotionsAdmin,
  fetchReviewsAdmin,
  fetchStaffQueue,
  fetchStaffSummary,
  removeCustomerVerification,
  updateContactMessage,
  updateOrderStatus,
  updateReviewStatus,
  verifyCustomer,
} from "@/lib/staff";

const nowIso = new Date().toISOString().slice(0, 16);

const AdminDashboardPage = () => {
  usePageMeta({
    title: "Staff Dashboard | Brazilian Sushi",
    description: "Operational dashboard for Brazilian Sushi staff to manage orders, customers, reviews, promotions, and support.",
    robots: "noindex,nofollow",
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tokens, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const token = tokens?.access;

  const [promotionForm, setPromotionForm] = useState({
    title: "",
    description: "",
    audience: "all",
    starts_at: nowIso,
    ends_at: nowIso,
    active: true,
    featured: false,
  });
  const [couponForm, setCouponForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage",
    value: "10.00",
    minimum_order: "0.00",
    verified_only: false,
    active: true,
    starts_at: nowIso,
    ends_at: nowIso,
  });

  const { data: summary } = useQuery({ queryKey: ["staff-summary", token], queryFn: () => fetchStaffSummary(token!), enabled: Boolean(token && user?.is_staff) });
  const revenueChartData = useMemo(
    () =>
      (summary?.daily_revenue ?? []).map((point) => ({
        date: new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: Number(point.revenue),
      })),
    [summary?.daily_revenue],
  );
  const { data: staffQueue = [] } = useQuery({ queryKey: ["staff-queue", token], queryFn: () => fetchStaffQueue(token!), enabled: Boolean(token && user?.is_staff) });
  const { data: customers = [] } = useQuery({ queryKey: ["staff-customers", token], queryFn: () => fetchCustomers(token!), enabled: Boolean(token && user?.is_staff) });
  const { data: promotions = [] } = useQuery({ queryKey: ["staff-promotions", token], queryFn: () => fetchPromotionsAdmin(token!), enabled: Boolean(token && user?.is_staff) });
  const { data: coupons = [] } = useQuery({ queryKey: ["staff-coupons", token], queryFn: () => fetchCouponsAdmin(token!), enabled: Boolean(token && user?.is_staff) });
  const { data: reviews = [] } = useQuery({ queryKey: ["staff-reviews", token], queryFn: () => fetchReviewsAdmin(token!), enabled: Boolean(token && user?.is_staff) });
  const { data: contactMessages = [] } = useQuery({ queryKey: ["staff-contact", token], queryFn: () => fetchContactMessagesAdmin(token!), enabled: Boolean(token && user?.is_staff) });

  const refreshStaffData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-summary", token] }),
      queryClient.invalidateQueries({ queryKey: ["staff-queue", token] }),
      queryClient.invalidateQueries({ queryKey: ["staff-customers", token] }),
      queryClient.invalidateQueries({ queryKey: ["staff-promotions", token] }),
      queryClient.invalidateQueries({ queryKey: ["staff-coupons", token] }),
      queryClient.invalidateQueries({ queryKey: ["staff-reviews", token] }),
      queryClient.invalidateQueries({ queryKey: ["staff-contact", token] }),
    ]);
  };

  const orderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) => updateOrderStatus(token!, orderId, status),
    onSuccess: async () => {
      await refreshStaffData();
      toast.success("Order status updated");
    },
    onError: () => toast.error("Could not update order status."),
  });

  const customerVerificationMutation = useMutation({
    mutationFn: ({ customerId, verify }: { customerId: number; verify: boolean }) =>
      verify ? verifyCustomer(token!, customerId) : removeCustomerVerification(token!, customerId),
    onSuccess: async () => {
      await refreshStaffData();
      toast.success("Customer verification updated");
    },
    onError: () => toast.error("Could not update customer verification."),
  });

  const reviewStatusMutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: number; status: string }) => updateReviewStatus(token!, reviewId, status),
    onSuccess: async () => {
      await refreshStaffData();
      toast.success("Review moderation updated");
    },
    onError: () => toast.error("Could not update review status."),
  });

  const contactMutation = useMutation({
    mutationFn: ({ messageId, resolved }: { messageId: number; resolved: boolean }) => updateContactMessage(token!, messageId, resolved),
    onSuccess: async () => {
      await refreshStaffData();
      toast.success("Contact message updated");
    },
    onError: () => toast.error("Could not update contact message."),
  });

  const promotionMutation = useMutation({
    mutationFn: () => createPromotion(token!, promotionForm),
    onSuccess: async () => {
      setPromotionForm({ title: "", description: "", audience: "all", starts_at: nowIso, ends_at: nowIso, active: true, featured: false });
      await refreshStaffData();
      toast.success("Promotion created");
    },
    onError: () => toast.error("Could not create promotion."),
  });

  const couponMutation = useMutation({
    mutationFn: () => createCoupon(token!, couponForm),
    onSuccess: async () => {
      setCouponForm({ code: "", description: "", discount_type: "percentage", value: "10.00", minimum_order: "0.00", verified_only: false, active: true, starts_at: nowIso, ends_at: nowIso });
      await refreshStaffData();
      toast.success("Coupon created");
    },
    onError: () => toast.error("Could not create coupon."),
  });

  if (isAuthLoading) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-16">
        <div className="container max-w-3xl">
          <SectionHeading label="Operations" title="Staff Dashboard" subtitle="This area is available only for administrative or staff accounts." />
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground" role="status">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.is_staff || !token) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-16">
        <div className="container max-w-3xl">
          <SectionHeading label="Operations" title="Staff Dashboard" subtitle="This area is available only for administrative or staff accounts." />
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <p className="text-muted-foreground mb-6">You need a staff account to access this operational dashboard.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login" className="bg-gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold">Sign In</Link>
              <button type="button" onClick={() => navigate("/account")} className="border border-border px-6 py-3 rounded-lg font-semibold">Go to Account</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container max-w-7xl">
        <SectionHeading label="Operations" title="Staff Dashboard" subtitle="Manage incoming orders, customer verification, reviews, campaigns, coupons, and customer service from one place." />

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-2xl p-5"><p className="text-sm text-muted-foreground">Incoming orders</p><p className="text-3xl font-display font-bold mt-2">{summary?.received ?? 0}</p></div>
          <div className="bg-card border border-border rounded-2xl p-5"><p className="text-sm text-muted-foreground">In kitchen</p><p className="text-3xl font-display font-bold mt-2">{(summary?.confirmed ?? 0) + (summary?.preparing ?? 0)}</p></div>
          <div className="bg-card border border-border rounded-2xl p-5"><p className="text-sm text-muted-foreground">Ready / dispatch</p><p className="text-3xl font-display font-bold mt-2">{(summary?.ready ?? 0) + (summary?.out_for_delivery ?? 0)}</p></div>
          <div className="bg-card border border-border rounded-2xl p-5"><p className="text-sm text-muted-foreground">Delivered today snapshot</p><p className="text-3xl font-display font-bold mt-2">{summary?.delivered ?? 0}</p></div>
        </div>

        <section className="bg-card border border-border rounded-2xl p-6 mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
            <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" /> Revenue, last 7 days
            </h3>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>
                Total: <strong className="text-foreground text-base">${Number(summary?.revenue_last_7_days ?? 0).toFixed(2)}</strong>
              </span>
              {summary?.average_delivery_minutes != null && (
                <span>
                  Avg. delivery time: <strong className="text-foreground text-base">{summary.average_delivery_minutes} min</strong>
                </span>
              )}
            </div>
          </div>
          {revenueChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No delivered orders in the last 7 days yet.</p>
          ) : (
            <div className="h-56" role="img" aria-label="Line chart of revenue from delivered orders over the last 7 days">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => `$${value}`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-8">
          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2"><Truck className="w-5 h-5 text-primary" /> Live Order Queue</h3>
              <div className="space-y-4">
                {staffQueue.map((order) => (
                  <div key={order.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">Order #{order.id}</p>
                        <p className="text-sm text-muted-foreground mt-1">{order.order_type} · {order.status.replaceAll("_", " ")} · ${Number(order.total).toFixed(2)}</p>
                      </div>
                      <span className="text-sm text-primary font-semibold">{order.notification_preference.toUpperCase()}</span>
                    </div>
                    {(order.has_kitchen_notes || order.has_allergy_alert) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.has_kitchen_notes ? (
                          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            Kitchen notes
                          </span>
                        ) : null}
                        {order.has_allergy_alert ? (
                          <span className="inline-flex items-center rounded-full border border-destructive/35 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                            Allergy / dietary alert
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {order.notes ? (
                      <div className="mt-3 rounded-xl border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Order notes</p>
                        <p className="mt-2 text-sm text-foreground">{order.notes}</p>
                      </div>
                    ) : null}
                    {order.allergy_notes ? (
                      <div className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 p-3">
                        <p className="text-xs uppercase tracking-[0.24em] font-semibold text-destructive">Allergy or dietary restriction</p>
                        <p className="mt-2 text-sm text-foreground">{order.allergy_notes}</p>
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm text-muted-foreground">{order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", ")}</div>
                    <div className="flex flex-wrap gap-3 mt-4">
                      {["confirmed", "preparing", "ready", "out_for_delivery", "delivered"].map((status) => (
                        <button key={status} type="button" onClick={() => orderStatusMutation.mutate({ orderId: order.id, status })} className="text-xs border border-border rounded-full px-3 py-1.5 hover:border-primary/40">
                          {status.replaceAll("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2"><BadgeCheck className="w-5 h-5 text-primary" /> Customers</h3>
              <div className="space-y-3">
                {customers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between gap-4 border border-border rounded-xl p-4">
                    <div>
                      <p className="font-semibold">{customer.first_name} {customer.last_name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{customer.email} · Orders completed: {customer.loyalty_completed_orders}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => customerVerificationMutation.mutate({ customerId: customer.id, verify: !customer.is_verified_customer })}
                      className={`text-sm font-semibold px-4 py-2 rounded-lg ${customer.is_verified_customer ? "bg-secondary" : "bg-gradient-gold text-primary-foreground"}`}
                    >
                      {customer.is_verified_customer ? "Remove verification" : "Verify customer"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> Review Moderation</h3>
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{review.customer_name} · {review.rating} stars</p>
                        <p className="text-sm text-muted-foreground mt-1">{review.title}</p>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{review.approval_status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">{review.content}</p>
                    <div className="flex gap-3 mt-4">
                      <button type="button" onClick={() => reviewStatusMutation.mutate({ reviewId: review.id, status: "approved" })} className="text-sm font-semibold text-primary">Approve</button>
                      <button type="button" onClick={() => reviewStatusMutation.mutate({ reviewId: review.id, status: "rejected" })} className="text-sm font-semibold text-muted-foreground">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2"><Percent className="w-5 h-5 text-primary" /> Promotions</h3>
              <div className="space-y-3 text-sm">
                <input value={promotionForm.title} onChange={(e) => setPromotionForm((c) => ({ ...c, title: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-4 py-3" placeholder="Promotion title" />
                <textarea value={promotionForm.description} onChange={(e) => setPromotionForm((c) => ({ ...c, description: e.target.value }))} rows={3} className="w-full bg-background border border-border rounded-lg px-4 py-3 resize-none" placeholder="Promotion description" />
                <select value={promotionForm.audience} onChange={(e) => setPromotionForm((c) => ({ ...c, audience: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-4 py-3">
                  <option value="all">All customers</option><option value="verified">Verified customers</option><option value="returning">Returning customers</option><option value="pickup">Pickup customers</option><option value="delivery">Delivery customers</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="datetime-local" value={promotionForm.starts_at} onChange={(e) => setPromotionForm((c) => ({ ...c, starts_at: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3" />
                  <input type="datetime-local" value={promotionForm.ends_at} onChange={(e) => setPromotionForm((c) => ({ ...c, ends_at: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3" />
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={promotionForm.active} onChange={(e) => setPromotionForm((c) => ({ ...c, active: e.target.checked }))} /> Active</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={promotionForm.featured} onChange={(e) => setPromotionForm((c) => ({ ...c, featured: e.target.checked }))} /> Featured</label>
                </div>
                <button type="button" onClick={() => promotionMutation.mutate()} className="w-full bg-gradient-gold text-primary-foreground py-3 rounded-lg font-semibold">Create Promotion</button>
              </div>
              <div className="space-y-3">
                {promotions.slice(0, 5).map((promotion) => <div key={promotion.id} className="border border-border rounded-xl p-3 text-sm"><p className="font-semibold">{promotion.title}</p><p className="text-muted-foreground mt-1">{promotion.audience}</p></div>)}
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Coupons</h3>
              <div className="space-y-3 text-sm">
                <input value={couponForm.code} onChange={(e) => setCouponForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} className="w-full bg-background border border-border rounded-lg px-4 py-3" placeholder="Coupon code" />
                <input value={couponForm.description} onChange={(e) => setCouponForm((c) => ({ ...c, description: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-4 py-3" placeholder="Description" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={couponForm.discount_type} onChange={(e) => setCouponForm((c) => ({ ...c, discount_type: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3">
                    <option value="percentage">Percentage</option><option value="fixed">Fixed</option>
                  </select>
                  <input value={couponForm.value} onChange={(e) => setCouponForm((c) => ({ ...c, value: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3" placeholder="Value" />
                </div>
                <input value={couponForm.minimum_order} onChange={(e) => setCouponForm((c) => ({ ...c, minimum_order: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-4 py-3" placeholder="Minimum order" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="datetime-local" value={couponForm.starts_at} onChange={(e) => setCouponForm((c) => ({ ...c, starts_at: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3" />
                  <input type="datetime-local" value={couponForm.ends_at} onChange={(e) => setCouponForm((c) => ({ ...c, ends_at: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3" />
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={couponForm.active} onChange={(e) => setCouponForm((c) => ({ ...c, active: e.target.checked }))} /> Active</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={couponForm.verified_only} onChange={(e) => setCouponForm((c) => ({ ...c, verified_only: e.target.checked }))} /> Verified only</label>
                </div>
                <button type="button" onClick={() => couponMutation.mutate()} className="w-full border border-primary/30 py-3 rounded-lg font-semibold">Create Coupon</button>
              </div>
              <div className="space-y-3">
                {coupons.slice(0, 5).map((coupon) => <div key={coupon.id} className="border border-border rounded-xl p-3 text-sm"><p className="font-semibold">{coupon.code}</p><p className="text-muted-foreground mt-1">{coupon.description}</p></div>)}
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold inline-flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Contact Queue</h3>
              <div className="space-y-3">
                {contactMessages.map((message) => (
                  <div key={message.id} className="border border-border rounded-xl p-4">
                    <p className="font-semibold">{message.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{message.email} {message.phone ? `· ${message.phone}` : ""}</p>
                    <p className="text-sm text-muted-foreground mt-3">{message.message}</p>
                    <button type="button" onClick={() => contactMutation.mutate({ messageId: message.id, resolved: !message.resolved })} className="text-sm font-semibold text-primary mt-4">
                      {message.resolved ? "Mark unresolved" : "Mark resolved"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;


