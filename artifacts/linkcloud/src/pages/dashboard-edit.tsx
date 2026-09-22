import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTaxonomy } from "@/contexts/TaxonomyContext";
import { useLocation as useAppLocation } from "@/contexts/LocationContext";
import { getGroupById, updateGroup } from "@/lib/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { Group } from "@/lib/types";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Save,
  AlertTriangle,
  CloudUpload,
  AlertCircle,
  FileText,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { CharacterCounter } from "@/components/character-counter";
import { usePageTitle } from "@/lib/page-meta";

const AGE_OPTIONS = ["All Ages", "13+", "16+", "18+", "21+"];

export default function DashboardEdit() {
  const { id } = useParams();
  const { user, profile, isWebmaster } = useAuth();
  const [, setLocation] = useLocation();

  const {
    activeCategories: categories,
    activePlatforms: platforms,
    activeContentTypes: contentTypes,
    activeLanguages: languages,
  } = useTaxonomy();

  const { activeStates, getDistrictsForState } = useAppLocation();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  usePageTitle(group ? `Edit ${group.name}` : "Edit Community", "Member Dashboard");

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contentType, setContentType] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [minimumAge, setMinimumAge] = useState("All Ages");
  const [tagsInput, setTagsInput] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const g = await getGroupById(id);
        if (g) {
          setGroup(g);
          setName(g.name);
          setPlatform(g.platform);
          setCategoryId(g.categoryId);
          setContentType(g.contentType || "");
          setState(g.state || "");
          setDistrict(g.district || "");
          setCity(g.city || "");
          setLanguage(g.language || "");
          setDescription(g.description || "");
          setRules(g.rules || "");
          setMinimumAge(g.minimumAge ? `${g.minimumAge}+` : "All Ages");
          setTagsInput(g.tags && Array.isArray(g.tags) ? g.tags.join(", ") : "");
          setJoinUrl(g.joinUrl);
          setLogoPreview(g.logoUrl || "");
        }
      } catch (err) {
        toast.error("Failed to load community details.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const districts = state ? getDistrictsForState(state) : [];

  useEffect(() => {
    if (!contentType && contentTypes.length > 0) {
      setContentType(contentTypes[0].name);
    }
  }, [contentTypes, contentType]);

  useEffect(() => {
    if (state && (!group?.state || group.state !== state)) {
      setDistrict("");
    }
  }, [state]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo file size must be less than 2 MB.");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      toast.success("New logo selected.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !user) return;
    const isOwner = group.submittedBy === user.uid || (group as any).submitterUid === user.uid;
    const hasEditPermission = isOwner || isWebmaster || profile?.role === "webmaster";
    if (!hasEditPermission) {
      toast.error("You do not have permission to edit this community.");
      return;
    }
    if (!name.trim()) { toast.error("Name is required."); return; }
    if (!categoryId) { toast.error("Please select a Category."); return; }
    if (!state) { toast.error("Please select a State."); return; }
    if (!district) { toast.error("Please select a District."); return; }
    if (!city.trim()) { toast.error("City is required."); return; }
    if (description.trim().length < 20) { toast.error("Description must be at least 20 characters."); return; }
    if (!joinUrl.trim()) { toast.error("Invite Link is required."); return; }

    setSaving(true);
    try {
      let logoUrl = group.logoUrl || "";
      if (logoFile) {
        logoUrl = await uploadToCloudinary(logoFile);
      }

      const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
      const tags = Array.from(
        new Set(
          tagsInput
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        )
      );

      await updateGroup(group.id, {
        name: name.trim(),
        platform,
        categoryId,
        categoryName,
        contentType,
        logoUrl,
        state,
        district,
        city: city.trim(),
        language,
        description: description.trim(),
        rules: rules.trim(),
        minimumAge: minimumAge || "All Ages",
        tags,
        joinUrl: joinUrl.trim(),
        status: "pending", // Reset status to pending upon update for review
        changesRequested: false,
        changesRequestedMessage: "",
      });

      toast.success("Community updated and resubmitted for Webmaster review!");
      setLocation(isWebmaster ? "/webmaster/dashboard" : "/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to update community.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = Boolean(
    user && (group?.submittedBy === user.uid || (group as any)?.submitterUid === user.uid)
  );
  const canEdit = Boolean(isOwner || isWebmaster || profile?.role === "webmaster");

  if (!group || !canEdit) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-lg text-muted-foreground">You do not have permission to edit this community.</p>
        <Link href={isWebmaster ? "/webmaster/dashboard" : "/dashboard"} className="text-primary hover:underline font-bold inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full p-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm font-medium transition";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: isWebmaster ? "/webmaster/dashboard" : "/dashboard" },
          { label: "My Communities", href: isWebmaster ? "/webmaster/groups" : "/dashboard?tab=groups" },
          { label: `Edit: ${group.name}` },
        ]}
      />
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Edit Community Submission</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Update details and resubmit for Web Administrator review
        </p>
      </div>

      {group.changesRequested && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs sm:text-sm text-amber-700 dark:text-amber-400 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <span>
            <strong>Webmaster Requested Changes:</strong> {group.changesRequestedMessage || "Please update your community info and resubmit."}
          </span>
        </div>
      )}

      {group.status === "rejected" && group.rejectionReason && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs sm:text-sm text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Rejection Reason:</strong> {group.rejectionReason}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
        <div className="space-y-6">
          <h2 className="text-lg font-bold border-b border-border pb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Edit Community Details
          </h2>

          <div className="space-y-6">
            {/* Group Name */}
            <div>
              <label className={labelClass}>Group Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                maxLength={80}
              />
              <CharacterCounter current={name.length} max={80} />
            </div>

            {/* Platform */}
            <div>
              <label className={labelClass}>Platform *</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                {platforms.map((p) => (
                  <option key={p.id || p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className={labelClass}>Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Content Type */}
            <div>
              <label className={labelClass}>Content Type *</label>
              <select
                required
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                {contentTypes.map((ct) => (
                  <option key={ct.id || ct.name} value={ct.name}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Group Logo */}
            <div>
              <label className={labelClass}>Group Logo (Optional, Max 2 MB)</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 bg-background border border-border rounded-2xl">
                <div className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <PlatformIcon platform={platform} className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <label className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl cursor-pointer hover:bg-primary/90 transition inline-flex items-center gap-1.5">
                    <CloudUpload className="w-4 h-4" /> Change Logo
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Description *</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className={`${inputClass} resize-none`}
              />
              <CharacterCounter current={description.length} min={20} max={500} />
            </div>

            {/* Language */}
            <div>
              <label className={labelClass}>Language *</label>
              <select
                required
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                {languages.map((l) => (
                  <option key={l.id || l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <label className={labelClass}>State *</label>
              <select
                required
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setDistrict("");
                }}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Select State</option>
                {activeStates.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* District */}
            <div>
              <label className={labelClass}>District *</label>
              <select
                required
                disabled={!state}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className={`${inputClass} cursor-pointer disabled:opacity-50`}
              >
                <option value="">{state ? "Select District" : "Select State First"}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className={labelClass}>City *</label>
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Rules */}
            <div>
              <label className={labelClass}>Rules (Optional)</label>
              <textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                maxLength={300}
                className={`${inputClass} resize-none`}
              />
              <CharacterCounter current={rules.length} max={300} />
            </div>

            {/* Minimum Age */}
            <div>
              <label className={labelClass}>Minimum Age (Optional)</label>
              <select
                value={minimumAge}
                onChange={(e) => setMinimumAge(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                {AGE_OPTIONS.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className={labelClass}>Tags (Optional)</label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className={inputClass}
                placeholder="jobs, electrician, whatsapp, cg, room rent"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter keywords separated by commas (e.g. jobs, electrician, whatsapp, cg, room rent)
              </p>
            </div>

            {/* Invite Link */}
            <div>
              <label className={labelClass}>Invite Link *</label>
              <input
                required
                type="url"
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-border rounded-xl font-bold hover:bg-muted transition text-xs"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-extrabold rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 disabled:opacity-70 text-xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save & Resubmit Community
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
