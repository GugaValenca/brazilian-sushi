import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Phone, Mail, MessageCircle, Clock, MapPin, Send } from "lucide-react";

import SectionHeading from "@/components/SectionHeading";
import { usePageMeta } from "@/hooks/usePageMeta";
import { submitContactMessage } from "@/lib/catalog";
import { businessInfo } from "@/lib/site";

const contactInfo = [
  { icon: Phone, label: "Phone", value: businessInfo.phoneDisplay, href: businessInfo.phoneHref },
  { icon: Mail, label: "Email", value: businessInfo.email, href: businessInfo.emailHref },
  { icon: MessageCircle, label: "WhatsApp", value: "Message our team", href: businessInfo.whatsappHref },
  { icon: MessageCircle, label: "Telegram", value: "@braziliansushi", href: businessInfo.telegramHref },
];

const initialFormState = {
  name: "",
  email: "",
  phone: "",
  message: "",
};

const ContactPage = () => {
  usePageMeta({
    title: "Contact Brazilian Sushi | Delivery Area, Hours & Support",
    description: "Contact Brazilian Sushi for delivery questions, pickup instructions, support, business hours, WhatsApp, Telegram, phone, and email.",
  });

  const [formData, setFormData] = useState(initialFormState);
  const [sent, setSent] = useState(false);

  const contactMutation = useMutation({
    mutationFn: submitContactMessage,
    onSuccess: () => {
      setSent(true);
      setFormData(initialFormState);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(false);
    contactMutation.mutate(formData);
  };

  const handleFieldChange = (field: keyof typeof initialFormState, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="min-h-screen pt-24 md:pt-28 pb-16">
      <div className="container">
        <SectionHeading
          label="Reach Out"
          title="Contact Us"
          subtitle="Questions about delivery, pickup, catering, or your order? Our team is here to help."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contactInfo.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group"
                >
                  <c.icon className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-semibold text-sm mt-0.5">{c.value}</p>
                </a>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Business Hours</h4>
                  <p className="text-muted-foreground text-sm mt-1">
                    {businessInfo.hoursDetailed[0]}
                    <br />
                    {businessInfo.hoursDetailed[1]}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Delivery Area</h4>
                  <p className="text-muted-foreground text-sm mt-1">{businessInfo.deliveryArea}</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h4 className="font-semibold text-sm mb-2">Pickup Instructions</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">{businessInfo.pickupInstructions}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            {sent ? (
              <div className="bg-card border border-primary/20 rounded-xl p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Send className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">Message Sent</h3>
                <p className="text-muted-foreground text-sm">Thank you for reaching out. We will get back to you as soon as possible during business hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-5">
                <div>
                  <label htmlFor="contact-name" className="text-sm font-medium text-foreground block mb-1.5">Name</label>
                  <input
                    id="contact-name"
                    required
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="text-sm font-medium text-foreground block mb-1.5">Email</label>
                  <input
                    id="contact-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    placeholder="you@email.com"
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="text-sm font-medium text-foreground block mb-1.5">Phone (optional)</label>
                  <input
                    id="contact-phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="text-sm font-medium text-foreground block mb-1.5">Message</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleFieldChange("message", e.target.value)}
                    placeholder="Tell us how we can help"
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
                {contactMutation.isError && (
                  <p className="text-sm text-destructive">We could not send your message right now. Please try again in a moment.</p>
                )}
                <button
                  type="submit"
                  disabled={contactMutation.isPending}
                  className="w-full bg-gradient-gold text-primary-foreground py-3.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-70"
                >
                  {contactMutation.isPending ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
