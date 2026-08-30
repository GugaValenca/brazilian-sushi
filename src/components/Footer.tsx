import { Facebook, Ghost, Instagram, Mail, Music2, Phone, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { businessInfo } from "@/lib/site";

const socials = [
  { label: "Instagram", href: "https://instagram.com/braziliansushi", icon: Instagram },
  { label: "TikTok", href: "https://tiktok.com/@braziliansushi", icon: Music2 },
  { label: "Facebook", href: "https://facebook.com/braziliansushi", icon: Facebook },
  { label: "Snapchat", href: "https://snapchat.com/add/braziliansushi", icon: Ghost },
] satisfies Array<{ label: string; href: string; icon: LucideIcon }>;

const footerLinks = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/contact", label: "Contact" },
  { to: "/track-order", label: "Track Order" },
  { to: "/account", label: "Account" },
];

const Footer = () => (
  <footer className="border-t border-border bg-gradient-card">
    <div className="container py-12 md:py-16">
      <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-[0.7fr_1.15fr_0.9fr] md:gap-12">
        <div className="space-y-4 text-center">
          <h4 className="text-sm uppercase tracking-[0.22em] text-primary/85 font-medium">Navigate</h4>
          <div className="grid gap-3 justify-center">
            {footerLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="max-w-md md:mx-auto md:text-center">
          <h3 className="text-2xl md:text-3xl font-display font-bold text-gradient-gold mb-4">{businessInfo.name}</h3>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            Premium sushi crafted with Japanese precision and Brazilian soul, designed exclusively for delivery and takeout.
          </p>
          <div className="mt-5 inline-flex max-w-sm flex-col rounded-2xl border border-primary/20 bg-secondary/70 px-5 py-4 shadow-[0_18px_45px_-28px_hsl(var(--primary)/0.45)]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/85">Open Hours</span>
            <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">{businessInfo.hoursSummary}</p>
          </div>
        </div>

        <div className="space-y-5 text-center">
          <h4 className="text-sm uppercase tracking-[0.22em] text-primary/85 font-medium">Contact</h4>
          <div className="flex flex-col items-center space-y-3 text-sm text-muted-foreground">
            <a href={businessInfo.phoneHref} className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
              <Phone className="w-4 h-4 text-primary" />
              {businessInfo.phoneDisplay}
            </a>
            <a href={businessInfo.emailHref} className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
              <Mail className="w-4 h-4 text-primary" />
              {businessInfo.email}
            </a>
          </div>
          <div className="flex items-center justify-center gap-4 pt-1">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-border/60 bg-secondary/90 flex items-center justify-center transition-all hover:bg-primary/20 hover:border-primary/30"
                aria-label={social.label}
              >
                <social.icon className="w-5 h-5" strokeWidth={1.9} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="divider-gold mt-10 mb-6" />
      <p className="text-center text-xs text-muted-foreground">Copyright {new Date().getFullYear()} Brazilian Sushi. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
