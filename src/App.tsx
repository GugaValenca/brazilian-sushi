import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingButtons from "@/components/FloatingButtons";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import {
  fetchCategories,
  fetchFeaturedItems,
  fetchMenuItems,
  fetchPromotions,
  fetchReviews,
} from "@/lib/catalog";

const loadIndexPage = () => import("./pages/Index");
const loadMenuPage = () => import("./pages/MenuPage");
const loadContactPage = () => import("./pages/ContactPage");
const loadCheckoutPage = () => import("./pages/CheckoutPage");
const loadOrderTrackingPage = () => import("./pages/OrderTrackingPage");
const loadLoginPage = () => import("./pages/LoginPage");
const loadRegisterPage = () => import("./pages/RegisterPage");
const loadConfirmAccountPage = () => import("./pages/ConfirmAccountPage");
const loadAccountPage = () => import("./pages/AccountPage");
const loadAdminDashboardPage = () => import("./pages/AdminDashboardPage");
const loadNotFoundPage = () => import("./pages/NotFound");

const Index = lazy(loadIndexPage);
const MenuPage = lazy(loadMenuPage);
const ContactPage = lazy(loadContactPage);
const CheckoutPage = lazy(loadCheckoutPage);
const OrderTrackingPage = lazy(loadOrderTrackingPage);
const LoginPage = lazy(loadLoginPage);
const RegisterPage = lazy(loadRegisterPage);
const ConfirmAccountPage = lazy(loadConfirmAccountPage);
const AccountPage = lazy(loadAccountPage);
const AdminDashboardPage = lazy(loadAdminDashboardPage);
const NotFound = lazy(loadNotFoundPage);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const AppWarmup = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const warm = () => {
      void loadMenuPage();
      void loadCheckoutPage();

      void queryClient.prefetchQuery({
        queryKey: ["featured-items"],
        queryFn: fetchFeaturedItems,
      });
      void queryClient.prefetchQuery({
        queryKey: ["promotions"],
        queryFn: fetchPromotions,
      });
      void queryClient.prefetchQuery({
        queryKey: ["reviews"],
        queryFn: fetchReviews,
      });
      void queryClient.prefetchQuery({
        queryKey: ["menu-items"],
        queryFn: () => fetchMenuItems(),
      });
      void queryClient.prefetchQuery({
        queryKey: ["menu-categories"],
        queryFn: fetchCategories,
      });
    };

    // requestIdleCallback isn't implemented in Safari, so the fallback branch
    // below is real -- typed as optional here (TS's own lib.dom typings
    // declare it as always present, which doesn't match reality and made
    // a plain `"requestIdleCallback" in window` check untypeable).
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(() => warm(), { timeout: 1500 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(warm, 400);
    return () => window.clearTimeout(timeoutId);
  }, [queryClient]);

  return null;
};

const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppWarmup />
            <ScrollToTop />
            <a
              href="#main-content"
              className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-3 focus-visible:text-primary-foreground focus-visible:shadow-lg"
            >
              Skip to main content
            </a>
            <Navbar />
            <main id="main-content">
              <Suspense fallback={<div className="min-h-screen pt-24 md:pt-28"><div className="container py-16 text-center text-muted-foreground">Loading...</div></div>}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/track-order" element={<OrderTrackingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/confirm-account" element={<ConfirmAccountPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/staff-dashboard" element={<AdminDashboardPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            <FloatingButtons />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
