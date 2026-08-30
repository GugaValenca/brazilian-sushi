import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Phone, ArrowRight, Star, Clock, Shield, Truck } from "lucide-react";

import heroImage from "@/assets/hero-sushi.jpg";
import SectionHeading from "@/components/SectionHeading";
import MenuCard from "@/components/MenuCard";
import { menuItems } from "@/data/menuData";
import { fetchFeaturedItems, fetchPromotions, fetchReviews, normalizeMenuItem } from "@/lib/catalog";
import { businessInfo } from "@/lib/site";
import { usePageMeta } from "@/hooks/usePageMeta";

const fallbackFeatured = menuItems.filter((item) => item.featured).slice(0, 4);

const benefits = [
  { icon: Truck, title: "Fast Delivery", desc: "Carefully packed and delivered fresh" },
  { icon: Shield, title: "Verified Rewards", desc: "Exclusive perks for returning guests" },
  { icon: Clock, title: "Order Tracking", desc: "Clear updates from kitchen to doorstep" },
  { icon: Star, title: "Premium Quality", desc: "Selected ingredients and precise preparation" },
];

const storyHighlights = [
  { label: "Prepared to order", value: "Freshly composed in small batches throughout service." },
  { label: "Japanese precision", value: "Balanced cuts, clean flavors, and careful presentation." },
  { label: "Brazilian warmth", value: "A subtle house signature that keeps the experience memorable." },
];

const fallbackPromotions = [
  { id: 1, title: "First Order 15% Off", description: "Use code WELCOME15 at checkout on your first order of $25 or more.", audience: "all" },
  { id: 2, title: "Verified Combo Upgrade", description: "Verified guests receive a complimentary miso soup with any combo order this week.", audience: "verified" },
];

const fallbackReviews = [
  { id: 1, customer_name: "Maria S.", rating: 5, content: "Beautiful presentation, balanced flavors, and rolls that arrive tasting as fresh as they look.", is_verified_customer: true, title: "Amazing", customer_photo: null, approval_status: "approved", created_at: new Date().toISOString() },
  { id: 2, customer_name: "James L.", rating: 5, content: "The sashimi is consistently pristine and the hand rolls have that just-made texture you expect from a premium spot.", is_verified_customer: true, title: "Premium", customer_photo: null, approval_status: "approved", created_at: new Date().toISOString() },
  { id: 3, customer_name: "Ana P.", rating: 5, content: "Refined, flavorful, and easy to order. It feels elevated without losing the warmth of a neighborhood favorite.", is_verified_customer: true, title: "Favorite", customer_photo: null, approval_status: "approved", created_at: new Date().toISOString() },
];

