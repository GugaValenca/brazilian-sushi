import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MessageSquare, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { type StaffReview, deleteReview, fetchReviewsAdmin, updateReviewStatus } from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import PageHeader from "@/admin/components/PageHeader";
import StatusBadge from "@/admin/components/StatusBadge";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const ReviewsPage = () => {
  usePageMeta({ title: "Reviews | Admin", description: "Moderate customer reviews.", robots: "noindex,nofollow" });
  const { tokens } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("pending");
  const [deleteTarget, setDeleteTarget] = useState<StaffReview | null>(null);

  const queryKey = ["admin-reviews", token];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchReviewsAdmin(token!),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const statusMutation = useMutation({
    mutationFn: ({ id, approval_status }: { id: number; approval_status: string }) =>
      updateReviewStatus(token!, id, approval_status),
    onSuccess: async () => {
      await invalidate();
      toast.success("Review updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the review."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReview(token!, deleteTarget!.id),
    onSuccess: async () => {
      await invalidate();
      setDeleteTarget(null);
      toast.success("Review deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the review."),
  });

  const filteredReviews = useMemo(() => {
    const reviews = data ?? [];
    if (statusFilter === "all") return reviews;
    return reviews.filter((review) => review.approval_status === statusFilter);
  }, [data, statusFilter]);

  const columns: ColumnDef<StaffReview, unknown>[] = [
    { accessorKey: "customer_name", header: "Customer" },
    {
      id: "rating",
      header: "Rating",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1">
          {row.original.rating} <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
        </span>
      ),
    },
    { accessorKey: "title", header: "Title" },
    {
      id: "content",
      header: "Review",
      cell: ({ row }) => <p className="max-w-sm truncate text-sm text-muted-foreground">{row.original.content}</p>,
    },
    {
      accessorKey: "approval_status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.approval_status} kind="approval" />,
    },
    {
      accessorKey: "created_at",
      header: "Submitted",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString("en-US"),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {row.original.approval_status !== "approved" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: row.original.id, approval_status: "approved" })}
            >
              Approve
            </Button>
          )}
          {row.original.approval_status !== "rejected" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: row.original.id, approval_status: "rejected" })}
            >
              Reject
            </Button>
          )}
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(row.original)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Reviews" description="Approve or reject customer reviews before they appear on the site." />

      <div className="mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredReviews}
        isLoading={isLoading}
        emptyState={<EmptyState icon={MessageSquare} title="No reviews match this filter" />}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this review?"
        description="This permanently removes the review. This cannot be undone."
        confirmLabel="Delete review"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};

export default ReviewsPage;
