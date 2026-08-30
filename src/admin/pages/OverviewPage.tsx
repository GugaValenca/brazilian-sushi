import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChefHat, MapPin, MessageSquare, Percent, Ticket, TrendingUp, Truck, Users } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchStaffSummary } from "@/lib/staff";
import PageHeader from "@/admin/components/PageHeader";

const QUICK_LINKS = [
  { to: "/admin/orders", label: "Orders", icon: Truck },
  { to: "/admin/menu", label: "Menu", icon: ChefHat },
  { to: "/admin/delivery-zones", label: "Delivery Zones", icon: MapPin },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/promotions", label: "Promotions", icon: Percent },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquare },
];

const OverviewPage = () => {
  usePageMeta({ title: "Overview | Admin", description: "Operations overview.", robots: "noindex,nofollow" });
  const { user, tokens } = useAuth();
  const token = tokens?.access;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["admin-summary", token],
    queryFn: () => fetchStaffSummary(token!),
    enabled: Boolean(token),
  });

  const revenueChartData = useMemo(
    () =>
      (summary?.daily_revenue ?? []).map((point) => ({
        date: new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: Number(point.revenue),
      })),
    [summary?.daily_revenue],
  );

  return (
    <div>
      <PageHeader title={`Welcome back${user?.first_name ? `, ${user.first_name}` : ""}`} description="Here's what's happening across the restaurant right now." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Incoming orders" value={summary?.received} isLoading={isLoading} />
        <SummaryCard label="In kitchen" value={(summary?.confirmed ?? 0) + (summary?.preparing ?? 0)} isLoading={isLoading} />
        <SummaryCard label="Ready / dispatch" value={(summary?.ready ?? 0) + (summary?.out_for_delivery ?? 0)} isLoading={isLoading} />
        <SummaryCard label="Delivered" value={summary?.delivered} isLoading={isLoading} />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" /> Revenue, last 7 days
          </h2>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>
              Total: <strong className="text-base text-foreground">${Number(summary?.revenue_last_7_days ?? 0).toFixed(2)}</strong>
            </span>
            {summary?.average_delivery_minutes != null && (
              <span>
                Avg. delivery: <strong className="text-base text-foreground">{summary.average_delivery_minutes} min</strong>
              </span>
            )}
          </div>
        </div>
        {revenueChartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No delivered orders in the last 7 days yet.</p>
        ) : (
          <div className="h-56" role="img" aria-label="Area chart of revenue from delivered orders over the last 7 days">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="admin-revenue-fill" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#admin-revenue-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-bold text-foreground">Jump to</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <link.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{link.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

function SummaryCard({ label, value, isLoading }: { label: string; value: number | undefined; isLoading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{isLoading ? "-" : value ?? 0}</p>
    </div>
  );
}

export default OverviewPage;
