import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  type StaffCoupon,
  createCoupon,
  deleteCoupon,
  fetchCouponsAdmin,
  updateCoupon,
} from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import FormDialog from "@/admin/components/FormDialog";
import FormField from "@/admin/components/FormField";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

function toDatetimeLocal(value: string) {
  return value ? value.slice(0, 16) : "";
}

const emptyForm: StaffCoupon = {
  code: "",
  description: "",
  discount_type: "percentage",
  value: "10.00",
  minimum_order: "0.00",
  verified_only: false,
  active: true,
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

const CouponsPage = () => {
  usePageMeta({ title: "Coupons | Admin", description: "Manage discount coupons.", robots: "noindex,nofollow" });
  const { tokens } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<StaffCoupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StaffCoupon>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<StaffCoupon | null>(null);

  const queryKey = ["admin-coupons", token];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCouponsAdmin(token!),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (payload: StaffCoupon) => createCoupon(token!, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Coupon created");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the coupon."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: StaffCoupon) => updateCoupon(token!, editing!.id!, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Coupon updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the coupon."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCoupon(token!, deleteTarget!.id!),
    onSuccess: async () => {
      await invalidate();
      setDeleteTarget(null);
      toast.success("Coupon deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the coupon."),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (coupon: StaffCoupon) => {
    setEditing(coupon);
    setForm(coupon);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
    };
    if (editing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns: ColumnDef<StaffCoupon, unknown>[] = [
    { accessorKey: "code", header: "Code" },
    {
      accessorKey: "description",
      header: "Description",
      // Lower-priority columns hide below xl instead of ever forcing a
      // horizontal scrollbar (page- or table-level) at a realistic window
      // width -- Code/Discount/Status/Actions stay visible at every size.
      meta: { className: "hidden xl:table-cell" },
    },
    {
      id: "value",
      header: "Discount",
      cell: ({ row }) =>
        row.original.discount_type === "percentage"
          ? `${Number(row.original.value)}%`
          : `$${Number(row.original.value).toFixed(2)}`,
    },
    {
      id: "minimum_order",
      header: "Min. order",
      cell: ({ row }) => `$${Number(row.original.minimum_order).toFixed(2)}`,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "verified_only",
      header: "Verified only",
      cell: ({ row }) => (row.original.verified_only ? "Yes" : "No"),
      meta: { className: "hidden xl:table-cell" },
    },
    {
      id: "active",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={
            row.original.active
              ? "inline-flex items-center rounded-full border border-sushi-green/20 bg-sushi-green/10 px-2.5 py-0.5 text-xs font-semibold text-sushi-green"
              : "inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground"
          }
        >
          {row.original.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row.original)}>
            Edit
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(row.original)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  useAdminPageHeader(
    "Coupons",
    "Create and manage discount codes customers can apply at checkout.",
    <Button type="button" onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden="true" /> Add coupon
    </Button>,
  );

  return (
    <div>
      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Ticket}
            title="No coupons yet"
            description="Create a coupon to offer customers a discount."
            action={
              <Button type="button" size="sm" onClick={openCreate}>
                Add coupon
              </Button>
            }
          />
        }
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit coupon" : "Add coupon"}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save changes" : "Create coupon"}
      >
        <FormField label="Code" htmlFor="coupon-code">
          <Input
            id="coupon-code"
            value={form.code}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
            required
          />
        </FormField>
        <FormField label="Description" htmlFor="coupon-description">
          <Input
            id="coupon-description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            required
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Discount type" htmlFor="coupon-discount-type">
            <Select
              value={form.discount_type}
              onValueChange={(value) => setForm((current) => ({ ...current, discount_type: value }))}
            >
              <SelectTrigger id="coupon-discount-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed amount</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Value" htmlFor="coupon-value">
            <Input
              id="coupon-value"
              type="number"
              step="0.01"
              min="0"
              value={form.value}
              onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
              required
            />
          </FormField>
        </div>
        <FormField label="Minimum order ($)" htmlFor="coupon-minimum-order">
          <Input
            id="coupon-minimum-order"
            type="number"
            step="0.01"
            min="0"
            value={form.minimum_order}
            onChange={(event) => setForm((current) => ({ ...current, minimum_order: event.target.value }))}
            required
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Starts" htmlFor="coupon-starts-at">
            <Input
              id="coupon-starts-at"
              type="datetime-local"
              value={toDatetimeLocal(form.starts_at)}
              onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Ends" htmlFor="coupon-ends-at">
            <Input
              id="coupon-ends-at"
              type="datetime-local"
              value={toDatetimeLocal(form.ends_at)}
              onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))}
              required
            />
          </FormField>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Verified customers only</p>
            <p className="text-xs text-muted-foreground">Only verified customers can redeem this coupon.</p>
          </div>
          <Switch
            checked={form.verified_only}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, verified_only: checked }))}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted-foreground">Inactive coupons are rejected at checkout.</p>
          </div>
          <Switch
            checked={form.active}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked }))}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this coupon?"
        description={`"${deleteTarget?.code}" will no longer be redeemable. This cannot be undone.`}
        confirmLabel="Delete coupon"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};

export default CouponsPage;
