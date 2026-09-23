import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";
import {
  Moon,
  Sun,
  Menu,
  User,
  LogOut,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  Cloud,
  X,
  Plus,
  Bell,
  Heart,
  KeyRound,
  Settings,
  FolderTree,
  Users as UsersIcon,
  MessageSquare,
  ShieldAlert,
  MapPin,
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, isWebmaster, profile } = useAuth();
  const [location, setLocation] = useLocation();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Hide global navbar on Webmaster Login page
  if (location === "/webmaster/login") {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    toast.success("Logout Successful. See you again.");
    setLocation("/");
  };

  const navigateAndClose = (path: string) => {
    setLocation(path);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/groups", label: "Directory" },
    { href: "/submit", label: "Submit Group" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const isDashboardRoute =
    location.startsWith("/dashboard") ||
    location === "/my-groups" ||
    location === "/submitted-groups" ||
    location === "/my-submitted-groups" ||
    location === "/my-profile" ||
    location === "/profile-settings" ||
    location === "/change-password" ||
    location === "/account-security" ||
    location === "/favorites" ||
    location === "/notifications";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-ring font-semibold text-xs transition"
      >
        Skip to main content
      </a>
      <nav
        aria-label="Main Navigation"
        className={`sticky top-0 z-50 w-full border-b border-white/5 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 ${isDashboardRoute ? "hidden lg:block" : ""}`}
      >
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
                {navLinks.map((link) => {
                  const isActive =
                    location === link.href ||
                    (link.href !== "/" && location.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
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
                    <span className="text-sm font-medium max-w-[110px] truncate">
                      {profile?.displayName || user.displayName || user.email?.split("@")[0]}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                        {/* Profile Header Snippet */}
                        <div className="p-3 border-b border-border bg-muted/30">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-foreground truncate">
                              {profile?.displayName || user.displayName || "User"}
                            </p>
                            {isWebmaster && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                <ShieldCheck className="w-3 h-3" /> Webmaster
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {profile?.email || user.email}
                          </p>
                          {profile?.accountUid && (
                            <p className="text-[10px] text-muted-foreground/80 font-mono mt-0.5 truncate">
                              UID: {profile.accountUid}
                            </p>
                          )}
                        </div>

                        <div className="p-2 space-y-0.5 max-h-[70vh] overflow-y-auto">
                          <button
                            onClick={() => navigateAndClose(isWebmaster ? "/webmaster" : "/dashboard")}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary/10 hover:text-primary transition-colors text-left"
                          >
                            <LayoutDashboard className="w-4 h-4 text-primary" /> Dashboard
                          </button>
                          <button
                            onClick={() => navigateAndClose("/submit")}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                          >
                            <Plus className="w-4 h-4" /> Submit Group
                          </button>

                          {!isWebmaster ? (
                            <>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=my-groups")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <LayoutGrid className="w-4 h-4" /> My Groups
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=favorites")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <Heart className="w-4 h-4" /> Favorites
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=notifications")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <Bell className="w-4 h-4" /> Notifications
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=profile")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <User className="w-4 h-4" /> Profile
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=settings")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <Settings className="w-4 h-4" /> Settings
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=security")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <KeyRound className="w-4 h-4" /> Account Security
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=my-submitted-groups")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <LayoutGrid className="w-4 h-4" /> My Submitted Groups
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=favorites")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <Heart className="w-4 h-4" /> Favorites
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=my-profile")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <User className="w-4 h-4" /> My Profile
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=profile-settings")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <Settings className="w-4 h-4" /> Profile Settings
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=change-password")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <KeyRound className="w-4 h-4" /> Change Password
                              </button>
                              <button
                                onClick={() => navigateAndClose("/dashboard?tab=security")}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                              >
                                <Shield className="w-4 h-4" /> Account Security
                              </button>
                            </>
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
                  <button
                    onClick={() => navigateAndClose(isWebmaster ? "/webmaster/dashboard" : "/dashboard")}
                    className="w-full text-left block px-4 py-3 text-sm font-semibold rounded-xl hover:bg-muted"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => navigateAndClose("/submit")}
                    className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                  >
                    Submit Group
                  </button>
                  {!isWebmaster ? (
                    <>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=my-groups")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        My Groups
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=favorites")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Favorites
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=notifications")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Notifications
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=profile-settings")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Profile Settings
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=change-password")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Change Password
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=my-submitted-groups")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        My Submitted Groups
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=favorites")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Favorites
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=my-profile")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        My Profile
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=profile-settings")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Profile Settings
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=change-password")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Change Password
                      </button>
                      <button
                        onClick={() => navigateAndClose("/dashboard?tab=security")}
                        className="w-full text-left block px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted"
                      >
                        Account Security
                      </button>
                    </>
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
  </>
);
}
