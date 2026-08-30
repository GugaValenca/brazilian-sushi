import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, ShieldCheck, Star, Truck } from "lucide-react";
import { toast } from "sonner";

import SectionHeading from "@/components/SectionHeading";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  createAddress,
  fetchAddresses,
  fetchEligibleReviewOrder,
  fetchFavorites,
  fetchOrders,
  makeDefaultAddress,
  removeFavorite,
  reorderOrder,
  submitReview,
  updateProfile,
} from "@/lib/account";

const initialAddress = {
  label: "Home",
  recipient_name: "",
  phone_number: "",
  line_1: "",
  line_2: "",
  city: "",
  state: "",
  postal_code: "",
  delivery_notes: "",
  is_default: false,
};

const AccountPage = () => {
  usePageMeta({
    title: "Your Account | Brazilian Sushi",
    description: "Manage your Brazilian Sushi profile, saved addresses, favorites, reviews, and order history.",
    robots: "noindex,nofollow",
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tokens, isAuthenticated, isLoading: isAuthLoading, refreshProfile } = useAuth();
  const { addItem } = useCart();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    phone_number: user?.phone_number ?? "",
    notification_preference: user?.notification_preference ?? "both",
  });
  const [addressForm, setAddressForm] = useState(initialAddress);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", content: "" });

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      notification_preference: user.notification_preference,
    });
    setIsEditingProfile(false);
  }, [user]);

  const token = tokens?.access;

  const { data: orders = [] } = useQuery({
    queryKey: ["account-orders", token],
    queryFn: () => fetchOrders(token!),
    enabled: Boolean(token),
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["account-addresses", token],
    queryFn: () => fetchAddresses(token!),
    enabled: Boolean(token),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["account-favorites", token],
    queryFn: () => fetchFavorites(token!),
    enabled: Boolean(token),
  });

  const { data: eligibleReviewOrder } = useQuery({
    queryKey: ["eligible-review-order", token],
    queryFn: () => fetchEligibleReviewOrder(token!),
    enabled: Boolean(token),
    retry: false,
  });

  const stats = useMemo(() => ({
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, order) => sum + Number(order.total), 0),
  }), [orders]);

  const canLeaveReview = Boolean(eligibleReviewOrder);
  const notificationPreferenceLabel = {
    sms: "SMS updates",
    email: "Email updates",
    both: "SMS + Email updates",
  } as const;

  const resetProfileDraft = () => {
    if (!user) return;
    setProfileForm({
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      notification_preference: user.notification_preference,
    });
    setIsEditingProfile(false);
  };

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      updateProfile(token!, {
        ...profileForm,
        sms_opt_in: profileForm.notification_preference !== "email",
        email_opt_in: profileForm.notification_preference !== "sms",
      }),
    onSuccess: async () => {
      await refreshProfile();
      setIsEditingProfile(false);
      toast.success("Profile updated");
    },
    onError: () => toast.error("Could not update profile right now."),
  });

  const createAddressMutation = useMutation({
    mutationFn: () => createAddress(token!, addressForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-addresses", token] });
      setAddressForm(initialAddress);
      toast.success("Address saved");
    },
    onError: () => toast.error("Could not save address."),
  });

  const makeDefaultAddressMutation = useMutation({
    mutationFn: (addressId: number) => makeDefaultAddress(token!, addressId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-addresses", token] });
      toast.success("Default address updated");
    },
    onError: () => toast.error("Could not update your default address."),
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (favoriteId: number) => removeFavorite(token!, favoriteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-favorites", token] });
      toast.success("Favorite removed");
    },
    onError: () => toast.error("Could not remove favorite."),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderId: number) => reorderOrder(token!, orderId),
    onSuccess: async (order) => {
      order.items.forEach((item) => {
        addItem({
          id: `reorder-${order.id}-${item.id}`,
          apiId: item.menu_item,
          name: item.menu_item_name,
          description: "Reordered from account history",
          price: Number(item.line_total) / item.quantity,
          image: "/favicon.ico",
          category: "Reorder",
          allergens: [],
        });
      });
      toast.success("Items added back to cart");
      navigate("/checkout");
    },
    onError: () => toast.error("Could not reorder this purchase."),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      submitReview(token!, {
        ...reviewForm,
        order_id: eligibleReviewOrder!.order_id,
      }),
    onSuccess: () => {
      setReviewForm({ rating: 5, title: "", content: "" });
      void queryClient.invalidateQueries({ queryKey: ["eligible-review-order", token] });
      toast.success("Review submitted for approval");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Reviews are available after at least one completed order.",
      ),
  });

  if (isAuthLoading) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-16">
        <div className="container max-w-3xl">
          <SectionHeading label="Customer Area" title="Your Account" subtitle="Sign in to manage orders, favorites, saved addresses, and verified customer perks." />
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground" role="status">
            Loading your account...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !token) {
    return (
      <div className="min-h-screen pt-24 md:pt-28 pb-16">
        <div className="container max-w-3xl">
          <SectionHeading label="Customer Area" title="Your Account" subtitle="Sign in to manage orders, favorites, saved addresses, and verified customer perks." />
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <p className="text-muted-foreground mb-6">You need to sign in before accessing your account dashboard.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login" className="bg-gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold">Sign In</Link>
              <Link to="/register" className="border border-border px-6 py-3 rounded-lg font-semibold">Create Account</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container max-w-6xl">
        <SectionHeading label="Customer Area" title="Your Account" subtitle="Manage your profile, saved addresses, favorites, reviews, and order history from one place." />

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">Orders completed</p>
            <p className="text-3xl font-display font-bold mt-2">{stats.totalOrders}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">Total spent</p>
            <p className="text-3xl font-display font-bold mt-2">${stats.totalSpent.toFixed(2)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">Verification status</p>
            <p className="text-xl font-semibold mt-2 inline-flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> {user.is_verified_customer ? "Verified customer" : "Standard customer"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Completed successful orders: {user.loyalty_completed_orders}</p>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1fr_1fr] gap-8">
          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-2xl font-display font-bold">Profile</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your personal details stay saved to your account. Open edit mode only when you want to update them.
                  </p>
                </div>
                {!isEditingProfile ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="inline-flex items-center justify-center self-start border border-primary/30 px-4 py-2 text-sm rounded-lg font-semibold"
                  >
                    Edit Information
                  </button>
                ) : null}
              </div>

              {!isEditingProfile ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Name</p>
                    <p className="mt-2 text-base font-semibold">{`${user.first_name} ${user.last_name}`.trim() || "Not provided"}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Email</p>
                    <p className="mt-2 text-base font-semibold whitespace-normal break-all">{user.email}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Phone</p>
                    <p className="mt-2 text-base font-semibold whitespace-normal break-words">{user.phone_number || "Not provided"}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Notifications</p>
                    <p className="mt-2 text-base font-semibold">{notificationPreferenceLabel[user.notification_preference]}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input aria-label="First name" value={profileForm.first_name} onChange={(e) => setProfileForm((c) => ({ ...c, first_name: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="First name" />
                    <input aria-label="Last name" value={profileForm.last_name} onChange={(e) => setProfileForm((c) => ({ ...c, last_name: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Last name" />
                  </div>
                  <input aria-label="Email (cannot be changed)" value={user.email} disabled className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground" />
                  <input aria-label="Phone" value={profileForm.phone_number} onChange={(e) => setProfileForm((c) => ({ ...c, phone_number: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Phone" />
                  <div className="grid sm:grid-cols-3 gap-3">
                    {([["sms", "SMS"], ["email", "Email"], ["both", "SMS + Email"]] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setProfileForm((c) => ({ ...c, notification_preference: value }))} className={`rounded-xl border px-4 py-3 text-sm font-medium ${profileForm.notification_preference === value ? "border-primary bg-primary/5" : "border-border"}`}>{label}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending} className="bg-gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold disabled:opacity-70">{updateProfileMutation.isPending ? "Saving..." : "Save Changes"}</button>
                    <button type="button" onClick={resetProfileDraft} disabled={updateProfileMutation.isPending} className="border border-border px-6 py-3 rounded-lg font-semibold disabled:opacity-70">Cancel</button>
                  </div>
                </>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold">Saved Addresses</h3>
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div key={address.id} className="border border-border rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> {address.label} {address.is_default && <span className="text-xs text-primary">Default</span>}</p>
                      {!address.is_default && (
                        <button
                          type="button"
                          onClick={() => makeDefaultAddressMutation.mutate(address.id)}
                          disabled={makeDefaultAddressMutation.isPending}
                          className="text-sm font-semibold text-primary hover:underline underline-offset-4 disabled:opacity-70"
                        >
                          Make default
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{address.line_1}{address.line_2 ? `, ${address.line_2}` : ""} - {address.city}, {address.state} {address.postal_code}</p>
                    {address.delivery_notes && <p className="text-sm text-muted-foreground mt-1 italic">"{address.delivery_notes}"</p>}
                  </div>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <input aria-label="Address label" value={addressForm.label} onChange={(e) => setAddressForm((c) => ({ ...c, label: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Label" />
                <input aria-label="Recipient name" value={addressForm.recipient_name} onChange={(e) => setAddressForm((c) => ({ ...c, recipient_name: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Recipient name" />
                <input aria-label="Phone" value={addressForm.phone_number} onChange={(e) => setAddressForm((c) => ({ ...c, phone_number: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Phone" />
                <input aria-label="Address line 1" value={addressForm.line_1} onChange={(e) => setAddressForm((c) => ({ ...c, line_1: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Address line 1" />
                <input aria-label="Address line 2" value={addressForm.line_2} onChange={(e) => setAddressForm((c) => ({ ...c, line_2: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Address line 2" />
                <input aria-label="City" value={addressForm.city} onChange={(e) => setAddressForm((c) => ({ ...c, city: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="City" />
                <input aria-label="State" value={addressForm.state} onChange={(e) => setAddressForm((c) => ({ ...c, state: e.target.value.toUpperCase() }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="State" maxLength={2} />
                <input aria-label="Postal code" value={addressForm.postal_code} onChange={(e) => setAddressForm((c) => ({ ...c, postal_code: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Postal code" />
              </div>
              <textarea aria-label="Delivery notes" value={addressForm.delivery_notes} onChange={(e) => setAddressForm((c) => ({ ...c, delivery_notes: e.target.value }))} rows={2} placeholder="Gate code, building instructions, where to leave the order... (optional)" className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none" />
              <button type="button" onClick={() => createAddressMutation.mutate()} disabled={createAddressMutation.isPending} className="border border-primary/30 px-6 py-3 rounded-lg font-semibold disabled:opacity-70">{createAddressMutation.isPending ? "Saving..." : "Add Address"}</button>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold">Favorites</h3>
              {favorites.length === 0 ? <p className="text-sm text-muted-foreground">You have not saved any favorite items yet.</p> : (
                <div className="space-y-3">
                  {favorites.map((favorite) => (
                    <div key={favorite.id} className="flex items-center justify-between border border-border rounded-xl p-4 gap-4">
                      <div>
                        <p className="font-semibold inline-flex items-center gap-2"><Heart className="w-4 h-4 text-primary" /> {favorite.menu_item_name}</p>
                        <p className="text-sm text-muted-foreground mt-1">Saved on {new Date(favorite.created_at).toLocaleDateString("en-US")}</p>
                      </div>
                      <button type="button" onClick={() => removeFavoriteMutation.mutate(favorite.id)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/menu" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline underline-offset-4">Browse menu</Link>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold">Order History</h3>
              {orders.length === 0 ? <p className="text-sm text-muted-foreground">No completed orders yet.</p> : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold inline-flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Order #{order.id}</p>
                          <p className="text-sm text-muted-foreground mt-1">{new Date(order.created_at).toLocaleString("en-US")} - {order.status.replaceAll("_", " ")}</p>
                        </div>
                        <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">{order.items.map((item) => `${item.quantity}x ${item.menu_item_name}`).join(", ")}</div>
                      <div className="flex flex-wrap gap-4 mt-4 text-sm">
                        <Link to={`/track-order?order=${order.id}&token=${order.tracking_token}`} className="text-primary font-semibold">Track order</Link>
                        <button type="button" onClick={() => reorderMutation.mutate(order.id)} className="font-semibold text-foreground">Reorder to cart</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-2xl font-display font-bold">Leave a Review</h3>
              {canLeaveReview ? (
                <>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Review for order #{eligibleReviewOrder?.order_id}</p>
                    <p className="text-sm text-muted-foreground">
                      Items in this order: {eligibleReviewOrder?.product_names.join(", ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This review stays available until {eligibleReviewOrder ? new Date(eligibleReviewOrder.available_until).toLocaleString("en-US") : ""}, or until you place a new order.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input value={reviewForm.title} onChange={(e) => setReviewForm((c) => ({ ...c, title: e.target.value }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm" placeholder="Review title" />
                    <select value={reviewForm.rating} onChange={(e) => setReviewForm((c) => ({ ...c, rating: Number(e.target.value) }))} className="bg-background border border-border rounded-lg px-4 py-3 text-sm">
                      {[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} stars</option>)}
                    </select>
                  </div>
                  <textarea value={reviewForm.content} onChange={(e) => setReviewForm((c) => ({ ...c, content: e.target.value }))} rows={4} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm resize-none" placeholder="Tell other customers about your experience" />
                  <button
                    type="button"
                    onClick={() => reviewMutation.mutate()}
                    disabled={reviewMutation.isPending || !eligibleReviewOrder}
                    className="bg-gradient-gold text-primary-foreground px-6 py-3 rounded-lg font-semibold disabled:opacity-70"
                  >
                    <span className="inline-flex items-center gap-2"><Star className="w-4 h-4" /> {reviewMutation.isPending ? "Submitting..." : "Submit Review"}</span>
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reviews are released only after a delivered order is completed successfully. Each review is tied to that specific order, remains open for up to 24 hours, and closes as soon as a new order is placed.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;


