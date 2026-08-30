import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, KeyRound, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  type AdminOrderListItem,
  fetchAdminCustomerDetail,
  fetchAdminOrders,
  removeCustomerVerification,
  setCustomerPassword,
  updateCustomer,
  verifyCustomer,
} from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import FormDialog from "@/admin/components/FormDialog";
import FormField from "@/admin/components/FormField";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";
import StatusBadge from "@/admin/components/StatusBadge";

const orderColumns: ColumnDef<AdminOrderListItem, unknown>[] = [
  { accessorKey: "id", header: "Order", cell: ({ row }) => `#${row.original.id}` },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} kind="order" /> },
  { accessorKey: "total", header: "Total", cell: ({ row }) => `$${Number(row.original.total).toFixed(2)}` },
  {
    accessorKey: "created_at",
    header: "Placed",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString("en-US"),
    meta: { className: "hidden lg:table-cell" },
  },
];

const CustomerDetailPage = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const { tokens, user: currentUser } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  usePageMeta({ title: `Customer #${customerId} | Admin`, description: "Customer detail.", robots: "noindex,nofollow" });

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [revokeStaffOpen, setRevokeStaffOpen] = useState(false);

  const queryKey = ["admin-customer", token, customerId];
  const { data: customer, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAdminCustomerDetail(token!, Number(customerId)),
    enabled: Boolean(token && customerId),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-customer-orders", token, customerId],
    queryFn: () => fetchAdminOrders(token!, { customer: Number(customerId) }),
    enabled: Boolean(token && customerId),
  });

  // Verifying/unverifying and granting/revoking staff access all change
  // fields shown on the Customers and Staff list pages too (the verified
  // badge, the staff/superuser columns) -- invalidating only this page's
  // own query left those lists showing stale data until a manual refresh.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] }),
    ]);

  const verifyMutation = useMutation({
    mutationFn: () => verifyCustomer(token!, Number(customerId)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Customer verified");
    },
    onError: () => toast.error("Could not verify this customer."),
  });

  const unverifyMutation = useMutation({
    mutationFn: () => removeCustomerVerification(token!, Number(customerId)),
    onSuccess: async () => {
      await invalidate();
      toast.success("Verification removed");
    },
    onError: () => toast.error("Could not update this customer."),
  });

  const staffMutation = useMutation({
    mutationFn: (is_staff: boolean) => updateCustomer(token!, Number(customerId), { is_staff }),
    onSuccess: async () => {
      await invalidate();
      setRevokeStaffOpen(false);
      toast.success("Access updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update staff access."),
  });

  const passwordMutation = useMutation({
    mutationFn: () => setCustomerPassword(token!, Number(customerId), password),
    onSuccess: () => {
      setPasswordOpen(false);
      setPassword("");
      toast.success("Password updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not set the password."),
  });

  useAdminPageHeader(
    customer ? `${customer.first_name} ${customer.last_name}`.trim() || customer.username : "Customer",
    customer?.email,
    customer?.is_verified_customer ? <StatusBadge status="Verified" kind="approval" /> : undefined,
  );

  if (isLoading || !customer) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading customer...</div>;
  }

  const canManageStaffAccess = Boolean(currentUser?.is_superuser);

  return (
    <div>
      <Link to="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to customers
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Order history</h2>
            <DataTable
              columns={orderColumns}
              data={orders?.results ?? []}
              isLoading={ordersLoading}
              emptyState={<EmptyState title="No orders from this customer yet" />}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Details</h2>
            <div className="space-y-1.5 text-sm">
              <p className="text-muted-foreground">Phone: <span className="text-foreground">{customer.phone_number || "-"}</span></p>
              <p className="text-muted-foreground">Completed orders: <span className="text-foreground">{customer.loyalty_completed_orders}</span></p>
              <p className="text-muted-foreground">Joined: <span className="text-foreground">{new Date(customer.date_joined).toLocaleDateString("en-US")}</span></p>
              <p className="text-muted-foreground">Staff account: <span className="text-foreground">{customer.is_staff ? "Yes" : "No"}</span></p>
              {customer.is_superuser && <p className="text-muted-foreground">Superuser: <span className="text-foreground">Yes</span></p>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Addresses</h2>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses -- pickup only, or not provided yet.</p>
            ) : (
              <div className="space-y-3">
                {customer.addresses.map((address) => (
                  <div key={address.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium text-foreground inline-flex items-center gap-2">
                      {address.label}
                      {address.is_default && <StatusBadge status="Default" kind="approval" />}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {address.line_1}
                      {address.line_2 ? `, ${address.line_2}` : ""} — {address.city}, {address.state} {address.postal_code}
                    </p>
                    <p className="text-muted-foreground">{address.recipient_name} · {address.phone_number}</p>
                    {address.delivery_notes && (
                      <p className="mt-1 italic text-muted-foreground">"{address.delivery_notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Verification</h2>
            <div className="space-y-2">
              {customer.is_verified_customer ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={unverifyMutation.isPending}
                  onClick={() => unverifyMutation.mutate()}
                >
                  <ShieldOff className="h-4 w-4" aria-hidden="true" /> Remove verification
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate()}
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verify customer
                </Button>
              )}
            </div>
          </section>

          {/* Only shown for a customer who is already staff (revoke + reset
              their password) -- granting staff access in the first place is
              deliberately not offered here. Every customer is technically
              eligible in the data model, but surfacing a one-click "make
              this person staff" button on every single customer's page
              made it look like a routine, low-stakes action. Granting stays
              exclusively on the Staff page's dedicated search-and-promote
              flow, a deliberate destination instead of an incidental one. */}
          {canManageStaffAccess && customer.is_staff && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">Staff access</h2>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setRevokeStaffOpen(true)}
                >
                  Revoke staff access
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => setPasswordOpen(true)}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Set password
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>

      <FormDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title="Set a new password"
        description="This immediately replaces the customer's current password."
        onSubmit={() => passwordMutation.mutate()}
        isSubmitting={passwordMutation.isPending}
        submitLabel="Set password"
      >
        <FormField label="New password" htmlFor="new-password" hint="At least 8 characters, not a common password.">
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </FormField>
      </FormDialog>

      <ConfirmDialog
        open={revokeStaffOpen}
        onOpenChange={setRevokeStaffOpen}
        title="Revoke staff access?"
        description={`${customer.first_name || customer.username} will no longer be able to sign in to the admin area.`}
        confirmLabel="Revoke access"
        destructive
        isLoading={staffMutation.isPending}
        onConfirm={() => staffMutation.mutate(false)}
      />
    </div>
  );
};

export default CustomerDetailPage;
