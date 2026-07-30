import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getUserGroups, deleteGroup } from "@/lib/firestore";
import type { Group } from "@/lib/types";
import { Plus, LayoutGrid, CheckCircle2, Clock, XCircle, Trash2, Edit, ExternalLink, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGroups() {
      if (!user) return;
      try {
        const data = await getUserGroups(user.uid);
        setGroups(data);
      } catch (err) {
        toast.error("Failed to load your communities");
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, [user]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    
    try {
      await deleteGroup(id);
      setGroups(groups.filter(g => g.id !== id));
      toast.success("Community deleted successfully");
    } catch (err) {
      toast.error("Failed to delete community");
    }
  };

  const stats = {
    total: groups.length,
    approved: groups.filter(g => g.status === "approved").length,
    pending: groups.filter(g => g.status === "pending").length,
    rejected: groups.filter(g => g.status === "rejected").length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {profile?.displayName || "User"}</h1>
          <p className="text-muted-foreground mt-2">Manage your submitted communities here.</p>
        </div>
        <Link 
          href="/dashboard/submit" 
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" /> Submit Community
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-2">
            <LayoutGrid className="w-5 h-5" /> <span className="font-medium text-sm">Total</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <CheckCircle2 className="w-5 h-5" /> <span className="font-medium text-sm">Approved</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.approved}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-amber-600 mb-2">
            <Clock className="w-5 h-5" /> <span className="font-medium text-sm">Pending</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 text-destructive mb-2">
            <XCircle className="w-5 h-5" /> <span className="font-medium text-sm">Rejected</span>
          </div>
          <p className="text-3xl font-bold text-destructive">{stats.rejected}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">My Communities</h2>
        </div>
        
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
            <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No communities submitted yet.</p>
            <p className="text-sm mt-1 mb-6">Share your first community to get started.</p>
            <Link href="/dashboard/submit" className="text-primary font-medium hover:underline">Submit now</Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={group.id} 
                className="p-6 flex flex-col md:flex-row items-center gap-6 hover:bg-muted/30 transition-colors"
              >
                <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden flex-shrink-0 border border-border">
                  {group.logoUrl ? (
                    <img src={group.logoUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xl uppercase text-muted-foreground">
                      {group.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 text-center md:text-left space-y-1">
                  <h3 className="text-lg font-bold">
                    <Link href={`/groups/${group.id}`} className="hover:text-primary transition-colors">
                      {group.name}
                    </Link>
                  </h3>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm text-muted-foreground">
                    <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-xs font-medium">
                      {group.platform}
                    </span>
                    <span>•</span>
                    <span>{group.categoryName}</span>
                    <span>•</span>
                    <span>{group.joinCount} joins</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {group.status === "approved" && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  )}
                  {group.status === "pending" && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  )}
                  {group.status === "rejected" && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-destructive/10 text-destructive rounded-full text-xs font-bold uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5" /> Rejected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 md:mt-0">
                  <Link href={`/dashboard/edit/${group.id}`} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" title="Edit">
                    <Edit className="w-5 h-5" />
                  </Link>
                  <a href={group.joinUrl} target="_blank" rel="noreferrer" className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Visit">
                    <ExternalLink className="w-5 h-5" />
                  </a>
                  <button onClick={() => handleDelete(group.id, group.name)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}