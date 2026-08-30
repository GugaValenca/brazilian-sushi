import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { AlertTriangle, MapPin, MessageSquareText, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchAdminOrders, type AdminOrderListItem } from "@/lib/staff";
import DataTable from "@/admin/components/DataTable";
import StatusBadge from "@/admin/components/StatusBadge";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active (not delivered/cancelled)" },
  { value: "received", label: "Received" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const ACTIVE_STATUSES = ["received", "confirmed", "preparing", "ready", "out_for_delivery"];

const ORDER_TYPE_OPTIONS = [
  { value: "all", label: "All order types" },
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "not_required", label: "Not required" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const columns: ColumnDef<AdminOrderListItem, unknown>[] = [
  {
    accessorKey: "id",
    header: "Order",
    cell: ({ row }) => <span className="font-medium text-foreground">#{row.original.id}</span>,
  },
  {
    id: "guest",
    header: "Guest / Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.guest_name || "-"}</p>
        <p className="text-xs text-muted-foreground">{row.original.guest_email}</p>
      </div>
    ),
  },
  {
    accessorKey: "order_type",
    header: "Type",
    cell: ({ row }) => <span className="capitalize">{row.original.order_type}</span>,
    // Lower-priority columns hide below xl instead of ever forcing a
    // horizontal scrollbar (page- or table-level) at a realistic window
    // width -- Order/Guest/Status/Payment/Total stay visible at every size.
    meta: { className: "hidden xl:table-cell" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} kind="order" />,
  },
  {
    accessorKey: "payment_status",
    header: "Payment",
    cell: ({ row }) => <StatusBadge status={row.original.payment_status} kind="payment" />,
  },
  {
    id: "alerts",
    header: "",
    cell: ({ row }) =>
      row.original.has_allergy_alert || row.original.has_kitchen_notes || row.original.is_delivery_address_default === false ? (
        <div className="flex gap-1.5">
          {row.original.has_allergy_alert && <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Allergy alert" />}
          {row.original.has_kitchen_notes && <MessageSquareText className="h-4 w-4 text-primary" aria-label="Kitchen notes" />}
          {row.original.is_delivery_address_default === false && (
            <MapPin className="h-4 w-4 text-primary" aria-label="Delivering to a non-default address" />
          )}
        </div>
      ) : null,
    meta: { className: "hidden lg:table-cell" },
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => <span className="font-medium text-foreground">${Number(row.original.total).toFixed(2)}</span>,
  },
  {
    accessorKey: "created_at",
    header: "Placed",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    meta: { className: "hidden xl:table-cell" },
  },
];

const OrdersPage = () => {
  usePageMeta({ title: "Orders | Admin", description: "Manage incoming orders.", robots: "noindex,nofollow" });
  const navigate = useNavigate();
  const { tokens } = useAuth();
  const token = tokens?.access;

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 });

  const statusParam = statusFilter === "all" ? undefined : statusFilter === "active" ? ACTIVE_STATUSES : [statusFilter];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-orders", token, pagination.pageIndex, search, statusFilter, orderTypeFilter, paymentFilter],
    queryFn: () =>
      fetchAdminOrders(token!, {
        page: pagination.pageIndex + 1,
        search: search || undefined,
        status: statusParam,
        order_type: orderTypeFilter === "all" ? undefined : orderTypeFilter,
        payment_status: paymentFilter === "all" ? undefined : paymentFilter,
      }),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
  });

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSearch(searchInput.trim());
  };

  useAdminPageHeader("Orders", "Review live orders, update their status, and handle refunds.");

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-[220px] gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, or phone"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={orderTypeFilter}
          onValueChange={(value) => {
            setOrderTypeFilter(value);
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={paymentFilter}
          onValueChange={(value) => {
            setPaymentFilter(value);
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.results ?? []}
        isLoading={isLoading || (isFetching && !data)}
        onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
        manualPagination
        rowCount={data?.count ?? 0}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyState={<span className="text-sm text-muted-foreground">No orders match these filters.</span>}
      />
    </div>
  );
};

export default OrdersPage;
