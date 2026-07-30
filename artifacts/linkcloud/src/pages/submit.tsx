import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { createGroup, getCategories } from "@/lib/firestore";
import type { Category, Platform } from "@/lib/types";
import { INDIA_STATE_NAMES, getDistrictsForState } from "@/lib/india-data";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Send,
  CheckCircle2,
  ExternalLink,
  Shield,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SiWhatsapp,
  SiTelegram,
  SiDiscord,
  SiFacebook,
  SiInstagram,
  SiX,
  SiYoutube,
  SiReddit,
} from "react-icons/si";
import { Linkedin } from "lucide-react";

const PLATFORMS: { value: Platform; icon: React.FC<{ className?: string }>; color: string }[] = [
  { value: "WhatsApp", icon: SiWhatsapp, color: "text-green-500" },
  { value: "Telegram", icon: SiTelegram, color: "text-blue-400" },
  { value: "Discord", icon: SiDiscord, color: "text-indigo-500" },
  { value: "Facebook Groups", icon: SiFacebook, color: "text-blue-600" },
  { value: "Instagram Broadcast", icon: SiInstagram, color: "text-pink-500" },
  { value: "X Communities", icon: SiX, color: "text-foreground" },
  { value: "LinkedIn Groups", icon: Linkedin, color: "text-blue-700" },
  { value: "YouTube Channels", icon: SiYoutube, color: "text-red-500" },
  { value: "Reddit", icon: SiReddit, color: "text-orange-500" },
];

const LANGUAGES = [
  "Hindi", "English", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati",
  "Kannada", "Malayalam", "Punjabi", "Odia", "Assamese", "Urdu", "Other",
];

interface FormData {
  name: string;
  platform: Platform;
  categoryId: string;
  joinUrl: string;
  description: string;
  rules: string;
  tagsInput: string;
  state: string;
  district: string;
  city: string;
  language: string;
  logoUrl: string;
  submitterName: string;
  submitterEmail: string;
}

