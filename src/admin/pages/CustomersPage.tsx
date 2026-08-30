import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ColumnDef, type PaginationState } from "@tanstack/react-table";
import { BadgeCheck, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import { fetchAdminCustomers, type StaffCustomer } from "@/lib/staff";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import PageHeader from "@/admin/components/PageHeader";

const columns: ColumnDef<StaffCustomer, unknown>[] = [
  {
    id: "name",
    header: "Customer",
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">
          {`${row.original.first_name} ${row.original.last_name}`.trim() || row.original.username}
        </p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  { accessorKey: "phone_number", header: "Phone" },
  {
    id: "verified",
    header: "Verified",
    cell: ({ row }) =>
      row.original.is_verified_customer ? (
        <span className="inline-flex items-center gap-1 text-sushi-green">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  { accessorKey: "loyalty_completed_orders", header: "Completed orders" },
  {
    id: "staff",
    header: "Staff",
    cell: ({ row }) => (row.original.is_staff ? "Yes" : "No"),
  },
  {
    accessorKey: "date_joined",
    header: "Joined",
    cell: ({ row }) => new Date(row.original.date_joined).toLocaleDateString("en-US"),
  },
];

const CustomersPage = () => {
  usePageMeta({ title: "Customers | Admin", description: "Manage customer accounts.", robots: "noindex,nofollow" });
  const navigate = useNavigate();
  const { tokens } = useAuth();
  const token = tokens?.access;

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 12 });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-customers", token, pagination.pageIndex, search],
    queryFn: () => fetchAdminCustomers(token!, { page: pagination.pageIndex + 1, search: search || undefined }),
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
  });

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setSearch(searchInput.trim());
  };

  return (
    <div>
      <PageHeader title="Customers" description="Look up customer accounts, verification status, and order history." />

      <form onSubmit={handleSearchSubmit} className="mb-4 flex max-w-md gap-2">
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

      <DataTable
        columns={columns}
        data={data?.results ?? []}
        isLoading={isLoading || (isFetching && !data)}
        onRowClick={(customer) => navigate(`/admin/customers/${customer.id}`)}
        manualPagination
        rowCount={data?.count ?? 0}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyState={<EmptyState icon={Users} title="No customers match this search" />}
      />
    </div>
  );
};

export default CustomersPage;
