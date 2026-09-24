import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTaxonomy } from "@/contexts/TaxonomyContext";
import {
  getApprovedGroups,
  getTrendingGroups,
  getFeaturedGroups,
  getLatestGroups,
  getSiteSettings,
  getFAQs,
  logVisitorHit,
  logSearchQuery,
} from "@/lib/firestore";
import type { Group, SiteSettings, FAQItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import GroupCard from "@/components/group-card";
import SkeletonCard from "@/components/skeleton-card";
import { PlatformIcon } from "@/components/platform-icon";
import { CategoryIcon } from "@/components/category-icon";
import { getPlatformVisual, getCategoryVisual } from "@/lib/taxonomy-visuals";
import {
  Search,
  Compass,
  Flame,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  TrendingUp,
  Layers,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Users,
  MapPin,
  MessageSquare,
  Wrench,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTitle } from "@/lib/page-meta";

export default function Home() {
  const { isWebmaster } = useAuth();
  usePageTitle("Discover & Join Verified Communities", "India's Public Community Directory");
  const [, setLocation] = useLocation();
  const {
    activeCategories: categories,
    activePlatforms: platforms,
  } = useTaxonomy();

  const [search, setSearch] = useState("");
  const [featured, setFeatured] = useState<Group[]>([]);
  const [popular, setPopular] = useState<Group[]>([]);
  const [latest, setLatest] = useState<Group[]>([]);
  const [allGroupsCount, setAllGroupsCount] = useState(0);
  const [totalJoins, setTotalJoins] = useState(0);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  // Settings & FAQs from Firestore
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);

  // Suggestions for autocomplete search bar
  const [suggestions, setSuggestions] = useState<Group[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    // Log Visitor Traffic Hit
    logVisitorHit();

    async function loadInitial() {
      try {
        const [feat, trend, late, all, siteData, faqData] = await Promise.all([
          getFeaturedGroups(),
          getTrendingGroups(),
          getLatestGroups(),
          getApprovedGroups(),
          getSiteSettings(),
          getFAQs(),
        ]);
        setFeatured(feat);
        setPopular(trend);
        setLatest(late);
        setAllGroupsCount(all.length);
        setSettings(siteData);
        setFaqs(faqData);

        const joins = all.reduce((sum, g) => sum + (g.joinCount ?? 0), 0);
        setTotalJoins(joins);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadInitial();
  }, []);

  // Handle instant autocomplete suggestions
  useEffect(() => {
    if (!search.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await getApprovedGroups({ search });
        setSuggestions(results.slice(0, 5));
        setShowSuggestions(true);
      } catch {
        // ignore
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      logSearchQuery(search.trim());
      setLocation(`/groups?q=${encodeURIComponent(search.trim())}`);
    } else {
      setLocation("/groups");
    }
  };

  // Maintenance Screen Bypass for Webmaster
  if (settings?.maintenanceMode && !isWebmaster) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-xl">
          <Wrench className="w-10 h-10 animate-bounce" />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-3xl font-extrabold text-foreground">Under Maintenance</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {settings?.maintenanceMessage?.trim() ||
              "LinkCloud is currently undergoing system upgrades and database optimization. We will be back online shortly!"}
          </p>
        </div>
        <div className="pt-4 flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/30 px-4 py-2 rounded-xl border border-border">
          <ShieldAlert className="w-4 h-4 text-amber-500" /> Webmaster Bypass Enabled in Header
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      {settings?.heroSectionEnabled !== false && (
        <section className="relative pt-12 pb-6 flex flex-col items-center text-center overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl space-y-6 z-10 px-4"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold tracking-wide border border-primary/20 backdrop-blur-md">
              🇮🇳 {settings?.siteTagline || "India's #1 Public Community Directory"}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1]">
              {settings?.heroTitle || "Discover & Join Verified Communities"}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {settings?.heroSubtitle || "Find active WhatsApp, Telegram, Discord, and social groups curated across India."}
            </p>

            {/* Search Bar with Instant Autocomplete Suggestions */}
            <div className="max-w-2xl mx-auto w-full mt-6 relative z-50">
              <form onSubmit={handleSearchSubmit} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500 pointer-events-none" />
                <div className="relative flex items-center bg-card border border-border/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
                  <Search className="w-5 h-5 ml-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => search.trim() && setShowSuggestions(true)}
                    placeholder="Search WhatsApp groups, study circles, cities, tech..."
                    className="w-full p-4 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm sm:text-base"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setShowSuggestions(false);
                      }}
                      className="p-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="m-1.5 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>{settings?.heroButtonText || "Search"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Instant Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-left z-50 divide-y divide-border/40"
                  >
                    <div className="p-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 bg-muted/40">
                      Top Live Matches
                    </div>
                    {suggestions.map((g) => (
                      <Link
                        key={g.id}
                        href={`/groups/${g.id}`}
                        onClick={() => setShowSuggestions(false)}
                        className="flex items-center gap-3 p-3.5 hover:bg-muted/60 transition-colors group"
                      >
                        <img
                          src={g.logoUrl || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100"}
                          alt={g.name}
                          className="w-8 h-8 rounded-xl object-cover border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-foreground group-hover:text-primary truncate">{g.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{g.platform} • {g.categoryName}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                          Join
                        </span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>
      )}

      {/* Featured Groups Carousel Section */}
      {settings?.featuredGroupsEnabled !== false && (loadingInitial || featured.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Featured Communities</h2>
                <p className="text-xs text-muted-foreground">Handpicked high-engagement verified groups</p>
              </div>
            </div>
            <Link href="/groups?featured=true" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All Featured <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingInitial
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`feat-skel-${i}`} />)
              : featured.map((g, idx) => <GroupCard key={g.id} group={g} delay={idx * 0.04} />)}
          </div>
        </section>
      )}

      {/* Popular Platforms Grid */}
      {settings?.popularPlatformsEnabled !== false && platforms.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-border/80 pb-3">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Supported Platforms
            </h2>
            <p className="text-xs text-muted-foreground">Browse active communities across messaging networks</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            {platforms.map((p) => {
              const pVisual = getPlatformVisual(p.name, p.themeColor, p.icon);
              const isPlatformFilterEnabled = settings?.filterSettings?.platformFilterEnabled !== false;
              const targetHref = isPlatformFilterEnabled
                ? `/groups?platform=${encodeURIComponent(p.name)}`
                : "/groups";

              return (
                <Link
                  key={p.id || p.name}
                  href={targetHref}
                  className="p-3.5 bg-card border border-border/80 hover:border-primary hover:scale-105 rounded-2xl transition-all flex flex-col items-center justify-center text-center gap-2 shadow-sm group"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all group-hover:scale-110"
                    style={{ backgroundColor: pVisual.bgColor, borderColor: pVisual.borderColor }}
                  >
                    <PlatformIcon platform={p.name} color={p.themeColor} icon={p.icon} className="w-5 h-5" style={pVisual.iconStyle} />
                  </div>
                  <span className="text-xs font-bold truncate max-w-full text-foreground">{p.name.split(" ")[0]}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Popular Categories Grid */}
      {settings?.popularCategoriesEnabled !== false && categories.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" /> Explore Top Categories
              </h2>
              <p className="text-xs text-muted-foreground">Discover groups by topic and interest</p>
            </div>
            <Link href="/groups" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              All Categories <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.slice(0, 12).map((c) => {
              const cVisual = getCategoryVisual(c.name, c.themeColor, c.icon);
              const isCategoryFilterEnabled = settings?.filterSettings?.categoryFilterEnabled !== false;
              const targetHref = isCategoryFilterEnabled
                ? `/groups?category=${c.id}`
                : "/groups";

              return (
                <Link
                  key={c.id}
                  href={targetHref}
                  className="p-4 bg-card border border-border/80 hover:border-primary rounded-2xl transition-all hover:shadow-md flex items-center gap-3 group"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base transition-colors shrink-0 border"
                    style={{ backgroundColor: cVisual.bgColor, borderColor: cVisual.borderColor, color: cVisual.color }}
                  >
                    <CategoryIcon icon={c.icon} name={c.name} color={c.themeColor} className="w-5 h-5" style={{ color: cVisual.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate group-hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.groupCount || 0} groups</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Popular & Trending Section */}
      {settings?.popularGroupsEnabled !== false && (loadingInitial || popular.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Trending & Popular Groups</h2>
                <p className="text-xs text-muted-foreground">Highest join activity in the last 24 hours</p>
              </div>
            </div>
            <Link href="/groups?sort=popular" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All Trending <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingInitial
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`pop-skel-${i}`} />)
              : popular.slice(0, 8).map((g, idx) => (
                  <GroupCard key={g.id} group={g} delay={idx * 0.04} />
                ))}
          </div>
        </section>
      )}

      {/* Latest Submissions */}
      {settings?.latestGroupsEnabled !== false && (loadingInitial || latest.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Recently Added Communities</h2>
                <p className="text-xs text-muted-foreground">Freshly verified links added today</p>
              </div>
            </div>
            <Link href="/groups?sort=latest" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All Latest <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loadingInitial
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={`lat-skel-${i}`} />)
              : latest.slice(0, 8).map((g, idx) => (
                  <GroupCard key={g.id} group={g} delay={idx * 0.04} />
                ))}
          </div>
        </section>
      )}

      {/* Live Directory Statistics Counter */}
      {settings?.statisticsSectionEnabled !== false && (
        <section className="bg-card border border-border/80 rounded-3xl p-8 relative overflow-hidden shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center relative z-10">
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-primary">{allGroupsCount || 500}+</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Groups</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-500">28</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Indian States</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-blue-500">9</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Platforms</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl sm:text-4xl font-extrabold text-purple-500">{totalJoins || 12000}+</p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Join Clicks</p>
            </div>
          </div>
        </section>
      )}

      {/* Dynamic FAQ Accordion */}
      {settings?.faqSectionEnabled !== false && faqs.length > 0 && (
        <section className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center justify-center gap-2">
              <HelpCircle className="w-6 h-6 text-primary" /> Frequently Asked Questions
            </h2>
            <p className="text-xs text-muted-foreground">Everything you need to know about LinkCloud India</p>
          </div>

          <div className="space-y-3">
            {faqs.filter((f) => f.enabled !== false).map((faq, idx) => {
              const isOpen = faqOpen === idx;
              return (
                <div
                  key={faq.id}
                  className="bg-card border border-border/80 rounded-2xl overflow-hidden transition-all shadow-sm"
                >
                  <button
                    onClick={() => setFaqOpen(isOpen ? null : idx)}
                    className="w-full p-4 text-left font-bold text-sm flex items-center justify-between gap-4 text-foreground hover:text-primary transition-colors"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 text-muted-foreground ${isOpen ? "rotate-180 text-primary" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
