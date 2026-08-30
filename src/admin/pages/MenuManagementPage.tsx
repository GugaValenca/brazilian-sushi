import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ChefHat, Layers, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { CategoryApiItem, MenuApiItem } from "@/lib/catalog";
import {
  type AdminCategoryPayload,
  type AdminMenuItemPayload,
  type AdminMenuOptionPayload,
  type AdminOptionGroupPayload,
  createCategory,
  createMenuItem,
  createMenuOption,
  createOptionGroup,
  deleteCategory,
  deleteMenuItem,
  deleteMenuOption,
  deleteOptionGroup,
  fetchAdminCategories,
  fetchAdminMenuItems,
  fetchMenuItemDetail,
  updateCategory,
  updateMenuItem,
  updateMenuOption,
  updateOptionGroup,
} from "@/lib/staff";
import ConfirmDialog from "@/admin/components/ConfirmDialog";
import DataTable from "@/admin/components/DataTable";
import EmptyState from "@/admin/components/EmptyState";
import FormDialog from "@/admin/components/FormDialog";
import FormField from "@/admin/components/FormField";
import { useAdminPageHeader } from "@/admin/hooks/useAdminPageHeader";

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "sold_out", label: "Sold out" },
  { value: "hidden", label: "Hidden" },
];

// -- Category management --------------------------------------------------

const emptyCategoryForm: AdminCategoryPayload = { name: "", slug: "", description: "", sort_order: 0 };

