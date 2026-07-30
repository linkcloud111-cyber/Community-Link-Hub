import { useState } from "react";
import { Link, useLocation } from "wouter";
import { INDIA_STATE_NAMES, getDistrictsForState } from "@/lib/india-data";
import { MapPin, ChevronDown, ChevronUp, Search } from "lucide-react";

export default function AdminLocations() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedState, setExpandedState] = useState<string | null>(null);

  const filtered = INDIA_STATE_NAMES.filter((s) =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminNav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/groups", label: "Groups" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/categories", label: "Categories" },
    { href: "/admin/locations", label: "Locations" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/contacts", label: "Contacts" },
    { href: "/admin/settings", label: "Settings" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <MapPin className="w-7 h-7 text-primary" /> Locations
        </h1>
        <p className="text-muted-foreground mt-2">
          India's states and districts are pre-loaded. Users can select from these when submitting communities.
        </p>
      </div>

      {/* Admin Nav */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        {adminNav.map((nav) => (
          <Link
            key={nav.href}
            href={nav.href}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              location === nav.href
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {nav.label}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl">
          <p className="text-muted-foreground text-sm mb-1">Total States / UTs</p>
          <p className="text-3xl font-bold">{INDIA_STATE_NAMES.length}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl">
          <p className="text-muted-foreground text-sm mb-1">Total Districts</p>
          <p className="text-3xl font-bold">
            {INDIA_STATE_NAMES.reduce(
              (sum, s) => sum + getDistrictsForState(s).length,
              0
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search states..."
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      {/* States list */}
      <div className="space-y-2">
        {filtered.map((stateName) => {
          const dists = getDistrictsForState(stateName);
          const isOpen = expandedState === stateName;
          return (
            <div key={stateName} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedState(isOpen ? null : stateName)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-semibold">{stateName}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {dists.length} districts
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    {dists.map((d) => (
                      <span
                        key={d}
                        className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-lg"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No states found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
