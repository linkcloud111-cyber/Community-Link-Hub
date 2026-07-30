import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getGroupById, updateGroup, getCategories } from "@/lib/firestore";
import type { Group, Category, Platform } from "@/lib/types";
import { INDIA_STATE_NAMES, getDistrictsForState } from "@/lib/india-data";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save } from "lucide-react";

const PLATFORMS: Platform[] = [
  "WhatsApp", "Telegram", "Discord", "Facebook Groups",
  "Instagram Broadcast", "X Communities", "LinkedIn Groups",
  "YouTube Channels", "Reddit",
];

const LANGUAGES = [
  "Hindi", "English", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati",
  "Kannada", "Malayalam", "Punjabi", "Odia", "Assamese", "Urdu", "Other",
];

export default function DashboardEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [group, setGroup] = useState<Group | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("WhatsApp");
  const [categoryId, setCategoryId] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [g, cats] = await Promise.all([getGroupById(id), getCategories()]);
        setCategories(cats);
        if (g) {
          setGroup(g);
          setName(g.name);
          setPlatform(g.platform);
          setCategoryId(g.categoryId);
          setState(g.state || "");
          setDistrict(g.district || "");
          setCity(g.city || "");
          setLanguage(g.language || "Hindi");
          setDescription(g.description);
          setRules(g.rules || "");
          setTagsInput(g.tags?.join(", ") || "");
          setJoinUrl(g.joinUrl);
          if (g.state) setDistricts(getDistrictsForState(g.state));
        }
      } catch (err) {
        toast.error("Failed to load community");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (state) {
      setDistricts(getDistrictsForState(state));
      if (!group?.state || group.state !== state) setDistrict("");
    }
  }, [state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !user) return;
    if (group.submittedBy !== user.uid) {
      toast.error("You can only edit your own submissions");
      return;
    }
    if (!categoryId) { toast.error("Please select a category"); return; }
    if (!state) { toast.error("Please select a state"); return; }

    setSaving(true);
    try {
      const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);

      await updateGroup(group.id, {
        name: name.trim(),
        platform,
        categoryId,
        categoryName,
        state,
        district,
        city: city.trim(),
        language,
        description: description.trim(),
        rules: rules.trim(),
        tags,
        joinUrl: joinUrl.trim(),
      });

      toast.success("Community updated successfully");
      setLocation("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Community not found.</p>
        <Link href="/dashboard" className="text-primary hover:underline mt-4 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  if (group.submittedBy !== user?.uid) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">You don't have permission to edit this community.</p>
        <Link href="/dashboard" className="text-primary hover:underline mt-4 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const inputClass = "w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm";
  const labelClass = "block text-sm font-semibold mb-1.5";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold">Edit Community</h1>
        <p className="text-muted-foreground mt-2">Update your community details. Changes will go live immediately.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Community Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={80} />
          </div>
          <div>
            <label className={labelClass}>Platform *</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={`${inputClass} cursor-pointer`}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Category *</label>
            <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Join Link *</label>
            <input required type="url" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="font-semibold mb-4">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>State *</label>
              <select required value={state} onChange={(e) => setState(e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="">Select State</option>
                {INDIA_STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>District</label>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!state} className={`${inputClass} cursor-pointer disabled:opacity-50`}>
                <option value="">Select District</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>City / Area</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="e.g. Bandra" />
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <label className={labelClass}>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-5">
          <div>
            <label className={labelClass}>Description *</label>
            <textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} maxLength={600} />
          </div>
          <div>
            <label className={labelClass}>Rules (optional)</label>
            <textarea rows={3} value={rules} onChange={(e) => setRules(e.target.value)} className={`${inputClass} resize-none`} maxLength={400} />
          </div>
          <div>
            <label className={labelClass}>Tags (comma separated)</label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/dashboard" className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors text-sm">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}
