import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import {
  Moon,
  Sun,
  Menu,
  User,
  LogOut,
  LayoutDashboard,
  Shield,
  Cloud,
  X,
  Plus,
  Bell,
  Heart,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, isAdmin, profile } = useAuth();
  const [location, setLocation] = useLocation();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location]);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    setLocation("/");
  };

  const navLinks = [
    { href: "/", label: "Discover" },
    { href: "/submit", label: "Submit Group" },
    { href: "/about", label: "About" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
                <Cloud className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg tracking-tight">LinkCloud</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    location === link.href
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {user ? (
              <>
                <Link
                  href="/submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4" /> Submit
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-muted/50 border border-transparent hover:border-border transition-all"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Avatar"
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="text-sm font-medium max-w-[90px] truncate">
                      {profile?.displayName || user.displayName || user.email?.split("@")[0]}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-2 space-y-0.5">
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" /> Dashboard
                          </Link>
                          <Link
                            href="/favorites"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Heart className="w-4 h-4" /> Favorites
                          </Link>
                          <Link
                            href="/notifications"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Bell className="w-4 h-4" /> Notifications
                          </Link>
                          {isAdmin && (
                            <Link
                              href="/admin"
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Shield className="w-4 h-4" /> Admin Panel
                            </Link>
                          )}
                        </div>
                        <div className="border-t border-border p-2">
                          <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" /> Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-colors shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4" /> Submit Group
                </Link>
              </div>
            )}
          </div>

          {/* Mobile buttons */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full text-muted-foreground"
            >
              {mounted && theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl absolute top-16 left-0 w-full shadow-2xl">
          <div className="p-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  location === link.href
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <>
                <div className="border-t border-border pt-3 mt-3 space-y-1">
                  <div className="px-4 py-2 text-xs text-muted-foreground">
                    Signed in as{" "}
                    <span className="font-medium text-foreground">
                      {user.email}
                    </span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/favorites"
                    className="block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                  >
                    Favorites
                  </Link>
                  <Link
                    href="/notifications"
                    className="block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                  >
                    Notifications
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                    >
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-destructive rounded-xl hover:bg-destructive/10"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-border">
                <Link
                  href="/login"
                  className="block text-center px-4 py-3 bg-muted text-foreground font-medium rounded-xl"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="block text-center px-4 py-3 bg-primary text-primary-foreground font-medium rounded-xl"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
