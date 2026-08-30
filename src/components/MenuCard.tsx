import { motion } from "framer-motion";
import { Flame, Heart, Leaf } from "lucide-react";

import type { NormalizedMenuItem } from "@/lib/catalog";

interface MenuCardProps {
  item: NormalizedMenuItem;
  index?: number;
  onAddToCart?: (item: NormalizedMenuItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (item: NormalizedMenuItem) => void;
}

const MenuCard = ({ item, index = 0, onAddToCart, isFavorite = false, onToggleFavorite }: MenuCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ duration: 0.5, delay: index * 0.08 }}
    className="group bg-card rounded-xl overflow-hidden border border-border hover:border-primary/30 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.28)] transition-all duration-300"
  >
    <div className="relative aspect-square overflow-hidden bg-secondary/40">
      <img
        src={item.image || "/favicon.ico"}
        alt={item.name}
        loading={index < 4 ? "eager" : "lazy"}
        fetchPriority={index < 2 ? "high" : "auto"}
        decoding="async"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent opacity-70 pointer-events-none" />
      {item.featured && (
        <span className="absolute top-3 left-3 bg-gradient-gold text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
          Featured
        </span>
      )}
      <div className="absolute top-3 right-3 flex gap-1.5">
        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            className={`p-1.5 rounded-full ${isFavorite ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground"}`}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        )}
        {item.spicy && (
          <span className="bg-sushi-red/90 p-1.5 rounded-full" title="Spicy">
            <Flame className="w-3.5 h-3.5 text-foreground" />
          </span>
        )}
        {item.vegetarian && (
          <span className="bg-sushi-green/90 p-1.5 rounded-full" title="Vegetarian">
            <Leaf className="w-3.5 h-3.5 text-foreground" />
          </span>
        )}
      </div>
    </div>
    <div className="p-4">
      <h3 className="font-display font-semibold text-lg">{item.name}</h3>
      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{item.description}</p>
      {item.allergens && item.allergens.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {item.allergens.map((a) => (
            <span key={a} className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {a}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-4 gap-3">
        <span className="text-primary font-bold text-lg">${item.price.toFixed(2)}</span>
        <button
          type="button"
          onClick={() => onAddToCart?.(item)}
          className="bg-gradient-gold text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-95 hover:shadow-[0_12px_30px_rgba(160,122,44,0.25)] transition-all"
        >
          Add to Cart
        </button>
      </div>
    </div>
  </motion.div>
);

export default MenuCard;
