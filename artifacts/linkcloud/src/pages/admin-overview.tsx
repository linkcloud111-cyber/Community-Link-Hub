import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getAdminStats } from "@/lib/firestore";
import {
  Loader2, Users, LayoutGrid, CheckCircle2, XCircle,
  AlertTriangle, ShieldCheck, MessageSquare, TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PLATFORM_COLORS: Record<string, string> = {
  WhatsApp: "#22c55e",
  Telegram: "#60a5fa",
  Discord: "#818cf8",
  "Facebook Groups": "#2563eb",
  "Instagram Broadcast": "#ec4899",
  "X Communities": "#94a3b8",
  "LinkedIn Groups": "#1d4ed8",
  "YouTube Channels": "#ef4444",
  Reddit: "#f97316",
};

export default function AdminOverview() {
  const [location] = useLocation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = stats
    ? Object.entries(stats.platformCounts).map(([name, value]) => ({ name: name.split(" ")[0], value }))
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" /> Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Platform overview and management.</p>
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
            {nav.href === "/admin/reports" && stats?.pendingReports > 0 && (
              <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {stats.pendingReports}
              </span>
            )}
            {nav.href === "/admin/contacts" && stats?.unreadContacts > 0 && (
              <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {stats.unreadContacts}
              </span>
            )}
            {nav.href === "/admin/groups" && stats?.pendingGroups > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {stats.pendingGroups}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={LayoutGrid} label="Total Groups" value={stats?.totalGroups} />
        <StatCard icon={AlertTriangle} label="Pending" value={stats?.pendingGroups} color="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={stats?.approvedGroups} color="emerald" />
        <StatCard icon={XCircle} label="Rejected" value={stats?.rejectedGroups} color="red" />
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers} />
        <StatCard icon={LayoutGrid} label="Categories" value={stats?.totalCategories} />
        <StatCard icon={AlertTriangle} label="Pending Reports" value={stats?.pendingReports} color="red" />
        <StatCard icon={MessageSquare} label="Unread Messages" value={stats?.unreadContacts} color="blue" />
      </div>

      {/* Total joins */}
      {stats?.totalJoins > 0 && (
        <div className="bg-card border border-border p-6 rounded-2xl flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-emerald-500" />
          <div>
            <p className="text-muted-foreground text-sm">Total Community Joins</p>
            <p className="text-3xl font-bold">{stats.totalJoins.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Platform chart */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-3xl p-6">
          <h2 className="text-lg font-bold mb-6">Platform Distribution (Approved Groups)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry, index) => (
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
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/admin/groups" className="p-5 bg-card border border-amber-500/30 rounded-2xl hover:border-amber-500/60 transition-colors group">
          <AlertTriangle className="w-5 h-5 text-amber-500 mb-2" />
          <p className="font-semibold">Review Pending Groups</p>
          <p className="text-sm text-muted-foreground mt-1">{stats?.pendingGroups} awaiting approval</p>
        </Link>
        <Link href="/admin/reports" className="p-5 bg-card border border-destructive/30 rounded-2xl hover:border-destructive/60 transition-colors">
          <AlertTriangle className="w-5 h-5 text-destructive mb-2" />
          <p className="font-semibold">Handle Reports</p>
          <p className="text-sm text-muted-foreground mt-1">{stats?.pendingReports} pending reports</p>
        </Link>
        <Link href="/admin/contacts" className="p-5 bg-card border border-blue-500/30 rounded-2xl hover:border-blue-500/60 transition-colors">
          <MessageSquare className="w-5 h-5 text-blue-500 mb-2" />
          <p className="font-semibold">Contact Messages</p>
          <p className="text-sm text-muted-foreground mt-1">{stats?.unreadContacts} unread messages</p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | undefined;
  color?: "amber" | "emerald" | "red" | "blue";
}) {
  const colorMap = {
    amber: "text-amber-500 border-amber-500/30",
    emerald: "text-emerald-500 border-emerald-500/30",
    red: "text-destructive border-destructive/30",
    blue: "text-blue-500 border-blue-500/30",
  };
  const cls = color ? colorMap[color] : "text-muted-foreground border-border";

  return (
    <div className={`bg-card border ${cls.split(" ")[1]} p-5 rounded-2xl`}>
      <div className={`flex items-center gap-2 mb-2 ${cls.split(" ")[0]}`}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color ? cls.split(" ")[0] : "text-foreground"}`}>
        {value ?? 0}
      </p>
    </div>
  );
}
