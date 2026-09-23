import { useState, useEffect } from "react";
import { Link } from "wouter";
import { getAdminStats } from "@/lib/firestore";
import AdminNav from "@/components/admin-nav";
import {
  Loader2,
  Users,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  TrendingUp,
  Eye,
  Star,
  MapPin,
  Globe,
  Share2,
  Heart,
  FileText,
  Clock,
  Link as LinkIcon,
  EyeOff,
  Flame,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { getPlatformVisual } from "@/lib/taxonomy-visuals";

const PLATFORM_COLORS: Record<string, string> = {
  WhatsApp: getPlatformVisual("WhatsApp").color,
  Telegram: getPlatformVisual("Telegram").color,
  Discord: getPlatformVisual("Discord").color,
  "Facebook Groups": getPlatformVisual("Facebook Groups").color,
  "Instagram Broadcast": getPlatformVisual("Instagram Broadcast").color,
  "X Communities": getPlatformVisual("X Communities").color,
  "LinkedIn Groups": getPlatformVisual("LinkedIn Groups").color,
  "YouTube Channels": getPlatformVisual("YouTube Channels").color,
  Reddit: getPlatformVisual("Reddit").color,
};

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = stats?.topPlatforms
    ? stats.topPlatforms.map(([name, value]: [string, number]) => ({
        name: name.split(" ")[0],
        value,
      }))
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 sm:px-6">
      {/* Webmaster Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
            <ShieldCheck className="w-4 h-4" /> Single Webmaster Console
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Webmaster Console Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Full platform authority over users, groups, taxonomy, locations, & site health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Firestore Sync
          </span>
        </div>
      </div>

      {/* Admin Navigation */}
      <AdminNav stats={stats} />

      {/* Primary Metrics Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Key Performance Metrics
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard icon={Eye} label="Total Visitors" value={stats?.totalVisitors} color="blue" />
          <MetricCard icon={Users} label="Registered Users" value={stats?.totalUsers} color="emerald" />
          <MetricCard icon={LayoutGrid} label="Total Groups" value={stats?.totalGroups} color="purple" />
          <MetricCard icon={Clock} label="Pending Review" value={stats?.pendingGroups} color="amber" highlight={stats?.pendingGroups > 0} />
          <MetricCard icon={CheckCircle2} label="Approved Groups" value={stats?.approvedGroups} color="emerald" />
          <MetricCard icon={XCircle} label="Rejected Groups" value={stats?.rejectedGroups} color="rose" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard icon={Star} label="Featured Groups" value={stats?.featuredGroups} color="amber" />
          <MetricCard icon={EyeOff} label="Hidden Groups" value={stats?.hiddenGroups} color="slate" />
          <MetricCard icon={LinkIcon} label="Active Links" value={stats?.activeLinks} color="emerald" />
          <MetricCard icon={AlertTriangle} label="Inactive Links" value={stats?.inactiveLinks} color="rose" />
          <MetricCard icon={Heart} label="Total Favorites" value={stats?.totalFavorites} color="rose" />
          <MetricCard icon={TrendingUp} label="Total Joins" value={stats?.totalJoins} color="indigo" />
        </div>
      </div>

      {/* Content & Taxonomy Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={LayoutGrid} label="Categories" value={stats?.totalCategories} />
        <MetricCard icon={Share2} label="Platforms" value={stats?.totalPlatforms} />
        <MetricCard icon={Globe} label="Languages" value={stats?.totalLanguages} />
        <MetricCard icon={MapPin} label="States" value={stats?.totalStates} />
        <MetricCard icon={MapPin} label="Districts" value={stats?.totalDistricts} />
        <MetricCard icon={MapPin} label="Cities" value={stats?.totalCities} />
      </div>

      {/* Inbox & Health Warning Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/webmaster/groups"
          className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl hover:bg-amber-500/10 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Action Required</span>
            <h3 className="font-bold text-foreground">Pending Group Approvals</h3>
            <p className="text-xs text-muted-foreground">{stats?.pendingGroups || 0} groups waiting in queue</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 font-extrabold text-lg flex items-center justify-center">
            {stats?.pendingGroups || 0}
          </div>
        </Link>

        <Link
          href="/webmaster/reports"
          className="p-5 bg-destructive/5 border border-destructive/20 rounded-2xl hover:bg-destructive/10 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-destructive">User Moderation</span>
            <h3 className="font-bold text-foreground">Pending Abuse Reports</h3>
            <p className="text-xs text-muted-foreground">{stats?.pendingReports || 0} unreviewed community reports</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive font-extrabold text-lg flex items-center justify-center">
            {stats?.pendingReports || 0}
          </div>
        </Link>

        <Link
          href="/webmaster/contacts"
          className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl hover:bg-blue-500/10 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Site Inbox</span>
            <h3 className="font-bold text-foreground">Unread Contact Messages</h3>
            <p className="text-xs text-muted-foreground">{stats?.unreadContacts || 0} unread webmaster messages</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 font-extrabold text-lg flex items-center justify-center">
            {stats?.unreadContacts || 0}
          </div>
        </Link>
      </div>

      {/* Platform Chart & Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Platform Distribution</h2>
              <p className="text-xs text-muted-foreground">Community count across platforms</p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">{stats?.totalGroups || 0} total groups</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PLATFORM_COLORS[entry.name] ?? "hsl(var(--primary))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Demographics */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Geographic Breakdown
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Top States</p>
              <div className="flex flex-wrap gap-1.5">
                {stats?.topStates?.slice(0, 5).map(([state, count]: [string, number]) => (
                  <span key={state} className="px-2.5 py-1 rounded-lg bg-muted text-foreground font-medium">
                    {state || "All India"} ({count})
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="font-semibold text-muted-foreground mb-1">Top Categories</p>
              <div className="flex flex-wrap gap-1.5">
                {stats?.topCategories?.slice(0, 5).map(([cat, count]: [string, number]) => (
                  <span key={cat} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                    {cat} ({count})
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="font-semibold text-muted-foreground mb-1">Top Languages</p>
              <div className="flex flex-wrap gap-1.5">
                {stats?.topLanguages?.slice(0, 5).map(([lang, count]: [string, number]) => (
                  <span key={lang} className="px-2.5 py-1 rounded-lg bg-muted text-foreground font-medium">
                    {lang} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Most Viewed & Most Joined Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" /> Most Viewed Groups
          </h2>
          <div className="divide-y divide-border">
            {stats?.mostViewedGroups?.map((group: any) => (
              <div key={group.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold truncate">{group.name}</p>
                  <p className="text-muted-foreground truncate">{group.platform} • {group.categoryName}</p>
                </div>
                <span className="font-mono bg-muted px-2.5 py-1 rounded-lg font-bold flex-shrink-0">
                  {group.viewsCount || 0} views
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Most Joined Groups
          </h2>
          <div className="divide-y divide-border">
            {stats?.mostJoinedGroups?.map((group: any) => (
              <div key={group.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold truncate">{group.name}</p>
                  <p className="text-muted-foreground truncate">{group.platform} • {group.categoryName}</p>
                </div>
                <span className="font-mono bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg font-bold flex-shrink-0">
                  {group.joinCount || 0} joins
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: any;
  label: string;
  value?: number;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        highlight
          ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-bold truncate">{label}</span>
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value ?? 0}</p>
    </div>
  );
}
