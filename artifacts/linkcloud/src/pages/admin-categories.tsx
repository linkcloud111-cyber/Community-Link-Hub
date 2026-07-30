import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/firestore";
import type { Category } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Check, X, Tag } from "lucide-react";

export default function AdminCategories() {
  const [location] = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🏷️");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [saving, setSaving] = useState(false);

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
    getCategories()
      .then(setCategories)
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const id = await createCategory({ name: newName.trim(), icon: newIcon, groupCount: 0 });
      setCategories((prev) => [...prev, { id, name: newName.trim(), icon: newIcon, groupCount: 0 } as any]);
      setNewName("");
      setNewIcon("🏷️");
      setAdding(false);
      toast.success("Category added");
    } catch {
      toast.error("Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateCategory(id, { name: editName.trim(), icon: editIcon });
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editName.trim(), icon: editIcon } : c))
      );
      setEditId(null);
      toast.success("Category updated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Existing groups will keep their category name.")) return;
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Tag className="w-7 h-7 text-primary" /> Categories
          </h1>
          <p className="text-muted-foreground mt-1">Manage group categories.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
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

      {/* Add form */}
      {adding && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 flex items-center gap-3 flex-wrap">
          <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} className="w-14 p-2 text-2xl text-center bg-background border border-border rounded-xl outline-none" maxLength={2} />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="flex-1 min-w-[160px] px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newName.trim()} className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => setAdding(false)} className="p-2 bg-muted rounded-lg hover:bg-muted/80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-3xl">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">No categories yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="divide-y divide-border">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-4 px-5 py-4">
                {editId === cat.id ? (
                  <>
                    <input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} className="w-12 p-1.5 text-xl text-center bg-background border border-border rounded-lg outline-none" maxLength={2} />
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") handleEdit(cat.id); if (e.key === "Escape") setEditId(null); }}
                      autoFocus
                    />
                    <button onClick={() => handleEdit(cat.id)} disabled={saving} className="p-1.5 bg-primary text-primary-foreground rounded-lg">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1.5 bg-muted rounded-lg">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">{cat.groupCount || 0} groups</p>
                    </div>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditIcon(cat.icon); }}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
