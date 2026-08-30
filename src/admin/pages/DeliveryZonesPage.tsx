import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { DeliveryZone } from "@/lib/catalog";
import {
  type AdminDeliveryZonePayload,
  createDeliveryZone,
  deleteDeliveryZone,
  fetchAdminDeliveryZones,
  updateDeliveryZone,
} from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import FormDialog from "@/admin/components/FormDialog";
import FormField from "@/admin/components/FormField";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

const emptyForm: AdminDeliveryZonePayload = {
  name: "",
  postal_code: "",
  fee: "0.00",
  minimum_order: "0.00",
  average_minutes: 45,
  active: true,
};

const DeliveryZonesPage = () => {
  usePageMeta({ title: "Delivery Zones | Admin", description: "Manage delivery zones.", robots: "noindex,nofollow" });
  const { tokens } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AdminDeliveryZonePayload>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryZone | null>(null);

  const queryKey = ["admin-delivery-zones", token];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAdminDeliveryZones(token!),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (payload: AdminDeliveryZonePayload) => createDeliveryZone(token!, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Delivery zone created");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the delivery zone."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: AdminDeliveryZonePayload) => updateDeliveryZone(token!, editing!.id, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Delivery zone updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the delivery zone."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeliveryZone(token!, deleteTarget!.id),
    onSuccess: async () => {
      await invalidate();
      setDeleteTarget(null);
      toast.success("Delivery zone deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the delivery zone."),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditing(zone);
    setForm({
      name: zone.name,
      postal_code: zone.postal_code,
      fee: zone.fee,
      minimum_order: zone.minimum_order,
      average_minutes: zone.average_minutes,
      active: zone.active,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (editing) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const columns: ColumnDef<DeliveryZone, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "postal_code", header: "Postal code" },
    { id: "fee", header: "Fee", cell: ({ row }) => `$${Number(row.original.fee).toFixed(2)}` },
    {
      id: "minimum_order",
      header: "Min. order",
      cell: ({ row }) => `$${Number(row.original.minimum_order).toFixed(2)}`,
      // Lower-priority columns hide below xl instead of ever forcing a
      // horizontal scrollbar (page- or table-level) at a realistic window
      // width -- Name/Postal code/Fee/Status/Actions stay visible always.
      meta: { className: "hidden xl:table-cell" },
    },
    { accessorKey: "average_minutes", header: "Est. minutes", meta: { className: "hidden lg:table-cell" } },
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
    "Delivery Zones",
    "Manage the postal codes, fees, and estimated delivery times customers see at checkout.",
    <Button type="button" onClick={openCreate}>
      <Plus className="h-4 w-4" aria-hidden="true" /> Add zone
    </Button>,
  );

  return (
    <div>
      <DataTable
        columns={columns}
        data={data?.results ?? []}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={MapPin}
            title="No delivery zones yet"
            description="Add a zone to start offering delivery in a postal code."
            action={
              <Button type="button" size="sm" onClick={openCreate}>
                Add zone
              </Button>
            }
          />
        }
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit delivery zone" : "Add delivery zone"}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save changes" : "Create zone"}
      >
        <FormField label="Name" htmlFor="zone-name">
          <Input
            id="zone-name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </FormField>
        <FormField label="Postal code" htmlFor="zone-postal-code">
          <Input
            id="zone-postal-code"
            value={form.postal_code}
            onChange={(event) => setForm((current) => ({ ...current, postal_code: event.target.value }))}
            required
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Delivery fee ($)" htmlFor="zone-fee">
            <Input
              id="zone-fee"
              type="number"
              step="0.01"
              min="0"
              value={form.fee}
              onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Minimum order ($)" htmlFor="zone-minimum-order">
            <Input
              id="zone-minimum-order"
              type="number"
              step="0.01"
              min="0"
              value={form.minimum_order}
              onChange={(event) => setForm((current) => ({ ...current, minimum_order: event.target.value }))}
              required
            />
          </FormField>
        </div>
        <FormField label="Estimated delivery time (minutes)" htmlFor="zone-average-minutes">
          <Input
            id="zone-average-minutes"
            type="number"
            min="1"
            value={form.average_minutes}
            onChange={(event) => setForm((current) => ({ ...current, average_minutes: Number(event.target.value) }))}
            required
          />
        </FormField>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted-foreground">Inactive zones are hidden from checkout.</p>
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
        title="Delete this delivery zone?"
        description={`"${deleteTarget?.name}" will no longer be offered at checkout. This cannot be undone.`}
        confirmLabel="Delete zone"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};

export default DeliveryZonesPage;
