import { Cloud, Mail, ExternalLink, Phone, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  SiWhatsapp,
  SiTelegram,
  SiDiscord,
  SiFacebook,
  SiInstagram,
  SiX,
  SiYoutube,
  SiReddit,
  SiGithub,
} from "react-icons/si";
import { Linkedin } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const PLATFORMS = [
  { name: "WhatsApp", icon: SiWhatsapp, color: "text-green-500" },
  { name: "Telegram", icon: SiTelegram, color: "text-blue-400" },
  { name: "Discord", icon: SiDiscord, color: "text-indigo-500" },
  { name: "Facebook Groups", icon: SiFacebook, color: "text-blue-600" },
  { name: "Instagram Broadcast", icon: SiInstagram, color: "text-pink-500" },
  { name: "X Communities", icon: SiX, color: "text-foreground" },
  { name: "LinkedIn Groups", icon: Linkedin, color: "text-blue-700" },
  { name: "YouTube Channels", icon: SiYoutube, color: "text-red-500" },
  { name: "Reddit", icon: SiReddit, color: "text-orange-500" },
];

export default function Footer() {
  const [location] = useLocation();
  const { settings } = useSiteSettings();
  const year = new Date().getFullYear();

  // Hide global footer on Webmaster Login page
  if (location === "/webmaster/login") {
    return null;
  }

  // Respect Webmaster's Homepage Section Toggle: footerEnabled
  if (settings?.footerEnabled === false) {
    return null;
  }

  const siteName = settings?.siteName || "LinkCloud";
  const supportEmail = settings?.supportEmail || settings?.contactEmail || "support@linkcloud.in";
  const supportMobile = settings?.supportMobile || "";
  const footerDesc =
    settings?.footerDescription ||
    "India's premium community directory. Discover and share the best WhatsApp, Telegram, Discord, and more groups across India.";
  const copyright =
    settings?.copyrightText || `© ${year} ${siteName}. All rights reserved. Made with ♥ in India.`;

  // Dynamic official social links from Webmaster configuration
  const socialLinks = [
    { name: "WhatsApp", url: settings?.whatsappUrl, icon: SiWhatsapp, hover: "hover:text-green-500" },
    { name: "Telegram", url: settings?.telegramUrl, icon: SiTelegram, hover: "hover:text-blue-400" },
    { name: "YouTube", url: settings?.youtubeUrl, icon: SiYoutube, hover: "hover:text-red-500" },
    { name: "Instagram", url: settings?.instagramUrl, icon: SiInstagram, hover: "hover:text-pink-500" },
    { name: "Facebook", url: settings?.facebookUrl, icon: SiFacebook, hover: "hover:text-blue-600" },
    { name: "LinkedIn", url: settings?.linkedinUrl, icon: Linkedin, hover: "hover:text-blue-500" },
    { name: "X", url: settings?.twitterUrl, icon: SiX, hover: "hover:text-foreground" },
    { name: "Reddit", url: settings?.redditUrl, icon: SiReddit, hover: "hover:text-orange-500" },
    { name: "GitHub", url: settings?.githubUrl, icon: SiGithub, hover: "hover:text-foreground" },
  ].filter((s) => Boolean(s.url && s.url.trim().length > 0));

  return (
    <footer className="border-t border-border bg-card/20 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                {settings?.logoUrl || settings?.siteLogo ? (
                  <img
                    src={settings.logoUrl || settings.siteLogo}
                    alt={siteName}
                    className="w-5 h-5 rounded object-contain"
                  />
                ) : (
                  <Cloud className="w-4 h-4" />
                )}
              </div>
              <span className="font-bold text-lg tracking-tight">{siteName}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {footerDesc}
            </p>

            <div className="space-y-1.5 text-sm">
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                title="Support Email"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{supportEmail}</span>
              </a>

              {supportMobile && (
                <a
                  href={`tel:${supportMobile.replace(/\s+/g, "")}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-xs"
                  title="Official Helpline"
                >
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{supportMobile}</span>
                </a>
              )}
            </div>

            {/* Official Social Channels configured by Webmaster */}
            {socialLinks.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Official Channels
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {socialLinks.map((s) => {
                    const Icon = s.icon;
                    return (
                      <a
                        key={s.name}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground ${s.hover} hover:border-primary/40 transition shadow-sm`}
                        title={s.name}
                        aria-label={s.name}
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/groups" className="hover:text-primary transition-colors">
                  Browse Communities
                </Link>
              </li>
              {settings?.groupSubmissionEnabled !== false && settings?.allowPublicSubmissions !== false && (
                <li>
                  <Link href="/submit" className="hover:text-primary transition-colors">
                    Submit a Community
                  </Link>
                </li>
              )}
              <li>
                <Link href="/login" className="hover:text-primary transition-colors">
                  Sign In
                </Link>
              </li>
              {settings?.userRegistrationEnabled !== false && (
                <li>
                  <Link href="/register" className="hover:text-primary transition-colors">
                    Create Account
                  </Link>
                </li>
              )}
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About {siteName}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground mb-4">
              Support & Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {settings?.contactFormEnabled !== false && (
                <li>
                  <Link href="/contact" className="hover:text-primary transition-colors">
                    Contact Us
                  </Link>
                </li>
              )}
              {settings?.complaintSystemEnabled !== false && (
                <li>
                  <Link href="/complaint" className="hover:text-primary transition-colors text-destructive/80 font-semibold">
                    Submit Complaint
                  </Link>
                </li>
              )}
              <li>
                <Link href="/help" className="hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="hover:text-primary transition-colors">
                  DMCA
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="hover:text-primary transition-colors">
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>

          {/* Platforms */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground mb-4">
              Platforms
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {PLATFORMS.map((p) => (
                <li key={p.name}>
                  <Link
                    href={`/groups?platform=${encodeURIComponent(p.name)}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors group"
                  >
                    <p.icon className={`w-4 h-4 ${p.color}`} />
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>{copyright}</p>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/webmaster/login" className="hover:text-amber-500 font-mono transition-colors flex items-center gap-1">
              Webmaster Login
            </Link>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span>For Indian communities only</span>
              <span>🇮🇳</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
