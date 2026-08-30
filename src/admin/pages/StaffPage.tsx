import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Search, ShieldCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchAdminCustomers, updateCustomer, type StaffCustomer } from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

const StaffPage = () => {
  usePageMeta({ title: "Staff | Admin", description: "Manage staff access.", robots: "noindex,nofollow" });
  const navigate = useNavigate();
  const { tokens, user: currentUser } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [revokeTarget, setRevokeTarget] = useState<StaffCustomer | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantSearchInput, setGrantSearchInput] = useState("");
  const [grantSearch, setGrantSearch] = useState("");

  const staffQueryKey = ["admin-staff", token];
  const { data, isLoading } = useQuery({
    queryKey: staffQueryKey,
    queryFn: () => fetchAdminCustomers(token!, { is_staff: "true" }),
    enabled: Boolean(token),
  });

  const { data: candidates, isFetching: candidatesLoading } = useQuery({
    queryKey: ["admin-staff-candidates", token, grantSearch],
    queryFn: () => fetchAdminCustomers(token!, { search: grantSearch, is_staff: "false" }),
    enabled: Boolean(token) && grantOpen && grantSearch.length > 0,
  });

  // Granting/revoking here changes the is_staff/is_superuser columns the
  // Customers list and a customer's own detail page also show -- without
  // this they'd keep showing stale data until a manual refresh, the same
  // gap CustomerDetailPage's own grant/revoke actions had.
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: staffQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-customer"] }),
    ]);

  const grantMutation = useMutation({
    mutationFn: (customerId: number) => updateCustomer(token!, customerId, { is_staff: true }),
    onSuccess: async () => {
      await invalidate();
      setGrantOpen(false);
      setGrantSearchInput("");
      setGrantSearch("");
      toast.success("Staff access granted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not grant staff access."),
  });

  const revokeMutation = useMutation({
    mutationFn: () => updateCustomer(token!, revokeTarget!.id, { is_staff: false }),
    onSuccess: async () => {
      await invalidate();
      setRevokeTarget(null);
      toast.success("Staff access revoked");
    },
    onError: (error: Error) => toast.error(error.message || "Could not revoke staff access."),
  });

  const handleGrantSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setGrantSearch(grantSearchInput.trim());
  };

  // Called unconditionally (before the superuser early-return below) since
  // hooks can't follow it -- the description/action are only shown once
  // authorization is confirmed, same as everything else on this page.
  useAdminPageHeader(
    "Staff",
    currentUser?.is_superuser ? "Superuser-only: grant or revoke access to the admin area." : undefined,
    currentUser?.is_superuser ? (
      <Button type="button" onClick={() => setGrantOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden="true" /> Grant access
      </Button>
    ) : undefined,
  );

  // The sidebar already hides this link from non-superusers, but that's a
  // display nicety, not a guard -- anyone can type /admin/staff directly.
  if (!currentUser?.is_superuser) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Superuser access required"
        description="Only superusers can manage staff access. Ask an existing superuser to grant it if you need this page."
      />
    );
  }

  const columns: ColumnDef<StaffCustomer, unknown>[] = [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">
            {`${row.original.first_name} ${row.original.last_name}`.trim() || row.original.username}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) =>
        row.original.is_superuser ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Superuser
          </span>
        ) : (
          "Staff"
        ),
    },
    {
      accessorKey: "date_joined",
      header: "Joined",
      cell: ({ row }) => new Date(row.original.date_joined).toLocaleDateString("en-US"),
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/admin/customers/${row.original.id}`)}>
            Manage
          </Button>
          {row.original.id !== currentUser?.id && (
            <Button type="button" variant="destructive" size="sm" onClick={() => setRevokeTarget(row.original)}>
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        data={data?.results ?? []}
        isLoading={isLoading}
        emptyState={<EmptyState title="No staff accounts yet" />}
      />

      {grantOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-24" onClick={() => setGrantOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-1 font-display text-lg font-bold text-foreground">Grant staff access</h2>
            <p className="mb-4 text-sm text-muted-foreground">Search for an existing customer account to promote to staff.</p>
            <form onSubmit={handleGrantSearchSubmit} className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={grantSearchInput}
                  onChange={(event) => setGrantSearchInput(event.target.value)}
                  placeholder="Search by name or email"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {candidatesLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
              {!candidatesLoading && grantSearch && candidates?.results.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching customers found.</p>
              )}
              {candidates?.results.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={grantMutation.isPending}
                  onClick={() => grantMutation.mutate(candidate.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border p-2.5 text-left text-sm hover:border-primary/40 hover:bg-primary/5"
                >
                  <span>
                    <span className="block font-medium text-foreground">
                      {`${candidate.first_name} ${candidate.last_name}`.trim() || candidate.username}
                    </span>
                    <span className="block text-xs text-muted-foreground">{candidate.email}</span>
                  </span>
                  <span className="text-xs font-semibold text-primary">Grant</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setGrantOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke staff access?"
        description={`${revokeTarget?.first_name || revokeTarget?.username} will no longer be able to sign in to the admin area.`}
        confirmLabel="Revoke access"
        destructive
        isLoading={revokeMutation.isPending}
        onConfirm={() => revokeMutation.mutate()}
      />

      <p className="mt-6 text-xs text-muted-foreground">
        Looking for a specific customer to promote?{" "}
        <Link to="/admin/customers" className="text-primary hover:underline">
          Browse all customers
        </Link>
        .
      </p>
    </div>
  );
};

export default StaffPage;