export default function Submit() {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: "",
    platform: "WhatsApp",
    categoryId: "",
    joinUrl: "",
    description: "",
    rules: "",
    tagsInput: "",
    state: "",
    district: "",
    city: "",
    language: "Hindi",
    logoUrl: "",
    submitterName: profile?.displayName || user?.displayName || "",
    submitterEmail: user?.email || "",
  });

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setForm((f) => ({ ...f, categoryId: cats[0].id }));
      })
      .catch(console.error)
      .finally(() => setLoadingCats(false));
  }, []);

  useEffect(() => {
    setForm((f) => ({ ...f, district: "" }));
    setDistricts(form.state ? getDistrictsForState(form.state) : []);
  }, [form.state]);

  const update = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): string | null => {
    if (!form.name.trim()) return "Community name is required";
    if (form.name.trim().length < 3) return "Name must be at least 3 characters";
    if (!form.joinUrl.trim()) return "Join link is required";
    if (!form.joinUrl.startsWith("http")) return "Join link must be a valid URL";
    if (!form.description.trim()) return "Description is required";
    if (form.description.trim().length < 20) return "Description must be at least 20 characters";
    if (!form.state) return "Please select a state";
    if (!form.categoryId) return "Please select a category";
    if (!user && !form.submitterName.trim()) return "Your name is required";
    if (!user && !form.submitterEmail.trim()) return "Your email is required";
    if (!user && form.submitterEmail && !/\S+@\S+\.\S+/.test(form.submitterEmail))
      return "Please enter a valid email address";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const categoryName = categories.find((c) => c.id === form.categoryId)?.name || "";
      const tags = form.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);

      await createGroup({
        name: form.name.trim(),
        platform: form.platform,
        categoryId: form.categoryId,
        categoryName,
        state: form.state,
        district: form.district,
        city: form.city.trim(),
        language: form.language,
        description: form.description.trim(),
        rules: form.rules.trim(),
        tags,
        joinUrl: form.joinUrl.trim(),
        logoUrl: form.logoUrl.trim(),
        submittedBy: user?.uid || "",
        submittedByName:
          user
            ? profile?.displayName || user.displayName || user.email || "User"
            : form.submitterName.trim(),
        submittedByEmail: user?.email || form.submitterEmail.trim(),
        status: "pending",
        featured: false,
        trending: false,
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
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
          <h1 className="text-3xl font-bold">Submitted Successfully!</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Your community has been submitted for review. Our team will approve it
            within 24–48 hours.
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
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Platform selection */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-5">
          <h2 className="text-base font-bold text-foreground">Platform & Basic Info</h2>

          {/* Platform grid */}
          <div>
            <label className={labelClass}>Platform *</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update("platform", p.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                    form.platform === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p.icon className={`w-5 h-5 ${form.platform === p.value ? "text-primary" : p.color}`} />
                  <span className="text-center leading-tight">{p.value.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Community Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputClass}
                placeholder="e.g. Mumbai Tech Developers"
                maxLength={80}
              />
            </div>

            <div>
              <label className={labelClass}>Category *</label>
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
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Join / Invite Link *
            </label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                required
                type="url"
                value={form.joinUrl}
                onChange={(e) => update("joinUrl", e.target.value)}
                className={`${inputClass} pl-10`}
                placeholder="https://chat.whatsapp.com/..."
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Paste the direct invite link for your community
            </p>
          </div>

          <div>
            <label className={labelClass}>Community Logo URL (optional)</label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              className={inputClass}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        {/* Section 2: Location */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-5">
          <h2 className="text-base font-bold text-foreground">Location (India)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>State *</label>
              <select
                required
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Select State</option>
                {INDIA_STATE_NAMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>District</label>
              <select
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
                disabled={!form.state || districts.length === 0}
                className={`${inputClass} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">Select District</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>City / Area</label>
              <input
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className={inputClass}
                placeholder="e.g. Mumbai, Bandra"
              />
            </div>
          </div>

          <div className="max-w-xs">
            <label className={labelClass}>Primary Language</label>
            <select
              value={form.language}
              onChange={(e) => update("language", e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 3: Details */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-5">
          <h2 className="text-base font-bold text-foreground">Community Details</h2>

          <div>
            <label className={labelClass}>Description *</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="What is this community about? Who is it for? What topics are discussed?"
              maxLength={600}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {form.description.length}/600 characters
            </p>
          </div>

          <div>
            <label className={labelClass}>Community Rules (optional)</label>
            <textarea
              rows={3}
              value={form.rules}
              onChange={(e) => update("rules", e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="List rules members must follow (e.g. No spam, Be respectful)"
              maxLength={400}
            />
          </div>

          <div>
            <label className={labelClass}>Tags (optional)</label>
            <input
              value={form.tagsInput}
              onChange={(e) => update("tagsInput", e.target.value)}
              className={inputClass}
              placeholder="Comma separated: coding, react, javascript, webdev"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Up to 10 tags, separated by commas
            </p>
          </div>
        </div>

        {/* Section 4: Submitter info (only for non-logged-in users) */}
        {!user && (
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5">
            <h2 className="text-base font-bold text-foreground">Your Details</h2>
            <p className="text-sm text-muted-foreground">
              Optional:{" "}
              <Link href="/login" className="text-primary hover:underline">
                sign in
              </Link>{" "}
              to track your submissions and get notified on approval.
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
                <p className="text-xs text-muted-foreground mt-1.5">
                  Used to notify you when your submission is approved
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:scale-[1.01] disabled:opacity-70 disabled:scale-100"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
            ) : (
              <><Send className="w-5 h-5" /> Submit for Review</>
            )}
          </button>
        </div>

        {/* Security note */}
        <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
          <Shield className="w-3.5 h-3.5" />
          All submissions are reviewed by our team before going live.
        </p>
      </form>
    </div>
  );
}