function CategoriesPanel({
  token,
  categories,
  isLoading,
  selectedSlug,
  onSelectSlug,
}: {
  token: string;
  categories: CategoryApiItem[];
  isLoading: boolean;
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryApiItem | null>(null);
  const [form, setForm] = useState<AdminCategoryPayload>(emptyCategoryForm);
  const [deleteTarget, setDeleteTarget] = useState<CategoryApiItem | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-categories", token] });

  const createMutation = useMutation({
    mutationFn: (payload: AdminCategoryPayload) => createCategory(token, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Category created");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the category."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: AdminCategoryPayload) => updateCategory(token, editing!.id, payload),
    onSuccess: async () => {
      await invalidate();
      setFormOpen(false);
      toast.success("Category updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the category."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(token, deleteTarget!.id),
    onSuccess: async () => {
      await invalidate();
      if (selectedSlug === deleteTarget?.slug) onSelectSlug("");
      setDeleteTarget(null);
      toast.success("Category deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the category. It may still have menu items."),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCategoryForm);
    setFormOpen(true);
  };

  const openEdit = (category: CategoryApiItem) => {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug, description: category.description, sort_order: category.sort_order });
    setFormOpen(true);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">Categories</h2>
        <Button type="button" size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading categories...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectSlug("")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              selectedSlug === "" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            All items
          </button>
          {categories.map((category) => (
            <div
              key={category.id}
              className={`flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-sm ${
                selectedSlug === category.slug ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <button type="button" onClick={() => onSelectSlug(category.slug)}>
                {category.name}
              </button>
              <button type="button" onClick={() => openEdit(category)} className="rounded-full p-1 hover:bg-black/5" aria-label={`Edit ${category.name}`}>
                <Pencil className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(category)}
                className="rounded-full p-1 hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${category.name}`}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit category" : "Add category"}
        onSubmit={() => (editing ? updateMutation.mutate(form) : createMutation.mutate(form))}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save changes" : "Create category"}
      >
        <FormField label="Name" htmlFor="category-name">
          <Input id="category-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </FormField>
        <FormField label="Slug" htmlFor="category-slug" hint="Used in the storefront URL and menu filters.">
          <Input id="category-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} required />
        </FormField>
        <FormField label="Description" htmlFor="category-description">
          <Textarea
            id="category-description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </FormField>
        <FormField label="Sort order" htmlFor="category-sort-order">
          <Input
            id="category-sort-order"
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
          />
        </FormField>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this category?"
        description={`"${deleteTarget?.name}" can only be deleted if it has no menu items left.`}
        confirmLabel="Delete category"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </section>
  );
}

// -- Option group / option management -------------------------------------

function ManageOptionsDialog({ token, item, onClose }: { token: string; item: MenuApiItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detailKey = ["admin-menu-item-detail", token, item.id];
  const { data: detail, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchMenuItemDetail(token, item.id),
  });

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: detailKey });
    await queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] });
  };

  const [newGroupName, setNewGroupName] = useState("");
  const addGroupMutation = useMutation({
    mutationFn: (payload: AdminOptionGroupPayload) => createOptionGroup(token, payload),
    onSuccess: async () => {
      await invalidateAll();
      setNewGroupName("");
      toast.success("Option group added");
    },
    onError: (error: Error) => toast.error(error.message || "Could not add the option group."),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AdminOptionGroupPayload> }) => updateOptionGroup(token, id, payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Option group updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the option group."),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => deleteOptionGroup(token, id),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Option group deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the option group."),
  });

  const addOptionMutation = useMutation({
    mutationFn: (payload: AdminMenuOptionPayload) => createMenuOption(token, payload),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Option added");
    },
    onError: (error: Error) => toast.error(error.message || "Could not add the option."),
  });

  const updateOptionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AdminMenuOptionPayload> }) => updateMenuOption(token, id, payload),
    onSuccess: async () => {
      await invalidateAll();
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the option."),
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (id: number) => deleteMenuOption(token, id),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Option deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the option."),
  });

  const [newOptionByGroup, setNewOptionByGroup] = useState<Record<number, { name: string; price_delta: string }>>({});

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Customization options</h2>
            <p className="text-sm text-muted-foreground">{item.name}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4">
            {(detail?.option_groups ?? []).map((group) => (
              <div key={group.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Input
                    value={group.name}
                    onChange={(event) => updateGroupMutation.mutate({ id: group.id, payload: { name: event.target.value } })}
                    className="h-8 max-w-[200px] font-medium"
                  />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5">
                      <Switch
                        checked={group.required}
                        onCheckedChange={(checked) => updateGroupMutation.mutate({ id: group.id, payload: { required: checked } })}
                      />
                      Required
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteGroupMutation.mutate(group.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <Input
                        value={option.name}
                        onChange={(event) => updateOptionMutation.mutate({ id: option.id, payload: { name: event.target.value } })}
                        className="h-8 flex-1"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        value={option.price_delta}
                        onChange={(event) => updateOptionMutation.mutate({ id: option.id, payload: { price_delta: event.target.value } })}
                        className="h-8 w-24"
                      />
                      <Button type="button" variant="ghost" size="sm" onClick={() => deleteOptionMutation.mutate(option.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="New option name"
                      value={newOptionByGroup[group.id]?.name ?? ""}
                      onChange={(event) =>
                        setNewOptionByGroup((current) => ({
                          ...current,
                          [group.id]: { name: event.target.value, price_delta: current[group.id]?.price_delta ?? "0.00" },
                        }))
                      }
                      className="h-8 flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newOptionByGroup[group.id]?.price_delta ?? ""}
                      onChange={(event) =>
                        setNewOptionByGroup((current) => ({
                          ...current,
                          [group.id]: { name: current[group.id]?.name ?? "", price_delta: event.target.value },
                        }))
                      }
                      className="h-8 w-24"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!newOptionByGroup[group.id]?.name}
                      onClick={() => {
                        const draft = newOptionByGroup[group.id];
                        if (!draft?.name) return;
                        addOptionMutation.mutate({
                          group: group.id,
                          name: draft.name,
                          price_delta: draft.price_delta || "0.00",
                          is_default: false,
                        });
                        setNewOptionByGroup((current) => ({ ...current, [group.id]: { name: "", price_delta: "" } }));
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Input
                placeholder="New group name (e.g. Choose your protein)"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!newGroupName || addGroupMutation.isPending}
                onClick={() => {
                  addGroupMutation.mutate({ menu_item: item.id, name: newGroupName, required: false, min_select: 0, max_select: 1 });
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Add group
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Items ------------------------------------------------------------------

const emptyItemForm: AdminMenuItemPayload = {
  category: 0,
  name: "",
  slug: "",
  short_description: "",
  description: "",
  price: "0.00",
  spicy: false,
  vegetarian: false,
  featured: false,
  allergens: "",
  calories: null,
  availability: "available",
};

const MenuManagementPage = () => {
  usePageMeta({ title: "Menu | Admin", description: "Manage the menu.", robots: "noindex,nofollow" });
  const { tokens } = useAuth();
  const token = tokens?.access;
  const queryClient = useQueryClient();

  const [selectedSlug, setSelectedSlug] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuApiItem | null>(null);
  const [form, setForm] = useState<AdminMenuItemPayload>(emptyItemForm);
  const [deleteTarget, setDeleteTarget] = useState<MenuApiItem | null>(null);
  const [optionsTarget, setOptionsTarget] = useState<MenuApiItem | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["admin-categories", token],
    queryFn: () => fetchAdminCategories(token!),
    enabled: Boolean(token),
  });

  const itemsQueryKey = ["admin-menu-items", token, selectedSlug, search];
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: itemsQueryKey,
    queryFn: () => fetchAdminMenuItems(token!, { category: selectedSlug || undefined, search: search || undefined }),
    enabled: Boolean(token),
  });

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ["admin-menu-items"] });

  const createMutation = useMutation({
    mutationFn: (payload: AdminMenuItemPayload) => createMenuItem(token!, payload),
    onSuccess: async () => {
      await invalidateItems();
      setFormOpen(false);
      toast.success("Menu item created");
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the menu item."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: AdminMenuItemPayload) => updateMenuItem(token!, editing!.id, payload),
    onSuccess: async () => {
      await invalidateItems();
      setFormOpen(false);
      toast.success("Menu item updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not update the menu item."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMenuItem(token!, deleteTarget!.id),
    onSuccess: async () => {
      await invalidateItems();
      setDeleteTarget(null);
      toast.success("Menu item deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete the menu item."),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyItemForm, category: categories?.[0]?.id ?? 0 });
    setFormOpen(true);
  };

  const openEdit = (item: MenuApiItem) => {
    setEditing(item);
    setForm({
      category: item.category,
      name: item.name,
      slug: item.slug,
      short_description: item.short_description,
      description: item.description,
      price: item.price,
      spicy: item.spicy,
      vegetarian: item.vegetarian,
      featured: item.featured,
      allergens: item.allergens,
      calories: item.calories,
      availability: item.availability as AdminMenuItemPayload["availability"],
    });
    setFormOpen(true);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const columns: ColumnDef<MenuApiItem, unknown>[] = [
    { accessorKey: "name", header: "Item" },
    {
      accessorKey: "category_name",
      header: "Category",
      // Lower-priority columns hide below xl instead of ever forcing a
      // horizontal scrollbar (page- or table-level) at a realistic window
      // width -- Item/Price/Availability/Actions stay visible at every size.
      meta: { className: "hidden xl:table-cell" },
    },
    { id: "price", header: "Price", cell: ({ row }) => `$${Number(row.original.price).toFixed(2)}` },
    {
      id: "availability",
      header: "Availability",
      cell: ({ row }) => (
        <span
          className={
            row.original.availability === "available"
              ? "inline-flex items-center rounded-full border border-sushi-green/20 bg-sushi-green/10 px-2.5 py-0.5 text-xs font-semibold text-sushi-green"
              : row.original.availability === "sold_out"
                ? "inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
                : "inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground"
          }
        >
          {AVAILABILITY_OPTIONS.find((option) => option.value === row.original.availability)?.label}
        </span>
      ),
    },
    {
      id: "options",
      header: "Options",
      cell: ({ row }) => row.original.option_groups.length,
      meta: { className: "hidden lg:table-cell" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOptionsTarget(row.original)}>
            <Layers className="h-3.5 w-3.5" aria-hidden="true" /> Options
          </Button>
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
    "Menu",
    "Manage categories, items, pricing, availability, and customization options.",
    <Button type="button" onClick={openCreate} disabled={!categories?.length}>
      <Plus className="h-4 w-4" aria-hidden="true" /> Add item
    </Button>,
  );

  return (
    <div className="space-y-6">
      {token && (
        <CategoriesPanel
          token={token}
          categories={categories ?? []}
          isLoading={categoriesLoading}
          selectedSlug={selectedSlug}
          onSelectSlug={setSelectedSlug}
        />
      )}

      <form onSubmit={handleSearchSubmit} className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search items by name"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <DataTable
        columns={columns}
        data={items?.results ?? []}
        isLoading={itemsLoading}
        emptyState={
          <EmptyState
            icon={ChefHat}
            title="No menu items yet"
            description="Add your first item to get the menu started."
            action={categories?.length ? (
              <Button type="button" size="sm" onClick={openCreate}>
                Add item
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Add a category first.</p>
            )}
          />
        }
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? "Edit menu item" : "Add menu item"}
        onSubmit={() => (editing ? updateMutation.mutate(form) : createMutation.mutate(form))}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save changes" : "Create item"}
      >
        <FormField label="Category" htmlFor="item-category">
          <Select value={String(form.category)} onValueChange={(value) => setForm((current) => ({ ...current, category: Number(value) }))}>
            <SelectTrigger id="item-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(categories ?? []).map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Name" htmlFor="item-name">
          <Input id="item-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </FormField>
        <FormField label="Slug" htmlFor="item-slug">
          <Input id="item-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} required />
        </FormField>
        <FormField label="Short description" htmlFor="item-short-description" hint="Shown on menu cards.">
          <Input
            id="item-short-description"
            value={form.short_description}
            onChange={(event) => setForm((current) => ({ ...current, short_description: event.target.value }))}
            required
          />
        </FormField>
        <FormField label="Full description" htmlFor="item-description">
          <Textarea
            id="item-description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Price ($)" htmlFor="item-price">
            <Input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Calories" htmlFor="item-calories">
            <Input
              id="item-calories"
              type="number"
              min="0"
              value={form.calories ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, calories: event.target.value ? Number(event.target.value) : null }))}
            />
          </FormField>
        </div>
        <FormField label="Allergens" htmlFor="item-allergens" hint="Comma-separated, e.g. shellfish, sesame.">
          <Input
            id="item-allergens"
            value={form.allergens}
            onChange={(event) => setForm((current) => ({ ...current, allergens: event.target.value }))}
          />
        </FormField>
        <FormField label="Availability" htmlFor="item-availability">
          <Select
            value={form.availability}
            onValueChange={(value) => setForm((current) => ({ ...current, availability: value as AdminMenuItemPayload["availability"] }))}
          >
            <SelectTrigger id="item-availability">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={form.spicy} onCheckedChange={(checked) => setForm((current) => ({ ...current, spicy: checked }))} /> Spicy
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={form.vegetarian} onCheckedChange={(checked) => setForm((current) => ({ ...current, vegetarian: checked }))} /> Vegetarian
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={form.featured} onCheckedChange={(checked) => setForm((current) => ({ ...current, featured: checked }))} /> Featured
          </label>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this menu item?"
        description={`"${deleteTarget?.name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete item"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      {optionsTarget && token && (
        <ManageOptionsDialog token={token} item={optionsTarget} onClose={() => setOptionsTarget(null)} />
      )}
    </div>
  );
};

export default MenuManagementPage;
