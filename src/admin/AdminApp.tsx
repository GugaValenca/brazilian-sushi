import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";

import AdminLayout from "./AdminLayout";

const loadOverviewPage = () => import("./pages/OverviewPage");
const loadOrdersPage = () => import("./pages/OrdersPage");
const loadOrderDetailPage = () => import("./pages/OrderDetailPage");
const loadMenuManagementPage = () => import("./pages/MenuManagementPage");
const loadDeliveryZonesPage = () => import("./pages/DeliveryZonesPage");
const loadCustomersPage = () => import("./pages/CustomersPage");
const loadCustomerDetailPage = () => import("./pages/CustomerDetailPage");
const loadStaffPage = () => import("./pages/StaffPage");
const loadCouponsPage = () => import("./pages/CouponsPage");
const loadPromotionsPage = () => import("./pages/PromotionsPage");
const loadReviewsPage = () => import("./pages/ReviewsPage");
const loadMessagesPage = () => import("./pages/MessagesPage");
const loadAdminNotFoundPage = () => import("./pages/AdminNotFoundPage");

const OverviewPage = lazy(loadOverviewPage);
const OrdersPage = lazy(loadOrdersPage);
const OrderDetailPage = lazy(loadOrderDetailPage);
const MenuManagementPage = lazy(loadMenuManagementPage);
const DeliveryZonesPage = lazy(loadDeliveryZonesPage);
const CustomersPage = lazy(loadCustomersPage);
const CustomerDetailPage = lazy(loadCustomerDetailPage);
const StaffPage = lazy(loadStaffPage);
const CouponsPage = lazy(loadCouponsPage);
const PromotionsPage = lazy(loadPromotionsPage);
const ReviewsPage = lazy(loadReviewsPage);
const MessagesPage = lazy(loadMessagesPage);
const AdminNotFoundPage = lazy(loadAdminNotFoundPage);

const PageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading...</div>
);

/** Mounted at /admin/* by src/App.tsx. Its own router subtree + shell
 * (AdminLayout: sidebar, staff-only access gate) entirely separate from the
 * storefront's Navbar/Footer. */
const AdminApp = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      <Route
        index
        element={
          <Suspense fallback={<PageFallback />}>
            <OverviewPage />
          </Suspense>
        }
      />
      <Route
        path="orders"
        element={
          <Suspense fallback={<PageFallback />}>
            <OrdersPage />
          </Suspense>
        }
      />
      <Route
        path="orders/:orderId"
        element={
          <Suspense fallback={<PageFallback />}>
            <OrderDetailPage />
          </Suspense>
        }
      />
      <Route
        path="menu"
        element={
          <Suspense fallback={<PageFallback />}>
            <MenuManagementPage />
          </Suspense>
        }
      />
      <Route
        path="delivery-zones"
        element={
          <Suspense fallback={<PageFallback />}>
            <DeliveryZonesPage />
          </Suspense>
        }
      />
      <Route
        path="customers"
        element={
          <Suspense fallback={<PageFallback />}>
            <CustomersPage />
          </Suspense>
        }
      />
      <Route
        path="customers/:customerId"
        element={
          <Suspense fallback={<PageFallback />}>
            <CustomerDetailPage />
          </Suspense>
        }
      />
      <Route
        path="staff"
        element={
          <Suspense fallback={<PageFallback />}>
            <StaffPage />
          </Suspense>
        }
      />
      <Route
        path="coupons"
        element={
          <Suspense fallback={<PageFallback />}>
            <CouponsPage />
          </Suspense>
        }
      />
      <Route
        path="promotions"
        element={
          <Suspense fallback={<PageFallback />}>
            <PromotionsPage />
          </Suspense>
        }
      />
      <Route
        path="reviews"
        element={
          <Suspense fallback={<PageFallback />}>
            <ReviewsPage />
          </Suspense>
        }
      />
      <Route
        path="messages"
        element={
          <Suspense fallback={<PageFallback />}>
            <MessagesPage />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <Suspense fallback={<PageFallback />}>
            <AdminNotFoundPage />
          </Suspense>
        }
      />
    </Route>
  </Routes>
);

export default AdminApp;
