import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTaxonomy } from "@/contexts/TaxonomyContext";
import { useLocation as useAppLocation } from "@/contexts/LocationContext";
import { createGroup, checkDuplicateGroup } from "@/lib/firestore";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  ImagePlus,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  ShieldAlert,
  Info,
  X,
  FileText,
  RotateCcw,
  Check,
  Building,
  Globe,
  MapPin,
  Tag,
  Share2,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";

const AGE_OPTIONS = ["All Ages", "13+", "16+", "18+", "21+"];

const DRAFT_KEY = "linkcloud_submit_draft";

const DEFAULT_PLATFORM_CONFIG = {
  pattern: /^https?:\/\/.+/i,
  errorText: "Invite Link must be a valid URL starting with http:// or https://",
  placeholder: "https://...",
  helpText: "Paste your community invite or join link",
  example: "https://example.com/join",
};

const PLATFORM_CONFIGS: Record<string, typeof DEFAULT_PLATFORM_CONFIG> = {
  whatsapp: {
    pattern: /^(https?:\/\/)?(chat\.whatsapp\.com|wa\.me)\/.+/i,
    errorText: "Invalid WhatsApp URL. Must start with chat.whatsapp.com or wa.me",
    placeholder: "https://chat.whatsapp.com/...",
    helpText: "Paste your WhatsApp Group invite link",
    example: "https://chat.whatsapp.com/L1234567890abcdef",
  },
  telegram: {
    pattern: /^(https?:\/\/)?(t\.me|telegram\.me)\/.+/i,
    errorText: "Invalid Telegram URL. Must start with t.me or telegram.me",
    placeholder: "https://t.me/...",
    helpText: "Paste your Telegram channel or group link",
    example: "https://t.me/mygroup",
  },
  discord: {
    pattern: /^(https?:\/\/)?(discord\.(gg|com\/invite))\/.+/i,
    errorText: "Invalid Discord URL. Must start with discord.gg or discord.com/invite",
    placeholder: "https://discord.gg/...",
    helpText: "Paste your Discord server invite link",
    example: "https://discord.gg/abc123xyz",
  },
  signal: {
    pattern: /^(https?:\/\/)?(signal\.(group|me))\/.+/i,
    errorText: "Invalid Signal URL. Must start with signal.group",
    placeholder: "https://signal.group/#...",
    helpText: "Paste your Signal group invite link",
    example: "https://signal.group/#CjQK...",
  },
  facebook: {
    pattern: /^(https?:\/\/)?(www\.)?facebook\.com\/.+/i,
    errorText: "Invalid Facebook URL. Must be a facebook.com link",
    placeholder: "https://facebook.com/groups/...",
    helpText: "Paste your Facebook Group or Page link",
    example: "https://facebook.com/groups/mygroup",
  },
  instagram: {
    pattern: /^(https?:\/\/)?(www\.)?instagram\.com\/.+/i,
    errorText: "Invalid Instagram URL. Must be an instagram.com link",
    placeholder: "https://instagram.com/...",
    helpText: "Paste your Instagram channel or account link",
    example: "https://instagram.com/myaccount",
  },
  youtube: {
    pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i,
    errorText: "Invalid YouTube URL. Must be a youtube.com link",
    placeholder: "https://youtube.com/@...",
    helpText: "Paste your YouTube channel link",
    example: "https://youtube.com/@mychannel",
  },
  twitter: {
    pattern: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+/i,
    errorText: "Invalid X/Twitter URL. Must be a twitter.com or x.com link",
    placeholder: "https://x.com/...",
    helpText: "Paste your X/Twitter profile or community link",
    example: "https://x.com/i/communities/123",
  },
  linkedin: {
    pattern: /^(https?:\/\/)?(www\.)?linkedin\.com\/.+/i,
    errorText: "Invalid LinkedIn URL. Must be a linkedin.com link",
    placeholder: "https://linkedin.com/groups/...",
    helpText: "Paste your LinkedIn Group or Page link",
    example: "https://linkedin.com/groups/123456",
  },
  reddit: {
    pattern: /^(https?:\/\/)?(www\.)?reddit\.com\/r\/.+/i,
    errorText: "Invalid Reddit URL. Must start with reddit.com/r/",
    placeholder: "https://reddit.com/r/...",
    helpText: "Paste your Subreddit link",
    example: "https://reddit.com/r/mycommunity",
  },
};

