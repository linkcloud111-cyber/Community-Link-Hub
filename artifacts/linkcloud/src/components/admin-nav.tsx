import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getAdminStats } from "@/lib/firestore";
import {
  ShieldCheck,
  LayoutGrid,
  Users,
  FolderTree,
  MapPin,
  ShieldAlert,
  MessageSquare,
  Bell,
  Settings,
} from "lucide-react";

interface AdminNavProps {
  stats?: {
    pendingGroups?: number;
    pendingReports?: number;
    unreadContacts?: number;
    pendingDeletions?: number;
  };
}

export default function AdminNav({ stats: initialStats }: AdminNavProps) {
  const [location] = useLocation();
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    if (!initialStats) {
      getAdminStats()
        .then((s) => {
          setStats({
            pendingGroups: s?.pendingGroups,
            pendingReports: s?.pendingReports,
            unreadContacts: s?.unreadContacts,
            pendingDeletions: s?.pendingDeletions,
          });
        })
        .catch(() => {});
    } else {
      setStats(initialStats);
    }
  }, [initialStats]);

  const navItems = [
    { href: "/webmaster", label: "Overview", icon: ShieldCheck },
    { href: "/webmaster/groups", label: "Groups", icon: LayoutGrid, count: stats?.pendingGroups, badgeColor: "bg-amber-500 text-white" },
    { href: "/webmaster/users", label: "Users", icon: Users, count: stats?.pendingDeletions, badgeColor: "bg-rose-500 text-white" },
    { href: "/webmaster/categories", label: "Taxonomy", icon: FolderTree },
    { href: "/webmaster/locations", label: "Locations", icon: MapPin },
    { href: "/webmaster/reports", label: "Reports & Links", icon: ShieldAlert, count: stats?.pendingReports, badgeColor: "bg-destructive text-destructive-foreground" },
    { href: "/webmaster/contacts", label: "Inbox & Grievances", icon: MessageSquare, count: stats?.unreadContacts, badgeColor: "bg-blue-500 text-white" },
    { href: "/webmaster/notifications", label: "Broadcasts", icon: Bell },
    { href: "/webmaster/settings", label: "Settings & SEO", icon: Settings },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6 scrollbar-none border-b border-border">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          location === item.href ||
          (item.href === "/webmaster" && (location === "/webmaster/dashboard" || location === "/webmaster")) ||
          (item.href !== "/webmaster" && location.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[44px] ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
            {item.count && item.count > 0 ? (
              <span className={`text-[10px] font-extrabold rounded-full px-2 py-0.5 ${item.badgeColor}`}>
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
