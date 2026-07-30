import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  getApprovedGroups,
  getTrendingGroups,
  getFeaturedGroups,
  getLatestGroups,
  getCategories,
} from "@/lib/firestore";
import type { Group, Category, Platform } from "@/lib/types";
import { INDIA_STATE_NAMES, getDistrictsForState } from "@/lib/india-data";
import GroupCard from "@/components/group-card";
import SkeletonCard from "@/components/skeleton-card";
import {
  Search,
  Compass,
  Flame,
  Sparkles,
  Clock,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  X,
} from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";

const PLATFORMS: { name: Platform | "All"; icon: React.FC<{ className?: string }> }[] = [
  { name: "All", icon: Compass },
  { name: "WhatsApp", icon: SiWhatsapp },
  { name: "Telegram", icon: SiTelegram },
  { name: "Discord", icon: SiDiscord },
  { name: "Facebook Groups", icon: SiFacebook },
  { name: "Instagram Broadcast", icon: SiInstagram },
  { name: "X Communities", icon: SiX },
  { name: "LinkedIn Groups", icon: Linkedin },
  { name: "YouTube Channels", icon: SiYoutube },
  { name: "Reddit", icon: SiReddit },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [platform, setPlatform] = useState<Platform | "All">("All");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [trending, setTrending] = useState<Group[]>([]);
  const [featured, setFeatured] = useState<Group[]>([]);
  const [latest, setLatest] = useState<Group[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Update districts when state changes
  useEffect(() => {
    setSelectedDistrict("");
    if (selectedState) {
      setDistricts(getDistrictsForState(selectedState));
    } else {
      setDistricts([]);
    }
  }, [selectedState]);

  // Load initial data
  useEffect(() => {
    async function loadInitial() {
      try {
        const [cats, trend, feat, late] = await Promise.all([
          getCategories(),
          getTrendingGroups(),
          getFeaturedGroups(),
          getLatestGroups(),
        ]);
        setCategories(cats);
        setTrending(trend);
        setFeatured(feat);
        setLatest(late);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadInitial();
  }, []);

  const isSearching =
    platform !== "All" || !!search || !!selectedCategory || !!selectedState || !!selectedDistrict;

  // Debounced search
  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const results = await getApprovedGroups({
          platform: platform === "All" ? undefined : platform,
          categoryId: selectedCategory || undefined,
          state: selectedState || undefined,
          district: selectedDistrict || undefined,
          search: search || undefined,
        });
        setSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSearch(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [platform, search, selectedCategory, selectedState, selectedDistrict, isSearching]);

  const clearFilters = () => {
    setPlatform("All");
    setSearch("");
    setSelectedCategory("");
    setSelectedState("");
    setSelectedDistrict("");
  };

  const activeFilterCount = [
    platform !== "All",
    !!selectedCategory,
    !!selectedState,
    !!selectedDistrict,
  ].filter(Boolean).length;

  return (
    <div className="space-y-12 pb-20">
      {/* Hero */}
      <section className="relative pt-16 pb-8 flex flex-col items-center text-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl space-y-6 z-10 px-4"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold tracking-wide border border-primary/20 backdrop-blur-md">
            🇮🇳 India's Community Directory
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
            Discover Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Next Community
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Find and join the best WhatsApp, Telegram, Discord groups across India.
            Curated, verified, and growing every day.
          </p>

          {/* Search Box */}
          <div className="max-w-2xl mx-auto w-full mt-6 relative">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500 pointer-events-none" />
              <div className="relative flex items-center bg-card border border-border rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
                <Search className="w-5 h-5 ml-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search groups, topics, cities, tags..."
                  className="w-full p-4 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="p-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> Submit Your Community
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Filters Bar */}
      <section className="sticky top-16 z-40 bg-background/80 backdrop-blur-xl border-y border-border py-3 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Platform pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar no-scrollbar">
            {PLATFORMS.map((p) => (
              <button
                key={p.name}
                onClick={() => setPlatform(p.name)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  platform === p.name
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <p.icon className="w-3.5 h-3.5" />
                {p.name}
              </button>
            ))}
          </div>

          {/* Advanced filters toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeFilterCount > 0
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </button>

            {/* Inline quick filters */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer text-foreground"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>

            {isSearching && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          {/* Advanced filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer text-foreground"
                  >
                    <option value="">All States</option>
                    {INDIA_STATE_NAMES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedState}
                    className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Districts</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Content */}
      {isSearching ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              {loadingSearch ? "Searching..." : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
            </h2>
          </div>

          {loadingSearch ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {searchResults.map((group, i) => (
                <GroupCard key={group.id} group={group} delay={i * 0.04} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
              <Compass className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-semibold mb-2">No communities found</h3>
              <p className="text-muted-foreground mb-6">
                Try different filters or be the first to add one!
              </p>
              <Link
                href="/submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Submit a Community
              </Link>
            </div>
          )}
        </section>
      ) : loadingInitial ? (
        <div className="space-y-12">
          {[0, 1].map((s) => (
            <section key={s} className="space-y-5">
              <div className="h-7 w-48 bg-muted rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2 className="text-xl font-bold">Featured Communities</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {featured.map((group, i) => (
                  <GroupCard key={group.id} group={group} delay={i * 0.08} />
                ))}
              </div>
            </section>
          )}

          {trending.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold">Trending Right Now</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {trending.map((group, i) => (
                  <GroupCard key={group.id} group={group} delay={i * 0.05} />
                ))}
              </div>
            </section>
          )}

          {latest.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold">Freshly Added</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {latest.map((group, i) => (
                  <GroupCard key={group.id} group={group} delay={i * 0.05} />
                ))}
              </div>
            </section>
          )}

          {!loadingInitial && featured.length === 0 && trending.length === 0 && latest.length === 0 && (
            <div className="text-center py-24">
              <Compass className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-20" />
              <h3 className="text-2xl font-bold mb-3">No communities yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Be the first to add your community to India's premium directory.
              </p>
              <Link
                href="/submit"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                <Plus className="w-5 h-5" /> Submit the First Community
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
