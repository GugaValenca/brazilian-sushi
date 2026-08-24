import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { LogIn, MailCheck } from "lucide-react";
import { toast } from "sonner";

import SectionHeading from "@/components/SectionHeading";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";

const LoginPage = () => {
  usePageMeta({
    title: "Sign In | Brazilian Sushi",
    description: "Access your Brazilian Sushi account to manage orders, addresses, favorites, and notification preferences.",
    robots: "noindex,nofollow",
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const pendingConfirmationEmail = useMemo(() => {
    const state = location.state as { pendingConfirmationEmail?: string } | null;
    return state?.pendingConfirmationEmail ?? "";
  }, [location.state]);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      toast.success("Signed in successfully");
      navigate((location.state as { from?: string } | null)?.from ?? "/account");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "We could not sign you in. Check your credentials and try again.";
      toast.error(message);
    },
  });

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container max-w-2xl">
        <SectionHeading
          label="Customer Access"
          title="Sign In"
          subtitle="Return to your account to follow recent orders, revisit favorites, and keep your checkout details ready for the next order."
        />

        {pendingConfirmationEmail && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <MailCheck className="w-4 h-4 text-primary" />
              Your account is waiting for confirmation.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent activation instructions to <span className="font-medium text-foreground">{pendingConfirmationEmail}</span>.
            </p>
            <Link
              to={`/confirm-account?email=${encodeURIComponent(pendingConfirmationEmail)}`}
              className="inline-flex items-center gap-2 text-primary font-semibold mt-4 hover:underline underline-offset-4"
            >
              Open confirmation page
            </Link>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ email, password });
          }}
          className="bg-card border border-border rounded-2xl p-8 space-y-5"
        >
          <div>
            <label htmlFor="login-email" className="text-sm font-medium block mb-2">Email</label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm"
              placeholder="you@email.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium block mb-2">Password</label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm"
              placeholder="Your password"
            />
          </div>
          <button type="submit" disabled={mutation.isPending} className="w-full bg-gradient-gold text-primary-foreground py-3.5 rounded-lg font-semibold disabled:opacity-70">
            <span className="inline-flex items-center gap-2"><LogIn className="w-4 h-4" /> {mutation.isPending ? "Signing in..." : "Sign In"}</span>
          </button>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Signing in keeps your saved addresses, order history, and notification preferences in one place.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            New here? <Link to="/register" className="text-primary font-semibold">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
