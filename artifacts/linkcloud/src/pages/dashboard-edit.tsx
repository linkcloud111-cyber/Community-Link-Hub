import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useTaxonomy } from "@/contexts/TaxonomyContext";
import { useLocation as useAppLocation } from "@/contexts/LocationContext";
import { checkDuplicateGroup, getGroupById, updateGroup } from "@/lib/firestore";
import {
  parseAndValidateTags,
  getLiveTagStats,
  getGroupLimits,
  MAX_TAG_LENGTH,
} from "@/lib/group-validation";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getPlatformLinkHints, normalizePlatformKey, validateInviteLink } from "@/lib/utils";
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
  const { settings } = useSiteSettings();
  const groupLimits = getGroupLimits(settings);
  const [, setLocation] = useLocation();

  const {
    activeCategories: categories,
    activePlatforms: platforms,
    activeContentTypes: contentTypes,
    activeLanguages: languages,
  } = useTaxonomy();

  const { activeStates, getDistrictsForState, getCitiesForDistrict } = useAppLocation();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  usePageTitle(group ? `Edit ${group.name}` : "Edit Community", "Member Dashboard");

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
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
          setTagline(g.tagline || "");
          setPlatform(g.platform);
          setCategoryId(g.categoryId);
          setContentType(g.contentType || "");
          setState(g.state || "");
          setDistrict(g.district || "");
          setCity(g.city || "");
          setLanguage(g.language || "");
          setDescription(g.description || "");
          setRules(g.rules || "");
          setMinimumAge(g.minimumAge ? String(g.minimumAge) : "All Ages");
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
  const cities = state ? getCitiesForDistrict(state, district) : [];
  const activePlatform = platforms.find(
    (p) =>
      p.name.toLowerCase() === (platform || "").toLowerCase() ||
      normalizePlatformKey(p.name) === normalizePlatformKey(platform)
  );
  const linkHints = getPlatformLinkHints(platform, activePlatform?.helpText, activePlatform?.errorText);

  useEffect(() => {
    if (!contentType && contentTypes.length > 0) {
      setContentType(contentTypes[0].name);
    }
  }, [contentTypes, contentType]);

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
    const isWebmasterRole = isWebmaster || profile?.role === "webmaster";
    const ownerCanEditStatus = group.status === "pending" || group.allowResubmit === true;
    const hasEditPermission = isWebmasterRole || (isOwner && ownerCanEditStatus);
    if (!hasEditPermission) {
      toast.error(
        isOwner
          ? "Published or finalized listings can only be edited if the Webmaster enables resubmission. Please contact support for changes."
          : "You do not have permission to edit this community."
      );
      return;
    }
    if (!name.trim() || name.trim().length < 3) { toast.error("Name must be at least 3 characters."); return; }
    if (name.trim().length > groupLimits.nameMaxLength) { toast.error(`Name must not exceed ${groupLimits.nameMaxLength} characters.`); return; }
    if (tagline.trim().length > groupLimits.taglineMaxLength) { toast.error(`Short Tagline must not exceed ${groupLimits.taglineMaxLength} characters.`); return; }
    if (!categoryId) { toast.error("Please select a Category."); return; }
    if (!state) { toast.error("Please select a State."); return; }
    if (!district) { toast.error("Please select a District."); return; }
    if (!city.trim()) { toast.error("City is required."); return; }
    if (description.trim().length < groupLimits.descriptionMinLength) { toast.error(`Description must be at least ${groupLimits.descriptionMinLength} characters.`); return; }
    if (description.trim().length > groupLimits.descriptionMaxLength) { toast.error(`Description must not exceed ${groupLimits.descriptionMaxLength} characters.`); return; }
    if (rules.trim().length > groupLimits.rulesMaxLength) { toast.error(`Rules must not exceed ${groupLimits.rulesMaxLength} characters.`); return; }
    if (!joinUrl.trim()) { toast.error("Invite Link is required."); return; }
    if (groupLimits.requireGroupLogo && !group.logoUrl?.trim() && !logoFile) {
      toast.error("Group Logo is required by Webmaster settings.");
      return;
    }

    const tagCheck = parseAndValidateTags(tagsInput, { required: false, maxTags: groupLimits.maxTags });
    if (!tagCheck.valid) {
      toast.error(tagCheck.error || "Please enter valid tags.");
      return;
    }

    const urlCheck = validateInviteLink(joinUrl, platform, activePlatform?.invitePattern);
    if (!urlCheck.valid) {
      toast.error(urlCheck.error || linkHints.exampleError);
      return;
    }

    setSaving(true);
    try {
      const dup = await checkDuplicateGroup(name, joinUrl, group.id);
      if (dup.duplicateName) {
        toast.error("Another community with this exact name already exists.");
        setSaving(false);
        return;
      }
      if (dup.duplicateUrl) {
        toast.error("This invite link is already listed on another community.");
        setSaving(false);
        return;
      }

      let logoUrl = group.logoUrl || "";
      if (logoFile) {
        logoUrl = await uploadToCloudinary(
          logoFile,
          settings?.cloudinaryUploadPreset || settings?.cloudinarySettings?.uploadPreset,
          settings?.cloudinaryCloudName || settings?.cloudinarySettings?.cloudName,
          settings?.cloudinarySettings?.enabled !== false
        );
      }

      const categoryName = categories.find((c) => c.id === categoryId)?.name || "";
      const tags = tagCheck.tags;

      const isWebmasterUser = Boolean(isWebmaster || profile?.role === "webmaster");
      const nextStatus = isWebmasterUser && group.status === "approved" ? "approved" : "pending";

      await updateGroup(group.id, {
        name: name.trim(),
        tagline: tagline.trim(),
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
        status: nextStatus,
        changesRequested: false,
        changesRequestedMessage: "",
        ...(isWebmasterUser ? {} : { allowResubmit: false }),
      });

      toast.success(
        nextStatus === "approved"
          ? "Community updated successfully!"
          : "Community updated and resubmitted for Webmaster review!"
      );
      setLocation(isWebmasterUser ? "/webmaster/groups" : "/dashboard");
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
  const isWebmasterRole = Boolean(isWebmaster || profile?.role === "webmaster");
  const ownerCanEditStatus = Boolean(group && (group.status === "pending" || group.allowResubmit === true));
  const canEdit = Boolean(isWebmasterRole || (isOwner && ownerCanEditStatus));

  if (!group || !canEdit) {
    return (
      <div className="text-center py-20 space-y-4 max-w-lg mx-auto px-4">
        <p className="text-lg font-semibold text-foreground">
          {group && isOwner && !ownerCanEditStatus
            ? "This listing is locked for editing"
            : "You do not have permission to edit this community."}
        </p>
        {group && isOwner && !ownerCanEditStatus && (
          <p className="text-sm text-muted-foreground">
            Approved or finalized communities cannot be modified directly by members unless the Webmaster enables resubmission. Use Contact Webmaster in your dashboard if you need an update.
          </p>
        )}
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
                maxLength={groupLimits.nameMaxLength}
              />
              <CharacterCounter current={name.length} max={groupLimits.nameMaxLength} />
            </div>

            {/* Short Tagline */}
            <div>
              <label className={labelClass}>Short Tagline (Optional)</label>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Concise one-line summary shown on directory cards"
                className={inputClass}
                maxLength={groupLimits.taglineMaxLength}
              />
              <CharacterCounter current={tagline.length} max={groupLimits.taglineMaxLength} />
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
                maxLength={groupLimits.descriptionMaxLength}
                className={`${inputClass} resize-none`}
              />
              <CharacterCounter
                current={description.length}
                min={groupLimits.descriptionMinLength}
                max={groupLimits.descriptionMaxLength}
              />
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
                  setCity("");
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
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setCity("");
                }}
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
              {cities.length > 0 ? (
                <select
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Select City</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {city && !cities.some((c) => c.name === city) && (
                    <option value={city}>{city}</option>
                  )}
                </select>
              ) : (
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Mumbai, Bengaluru, Connaught Place"
                />
              )}
            </div>

            {/* Rules */}
            <div>
              <label className={labelClass}>Rules (Optional)</label>
              <textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                maxLength={groupLimits.rulesMaxLength}
                className={`${inputClass} resize-none`}
              />
              <CharacterCounter current={rules.length} max={groupLimits.rulesMaxLength} />
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
              {(() => {
                const tagStats = getLiveTagStats(tagsInput, groupLimits.maxTags);
                const tagCheck = tagsInput.trim()
                  ? parseAndValidateTags(tagsInput, { required: false, maxTags: groupLimits.maxTags })
                  : null;
                return (
                  <>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className={labelClass}>Tags (Optional)</label>
                      <span
                        className={`text-xs font-bold ${
                          tagStats.count > groupLimits.maxTags || (tagCheck && !tagCheck.valid)
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {tagStats.count} / {groupLimits.maxTags} Tags ({tagStats.remaining} remaining)
                      </span>
                    </div>
                    <input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className={`${inputClass} ${
                        tagCheck && !tagCheck.valid ? "border-destructive focus:ring-destructive" : ""
                      }`}
                      placeholder="jobs, electrician, whatsapp, cg, room rent"
                    />
                    {tagCheck && !tagCheck.valid ? (
                      <p className="text-xs font-medium text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {tagCheck.error}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Up to {groupLimits.maxTags} comma-separated tags (max {MAX_TAG_LENGTH} characters each, no empty or duplicate tags).
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Invite Link */}
            <div>
              <label className={labelClass}>Invite Link * ({platform})</label>
              <input
                required
                type="url"
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                placeholder={linkHints.placeholder}
                className={inputClass}
              />
              <p className="text-[11px] text-muted-foreground mt-1">{linkHints.hint}</p>
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