function getPlatformConfig(platformName: string) {
  const key = (platformName || "").toLowerCase().trim();
  return PLATFORM_CONFIGS[key] || DEFAULT_PLATFORM_CONFIG;
}

export default function DashboardSubmit() {
  const { user, isWebmaster, profile } = useAuth();
  const [, setLocation] = useLocation();
  const {
    activeCategories: categories,
    activePlatforms: platforms,
    activeContentTypes: contentTypes,
    activeLanguages: languages,
    loading: loadingInitial,
  } = useTaxonomy();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const draftKey = useMemo(() => `linkcloud_submit_draft_${user?.uid || "guest"}`, [user?.uid]);

  // Form Fields
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contentType, setContentType] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [rules, setRules] = useState("");
  const [minimumAge, setMinimumAge] = useState("All Ages");
  const [tagsInput, setTagsInput] = useState("");
  const [joinUrl, setJoinUrl] = useState("");

  // Real-time validation & duplicate state
  const [duplicateName, setDuplicateName] = useState(false);
  const [duplicateUrl, setDuplicateUrl] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [urlFormatError, setUrlFormatError] = useState("");

  // Draft banner state
  const [hasDraft, setHasDraft] = useState(false);

  // Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Unsaved changes tracking
  const [isDirty, setIsDirty] = useState(false);

  // Sync default taxonomy values
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
    if (!platform && platforms.length > 0) {
      setPlatform(platforms[0].name);
    }
    if (!contentType && contentTypes.length > 0) {
      setContentType(contentTypes[0].name);
    }
    if (!language && languages.length > 0) {
      setLanguage(languages[0].name);
    }
  }, [categories, platforms, contentTypes, languages]);

  // Check for draft in localStorage
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name || parsed.joinUrl || parsed.description) {
          setHasDraft(true);
        }
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey]);

  const { activeStates, getDistrictsForState } = useAppLocation();
  const districts = state ? getDistrictsForState(state) : [];

  // Update Platform URL validation when platform or joinUrl changes
  useEffect(() => {
    const config = getPlatformConfig(platform);
    if (joinUrl.trim()) {
      if (!config.pattern.test(joinUrl.trim())) {
        setUrlFormatError(config.errorText);
      } else {
        setUrlFormatError("");
      }
    } else {
      setUrlFormatError("");
    }
  }, [platform, joinUrl]);

  // Debounced real-time duplicate checking
  useEffect(() => {
    if (!name.trim() && !joinUrl.trim()) {
      setDuplicateName(false);
      setDuplicateUrl(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      const res = await checkDuplicateGroup(name, joinUrl);
      setDuplicateName(res.duplicateName);
      setDuplicateUrl(res.duplicateUrl);
      setCheckingDuplicates(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [name, joinUrl]);

  // Auto Save Draft & dirty flag
  useEffect(() => {
    if (name || joinUrl || description || state || city || rules) {
      setIsDirty(true);
      const draftObj = {
        name,
        platform,
        categoryId,
        contentType,
        description,
        language,
        state,
        district,
        city,
        rules,
        minimumAge,
        joinUrl,
      };
      localStorage.setItem(draftKey, JSON.stringify(draftObj));
    }
  }, [name, platform, categoryId, contentType, description, language, state, district, city, rules, minimumAge, joinUrl, draftKey]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !submittedSuccess) {
        e.preventDefault();
        e.returnValue = "You have unsaved group submission changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, submittedSuccess]);

  // Restore Draft
  const handleRestoreDraft = () => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (data.name) setName(data.name);
      if (data.platform) setPlatform(data.platform);
      if (data.categoryId) setCategoryId(data.categoryId);
      if (data.contentType) setContentType(data.contentType);
      if (data.description) setDescription(data.description);
      if (data.language) setLanguage(data.language);
      if (data.state) setState(data.state);
      if (data.district) setDistrict(data.district);
      if (data.city) setCity(data.city);
      if (data.rules) setRules(data.rules);
      if (data.minimumAge) setMinimumAge(data.minimumAge);
      if (data.joinUrl) setJoinUrl(data.joinUrl);
      toast.success("Saved submission draft restored!");
    } catch {
      toast.error("Failed to restore draft.");
    } finally {
      setHasDraft(false);
    }
  };

  // Discard Draft
  const handleDiscardDraft = () => {
    localStorage.removeItem(draftKey);
    setHasDraft(false);
    toast.info("Draft discarded.");
  };

  // Handle Logo Upload (JPG, JPEG, PNG, WEBP, Max 2MB)
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file format. Please upload JPG, JPEG, PNG, or WEBP image.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo file size must be less than 2 MB.");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      toast.success("Logo file attached!");
    }
  };

  // Progress Calculation (Required fields: Name, Platform, Category, ContentType, Description, Language, State, District, City, JoinUrl)
  const calculateProgress = () => {
    let filled = 0;
    const total = 9;

    if (name.trim().length >= 3) filled++;
    if (platform) filled++;
    if (categoryId) filled++;
    if (contentType) filled++;
    if (description.trim().length >= 20 && description.trim().length <= 500) filled++;
    if (language) filled++;
    if (state) filled++;
    if (district) filled++;
    if (joinUrl.trim() && !urlFormatError) filled++;

    return Math.round((filled / total) * 100);
  };

  const progressPercent = calculateProgress();

  // Validate form prior to opening Preview
  const handleOpenPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) {
      toast.error("Please sign in to submit a community.");
      setLocation("/login");
      return;
    }
    if (!name.trim()) { toast.error("Group Name is required."); return; }
    if (duplicateName) { toast.error("A group with this exact name already exists."); return; }
    if (!categoryId) { toast.error("Please select a Category."); return; }
    if (!description.trim()) { toast.error("Description is required."); return; }
    if (description.trim().length < 20) { toast.error("Description must be at least 20 characters."); return; }
    if (description.trim().length > 500) { toast.error("Description must not exceed 500 characters."); return; }
    if (!state) { toast.error("Please select a State."); return; }
    if (!district) { toast.error("Please select a District."); return; }
    if (!city.trim()) { toast.error("City is required."); return; }
    if (!joinUrl.trim()) { toast.error("Invite Link is required."); return; }
    if (urlFormatError) { toast.error(urlFormatError); return; }
    if (duplicateUrl) { toast.error("This Invite Link has already been submitted to LinkCloud."); return; }

    setPreviewOpen(true);
  };

  // Final Submit Action
  const handleFinalSubmit = async () => {
    if (!user || !profile) return;
    if (!termsAccepted) {
      toast.error("Please confirm ownership / permission terms checkbox to proceed.");
      return;
    }

    setIsSubmitting(true);
    try {
      let logoUrl = "";
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

      await createGroup({
        name: name.trim(),
        platform,
        categoryId,
        categoryName,
        contentType,
        logoUrl,
        description: description.trim(),
        language,
        state,
        district,
        city: city.trim(),
        rules: rules.trim(),
        minimumAge: minimumAge || "All Ages",
        tags,
        joinUrl: joinUrl.trim(),
        submittedBy: user.uid,
        submittedByName: profile.displayName || user.displayName || user.email || "User",
        submittedByEmail: user.email || "",
        status: (isWebmaster || profile?.role === "webmaster") ? "approved" : "pending",
      });

      // Clear draft
      localStorage.removeItem(draftKey);
      setIsDirty(false);
      setPreviewOpen(false);
      setSubmittedSuccess(true);
      toast.success("Group submitted successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // SUCCESS SCREEN VIEW
  if (submittedSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-foreground">
            {isWebmaster ? "Group Approved & Published!" : "Submission Successful!"}
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Your group <strong className="text-foreground">"{name}"</strong> has been submitted successfully.
            {isWebmaster
              ? " It was automatically approved with Webmaster authority and is now live on LinkCloud."
              : " It is currently under review by the Web Administrator."}
          </p>
        </div>

        <div className="p-6 bg-card border border-border rounded-2xl text-left space-y-3 text-xs sm:text-sm">
          <div className="flex justify-between py-1 border-b border-border/60">
            <span className="text-muted-foreground font-medium">Platform</span>
            <span className="font-bold flex items-center gap-1">
              <PlatformIcon platform={platform} className="w-4 h-4" /> {platform}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/60">
            <span className="text-muted-foreground font-medium">Category</span>
            <span className="font-bold">{categories.find((c) => c.id === categoryId)?.name}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/60">
            <span className="text-muted-foreground font-medium">Location</span>
            <span className="font-bold">{city}, {district}, {state}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground font-medium">Status</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
              isWebmaster
                ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20"
                : "text-amber-600 bg-amber-500/10"
            }`}>
              {isWebmaster ? "Approved & Live" : "Pending Review"}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href={isWebmaster ? "/webmaster/dashboard" : "/dashboard"}
            className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition shadow-md"
          >
            Go to My Dashboard
          </Link>

          <button
            onClick={() => {
              setName("");
              setDescription("");
              setRules("");
              setJoinUrl("");
              setLogoFile(null);
              setLogoPreview("");
              setSubmittedSuccess(false);
              setTermsAccepted(false);
            }}
            className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-sm transition"
          >
            Submit Another Group
          </button>
        </div>
      </div>
    );
  }

  const currentPlatformConfig = getPlatformConfig(platform);
  const inputClass =
    "w-full p-3.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm font-medium transition placeholder:text-muted-foreground/60";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Link
            href={isWebmaster ? "/webmaster/dashboard" : "/dashboard"}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Group Submission Module</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            List your WhatsApp, Telegram, Discord or Social community on LinkCloud
          </p>
        </div>

        {/* Form Progress Card */}
        <div className="w-full md:w-64 bg-card border border-border rounded-2xl p-3 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Form Completion
            </span>
            <span className="text-primary font-extrabold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-blue-500 to-indigo-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* DRAFT NOTIFICATION BANNER */}
      {hasDraft && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between gap-4 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary flex-shrink-0" />
            <span>
              <strong>Saved Draft Found:</strong> We restored your previous unsaved community details.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition text-xs"
            >
              Restore Draft
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg transition text-xs"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* SUBMISSION FORM */}
      <form onSubmit={handleOpenPreview} className="space-y-8">
        {/* SECTION 1: COMMUNITY INFORMATION */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                01
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 1: COMMUNITY INFORMATION
                </h2>
                <p className="text-xs text-muted-foreground">Basic identifiers and classification</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* FIELD 1: Group Name * */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className={labelClass}>1. Group Name *</label>
                {checkingDuplicates && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking duplicates...
                  </span>
                )}
              </div>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputClass} ${duplicateName ? "border-destructive ring-1 ring-destructive" : ""}`}
                placeholder="e.g. India Tech & Developers Club"
                maxLength={80}
              />
              {duplicateName && (
                <p className="text-xs text-destructive mt-1.5 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> A community with this exact name already exists.
                </p>
              )}
            </div>

            {/* FIELD 2: Platform * */}
            <div>
              <label className={labelClass}>2. Platform *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2.5">
                {platforms.map((p) => {
                  const pName = typeof p === "string" ? p : p.name;
                  const pId = typeof p === "string" ? p : (p.id || pName);
                  const isSelected = platform === pName;
                  return (
                    <button
                      type="button"
                      key={pId}
                      onClick={() => setPlatform(pName)}
                      className={`p-3 rounded-2xl border text-left transition flex items-center gap-2.5 ${
                        isSelected
                          ? "bg-primary/10 border-primary text-foreground font-bold shadow-sm"
                          : "bg-background border-border hover:border-primary/50 text-muted-foreground"
                      }`}
                    >
                      <PlatformIcon platform={pName} className="w-5 h-5 flex-shrink-0" />
                      <span className="text-xs truncate">{pName}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* FIELD 3: Category * */}
              <div>
                <label className={labelClass}>3. Category *</label>
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

              {/* FIELD 4: Content Type * */}
              <div>
                <label className={labelClass}>4. Content Type *</label>
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

              {/* FIELD 5: Language * */}
              <div>
                <label className={labelClass}>5. Language *</label>
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
            </div>
          </div>
        </div>

        {/* SECTION 2: COMMUNITY DETAILS */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                02
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 2: COMMUNITY DETAILS
                </h2>
                <p className="text-xs text-muted-foreground">Description, search tags, and group logo</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* FIELD 6: Description * */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className={labelClass}>6. Description *</label>
                <span
                  className={`text-xs font-bold ${
                    description.length > 500
                      ? "text-destructive"
                      : description.length < 20
                      ? "text-amber-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {description.length} / 500 Characters
                </span>
              </div>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className={`${inputClass} resize-none`}
                placeholder="Describe what your community is about, rules, and benefits for new members..."
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Minimum 20 characters, Maximum 500 characters. Character counter provided.
              </p>
            </div>

            {/* FIELD 7: Tags * */}
            <div>
              <label className={labelClass}>7. Tags *</label>
              <input
                required
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className={inputClass}
                placeholder="jobs, electrician, whatsapp, cg, room rent"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter keywords separated by commas (e.g. jobs, electrician, whatsapp, cg, room rent)
              </p>
            </div>

            {/* FIELD 8: Group Logo (Optional) */}
            <div>
              <label className={labelClass}>8. Group Logo (Optional, Max 2 MB)</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 bg-background border border-border rounded-2xl">
                <div className="relative w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground space-y-1">
                      <PlatformIcon platform={platform} className="w-8 h-8" />
                      <span className="text-[9px] font-bold uppercase">Default Icon</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl cursor-pointer hover:bg-primary/90 transition inline-flex items-center gap-1.5">
                      <CloudUpload className="w-4 h-4" /> Upload Custom Logo
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>

                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview("");
                        }}
                        className="text-xs text-destructive hover:underline font-bold"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Supported: JPG, JPEG, PNG, WEBP (Max 2 MB). If no logo is uploaded, LinkCloud will automatically display the official {platform} icon.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: LOCATION */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                03
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 3: LOCATION
                </h2>
                <p className="text-xs text-muted-foreground">Geographic location targeting in India</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* FIELD 9: State * */}
            <div>
              <label className={labelClass}>9. State *</label>
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

            {/* FIELD 10: District * */}
            <div>
              <label className={labelClass}>10. District *</label>
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

            {/* FIELD 11: City * */}
            <div>
              <label className={labelClass}>11. City *</label>
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
                placeholder="e.g. Mumbai, Bengaluru, Connaught Place"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: ADDITIONAL INFORMATION */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                04
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 4: ADDITIONAL INFORMATION
                </h2>
                <p className="text-xs text-muted-foreground">Community guidelines and membership prerequisites</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* FIELD 12: Rules (Optional) */}
            <div className="sm:col-span-2">
              <label className={labelClass}>12. Rules (Optional)</label>
              <textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                maxLength={300}
                className={`${inputClass} resize-none`}
                placeholder={`No Spam\nRespect Members\nHindi/English Only`}
              />
            </div>

            {/* FIELD 13: Minimum Age (Optional) */}
            <div>
              <label className={labelClass}>13. Minimum Age (Optional)</label>
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
          </div>
        </div>

        {/* SECTION 5: COMMUNITY LINK */}
        <div className="bg-card border border-primary/30 bg-primary/5 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-primary/20 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                05
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 5: COMMUNITY LINK
                </h2>
                <p className="text-xs text-muted-foreground">Official URL with smart validation</p>
              </div>
            </div>
          </div>

          {/* FIELD 14: Invite Link * */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>14. Invite Link * ({platform})</label>
              <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                <PlatformIcon platform={platform} className="w-3.5 h-3.5" /> Smart Link Validation
              </span>
            </div>

            <input
              required
              type="url"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder={currentPlatformConfig.placeholder}
              className={`${inputClass} ${
                urlFormatError || duplicateUrl ? "border-destructive ring-1 ring-destructive" : ""
              }`}
            />

            {/* Smart Help Text & Format Examples */}
            <div className="space-y-1 text-xs">
              <p className="text-muted-foreground">{currentPlatformConfig.helpText}</p>
              <p className="text-xs text-primary/80 font-mono">
                Example format: <span>{currentPlatformConfig.example}</span>
              </p>
            </div>

            {urlFormatError && (
              <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {urlFormatError}
              </p>
            )}

            {duplicateUrl && (
              <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> This exact Invite Link is already listed in LinkCloud.
              </p>
            )}
          </div>
        </div>

        {/* SECTION 6: CONFIRMATION */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                06
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 6: CONFIRMATION
                </h2>
                <p className="text-xs text-muted-foreground">Required owner verification & guidelines agreement</p>
              </div>
            </div>
          </div>

          {/* FIELD 15: Terms & Conditions * */}
          <div className="p-5 bg-muted/30 border border-border rounded-2xl space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5 cursor-pointer accent-primary"
              />
              <div className="space-y-1.5 text-xs text-foreground font-medium leading-relaxed">
                <p className="font-bold text-sm text-foreground">15. Terms & Conditions *</p>
                <p className="text-muted-foreground font-medium">I confirm that:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                  <li>I own or have permission to submit this community.</li>
                  <li>The invite link is valid.</li>
                  <li>The submitted information is accurate.</li>
                  <li>I agree to the LinkCloud Terms, Privacy Policy and Community Guidelines.</li>
                </ul>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 7: ACTIONS */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                07
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground uppercase tracking-wide">
                  SECTION 7: ACTIONS
                </h2>
                <p className="text-xs text-muted-foreground">Preview details & final submission</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Review your community details before sending to Webmaster.
            </p>

            <button
              type="submit"
              disabled={duplicateName || duplicateUrl || !!urlFormatError || !termsAccepted}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-extrabold rounded-2xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" /> 16. Preview & Confirm Submission
            </button>
          </div>
        </div>
      </form>

      {/* PREVIEW MODAL */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-5 right-5 p-2 text-muted-foreground hover:text-foreground rounded-full bg-muted/50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" /> Review Submission
              </h2>
              <p className="text-xs text-muted-foreground">
                Please verify your community information before sending to Webmaster.
              </p>
            </div>

            {/* PREVIEW CARD */}
            <div className="p-5 bg-background border border-border rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xl uppercase text-muted-foreground">
                  {logoPreview ? (
                    <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PlatformIcon platform={platform} className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="font-extrabold text-lg text-foreground truncate">{name}</h3>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-bold flex items-center gap-1 text-primary">
                      <PlatformIcon platform={platform} className="w-3.5 h-3.5" /> {platform}
                    </span>
                    <span>•</span>
                    <span className="text-muted-foreground">
                      {categories.find((c) => c.id === categoryId)?.name}
                    </span>
                    <span>•</span>
                    <span className="text-muted-foreground">{contentType}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl space-y-2 text-xs">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{description}</p>
                {rules && (
                  <p className="text-muted-foreground pt-1 border-t border-border/40">
                    <strong>Rules:</strong> {rules}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-muted/20 rounded-xl">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Location</span>
                  <span className="font-bold text-foreground">{city}, {district}, {state}</span>
                </div>

                <div className="p-2.5 bg-muted/20 rounded-xl">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Language & Age</span>
                  <span className="font-bold text-foreground">{language} • {minimumAge}</span>
                </div>
              </div>

              <div className="p-2.5 bg-muted/20 rounded-xl text-xs break-all">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Invite Link</span>
                <span className="font-mono text-primary font-bold">{joinUrl}</span>
              </div>
            </div>

            {/* REQUIRED TERMS CHECKBOX */}
            <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5 cursor-pointer"
                />
                <span className="text-xs text-foreground font-medium leading-normal">
                  I confirm that I own this community <strong>OR</strong> I have permission to submit this invite link to LinkCloud.
                </span>
              </label>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl transition"
              >
                Back to Edit
              </button>

              <button
                type="button"
                disabled={!termsAccepted || isSubmitting}
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-extrabold text-xs rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Submit Group
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
