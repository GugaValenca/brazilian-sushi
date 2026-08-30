import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import SectionHeading from "@/components/SectionHeading";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/hooks/usePageMeta";

function getFriendlySignupError(error: unknown) {
  if (!(error instanceof Error)) {
    return "We couldn't create your account right now. Please review your details and try again.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("email") && message.includes("already exists")) {
    return "An account with this email already exists. Please sign in or use a different email address.";
  }

  if (message.includes("username") && message.includes("already exists")) {
    return "That username is already in use. Please choose another one and try again.";
  }

  if (message.includes("automatic sign-in")) {
    return error.message;
  }

  // The backend validates password strength (AUTH_PASSWORD_VALIDATORS) and
  // returns a specific, actionable reason -- e.g. "Password: This password
  // is too common." -- which is worth showing as-is instead of the generic
  // fallback below.
  if (message.includes("password")) {
    return error.message;
  }

  return "We couldn't create your account right now. Please review your details and try again.";
}

const RegisterPage = () => {
  usePageMeta({
    title: "Create Account | Brazilian Sushi",
    description: "Create a Brazilian Sushi customer account to save addresses, favorites, preferences, and order history.",
    robots: "noindex,nofollow",
  });

  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
    password: "",
    notification_preference: "both" as "sms" | "email" | "both",
  });

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (response) => {
      if (!response.confirmation_required) {
        toast.success("Account created successfully. You can sign in now.");
        navigate("/login");
        return;
      }

      const channelSummary = response.confirmation_channels.length
        ? response.confirmation_channels.join(" and ")
        : "email";
      toast.success(`Account created. Please confirm your signup via ${channelSummary} before signing in.`);
      navigate(`/confirm-account?email=${encodeURIComponent(form.email.trim())}`, {
        state: {
          justCreated: true,
          confirmationChannels: response.confirmation_channels,
        },
      });
    },
    onError: (error) => {
      toast.error(getFriendlySignupError(error));
    },
  });

  const updateField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container max-w-3xl">
        <SectionHeading
          label="Customer Access"
          title="Create Account"
          subtitle="Create your account to save addresses, reorder favorites faster, and build toward verified customer benefits over time."
        />

        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              ...form,
              email: form.email.trim(),
              username: form.username.trim(),
              phone_number: form.phone_number.trim(),
              sms_opt_in: form.notification_preference !== "email",
              email_opt_in: form.notification_preference !== "sms",
            });
          }}
          className="bg-card border border-border rounded-2xl p-8 space-y-6"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="register-first-name" className="text-sm font-medium block mb-2">First name</label>
              <input id="register-first-name" required autoComplete="given-name" value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label htmlFor="register-last-name" className="text-sm font-medium block mb-2">Last name</label>
              <input id="register-last-name" required autoComplete="family-name" value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="register-username" className="text-sm font-medium block mb-2">Username</label>
              <input id="register-username" required autoComplete="username" value={form.username} onChange={(e) => updateField("username", e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label htmlFor="register-phone" className="text-sm font-medium block mb-2">Phone</label>
              <input id="register-phone" required type="tel" autoComplete="tel" value={form.phone_number} onChange={(e) => updateField("phone_number", e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="register-email" className="text-sm font-medium block mb-2">Email</label>
              <input id="register-email" required type="email" autoComplete="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
            </div>
            <div>
              <label htmlFor="register-password" className="text-sm font-medium block mb-2">Password</label>
              <input id="register-password" required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => updateField("password", e.target.value)} className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm" />
            </div>
          </div>

          <div>
            <span className="text-sm font-medium block mb-2">Preferred notifications</span>
            <div className="grid sm:grid-cols-3 gap-3">
              {([
                ["sms", "SMS"],
                ["email", "Email"],
                ["both", "SMS + Email"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateField("notification_preference", value)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${form.notification_preference === value ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending} className="w-full bg-gradient-gold text-primary-foreground py-3.5 rounded-lg font-semibold disabled:opacity-70">
            <span className="inline-flex items-center gap-2"><UserPlus className="w-4 h-4" /> {mutation.isPending ? "Creating account..." : "Create Account"}</span>
          </button>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Your account helps us keep checkout smoother, communication preferences consistent, and future orders easier to place.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Already registered? <Link to="/login" className="text-primary font-semibold">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
