import { Cloud, Mail, ExternalLink } from "lucide-react";
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
} from "react-icons/si";
import { Linkedin } from "lucide-react";

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
  const year = new Date().getFullYear();

  if (location === "/webmaster/login") {
    return null;
  }

  return (
    <footer className="border-t border-border bg-card/20 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <Cloud className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg tracking-tight">LinkCloud</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              India's premium community directory. Discover and share the best
              WhatsApp, Telegram, Discord, and more groups across India.
            </p>
            <a
              href="mailto:hello@linkcloud.in"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" /> hello@linkcloud.in
            </a>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-primary transition-colors">
                  Browse Communities
                </Link>
              </li>
              <li>
                <Link href="/submit" className="hover:text-primary transition-colors">
                  Submit a Community
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-primary transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About LinkCloud
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
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/complaint" className="hover:text-primary transition-colors text-destructive/80 font-semibold">
                  Submit Complaint
                </Link>
              </li>
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
                    href={`/?platform=${encodeURIComponent(p.name)}`}
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
          <p>© {year} LinkCloud. All rights reserved. Made with ♥ in India.</p>
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
