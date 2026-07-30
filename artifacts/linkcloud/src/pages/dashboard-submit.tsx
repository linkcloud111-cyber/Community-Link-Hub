import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { createGroup, getCategories } from "@/lib/firestore";
import type { Category, Platform } from "@/lib/types";
import { INDIA_STATE_NAMES, getDistrictsForState } from "@/lib/india-data";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ImagePlus, CloudUpload } from "lucide-react";

const PLATFORMS: Platform[] = [
  "WhatsApp", "Telegram", "Discord", "Facebook Groups",
  "Instagram Broadcast", "X Communities", "LinkedIn Groups",
  "YouTube Channels", "Reddit",
];

const LANGUAGES = [
  "Hindi", "English", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati",
  "Kannada", "Malayalam", "Punjabi", "Odia", "Assamese", "Urdu", "Other",
];

export default function DashboardSubmit() {
  const { user, profile } = useAuth();
  const [, setLocation] = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingInitial(false));
  }, []);

  useEffect(() => {
    setDistrict("");
    setDistricts(state ? getDistrictsForState(state) : []);
  }, [state]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > 3 * 1024 * 1024) {
        toast.error("Logo must be under 3MB");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!categoryId) { toast.error("Please select a category"); return; }
    if (!state) { toast.error("Please select a state"); return; }
    if (description.trim().length < 20) { toast.error("Description must be at least 20 characters"); return; }

    setIsSubmitting(true);
    try {
      let logoUrl = "";
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const storageRef = ref(storage, `logos/${user.uid}_${Date.now()}.${ext}`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);

      await createGroup({
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
        logoUrl,
        submittedBy: user.uid,
        submittedByName: profile.displayName || user.displayName || user.email || "User",
        submittedByEmail: user.email || "",
        status: "pending",
        featured: false,
        trending: false,
      });

      toast.success("Community submitted! It is pending admin approval.");
      setLocation("/dashboard");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to submit community");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
        <h1 className="text-3xl font-bold">Submit a Community</h1>
        <p className="text-muted-foreground mt-2">
          Add your group to the directory. It will be reviewed before going live.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-8">
        {/* Logo upload */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="relative w-28 h-28 rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden group flex-shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-7 h-7 text-muted-foreground" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
              <CloudUpload className="w-6 h-6 text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">Community Logo</h3>
            <p className="text-sm text-muted-foreground">Upload a square image (JPG, PNG, max 3MB).</p>
          </div>
        </div>

        {/* Basic info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Community Name *</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Mumbai Developers" maxLength={80} />
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
            <input required type="url" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} className={inputClass} placeholder="https://..." />
          </div>
        </div>

        {/* Location */}
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
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="e.g. Bandra, Koramangala" />
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <label className={labelClass}>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Description & tags */}
        <div className="border-t border-border pt-6 space-y-5">
          <div>
            <label className={labelClass}>Description *</label>
            <textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} placeholder="What is this community about?" maxLength={600} />
          </div>
          <div>
            <label className={labelClass}>Rules (optional)</label>
            <textarea rows={3} value={rules} onChange={(e) => setRules(e.target.value)} className={`${inputClass} resize-none`} placeholder="Community rules (no spam, etc.)" maxLength={400} />
          </div>
          <div>
            <label className={labelClass}>Tags (optional)</label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} placeholder="Comma separated: coding, react, webdev" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-70"
          >
            {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : "Submit Community"}
          </button>
        </div>
      </form>
    </div>
  );
}
