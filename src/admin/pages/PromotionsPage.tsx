import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Percent, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  type StaffPromotion,
  createPromotion,
  deletePromotion,
  fetchPromotionsAdmin,
  updatePromotion,
} from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import FormDialog from "@/admin/components/FormDialog";
import FormField from "@/admin/components/FormField";
import PageHeader from "@/admin/components/PageHeader";

function toDatetimeLocal(value: string) {
  return value ? value.slice(0, 16) : "";
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All customers" },
  { value: "verified", label: "Verified customers" },
  { value: "returning", label: "Returning customers" },
  { value: "pickup", label: "Pickup customers" },
  { value: "delivery", label: "Delivery customers" },
];

const emptyForm: StaffPromotion = {
  title: "",
  description: "",
  audience: "all",
  active: true,
  featured: false,
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

const PromotionsPage = () => {
  usePageMeta({ title: "Promotions | Admin", description: "Manage marketing promotions.", robots: "noindex,nofollow" });
  const { tokens } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<StaffPromotion | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StaffPromotion>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<StaffPromotion | null>(null);

  const queryKey = ["admin-promotions", token];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPromotionsAdmin(token!),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (payload: StaffPromotion) => createPromotion(token!, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Promotion created");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the promotion."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: StaffPromotion) => updatePromotion(token!, editing!.id!, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Promotion updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the promotion."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePromotion(token!, deleteTarget!.id!),
    onSuccess: async () => {
      await invalidate();
      setDeleteTarget(null);
      toast.success("Promotion deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the promotion."),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (promotion: StaffPromotion) => {
    setEditing(promotion);
    setForm(promotion);
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

  const columns: ColumnDef<StaffPromotion, unknown>[] = [
    { accessorKey: "title", header: "Title" },
    {
      id: "audience",
      header: "Audience",
      cell: ({ row }) => AUDIENCE_OPTIONS.find((option) => option.value === row.original.audience)?.label ?? row.original.audience,
    },
    {
      id: "window",
      header: "Runs",
      cell: ({ row }) =>
        `${new Date(row.original.starts_at).toLocaleDateString("en-US")} - ${new Date(row.original.ends_at).toLocaleDateString("en-US")}`,
    },
    { id: "featured", header: "Featured", cell: ({ row }) => (row.original.featured ? "Yes" : "No") },
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

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Manage the marketing promotions shown to customers on the site."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add promotion
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={Percent}
            title="No promotions yet"
            description="Create a promotion to feature it on the site."
            action={
              <Button type="button" size="sm" onClick={openCreate}>
                Add promotion
              </Button>
            }
          />
        }
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit promotion" : "Add promotion"}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save changes" : "Create promotion"}
      >
        <FormField label="Title" htmlFor="promotion-title">
          <Input
            id="promotion-title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
        </FormField>
        <FormField label="Description" htmlFor="promotion-description">
          <Textarea
            id="promotion-description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            required
          />
        </FormField>
        <FormField label="Audience" htmlFor="promotion-audience">
          <Select
            value={form.audience}
            onValueChange={(value) => setForm((current) => ({ ...current, audience: value }))}
          >
            <SelectTrigger id="promotion-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Starts" htmlFor="promotion-starts-at">
            <Input
              id="promotion-starts-at"
              type="datetime-local"
              value={toDatetimeLocal(form.starts_at)}
              onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Ends" htmlFor="promotion-ends-at">
            <Input
              id="promotion-ends-at"
              type="datetime-local"
              value={toDatetimeLocal(form.ends_at)}
              onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))}
              required
            />
          </FormField>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Featured</p>
            <p className="text-xs text-muted-foreground">Featured promotions get priority placement.</p>
          </div>
          <Switch
            checked={form.featured}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, featured: checked }))}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted-foreground">Inactive promotions are hidden from customers.</p>
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
        title="Delete this promotion?"
        description={`"${deleteTarget?.title}" will be removed from the site. This cannot be undone.`}
        confirmLabel="Delete promotion"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};

export default PromotionsPage;
