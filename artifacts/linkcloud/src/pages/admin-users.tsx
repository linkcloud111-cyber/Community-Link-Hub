import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getAllUsers, updateUserRole } from "@/lib/firestore";
import type { UserProfile } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, Users, Shield, User, Search } from "lucide-react";

export default function AdminUsers() {
  const [location] = useLocation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

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

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const handleRoleToggle = async (uid: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (
      !confirm(
        `Change ${uid}'s role to ${newRole}? ${newRole === "admin" ? "This gives full admin access!" : ""}`
      )
    )
      return;
    setUpdating(uid);
    try {
      await updateUserRole(uid, newRole);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
      toast.success(`Role updated to ${newRole}`);
    } catch {
      toast.error("Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" /> Manage Users
        </h1>
        <p className="text-muted-foreground mt-1">{users.length} registered users.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        {adminNav.map((nav) => (
          <Link key={nav.href} href={nav.href}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              location === nav.href ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {nav.label}
          </Link>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((u) => (
              <div key={u.uid} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{u.displayName || "No name"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                  u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {u.role === "admin" ? <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Admin</span> : "User"}
                </span>
                <button
                  onClick={() => handleRoleToggle(u.uid, u.role)}
                  disabled={updating === u.uid}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                    u.role === "admin"
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {updating === u.uid ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : u.role === "admin" ? (
                    "Remove Admin"
                  ) : (
                    "Make Admin"
                  )}
                </button>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
