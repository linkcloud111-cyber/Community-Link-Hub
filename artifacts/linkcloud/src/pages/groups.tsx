import { useState, useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useTaxonomy } from "@/contexts/TaxonomyContext";
import { useLocation } from "@/contexts/LocationContext";
import {
  getApprovedGroups,
  getSiteSettings,
} from "@/lib/firestore";
import type { Group, FilterSettings } from "@/lib/types";
import GroupCard from "@/components/group-card";
import SkeletonCard from "@/components/skeleton-card";
import { PlatformIcon } from "@/components/platform-icon";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { EmptyState } from "@/components/empty-state";
import {
  Search,
  X,
  Compass,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Sparkles,
  Flame,
  Clock,
  TrendingUp,
  Grid,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

const SORT_OPTIONS: { value: "latest" | "popular" | "most_viewed" | "most_joined" | "featured" | "a-z" | "z-a" | "oldest"; label: string }[] = [
  { value: "latest", label: "Latest (Recently Added)" },
  { value: "popular", label: "Popular (Most Joins)" },
  { value: "most_viewed", label: "Most Viewed" },
  { value: "featured", label: "Featured First" },
  { value: "a-z", label: "Name (A to Z)" },
  { value: "z-a", label: "Name (Z to A)" },
  { value: "oldest", label: "Oldest First" },
];

const PAGE_SIZE = 12;

export default function GroupsPage() {
  const queryParams = new URLSearchParams(useSearch());

  const {
    activeCategories: categories,
    activePlatforms: platforms,
    activeContentTypes: contentTypes,
    activeLanguages: languages,
  } = useTaxonomy();

  const { activeStates, getDistrictsForState, getCitiesForDistrict } = useLocation();

  const [search, setSearch] = useState(queryParams.get("q") || "");
  const [platform, setPlatform] = useState<string>(queryParams.get("platform") || "All");
  const [categoryId, setCategoryId] = useState(queryParams.get("category") || "");
  const [contentType, setContentType] = useState(queryParams.get("type") || "All");
  const [language, setLanguage] = useState(queryParams.get("lang") || "All");
  const [state, setState] = useState(queryParams.get("state") || "");
  const [district, setDistrict] = useState(queryParams.get("district") || "");
  const [city, setCity] = useState(queryParams.get("city") || "");
  const [linkStatus, setLinkStatus] = useState<"all" | "active" | "inactive">("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "most_viewed" | "most_joined" | "featured" | "a-z" | "z-a" | "oldest">("latest");

  // Quick section view filter tabs: 'all', 'featured', 'popular', 'latest'
  const [viewTab, setViewTab] = useState<"all" | "featured" | "popular" | "latest">("all");

  const [allApprovedGroups, setAllApprovedGroups] = useState<Group[]>([]);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    categoryFilterEnabled: true,
    platformFilterEnabled: true,
    contentTypeFilterEnabled: true,
    languageFilterEnabled: true,
    stateFilterEnabled: true,
    districtFilterEnabled: true,
    cityFilterEnabled: true,
    linkStatusFilterEnabled: true,
    featuredFilterEnabled: true,
    popularFilterEnabled: true,
    newestFilterEnabled: true,
    verifiedFilterEnabled: true,
    approvalStatusFilterEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    document.title = "Public Group Directory — LinkCloud";
    async function loadInitialData() {
      const settings = await getSiteSettings();
      if (settings?.filterSettings) {
        setFilterSettings(settings.filterSettings);
      }
    }
    loadInitialData();
  }, []);

  const availableDistricts = state ? getDistrictsForState(state) : [];
  const availableCities = state ? getCitiesForDistrict(state, district) : [];

  // Central Filter Management Enforcement
  const isPlatformEnabled = filterSettings.platformFilterEnabled !== false;
  const isCategoryEnabled = filterSettings.categoryFilterEnabled !== false;
  const isContentTypeEnabled = filterSettings.contentTypeFilterEnabled !== false;
  const isLanguageEnabled = filterSettings.languageFilterEnabled !== false;
  const isStateEnabled = filterSettings.stateFilterEnabled !== false;
  const isDistrictEnabled = filterSettings.districtFilterEnabled !== false;
  const isCityEnabled = filterSettings.cityFilterEnabled !== false;
  const isLinkStatusEnabled = filterSettings.linkStatusFilterEnabled !== false;
  const isFeaturedEnabled = filterSettings.featuredFilterEnabled !== false;

  const effectivePlatform = isPlatformEnabled && platform !== "All" ? platform : undefined;
  const effectiveCategory = isCategoryEnabled && categoryId ? categoryId : undefined;
  const effectiveContentType = isContentTypeEnabled && contentType !== "All" ? contentType : undefined;
  const effectiveLanguage = isLanguageEnabled && language !== "All" ? language : undefined;
  const effectiveState = isStateEnabled && state ? state : undefined;
  const effectiveDistrict = isDistrictEnabled && district ? district : undefined;
  const effectiveCity = isCityEnabled && city ? city : undefined;
  const effectiveLinkStatus = isLinkStatusEnabled && linkStatus !== "all" ? linkStatus : undefined;

  // Resolve human-readable category name for active filter chip
  const selectedCategoryName = useMemo(() => {
    if (!effectiveCategory) return "";
    const target = effectiveCategory.trim().toLowerCase();

    // 1. Match by Category ID
    const matchById = categories.find((c) => c.id.toLowerCase() === target);
    if (matchById) return matchById.name;

    // 2. Match by Category Slug
    const matchBySlug = categories.find((c) => c.slug?.toLowerCase() === target);
    if (matchBySlug) return matchBySlug.name;

    // 3. Match by Category Name
    const matchByName = categories.find((c) => c.name.toLowerCase() === target);
    if (matchByName) return matchByName.name;

    // 4. Fallback formatting if taxonomy is loading or raw string
    return effectiveCategory
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }, [effectiveCategory, categories]);

  // Fetch groups when main filters change
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const effectiveSortBy =
          viewTab === "popular"
            ? "popular"
            : viewTab === "featured"
            ? "featured"
            : viewTab === "latest"
            ? "latest"
            : sortBy;

        const effectiveFeatured = isFeaturedEnabled
          ? viewTab === "featured"
            ? true
            : featuredOnly
            ? true
            : undefined
          : undefined;

        const res = await getApprovedGroups({
          platform: effectivePlatform,
          categoryId: effectiveCategory,
          contentType: effectiveContentType,
          language: effectiveLanguage,
          state: effectiveState,
          district: effectiveDistrict,
          city: effectiveCity,
          linkStatus: effectiveLinkStatus,
          featured: effectiveFeatured,
          search: search || undefined,
          sortBy: effectiveSortBy,
        });

        if (!isCancelled) {
          setAllApprovedGroups(res);
          setVisibleCount(PAGE_SIZE);
        }
      } catch (err) {
        console.error("Error loading groups:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    search,
    platform,
    categoryId,
    contentType,
    language,
    state,
    district,
    city,
    linkStatus,
    featuredOnly,
    sortBy,
    viewTab,
    filterSettings,
  ]);

  // Synchronize URL query parameters with filter state
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (platform && platform !== "All") params.set("platform", platform);
    if (categoryId) params.set("category", categoryId);
    if (contentType && contentType !== "All") params.set("type", contentType);
    if (language && language !== "All") params.set("lang", language);
    if (state) params.set("state", state);
    if (district) params.set("district", district);
    if (city) params.set("city", city);
    if (linkStatus && linkStatus !== "all") params.set("status", linkStatus);
    if (viewTab && viewTab !== "all") params.set("tab", viewTab);
    if (sortBy && sortBy !== "latest") params.set("sort", sortBy);

    const newQuery = params.toString();
    const targetUrl = newQuery ? `/groups?${newQuery}` : "/groups";
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.replaceState(null, "", targetUrl);
    }
  }, [
    search,
    platform,
    categoryId,
    contentType,
    language,
    state,
    district,
    city,
    linkStatus,
    viewTab,
    sortBy,
  ]);

  // Handle browser Back / Forward navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setSearch(p.get("q") || "");
      setPlatform(p.get("platform") || "All");
      setCategoryId(p.get("category") || "");
      setContentType(p.get("type") || "All");
      setLanguage(p.get("lang") || "All");
      setState(p.get("state") || "");
      setDistrict(p.get("district") || "");
      setCity(p.get("city") || "");
      setLinkStatus((p.get("status") as any) || "all");
      setViewTab((p.get("tab") as any) || "all");
      setSortBy((p.get("sort") as any) || "latest");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Realtime Search Suggestions
  const searchSuggestions = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];
    const q = search.toLowerCase();
    const suggestionsSet = new Set<string>();

    allApprovedGroups.forEach((g) => {
      if (g.name.toLowerCase().includes(q)) suggestionsSet.add(g.name);
      if (g.categoryName?.toLowerCase().includes(q)) suggestionsSet.add(g.categoryName);
      if (g.platform?.toLowerCase().includes(q)) suggestionsSet.add(g.platform);
    });

    return Array.from(suggestionsSet).slice(0, 5);
  }, [search, allApprovedGroups]);

  const clearFilters = () => {
    setSearch("");
    setPlatform("All");
    setCategoryId("");
    setContentType("All");
    setLanguage("All");
    setState("");
    setDistrict("");
    setCity("");
    setLinkStatus("all");
    setFeaturedOnly(false);
    setSortBy("latest");
    setViewTab("all");
    setVisibleCount(PAGE_SIZE);
  };

  const activeCount = [
    !!effectivePlatform,
    !!effectiveCategory,
    !!effectiveContentType,
    !!effectiveLanguage,
    !!effectiveState,
    !!effectiveDistrict,
    !!effectiveCity,
    !!effectiveLinkStatus,
    featuredOnly && isFeaturedEnabled,
    !!search,
    viewTab !== "all",
  ].filter(Boolean).length;

  const visibleGroups = allApprovedGroups.slice(0, visibleCount);
  const hasMore = visibleCount < allApprovedGroups.length;

  return (
    <div className="space-y-6 pb-20">
      <PageBreadcrumb items={[{ label: "Public Directory" }]} className="-mt-1" />

      {/* Page Heading & Quick View Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Public Community Directory
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
            Discover verified, active invite links across WhatsApp, Telegram, Discord, and more.
          </p>
        </div>

        {/* View Tabs: Featured, Popular, Latest, All */}
        <div className="flex items-center gap-1.5 p-1.5 bg-card border border-border/80 rounded-2xl shadow-sm self-start md:self-auto">
          <button
            onClick={() => setViewTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewTab === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Grid className="w-3.5 h-3.5" /> All Groups
          </button>
          {filterSettings.featuredFilterEnabled !== false && (
            <button
              onClick={() => setViewTab("featured")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === "featured"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Featured
            </button>
          )}
          {filterSettings.popularFilterEnabled !== false && (
            <button
              onClick={() => setViewTab("popular")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === "popular"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Popular
            </button>
          )}
          {filterSettings.newestFilterEnabled !== false && (
            <button
              onClick={() => setViewTab("latest")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewTab === "latest"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Latest
            </button>
          )}
        </div>
      </div>

      {/* Main Filter & Search Bar */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        {/* Search Input & Sort Selector */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Realtime Search by group name, category, platform, state, city..."
              className="w-full pl-12 pr-10 py-3 bg-background border border-border rounded-2xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Suggestions Dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-xl z-20 overflow-hidden p-2 space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground px-3 py-1 tracking-wider">
                  Suggestions
                </p>
                {searchSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearch(item);
                      setSearchFocused(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center justify-between"
                  >
                    <span>{item}</span>
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[210px] flex-1 md:flex-none">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-3 bg-background border border-border rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary outline-none cursor-pointer appearance-none pr-8"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            <button
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="md:hidden px-4 py-3 bg-secondary text-secondary-foreground rounded-2xl text-sm font-semibold border border-border flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters {activeCount > 0 && `(${activeCount})`}
            </button>
          </div>
        </div>

        {/* Platform Row Tabs */}
        {filterSettings.platformFilterEnabled !== false && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setPlatform("All")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                platform === "All"
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted border-border/60 hover:text-foreground"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              All
            </button>
            {platforms.map((p) => {
              const isSelected = platform === p.name;
              return (
                <button
                  key={p.id || p.name}
                  onClick={() => setPlatform(p.name)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted border-border/60 hover:text-foreground"
                  }`}
                >
                  <PlatformIcon platform={p.name} className="w-3.5 h-3.5" />
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Detailed Filters Dropdowns */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-3 border-t border-border/60 ${
            showFiltersMobile ? "block" : "hidden md:grid"
          }`}
        >
          {/* Category */}
          {filterSettings.categoryFilterEnabled !== false && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.groupCount ?? 0})
                </option>
              ))}
            </select>
          )}

          {/* Content Type */}
          {filterSettings.contentTypeFilterEnabled !== false && (
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="All">All Content Types</option>
              {contentTypes.map((t) => (
                <option key={t.id || t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {/* Language */}
          {filterSettings.languageFilterEnabled !== false && (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="All">All Languages</option>
              {languages.map((l) => (
                <option key={l.id || l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* State */}
          {filterSettings.stateFilterEnabled !== false && (
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setDistrict("");
                setCity("");
              }}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="">All States (India)</option>
              {activeStates.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* District */}
          {filterSettings.districtFilterEnabled !== false && (
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setCity("");
              }}
              disabled={!state}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="">{state ? "All Districts" : "Select State First"}</option>
              {availableDistricts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* City */}
          {filterSettings.cityFilterEnabled !== false && (
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!state}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="">{state ? "All Cities" : "Select State First"}</option>
              {availableCities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Link Status */}
          {filterSettings.linkStatusFilterEnabled !== false && (
            <select
              value={linkStatus}
              onChange={(e) => setLinkStatus(e.target.value as any)}
              className="px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="all">All Link Status</option>
              <option value="active">Active Links Only</option>
              <option value="inactive">Inactive Links</option>
            </select>
          )}
        </div>

        {/* Active Filter Chips */}
        {activeCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs flex-wrap gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Active Filters:</span>
              {viewTab !== "all" && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1 capitalize">
                  Tab: {viewTab}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setViewTab("all")} />
                </span>
              )}
              {effectivePlatform && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1">
                  Platform: {effectivePlatform}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setPlatform("All")} />
                </span>
              )}
              {effectiveCategory && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1">
                  Category: {selectedCategoryName}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setCategoryId("")} />
                </span>
              )}
              {effectiveContentType && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1">
                  {effectiveContentType}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setContentType("All")} />
                </span>
              )}
              {effectiveLanguage && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1">
                  {effectiveLanguage}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setLanguage("All")} />
                </span>
              )}
              {effectiveState && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1">
                  {effectiveState}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setState("")} />
                </span>
              )}
              {effectiveLinkStatus && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold flex items-center gap-1 capitalize">
                  Link: {effectiveLinkStatus}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setLinkStatus("all")} />
                </span>
              )}
            </div>

            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 font-medium transition-colors ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-muted-foreground">
          Showing <span className="text-foreground font-bold">{visibleGroups.length}</span> of{" "}
          <span className="text-foreground font-bold">{allApprovedGroups.length}</span> approved communities
        </p>
      </div>

      {/* Group Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : allApprovedGroups.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="No communities found"
          description="No communities matched your active search terms or filters. Try clearing your filters or exploring another category."
          actionLabel="Reset All Filters"
          onAction={clearFilters}
          className="max-w-lg mx-auto"
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleGroups.map((group, idx) => (
              <GroupCard key={group.id} group={group} delay={idx * 0.04} />
            ))}
          </div>

          {/* Load More Pagination */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="px-8 py-3 bg-card hover:bg-muted text-foreground border border-border rounded-2xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
              >
                Load More Communities ({allApprovedGroups.length - visibleCount} remaining)
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
