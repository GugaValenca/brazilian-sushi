import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Mail, MailOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  type StaffContactMessage,
  deleteContactMessage,
  fetchContactMessagesAdmin,
  updateContactMessage,
} from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

const STATUS_FILTERS = [
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All messages" },
];

const MessagesPage = () => {
  usePageMeta({ title: "Messages | Admin", description: "Review contact form submissions.", robots: "noindex,nofollow" });
  const { tokens } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("unresolved");
  const [deleteTarget, setDeleteTarget] = useState<StaffContactMessage | null>(null);

  const queryKey = ["admin-messages", token];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchContactMessagesAdmin(token!),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) => updateContactMessage(token!, id, resolved),
    onSuccess: async () => {
      await invalidate();
      toast.success("Message updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the message."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteContactMessage(token!, deleteTarget!.id),
    onSuccess: async () => {
      await invalidate();
      setDeleteTarget(null);
      toast.success("Message deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the message."),
  });

  const filteredMessages = useMemo(() => {
    const messages = data ?? [];
    if (statusFilter === "all") return messages;
    return messages.filter((message) => (statusFilter === "resolved" ? message.resolved : !message.resolved));
  }, [data, statusFilter]);

  const columns: ColumnDef<StaffContactMessage, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "phone",
      header: "Phone",
      // Lower-priority columns hide below xl instead of ever forcing a
      // horizontal scrollbar (page- or table-level) at a realistic window
      // width -- Name/Email/Message/Actions stay visible at every size.
      meta: { className: "hidden xl:table-cell" },
    },
    {
      id: "message",
      header: "Message",
      cell: ({ row }) => <p className="max-w-[14rem] truncate text-sm text-muted-foreground lg:max-w-md">{row.original.message}</p>,
    },
    {
      accessorKey: "created_at",
      header: "Received",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString("en-US"),
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resolveMutation.isPending}
            onClick={() => resolveMutation.mutate({ id: row.original.id, resolved: !row.original.resolved })}
          >
            {row.original.resolved ? (
              <>
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Reopen
              </>
            ) : (
              <>
                <MailOpen className="h-3.5 w-3.5" aria-hidden="true" /> Mark resolved
              </>
            )}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(row.original)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  useAdminPageHeader("Messages", "Contact form submissions from the website.");

  return (
    <div>
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
        data={filteredMessages}
        isLoading={isLoading}
        emptyState={<EmptyState icon={Mail} title="No messages match this filter" />}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this message?"
        description="This permanently removes the message. This cannot be undone."
        confirmLabel="Delete message"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};

export default MessagesPage;
