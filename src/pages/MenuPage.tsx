import { useMemo, useState } from "react";
import { Search, Flame, Leaf, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import SectionHeading from "@/components/SectionHeading";
import MenuCard from "@/components/MenuCard";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { categories as fallbackCategories, menuItems as fallbackItems } from "@/data/menuData";
import { usePageMeta } from "@/hooks/usePageMeta";
import { addFavorite, fetchFavorites, removeFavorite, type FavoriteItem } from "@/lib/account";
import { fetchCategories, fetchMenuItems, normalizeMenuItem } from "@/lib/catalog";

const MenuPage = () => {
  usePageMeta({
    title: "Brazilian Sushi Menu | Rolls, Sashimi, Combos & Delivery",
    description: "Browse the Brazilian Sushi menu with premium rolls, sashimi, combos, vegetarian options, filters, and quick online ordering.",
  });

  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showSpicy, setShowSpicy] = useState(false);
  const [showVeg, setShowVeg] = useState(false);
  const { addItem } = useCart();
  const { tokens, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const token = tokens?.access;

  const { data: menuApiItems, isLoading } = useQuery({
    queryKey: ["menu-items"],
    queryFn: () => fetchMenuItems(),
    staleTime: 1000 * 60 * 10,
  });
  const hasApiItems = (menuApiItems?.length ?? 0) > 0;

  const { data: categoriesApi } = useQuery({
    queryKey: ["menu-categories"],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 30,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["account-favorites", token],
    queryFn: () => fetchFavorites(token!),
    enabled: Boolean(token),
  });

  const addFavoriteMutation = useMutation({
    mutationFn: (menuItemId: number) => addFavorite(token!, menuItemId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-favorites", token] });
      toast.success("Added to favorites");
    },
    onError: () => toast.error("Could not add favorite right now."),
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (favoriteId: number) => removeFavorite(token!, favoriteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-favorites", token] });
      toast.success("Removed from favorites");
    },
    onError: () => toast.error("Could not remove favorite right now."),
  });

  const favoritesByMenuItem = useMemo(() => new Map(favorites.map((favorite) => [favorite.menu_item, favorite])), [favorites]);

  const categories = useMemo(() => {
    const liveCategories = categoriesApi?.map((category) => category.name) ?? [];
    return liveCategories.length ? ["All", ...liveCategories] : fallbackCategories;
  }, [categoriesApi]);

  const sourceItems = useMemo(() => {
    return hasApiItems && menuApiItems ? menuApiItems.map(normalizeMenuItem) : fallbackItems;
  }, [hasApiItems, menuApiItems]);

  const filtered = useMemo(() => {
    let items = sourceItems;
    if (activeCategory !== "All") items = items.filter((item) => item.category === activeCategory);
    if (showSpicy) items = items.filter((item) => item.spicy);
    if (showVeg) items = items.filter((item) => item.vegetarian);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
    }
    return items;
  }, [activeCategory, search, showSpicy, showVeg, sourceItems]);

  const handleToggleFavorite = (item: (typeof filtered)[number]) => {
    if (!isAuthenticated || !token) {
      toast.error("Sign in to save favorites");
      return;
    }

    const existingFavorite = favoritesByMenuItem.get(item.apiId) as FavoriteItem | undefined;
    if (existingFavorite) {
      removeFavoriteMutation.mutate(existingFavorite.id);
      return;
    }

    addFavoriteMutation.mutate(item.apiId);
  };

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container">
        <SectionHeading
          label="Our Selection"
          title="The Menu"
          subtitle="Explore signature rolls, pristine sashimi, comforting starters, and composed combinations prepared with care."
        />

        <div className="max-w-3xl mx-auto mb-10 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rolls, sashimi, combos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-12 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`text-sm px-4 py-2 rounded-full border transition-all ${
                  activeCategory === category
                    ? "bg-gradient-gold text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowSpicy(!showSpicy)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                showSpicy ? "bg-sushi-red/20 border-sushi-red/40 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Spicy
            </button>
            <button
              onClick={() => setShowVeg(!showVeg)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                showVeg ? "bg-sushi-green/20 border-sushi-green/40 text-sushi-green" : "border-border text-muted-foreground"
              }`}
            >
              <Leaf className="w-3.5 h-3.5" /> Vegetarian
            </button>
          </div>
        </div>

        {isLoading && !hasApiItems ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-square bg-secondary" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-secondary rounded" />
                  <div className="h-4 bg-secondary rounded" />
                  <div className="h-4 w-1/2 bg-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((item, index) => (
              <MenuCard
                key={item.id}
                item={item}
                index={index}
                isFavorite={favoritesByMenuItem.has(item.apiId)}
                onToggleFavorite={handleToggleFavorite}
                onAddToCart={(selectedItem) => {
                  addItem(selectedItem);
                  toast.success(`${selectedItem.name} added to cart`);
                }}
              />
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <p className="text-muted-foreground text-lg">No dishes matched your selection. Try another category or a broader search.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MenuPage;
