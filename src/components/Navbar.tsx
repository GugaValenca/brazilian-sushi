import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Menu, Phone, ShoppingBag, User, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { businessInfo } from "@/lib/site";

const links = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/contact", label: "Contact" },
  { to: "/track-order", label: "Track Order" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { totalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container flex items-center justify-between h-16 md:h-20">
        <Link to="/" className="flex items-center gap-2 md:flex-1">
          <span className="text-2xl md:text-3xl font-display font-bold text-gradient-gold">{businessInfo.name}</span>
        </Link>

        <div className="hidden md:flex flex-1 items-center justify-center gap-8">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`relative text-sm font-medium tracking-wide uppercase transition-colors hover:text-primary after:absolute after:left-0 after:-bottom-2 after:h-px after:w-full after:origin-center after:scale-x-0 after:bg-primary/70 after:transition-transform ${
                pathname === l.to ? "text-primary after:scale-x-100" : "text-foreground/70 hover:after:scale-x-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex flex-1 items-center justify-end gap-4">
          {user?.is_staff && (
            <Link to="/staff-dashboard" className="inline-flex items-center gap-2 text-sm font-semibold hover:text-primary">
              <LayoutDashboard className="w-4 h-4" /> Staff
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link to="/account" className="inline-flex items-center gap-2 text-sm font-semibold hover:text-primary">
                <User className="w-4 h-4" /> {user?.first_name || "Account"}
              </Link>
              <button type="button" onClick={logout} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="text-sm font-semibold hover:text-primary">
              Sign in
            </Link>
          )}
          <Link
            to="/checkout"
            className="relative inline-flex items-center gap-2 bg-gradient-gold text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-95 hover:shadow-[0_14px_30px_rgba(160,122,44,0.22)] transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            Checkout
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground p-2" aria-label="Toggle menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-border overflow-hidden"
          >
            <div className="container py-6 flex flex-col gap-4">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={`text-lg font-medium tracking-wide transition-colors ${
                    pathname === l.to ? "text-primary" : "text-foreground/70"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Link to="/checkout" onClick={() => setOpen(false)} className="inline-flex items-center justify-between border border-border px-5 py-3 rounded-lg font-semibold">
                <span className="inline-flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Checkout</span>
                {totalItems > 0 && <span className="text-primary text-sm">{totalItems}</span>}
              </Link>
              {user?.is_staff && (
                <Link to="/staff-dashboard" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 text-lg font-medium">
                  <LayoutDashboard className="w-5 h-5" /> Staff Dashboard
                </Link>
              )}
              {isAuthenticated ? (
                <>
                  <Link to="/account" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 text-lg font-medium">
                    <User className="w-5 h-5" /> {user?.first_name || "Account"}
                  </Link>
                  <button type="button" onClick={() => { logout(); setOpen(false); }} className="text-left text-lg font-medium text-muted-foreground">
                    Log out
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="text-lg font-medium">Sign in</Link>
              )}
              <a
                href={businessInfo.phoneHref}
                className="inline-flex items-center justify-center gap-2 bg-gradient-gold text-primary-foreground px-5 py-3 rounded-lg font-semibold mt-2"
              >
                <Phone className="w-4 h-4" />
                Call to Order
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