const Index = () => {
  usePageMeta({
    title: "Brazilian Sushi | Premium Sushi Delivery & Takeout",
    description: "Order premium sushi delivery or pickup from Brazilian Sushi. Explore featured rolls, combos, verified customer benefits, and premium takeout experience.",
  });

  const { data: featuredItems } = useQuery({
    queryKey: ["featured-items"],
    queryFn: fetchFeaturedItems,
    staleTime: 1000 * 60 * 10,
  });

  const { data: promotions } = useQuery({
    queryKey: ["promotions"],
    queryFn: fetchPromotions,
    staleTime: 1000 * 60 * 10,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews"],
    queryFn: fetchReviews,
    staleTime: 1000 * 60 * 10,
  });

  const featured = featuredItems?.length ? featuredItems.slice(0, 4).map(normalizeMenuItem) : fallbackFeatured;
  const promotionCards = promotions?.length ? promotions.slice(0, 2) : fallbackPromotions;
  const reviewCards = reviews?.length ? reviews.slice(0, 3) : fallbackReviews;

  return (
    <div className="min-h-screen">
      <section className="relative h-screen min-h-[600px] flex items-center">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Premium sushi platter"
            width={1920}
            height={1080}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
        </div>
        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-2xl">
            <span className="inline-flex items-center gap-3 text-primary text-sm uppercase tracking-[0.25em] font-medium mb-4">
              <span className="h-px w-10 bg-primary/40" />
              Delivery & Takeout
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-[1.1] mb-6">
              Japanese Art, <span className="text-gradient-gold">Brazilian Soul</span>
            </h1>
            <p className="text-lg text-foreground/70 max-w-md mb-8">
              Refined sushi, composed with Japanese precision and a subtle Brazilian warmth. Enjoy delivery or pickup with a smooth, elegant ordering experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/menu"
                className="inline-flex items-center justify-center gap-2 bg-gradient-gold text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-95 hover:shadow-[0_18px_40px_rgba(160,122,44,0.22)] transition-all"
              >
                View Menu
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href={businessInfo.phoneHref}
                className="inline-flex items-center justify-center gap-2 border border-primary/40 text-foreground px-8 py-4 rounded-lg font-semibold text-lg hover:bg-primary/10 hover:border-primary/60 transition-all"
              >
                <Phone className="w-5 h-5" />
                Call to Order
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <b.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-sm md:text-base">{b.title}</h3>
                <p className="text-muted-foreground text-xs md:text-sm mt-1">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 items-start max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-br from-card to-card/70 border border-border rounded-[1.75rem] p-8 md:p-10"
            >
              <span className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-primary/90 font-medium mb-5">
                <span className="h-px w-8 bg-primary/35" />
                About Us
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold leading-tight mb-5">
                Crafted for delivery, designed to feel like a premium table experience at home.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Brazilian Sushi was created around one idea: delivery and takeout should still feel refined, generous, and memorable. Every roll, sashimi cut, and combo is prepared to travel well without losing freshness, texture, or presentation.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Our menu blends Japanese discipline with a subtle Brazilian warmth, giving each order a sense of care from the first click to the final bite.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid gap-4"
            >
              {storyHighlights.map((item) => (
                <div key={item.label} className="bg-card border border-border rounded-2xl p-6 md:p-7">
                  <p className="text-xs uppercase tracking-[0.22em] text-primary/85 font-medium mb-3">{item.label}</p>
                  <p className="text-foreground/90 leading-relaxed">{item.value}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <SectionHeading label="Our Favorites" title="Featured Items" subtitle="A curated selection of house favorites, from signature rolls to premium sashimi and shareable combinations." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((item, i) => (
              <MenuCard key={item.id} item={item} index={i} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/menu" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline underline-offset-4">
              See Full Menu <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-card">
        <div className="container">
          <SectionHeading label="Special Offers" title="Today's Deals" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {promotionCards.map((promotion, index) => (
              <motion.div
                key={promotion.id}
                initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className={index === 0
                  ? "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-xl p-8"
                  : "bg-gradient-to-br from-sushi-red/15 to-sushi-red/5 border border-sushi-red/20 rounded-xl p-8"}
              >
                <span className="text-xs uppercase tracking-[0.2em] text-primary font-medium">
                  {promotion.audience === "verified" ? "Verified Exclusive" : "Limited Time"}
                </span>
                <h3 className="text-2xl font-display font-bold mt-2 mb-3">{promotion.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{promotion.description}</p>
                <Link to="/checkout" className="inline-flex items-center gap-2 bg-gradient-gold text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                  Checkout <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <SectionHeading label="Testimonials" title="What Our Customers Say" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {reviewCards.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground/80 text-sm leading-relaxed mb-6">"{review.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {review.customer_name
                      .split(" ")
                      .slice(0, 2)
                      .map((name) => name[0])
                      .join("")}
                  </div>
                  <div>
                    <span className="text-sm font-semibold">{review.customer_name}</span>
                    {review.is_verified_customer && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Shield className="w-3 h-3" /> Verified
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-card">
        <div className="container text-center">
          <SectionHeading label="Get in Touch" title="Ready for Tonight?" />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={businessInfo.phoneHref} className="inline-flex items-center gap-2 bg-gradient-gold text-primary-foreground px-8 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity">
              <Phone className="w-5 h-5" /> Call {businessInfo.phoneDisplay}
            </a>
            <Link to="/contact" className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 rounded-lg font-semibold hover:bg-secondary transition-colors">
              Contact Us <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
