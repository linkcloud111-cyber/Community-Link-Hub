import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTaxonomy } from "@/contexts/TaxonomyContext";
import { useLocation } from "@/contexts/LocationContext";
import {
  createGroup,
} from "@/lib/firestore";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Send,
  CheckCircle2,
  Shield,
  Info,
  Eye,
  X,
  AlertCircle,
  CloudUpload,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { PlatformIcon } from "@/components/platform-icon";

const AGE_OPTIONS = ["All Ages", "13+", "16+", "18+", "21+"];

interface FormData {
  name: string;
  platform: string;
  categoryId: string;
  contentType: string;
  language: string;
  description: string;
  tagsInput: string;
  logoUrl: string;
  state: string;
  district: string;
  city: string;
  rules: string;
  minimumAge: string;
  joinUrl: string;
  submitterName: string;
  submitterEmail: string;
}

export default function Submit() {
  const { user, profile, isWebmaster } = useAuth();
  const {
    activeCategories: categories,
    activePlatforms: platforms,
    activeContentTypes: contentTypes,
    activeLanguages: languages,
    loading: loadingCats,
  } = useTaxonomy();

  const { activeStates, getDistrictsForState } = useLocation();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: "",
    platform: "",
    categoryId: "",
    contentType: "",
    language: "",
    description: "",
    tagsInput: "",
    logoUrl: "",
    state: "",
    district: "",
    city: "",
    rules: "",
    minimumAge: "All Ages",
    joinUrl: "",
    submitterName: profile?.displayName || user?.displayName || "",
    submitterEmail: user?.email || "",
  });

  const districts = form.state ? getDistrictsForState(form.state) : [];

  // Sync form defaults with active taxonomy items when loaded
  useEffect(() => {
    if (!form.categoryId && categories.length > 0) {
      setForm((f) => ({ ...f, categoryId: categories[0].id }));
    }
    if (!form.platform && platforms.length > 0) {
      setForm((f) => ({ ...f, platform: platforms[0].name }));
    }
    if (!form.contentType && contentTypes.length > 0) {
      setForm((f) => ({ ...f, contentType: contentTypes[0].name }));
    }
    if (!form.language && languages.length > 0) {
      setForm((f) => ({ ...f, language: languages[0].name }));
    }
  }, [categories, platforms, contentTypes, languages]);

  const update = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): string | null => {
    if (!form.name.trim()) return "1. Group Name is required";
    if (form.name.trim().length < 3) return "Group Name must be at least 3 characters";
    if (!form.categoryId) return "3. Category is required";
    if (!form.description.trim()) return "6. Description is required";
    if (form.description.trim().length < 20) return "Description must be at least 20 characters";
    if (form.description.trim().length > 500) return "Description must not exceed 500 characters";
    if (!form.tagsInput.trim()) return "7. Tags are required. Enter keywords separated by commas.";
    if (!form.state) return "9. State is required";
    if (!form.district) return "10. District is required";
    if (!form.city.trim()) return "11. City is required";
    if (!form.joinUrl.trim()) return "14. Invite Link is required";
    if (!form.joinUrl.startsWith("http")) return "Invite Link must be a valid URL (starting with http:// or https://)";
    if (!termsAccepted) return "15. Please confirm the Terms & Conditions checkbox";
    if (!user && !form.submitterName.trim()) return "Your name is required";
    if (!user && !form.submitterEmail.trim()) return "Your email is required";
    if (!user && form.submitterEmail && !/\S+@\S+\.\S+/.test(form.submitterEmail))
      return "Please enter a valid email address";
    return null;
  };

  const handleOpenPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setPreviewOpen(true);
  };

  const handleFinalSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const categoryName = categories.find((c) => c.id === form.categoryId)?.name || "";
      const tags = Array.from(
        new Set(
          form.tagsInput
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        )
      );

      await createGroup({
        name: form.name.trim(),
        platform: form.platform,
        categoryId: form.categoryId,
        categoryName,
        contentType: form.contentType,
        state: form.state,
        district: form.district,
        city: form.city.trim(),
        language: form.language,
        description: form.description.trim(),
        rules: form.rules.trim(),
        minimumAge: form.minimumAge || "All Ages",
        tags,
        joinUrl: form.joinUrl.trim(),
        logoUrl: form.logoUrl.trim(),
        submittedBy: user?.uid || "",
        submittedByName:
          user
            ? profile?.displayName || user.displayName || user.email || "User"
            : form.submitterName.trim(),
        submittedByEmail: user?.email || form.submitterEmail.trim(),
        status: (isWebmaster || profile?.role === "webmaster") ? "approved" : "pending",
        featured: false,
        trending: false,
      });

      setPreviewOpen(false);
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const isAutoApproved = isWebmaster || profile?.role === "webmaster";
    return (
      <div className="max-w-lg mx-auto text-center py-24 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="w-24 h-24 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold">
            {isAutoApproved ? "Approved & Published!" : "Submitted Successfully!"}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {isAutoApproved
              ? `Your community "${form.name}" has been auto-approved and is now live on LinkCloud.`
              : `Your community has been submitted for review. Our team will approve it within 24–48 hours.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/"
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Browse Communities
            </Link>
            <button
              onClick={() => {
                setSubmitted(false);
                setForm((f) => ({
                  ...f,
                  name: "",
                  joinUrl: "",
                  description: "",
                  rules: "",
                  tagsInput: "",
                  state: "",
                  district: "",
                  city: "",
                  logoUrl: "",
                }));
              }}
              className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors"
            >
              Submit Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground";
  const labelClass = "block text-sm font-semibold text-foreground mb-1.5";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">Submit Your Community</h1>
        <p className="text-muted-foreground mt-2">
          Add your WhatsApp, Telegram, Discord, or other group to India's community
          directory. Completely free — no account required.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-sm text-blue-700 dark:text-blue-400">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Submission Guidelines</p>
          <ul className="space-y-1 text-xs list-disc list-inside text-blue-600 dark:text-blue-300">
            <li>Only Indian communities are accepted</li>
            <li>Provide an accurate, working invite link</li>
            <li>No adult, illegal, or spam content</li>
            <li>Each submission is reviewed within 24–48 hours</li>
          </ul>
        </div>
      </div>

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
              <label className={labelClass}>1. Group Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputClass}
                placeholder="e.g. India Tech & Developers Club"
                maxLength={80}
              />
            </div>

            {/* FIELD 2: Platform * */}
            <div>
              <label className={labelClass}>2. Platform *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2.5">
                {platforms.map((p) => {
                  const pName = p.name;
                  const isSelected = form.platform === pName;
                  return (
                    <button
                      type="button"
                      key={p.id || pName}
                      onClick={() => update("platform", pName)}
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
                {loadingCats ? (
                  <div className={`${inputClass} flex items-center gap-2 text-muted-foreground`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : (
                  <select
                    required
                    value={form.categoryId}
                    onChange={(e) => update("categoryId", e.target.value)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* FIELD 4: Content Type * */}
              <div>
                <label className={labelClass}>4. Content Type *</label>
                <select
                  required
                  value={form.contentType}
                  onChange={(e) => update("contentType", e.target.value)}
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
                  value={form.language}
                  onChange={(e) => update("language", e.target.value)}
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
                    form.description.length > 500
                      ? "text-destructive"
                      : form.description.length < 20
                      ? "text-amber-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {form.description.length} / 500 Characters
                </span>
              </div>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
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
                value={form.tagsInput}
                onChange={(e) => update("tagsInput", e.target.value)}
                className={inputClass}
                placeholder="jobs, electrician, whatsapp, cg, room rent"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter keywords separated by commas (e.g. jobs, electrician, whatsapp, cg, room rent)
              </p>
            </div>

            {/* FIELD 8: Group Logo (Optional) */}
            <div>
              <label className={labelClass}>8. Group Logo (Optional)</label>
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => update("logoUrl", e.target.value)}
                className={inputClass}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Image URL. If no logo URL is provided, LinkCloud will automatically display the official {form.platform} icon.
              </p>
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
                value={form.state}
                onChange={(e) => {
                  setForm((f) => ({ ...f, state: e.target.value, district: "", city: "" }));
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
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
                disabled={!form.state || districts.length === 0}
                className={`${inputClass} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">{form.state ? "Select District" : "Select State First"}</option>
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
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
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
                value={form.rules}
                onChange={(e) => update("rules", e.target.value)}
                maxLength={300}
                className={`${inputClass} resize-none`}
                placeholder={`No Spam\nRespect Members\nHindi/English Only`}
              />
            </div>

            {/* FIELD 13: Minimum Age (Optional) */}
            <div>
              <label className={labelClass}>13. Minimum Age (Optional)</label>
              <select
                value={form.minimumAge}
                onChange={(e) => update("minimumAge", e.target.value)}
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
              <label className={labelClass}>14. Invite Link * ({form.platform})</label>
              <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                <PlatformIcon platform={form.platform} className="w-3.5 h-3.5" /> Smart Link Validation
              </span>
            </div>

            <input
              required
              type="url"
              value={form.joinUrl}
              onChange={(e) => update("joinUrl", e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              Paste the direct invite link for your community
            </p>
          </div>
        </div>

        {/* Submitter Details for Guest Submissions */}
        {!user && (
          <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-foreground">Your Submitter Details</h2>
            <p className="text-xs text-muted-foreground">
              Optional:{" "}
              <Link href="/login" className="text-primary hover:underline">
                sign in
              </Link>{" "}
              to track your submissions and manage communities in your dashboard.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Your Name *</label>
                <input
                  required
                  value={form.submitterName}
                  onChange={(e) => update("submitterName", e.target.value)}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className={labelClass}>Your Email *</label>
                <input
                  required
                  type="email"
                  value={form.submitterEmail}
                  onChange={(e) => update("submitterEmail", e.target.value)}
                  className={inputClass}
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </div>
        )}

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
              Review your community details before sending for review.
            </p>

            <button
              type="submit"
              disabled={!termsAccepted}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-extrabold rounded-2xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" /> 16. Preview & Confirm Submission
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center pt-2">
          <Shield className="w-3.5 h-3.5" />
          All submissions are reviewed by our team before going live.
        </p>
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
                Please verify your community information before final submission.
              </p>
            </div>

            {/* PREVIEW CARD */}
            <div className="p-5 bg-background border border-border rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xl uppercase text-muted-foreground">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PlatformIcon platform={form.platform} className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="font-extrabold text-lg text-foreground truncate">{form.name}</h3>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-bold flex items-center gap-1 text-primary">
                      <PlatformIcon platform={form.platform} className="w-3.5 h-3.5" /> {form.platform}
                    </span>
                    <span>•</span>
                    <span className="text-muted-foreground">
                      {categories.find((c) => c.id === form.categoryId)?.name}
                    </span>
                    <span>•</span>
                    <span className="text-muted-foreground">{form.contentType}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl space-y-2 text-xs">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{form.description}</p>
                {form.rules && (
                  <p className="text-muted-foreground pt-1 border-t border-border/40">
                    <strong>Rules:</strong> {form.rules}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-muted/20 rounded-xl">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Location</span>
                  <span className="font-bold text-foreground">{form.city}, {form.district}, {form.state}</span>
                </div>

                <div className="p-2.5 bg-muted/20 rounded-xl">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Language & Age</span>
                  <span className="font-bold text-foreground">{form.language} • {form.minimumAge}</span>
                </div>
              </div>

              <div className="p-2.5 bg-muted/20 rounded-xl text-xs break-all">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Invite Link</span>
                <span className="font-mono text-primary font-bold">{form.joinUrl}</span>
              </div>
            </div>

            {/* REQUIRED TERMS CHECKBOX */}
            <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5 cursor-pointer accent-primary"
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
                disabled={!termsAccepted || submitting}
                onClick={handleFinalSubmit}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-extrabold text-xs rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> 17. Final Submit
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
