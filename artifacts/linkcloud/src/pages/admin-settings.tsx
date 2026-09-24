import { useState, useEffect } from "react";
import {
  getSiteSettings,
  updateSiteSettings,
  getFAQs,
  addFAQ,
  updateFAQ,
  deleteFAQ,
  getAuditLogs,
  getSearchAnalytics,
  logAuditEvent,
  getHelpArticles,
  addHelpArticle,
  deleteHelpArticle,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementEnabled,
} from "@/lib/firestore";
import type {
  SiteSettings,
  FAQItem,
  AuditLog,
  SearchAnalytics,
  HelpArticle,
  Announcement,
  AnnouncementType,
  AnnouncementDisplayMode,
} from "@/lib/types";
import { clearSiteSettingsCache } from "@/lib/page-meta";
import AdminNav from "@/components/admin-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/AuthContext";
import AnnouncementBanner, {
  isSafeActionUrl,
  ANNOUNCEMENT_THEMES,
} from "@/components/announcement-banner";
import { toast } from "sonner";
import {
  Loader2,
  Settings,
  Save,
  Globe,
  UploadCloud,
  ShieldAlert,
  FileText,
  Search,
  Sliders,
  CheckCircle2,
  Layout,
  Info,
  HelpCircle,
  Phone,
  Share2,
  Lock,
  BarChart2,
  History,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Sparkles,
  MapPin,
  ExternalLink,
  Code2,
  Filter,
  Megaphone,
  Calendar,
  Clock,
  Smartphone,
  Monitor,
  AlertTriangle,
  X,
} from "lucide-react";

type SettingsTab =
  | "general"
  | "homepage"
  | "announcements"
  | "aboutHelp"
  | "faq"
  | "contactSocial"
  | "legal"
  | "seo"
  | "system"
  | "filters"
  | "analytics"
  | "auditLog"
  | "cloudinary";

export default function AdminSettings() {
  const { user } = useAuth();
  
  const [tab, setTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Site Settings State
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: "LinkCloud",
    siteTagline: "India's Premium WhatsApp & Telegram Community Directory",
    siteLogo: "",
    favicon: "",
    homepageBanner: "",
    heroTitle: "Discover & Join India's Most Active WhatsApp & Telegram Communities",
    heroSubtitle: "Verified group links across 28 states, 50+ categories, and multiple platforms.",
    heroButtonText: "Explore Groups",
    heroButtonLink: "/groups",
    footerLogo: "",
    footerDescription: "LinkCloud is India's leading verified platform for discovering public WhatsApp groups, Telegram channels, and Discord servers.",
    copyrightText: "© 2026 LinkCloud Directory Services India. All rights reserved.",
    websiteTheme: "dark",
    maintenanceMode: false,

    contactEmail: "webmaster@linkcloud.in",
    supportEmail: "support@linkcloud.in",
    supportMobile: "+91 98765 43210",
    businessAddress: "Connaught Place, New Delhi, India 110001",
    officeHours: "Monday - Saturday: 09:00 AM - 07:00 PM IST",
    googleMapUrl: "https://maps.google.com",

    facebookUrl: "https://facebook.com/linkcloudin",
    instagramUrl: "https://instagram.com/linkcloudin",
    telegramUrl: "https://t.me/linkcloudin",
    whatsappUrl: "https://whatsapp.com/channel/linkcloudin",
    youtubeUrl: "https://youtube.com/@linkcloudin",
    linkedinUrl: "https://linkedin.com/company/linkcloudin",
    twitterUrl: "https://x.com/linkcloudin",
    redditUrl: "https://reddit.com/r/linkcloudin",
    githubUrl: "https://github.com/linkcloudin",

    heroSectionEnabled: true,
    featuredGroupsEnabled: true,
    latestGroupsEnabled: true,
    popularGroupsEnabled: true,
    popularCategoriesEnabled: true,
    popularPlatformsEnabled: true,
    statisticsSectionEnabled: true,
    testimonialsEnabled: true,
    faqSectionEnabled: true,
    newsletterSectionEnabled: true,
    footerEnabled: true,

    aboutTitle: "About LinkCloud India",
    aboutDescription: "LinkCloud is India's premier community discovery platform built to connect millions of users with authentic, high-quality public groups.",
    aboutMission: "Empowering Indian citizens to easily find, join, and grow safe educational, career, regional, and social communities.",
    aboutVision: "Building India's largest and safest directory of public social messaging groups with zero scam or broken links.",
    aboutUsContent: "LinkCloud is India's leading verified directory for WhatsApp, Telegram, and Discord communities.",

    privacyPolicyContent: "LinkCloud respects user privacy. We do not store or inspect private chat content, messages, or member lists.",
    termsContent: "By using LinkCloud, users agree not to submit illegal, spam, copyrighted, or prohibited group links.",
    dmcaContent: "To file a copyright takedown request under DMCA, please email webmaster@linkcloud.in with link details.",
    disclaimerContent: "LinkCloud is a public indexing platform and is not affiliated with WhatsApp, Telegram, Discord, Meta, or Google.",

    metaTitle: "LinkCloud - India's #1 WhatsApp, Telegram & Discord Group Directory",
    metaDescription: "Discover and join thousands of active WhatsApp groups, Telegram channels, and Discord communities in India.",
    metaKeywords: "WhatsApp groups, Telegram channels, Discord servers, India group links, study groups, job alerts",
    canonicalUrl: "https://linkcloud.in",
    ogImage: "https://linkcloud.in/og-banner.png",
    ogTitle: "LinkCloud - Join India's Top WhatsApp & Telegram Groups",
    ogDescription: "Discover verified active groups in Jobs, Education, Crypto, Tech, Movies, and regional communities across India.",
    twitterCardImage: "https://linkcloud.in/twitter-card.png",
    twitterCardTitle: "LinkCloud - WhatsApp & Telegram Directory",
    twitterCardDescription: "Find verified group invite links in India.",
    robotsTxtContent: "User-agent: *\nAllow: /\nSitemap: https://linkcloud.in/sitemap.xml",
    sitemapXmlContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url>\n    <loc>https://linkcloud.in/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://linkcloud.in/groups</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.9</priority>\n  </url>\n</urlset>",
    structuredDataJson: "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"WebSite\",\n  \"name\": \"LinkCloud\",\n  \"url\": \"https://linkcloud.in\"\n}",

    allowPublicSubmissions: true,
    groupSubmissionEnabled: true,
    userRegistrationEnabled: true,
    googleLoginEnabled: true,
    emailLoginEnabled: true,
    mobileOtpLoginEnabled: true,
    favoritesEnabled: true,
    reportSystemEnabled: true,
    complaintSystemEnabled: true,
    contactFormEnabled: true,
    notificationsEnabled: true,

    cloudinaryCloudName: "linkcloud",
    cloudinaryUploadPreset: "linkcloud_unsigned",
  });

  // Additional Data Collections
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [helpArticles, setHelpArticles] = useState<HelpArticle[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchAnalytics, setSearchAnalytics] = useState<SearchAnalytics[]>([]);

  // Announcements State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState<Omit<Announcement, "id">>({
    title: "",
    message: "",
    type: "announcement",
    displayMode: "banner",
    priority: 10,
    enabled: true,
    dismissible: true,
    actionLabel: "",
    actionUrl: "",
    startAt: null,
    endAt: null,
  });
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [announcementSaving, setAnnouncementSaving] = useState(false);

  // FAQ Modal / Input
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqForm, setFaqForm] = useState({ question: "", answer: "", category: "General", sortOrder: 1, enabled: true });

  // Help Article Modal
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [articleForm, setArticleForm] = useState({ title: "", category: "General", content: "", views: 0 });

  useEffect(() => {
    Promise.all([
      getSiteSettings(),
      getFAQs(),
      getHelpArticles(),
      getAuditLogs(30),
      getSearchAnalytics(),
      getAnnouncements(false),
    ])
      .then(([siteData, faqData, articleData, auditData, searchData, annData]) => {
        if (siteData) setSettings((prev) => ({ ...prev, ...siteData }));
        if (faqData) setFaqs(faqData);
        if (articleData) setHelpArticles(articleData);
        if (auditData) setAuditLogs(auditData);
        if (searchData) setSearchAnalytics(searchData);
        if (annData) setAnnouncements(annData);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to sync webmaster settings from Firestore");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      let savedViaApi = false;
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/admin/settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(settings),
          });
          if (res.ok) {
            savedViaApi = true;
          }
        } catch {
          // fallback to client-side Firestore write
        }
      }

      if (!savedViaApi) {
        await updateSiteSettings(settings);
        await logAuditEvent(
          "Settings Changed",
          `Updated webmaster configuration section (${tab})`,
          user?.email || "webmaster@linkcloud.in",
          user?.uid || "webmaster"
        );
      }

      clearSiteSettingsCache();
      toast.success("Webmaster configuration saved successfully");
      // Refresh audit logs
      const updatedLogs = await getAuditLogs(30);
      setAuditLogs(updatedLogs);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // FAQ Handlers
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await updateFAQ(editingFaq.id, faqForm);
        toast.success("FAQ item updated");
      } else {
        await addFAQ(faqForm);
        toast.success("New FAQ item created");
      }
      setFaqModalOpen(false);
      setEditingFaq(null);
      setFaqForm({ question: "", answer: "", category: "General", sortOrder: faqs.length + 1, enabled: true });
      const freshFaqs = await getFAQs();
      setFaqs(freshFaqs);
    } catch {
      toast.error("Failed to save FAQ");
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: "faq" | "article" | "announcement" } | null>(null);

  const handleDeleteFaq = (id: string) => {
    setDeleteConfirm({ id, type: "faq" });
  };

  // Help Article Handlers
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addHelpArticle(articleForm);
      toast.success("Help article created");
      setArticleModalOpen(false);
      setArticleForm({ title: "", category: "General", content: "", views: 0 });
      const freshArticles = await getHelpArticles();
      setHelpArticles(freshArticles);
    } catch {
      toast.error("Failed to create article");
    }
  };

  const handleDeleteArticle = (id: string) => {
    setDeleteConfirm({ id, type: "article" });
  };

  // Announcement Handlers
  const handleOpenCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({
      title: "",
      message: "",
      type: "announcement",
      displayMode: "banner",
      priority: 10,
      enabled: true,
      dismissible: true,
      actionLabel: "",
      actionUrl: "",
      startAt: null,
      endAt: null,
    });
    setAnnouncementModalOpen(true);
  };

  const handleOpenEditAnnouncement = (item: Announcement) => {
    setEditingAnnouncement(item);
    setAnnouncementForm({
      title: item.title,
      message: item.message,
      type: item.type,
      displayMode: item.displayMode,
      priority: item.priority,
      enabled: item.enabled,
      dismissible: item.dismissible,
      actionLabel: item.actionLabel || "",
      actionUrl: item.actionUrl || "",
      startAt: item.startAt || null,
      endAt: item.endAt || null,
    });
    setAnnouncementModalOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementForm.title.trim()) {
      toast.error("Announcement title is required.");
      return;
    }
    if (announcementForm.title.length > 100) {
      toast.error("Announcement title cannot exceed 100 characters.");
      return;
    }
    if (!announcementForm.message.trim()) {
      toast.error("Announcement message is required.");
      return;
    }
    if (announcementForm.message.length > 500) {
      toast.error("Announcement message cannot exceed 500 characters.");
      return;
    }
    if (announcementForm.actionUrl && !isSafeActionUrl(announcementForm.actionUrl)) {
      toast.error("Action URL has a disallowed protocol (javascript:/data:).");
      return;
    }
    if (announcementForm.startAt && announcementForm.endAt) {
      if (new Date(announcementForm.endAt).getTime() <= new Date(announcementForm.startAt).getTime()) {
        toast.error("Schedule end time must be after start time.");
        return;
      }
    }

    setAnnouncementSaving(true);
    try {
      let savedViaApi = false;
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const payload = {
            ...(editingAnnouncement ? { id: editingAnnouncement.id } : {}),
            ...announcementForm,
          };
          const res = await fetch("/api/admin/announcements", {
            method: editingAnnouncement ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            savedViaApi = true;
          }
        } catch {
          // fallback to client-side Firestore
        }
      }

      if (!savedViaApi) {
        if (editingAnnouncement) {
          await updateAnnouncement(
            editingAnnouncement.id,
            announcementForm,
            user?.email || "webmaster@linkcloud.in",
            user?.uid || "webmaster"
          );
        } else {
          await createAnnouncement(
            announcementForm,
            user?.email || "webmaster@linkcloud.in",
            user?.uid || "webmaster"
          );
        }
      }

      toast.success(editingAnnouncement ? "Announcement updated successfully" : "Announcement created successfully");
      setAnnouncementModalOpen(false);
      setEditingAnnouncement(null);
      const freshList = await getAnnouncements(false);
      setAnnouncements(freshList);
    } catch (err: any) {
      console.error("Failed to save announcement:", err);
      toast.error(err?.message || "Failed to save announcement.");
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleToggleAnnouncement = async (item: Announcement) => {
    const newEnabled = !item.enabled;
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, enabled: newEnabled } : a))
    );
    try {
      let savedViaApi = false;
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/admin/announcements", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ id: item.id, ...item, enabled: newEnabled }),
          });
          if (res.ok) savedViaApi = true;
        } catch {}
      }
      if (!savedViaApi) {
        await toggleAnnouncementEnabled(
          item.id,
          newEnabled,
          user?.email || "webmaster@linkcloud.in",
          user?.uid || "webmaster"
        );
      }
      toast.success(`Announcement ${newEnabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update announcement status");
      const fresh = await getAnnouncements(false);
      setAnnouncements(fresh);
    }
  };

  const handleDeleteAnnouncement = (item: Announcement) => {
    setDeleteConfirm({ id: item.id, type: "announcement" });
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirm) return;
    const { id, type } = deleteConfirm;
    try {
      if (type === "faq") {
        await deleteFAQ(id);
        toast.success("FAQ deleted");
        setFaqs(faqs.filter((f) => f.id !== id));
      } else if (type === "article") {
        await deleteHelpArticle(id);
        toast.success("Help article deleted");
        setHelpArticles(helpArticles.filter((a) => a.id !== id));
      } else if (type === "announcement") {
        let deletedViaApi = false;
        if (user) {
          try {
            const idToken = await user.getIdToken();
            const res = await fetch(`/api/admin/announcements?id=${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) deletedViaApi = true;
          } catch {}
        }
        if (!deletedViaApi) {
          await deleteAnnouncement(
            id,
            user?.email || "webmaster@linkcloud.in",
            user?.uid || "webmaster"
          );
        }
        toast.success("Announcement deleted");
        setAnnouncements(announcements.filter((a) => a.id !== id));
      }
      setDeleteConfirm(null);
    } catch {
      toast.error(`Failed to delete ${type}`);
    }
  };

  const inputClass = "w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary font-mono";
  const labelClass = "block text-xs font-bold text-muted-foreground mb-1";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary animate-spin-slow" /> Webmaster Control & Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full platform settings, Homepage sections, Legal docs, SEO tags, System toggles & Audit logs.
          </p>
        </div>
        <button
          onClick={() => handleSaveSettings()}
          disabled={saving}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Settings
        </button>
      </div>

      {/* Admin Nav */}
      <AdminNav />

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto scrollbar-none">
        <TabButton active={tab === "general"} onClick={() => setTab("general")} icon={Globe} label="Branding & Info" />
        <TabButton active={tab === "homepage"} onClick={() => setTab("homepage")} icon={Layout} label="Homepage Layout" />
        <TabButton active={tab === "announcements"} onClick={() => setTab("announcements")} icon={Megaphone} label="Announcements" />
        <TabButton active={tab === "aboutHelp"} onClick={() => setTab("aboutHelp")} icon={Info} label="About & Help" />
        <TabButton active={tab === "faq"} onClick={() => setTab("faq")} icon={HelpCircle} label="FAQ Management" />
        <TabButton active={tab === "contactSocial"} onClick={() => setTab("contactSocial")} icon={Phone} label="Contact & Social" />
        <TabButton active={tab === "legal"} onClick={() => setTab("legal")} icon={FileText} label="Legal Pages" />
        <TabButton active={tab === "seo"} onClick={() => setTab("seo")} icon={Search} label="SEO & Metadata" />
        <TabButton active={tab === "system"} onClick={() => setTab("system")} icon={Sliders} label="System Toggles" />
        <TabButton active={tab === "filters"} onClick={() => setTab("filters")} icon={Filter} label="Filter Management" />
        <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} icon={BarChart2} label="Search Terms" />
        <TabButton active={tab === "auditLog"} onClick={() => setTab("auditLog")} icon={History} label="Audit Logs" />
        <TabButton active={tab === "cloudinary"} onClick={() => setTab("cloudinary")} icon={UploadCloud} label="Cloudinary Media" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* TAB 1: GENERAL BRANDING */}
          {tab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" /> Website Identity & Branding
                </h2>

                <div>
                  <label className={labelClass}>Website Name</label>
                  <input
                    value={settings.siteName}
                    onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Site Tagline</label>
                  <input
                    value={settings.siteTagline}
                    onChange={(e) => setSettings((s) => ({ ...s, siteTagline: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Site Logo URL (PNG/SVG/Cloudinary)</label>
                  <input
                    value={settings.siteLogo || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, siteLogo: e.target.value }))}
                    placeholder="https://cloudinary.com/.../logo.png"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Favicon URL (.ico / .png)</label>
                  <input
                    value={settings.favicon || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, favicon: e.target.value }))}
                    placeholder="https://linkcloud.in/favicon.ico"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Website Default Theme</label>
                  <select
                    value={settings.websiteTheme}
                    onChange={(e) => setSettings((s) => ({ ...s, websiteTheme: e.target.value as any }))}
                    className={inputClass}
                  >
                    <option value="dark">Dark Theme (Default)</option>
                    <option value="light">Light Theme</option>
                    <option value="system">System Preference</option>
                  </select>
                </div>
              </div>

              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" /> Hero Banner & Footer Content
                </h2>

                <div>
                  <label className={labelClass}>Homepage Hero Title</label>
                  <input
                    value={settings.heroTitle}
                    onChange={(e) => setSettings((s) => ({ ...s, heroTitle: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Homepage Hero Subtitle</label>
                  <textarea
                    value={settings.heroSubtitle}
                    onChange={(e) => setSettings((s) => ({ ...s, heroSubtitle: e.target.value }))}
                    className="w-full h-20 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Hero CTA Button Text</label>
                    <input
                      value={settings.heroButtonText}
                      onChange={(e) => setSettings((s) => ({ ...s, heroButtonText: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Hero CTA Link</label>
                    <input
                      value={settings.heroButtonLink}
                      onChange={(e) => setSettings((s) => ({ ...s, heroButtonLink: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Footer Description</label>
                  <textarea
                    value={settings.footerDescription}
                    onChange={(e) => setSettings((s) => ({ ...s, footerDescription: e.target.value }))}
                    className="w-full h-20 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Copyright Notice</label>
                  <input
                    value={settings.copyrightText}
                    onChange={(e) => setSettings((s) => ({ ...s, copyrightText: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HOMEPAGE SECTIONS */}
          {tab === "homepage" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-sm max-w-3xl">
              <div className="border-b border-border pb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Layout className="w-5 h-5 text-primary" /> Homepage Section Controls
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable or disable individual sections on the LinkCloud homepage.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ToggleCard
                  title="Hero Search Section"
                  description="Main banner with search input & platform filters"
                  enabled={settings.heroSectionEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, heroSectionEnabled: !s.heroSectionEnabled }))}
                />
                <ToggleCard
                  title="Featured Groups"
                  description="Promoted groups pinned to homepage top"
                  enabled={settings.featuredGroupsEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, featuredGroupsEnabled: !s.featuredGroupsEnabled }))}
                />
                <ToggleCard
                  title="Latest Groups"
                  description="Recently submitted & approved communities"
                  enabled={settings.latestGroupsEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, latestGroupsEnabled: !s.latestGroupsEnabled }))}
                />
                <ToggleCard
                  title="Popular Groups"
                  description="Most viewed and joined groups"
                  enabled={settings.popularGroupsEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, popularGroupsEnabled: !s.popularGroupsEnabled }))}
                />
                <ToggleCard
                  title="Popular Categories"
                  description="Grid of top group taxonomy categories"
                  enabled={settings.popularCategoriesEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, popularCategoriesEnabled: !s.popularCategoriesEnabled }))}
                />
                <ToggleCard
                  title="Popular Platforms"
                  description="WhatsApp, Telegram, Discord, Facebook badges"
                  enabled={settings.popularPlatformsEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, popularPlatformsEnabled: !s.popularPlatformsEnabled }))}
                />
                <ToggleCard
                  title="Live Statistics counter"
                  description="Total visitors, group counts & member stats"
                  enabled={settings.statisticsSectionEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, statisticsSectionEnabled: !s.statisticsSectionEnabled }))}
                />
                <ToggleCard
                  title="Community Testimonials"
                  description="User reviews and success feedback"
                  enabled={settings.testimonialsEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, testimonialsEnabled: !s.testimonialsEnabled }))}
                />
                <ToggleCard
                  title="Homepage FAQ Accordion"
                  description="Quick answer drawer for common visitor questions"
                  enabled={settings.faqSectionEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, faqSectionEnabled: !s.faqSectionEnabled }))}
                />
                <ToggleCard
                  title="Newsletter Subscription"
                  description="Email capture form for weekly group drops"
                  enabled={settings.newsletterSectionEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, newsletterSectionEnabled: !s.newsletterSectionEnabled }))}
                />
              </div>
            </div>
          )}

          {/* TAB 2.5: WEBSITE-WIDE ANNOUNCEMENT SYSTEM */}
          {tab === "announcements" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <h2 className="font-bold text-base flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-primary" /> Website-Wide Announcements & Banners
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Broadcast global updates, news, maintenance notices, and call-to-actions across the entire platform.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCreateAnnouncement}
                    className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-all self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" /> New Announcement
                  </button>
                </div>

                {/* Announcement Cards List */}
                <div className="mt-6 space-y-4">
                  {announcements.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/20">
                      <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-semibold text-foreground">No announcements configured yet</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                        Add your first announcement to display a real-time banner or scrolling ticker across LinkCloud.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreateAnnouncement}
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all"
                      >
                        Create First Announcement
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {announcements.map((item) => {
                        const now = Date.now();
                        const isScheduled = item.startAt && new Date(item.startAt).getTime() > now;
                        const isExpired = item.endAt && new Date(item.endAt).getTime() < now;
                        const theme = ANNOUNCEMENT_THEMES[item.type] || ANNOUNCEMENT_THEMES.announcement;

                        return (
                          <div
                            key={item.id}
                            className={`border rounded-2xl p-4 sm:p-5 bg-card/60 hover:border-primary/40 transition-all space-y-3 ${
                              !item.enabled ? "opacity-60 bg-muted/20 border-border" : "border-border shadow-sm"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Type Badge */}
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${theme.badge}`}
                                >
                                  {item.type}
                                </span>

                                {/* Display Mode */}
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                  {item.displayMode === "ticker" || (item.displayMode as string) === "scrolling" ? "Ticker (Marquee)" : "Banner (Static)"}
                                </span>

                                {/* Priority */}
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-muted/60 text-muted-foreground">
                                  Priority: {item.priority ?? 10}
                                </span>

                                {/* Status */}
                                {!item.enabled ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                                    Disabled
                                  </span>
                                ) : isScheduled ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    Scheduled
                                  </span>
                                ) : isExpired ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                    Expired
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active Now
                                  </span>
                                )}
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-2 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAnnouncement(item)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                    item.enabled
                                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                                  }`}
                                  title={item.enabled ? "Click to Disable" : "Click to Enable"}
                                >
                                  {item.enabled ? "Enabled" : "Disabled"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAnnouncement(item)}
                                  className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                                  title="Edit Announcement"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAnnouncement(item)}
                                  className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                                  title="Delete Announcement"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Title & Message */}
                            <div>
                              <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                {item.message}
                              </p>
                            </div>

                            {/* Schedule & Action Metadata */}
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                {item.startAt || item.endAt ? (
                                  <span>
                                    {item.startAt ? `From ${new Date(item.startAt).toLocaleString()}` : "Immediate start"}
                                    {item.endAt ? ` until ${new Date(item.endAt).toLocaleString()}` : " (No end date)"}
                                  </span>
                                ) : (
                                  <span>Always active (No schedule limits)</span>
                                )}
                              </div>

                              {item.actionUrl && (
                                <div className="flex items-center gap-1.5">
                                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                  <span className="font-mono truncate max-w-xs">
                                    {item.actionLabel || "Action"}: {item.actionUrl}
                                  </span>
                                </div>
                              )}

                              <div>
                                {item.dismissible !== false ? (
                                  <span className="text-emerald-500 font-medium">✓ Dismissible by visitors</span>
                                ) : (
                                  <span className="text-amber-500 font-medium">⚠ Sticky (Non-dismissible)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ABOUT & HELP ARTICLES */}
          {tab === "aboutHelp" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm max-w-3xl">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-500" /> About Us Page Copy
                </h2>

                <div>
                  <label className={labelClass}>Page Header Title</label>
                  <input
                    value={settings.aboutTitle || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, aboutTitle: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Main Description</label>
                  <textarea
                    value={settings.aboutDescription || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, aboutDescription: e.target.value }))}
                    className="w-full h-24 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Our Mission Statement</label>
                  <textarea
                    value={settings.aboutMission || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, aboutMission: e.target.value }))}
                    className="w-full h-20 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Our Vision Statement</label>
                  <textarea
                    value={settings.aboutVision || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, aboutVision: e.target.value }))}
                    className="w-full h-20 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>
              </div>

              {/* Help Center Articles */}
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="font-bold text-base flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-emerald-500" /> Help Center Articles
                    </h2>
                    <p className="text-xs text-muted-foreground">Articles shown in Help Center (/help)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArticleModalOpen(true)}
                    className="px-3.5 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Article
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {helpArticles.map((article) => (
                    <div key={article.id} className="p-4 bg-muted/20 border border-border rounded-2xl flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{article.category}</span>
                        <h3 className="font-bold text-sm text-foreground">{article.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteArticle(article.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FAQ MANAGEMENT */}
          {tab === "faq" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-primary" /> FAQ Management
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Add, edit, enable, and sort frequently asked questions across the directory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingFaq(null);
                    setFaqForm({ question: "", answer: "", category: "General", sortOrder: faqs.length + 1, enabled: true });
                    setFaqModalOpen(true);
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add FAQ Item
                </button>
              </div>

              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <div key={f.id} className="p-4 bg-muted/20 border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          #{f.sortOrder || i + 1}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{f.category}</span>
                        {!f.enabled && (
                          <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-bold">
                            Disabled
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm text-foreground">{f.question}</h3>
                      <p className="text-xs text-muted-foreground">{f.answer}</p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFaq(f);
                          setFaqForm({
                            question: f.question,
                            answer: f.answer,
                            category: f.category || "General",
                            sortOrder: f.sortOrder || i + 1,
                            enabled: f.enabled !== false,
                          });
                          setFaqModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(f.id)}
                        className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONTACT & SOCIAL LINKS */}
          {tab === "contactSocial" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" /> Contact Details & Office Info
                </h2>

                <div>
                  <label className={labelClass}>Support Email</label>
                  <input
                    type="email"
                    value={settings.supportEmail || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Support Mobile Helpline</label>
                  <input
                    value={settings.supportMobile || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, supportMobile: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Business Physical Address</label>
                  <textarea
                    value={settings.businessAddress || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, businessAddress: e.target.value }))}
                    className="w-full h-20 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Office Working Hours</label>
                  <input
                    value={settings.officeHours || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, officeHours: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Google Maps Embed URL</label>
                  <input
                    value={settings.googleMapUrl || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, googleMapUrl: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Social Media Channels */}
              <div className="bg-card border border-border rounded-3xl p-6 space-y-3 shadow-sm">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-500" /> Official Social Handles & Channels
                </h2>

                <SocialInput label="WhatsApp Channel URL" value={settings.whatsappUrl} onChange={(val) => setSettings((s) => ({ ...s, whatsappUrl: val }))} />
                <SocialInput label="Telegram Channel URL" value={settings.telegramUrl} onChange={(val) => setSettings((s) => ({ ...s, telegramUrl: val }))} />
                <SocialInput label="YouTube Channel URL" value={settings.youtubeUrl} onChange={(val) => setSettings((s) => ({ ...s, youtubeUrl: val }))} />
                <SocialInput label="Instagram Page URL" value={settings.instagramUrl} onChange={(val) => setSettings((s) => ({ ...s, instagramUrl: val }))} />
                <SocialInput label="Facebook Page URL" value={settings.facebookUrl} onChange={(val) => setSettings((s) => ({ ...s, facebookUrl: val }))} />
                <SocialInput label="LinkedIn Page URL" value={settings.linkedinUrl} onChange={(val) => setSettings((s) => ({ ...s, linkedinUrl: val }))} />
                <SocialInput label="X (Twitter) Profile URL" value={settings.twitterUrl} onChange={(val) => setSettings((s) => ({ ...s, twitterUrl: val }))} />
                <SocialInput label="Reddit Subreddit URL" value={settings.redditUrl} onChange={(val) => setSettings((s) => ({ ...s, redditUrl: val }))} />
                <SocialInput label="GitHub Repository URL" value={settings.githubUrl} onChange={(val) => setSettings((s) => ({ ...s, githubUrl: val }))} />
              </div>
            </div>
          )}

          {/* TAB 6: LEGAL PAGES */}
          {tab === "legal" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Static Legal Pages Copy
              </h2>

              <div>
                <label className={labelClass}>Privacy Policy Content</label>
                <textarea
                  value={settings.privacyPolicyContent || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, privacyPolicyContent: e.target.value }))}
                  className="w-full h-36 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className={labelClass}>Terms of Service Content</label>
                <textarea
                  value={settings.termsContent || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, termsContent: e.target.value }))}
                  className="w-full h-36 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className={labelClass}>DMCA Copyright Policy Content</label>
                <textarea
                  value={settings.dmcaContent || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, dmcaContent: e.target.value }))}
                  className="w-full h-36 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className={labelClass}>General Legal Disclaimer</label>
                <textarea
                  value={settings.disclaimerContent || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, disclaimerContent: e.target.value }))}
                  className="w-full h-28 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 7: SEO MANAGEMENT */}
          {tab === "seo" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" /> Meta Tags & Open Graph
                </h2>

                <div>
                  <label className={labelClass}>Website Default Meta Title</label>
                  <input
                    value={settings.metaTitle || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, metaTitle: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Website Default Meta Description</label>
                  <textarea
                    value={settings.metaDescription || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, metaDescription: e.target.value }))}
                    className="w-full h-24 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Meta Keywords (comma separated)</label>
                  <input
                    value={settings.metaKeywords || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, metaKeywords: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Canonical URL Base</label>
                  <input
                    value={settings.canonicalUrl || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, canonicalUrl: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Open Graph Banner Image URL</label>
                  <input
                    value={settings.ogImage || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, ogImage: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Twitter Card Image URL</label>
                  <input
                    value={settings.twitterCardImage || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, twitterCardImage: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Robots.txt & Sitemap.xml */}
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-500" /> Crawlers & Schema Markup
                </h2>

                <div>
                  <label className={labelClass}>robots.txt Content</label>
                  <textarea
                    value={settings.robotsTxtContent || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, robotsTxtContent: e.target.value }))}
                    className="w-full h-28 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>sitemap.xml Template</label>
                  <textarea
                    value={settings.sitemapXmlContent || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, sitemapXmlContent: e.target.value }))}
                    className="w-full h-32 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className={labelClass}>Structured Data (JSON-LD Schema)</label>
                  <textarea
                    value={settings.structuredDataJson || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, structuredDataJson: e.target.value }))}
                    className="w-full h-28 p-3 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SYSTEM SETTINGS */}
          {tab === "system" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-sm max-w-3xl">
              <div className="border-b border-border pb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" /> Feature Modules & Global Master Switches
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable or disable platform functionalities instantly across the site.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ToggleCard
                  title="User Registration"
                  description="Allow new visitors to register accounts"
                  enabled={settings.userRegistrationEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, userRegistrationEnabled: !s.userRegistrationEnabled }))}
                />
                <ToggleCard
                  title="Google OAuth Login"
                  description="Enable one-click Google Sign-In"
                  enabled={settings.googleLoginEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, googleLoginEnabled: !s.googleLoginEnabled }))}
                />
                <ToggleCard
                  title="Email & Password Login"
                  description="Allow standard email login form"
                  enabled={settings.emailLoginEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, emailLoginEnabled: !s.emailLoginEnabled }))}
                />
                <ToggleCard
                  title="Mobile OTP Login"
                  description="Allow SMS phone number verification"
                  enabled={settings.mobileOtpLoginEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, mobileOtpLoginEnabled: !s.mobileOtpLoginEnabled }))}
                />
                <ToggleCard
                  title="Group Link Submissions"
                  description="Allow users to submit new community links"
                  enabled={settings.allowPublicSubmissions}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      allowPublicSubmissions: !s.allowPublicSubmissions,
                      groupSubmissionEnabled: !s.allowPublicSubmissions,
                    }))
                  }
                />
                <ToggleCard
                  title="Bookmark & Favorites"
                  description="Allow users to save groups to dashboard"
                  enabled={settings.favoritesEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, favoritesEnabled: !s.favoritesEnabled }))}
                />
                <ToggleCard
                  title="Abuse Report System"
                  description="Enable community report links on group pages"
                  enabled={settings.reportSystemEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, reportSystemEnabled: !s.reportSystemEnabled }))}
                />
                <ToggleCard
                  title="Grievance & Complaints"
                  description="Allow filing legal/formal grievances"
                  enabled={settings.complaintSystemEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, complaintSystemEnabled: !s.complaintSystemEnabled }))}
                />
                <ToggleCard
                  title="Contact Support Form"
                  description="Enable public webmaster contact page"
                  enabled={settings.contactFormEnabled}
                  onToggle={() => setSettings((s) => ({ ...s, contactFormEnabled: !s.contactFormEnabled }))}
                />
                <ToggleCard
                  title="Maintenance Mode"
                  description="Block directory access & show maintenance screen"
                  enabled={settings.maintenanceMode}
                  danger
                  onToggle={() => setSettings((s) => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                />
                {settings.maintenanceMode && (
                  <div className="col-span-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Custom Public Maintenance Notice
                    </label>
                    <textarea
                      value={settings.maintenanceMessage || ""}
                      onChange={(e) => setSettings((s) => ({ ...s, maintenanceMessage: e.target.value }))}
                      placeholder="LinkCloud is currently undergoing scheduled system upgrades and database optimization. We will be back online shortly!"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none h-20"
                      maxLength={300}
                    />
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                      <span>Displayed to public visitors on the maintenance landing page.</span>
                      <span>{(settings.maintenanceMessage || "").length} / 300</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8.5: FILTER MANAGEMENT */}
          {tab === "filters" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-sm max-w-4xl">
              <div className="border-b border-border pb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Filter className="w-5 h-5 text-primary" /> Webmaster Filter Management
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable or disable public directory filters. When a filter is disabled, its dropdown or tab UI is completely hidden across public pages (Home, Directory, Search, Groups).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ToggleCard
                  title="Category Filter"
                  description="Hide/show category dropdown & filter"
                  enabled={settings.filterSettings?.categoryFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        categoryFilterEnabled: !(s.filterSettings?.categoryFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Platform Filter"
                  description="Hide/show WhatsApp, Telegram, Discord filters"
                  enabled={settings.filterSettings?.platformFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        platformFilterEnabled: !(s.filterSettings?.platformFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Content Type Filter"
                  description="Hide/show Broadcast, Group, Channel filter"
                  enabled={settings.filterSettings?.contentTypeFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        contentTypeFilterEnabled: !(s.filterSettings?.contentTypeFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Language Filter"
                  description="Hide/show language dropdown filter"
                  enabled={settings.filterSettings?.languageFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        languageFilterEnabled: !(s.filterSettings?.languageFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="State Filter"
                  description="Hide/show State location dropdown"
                  enabled={settings.filterSettings?.stateFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        stateFilterEnabled: !(s.filterSettings?.stateFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="District Filter"
                  description="Hide/show District location dropdown"
                  enabled={settings.filterSettings?.districtFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        districtFilterEnabled: !(s.filterSettings?.districtFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="City Filter"
                  description="Hide/show City location search/dropdown"
                  enabled={settings.filterSettings?.cityFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        cityFilterEnabled: !(s.filterSettings?.cityFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Link Status Filter"
                  description="Hide/show Active/Inactive link status filter"
                  enabled={settings.filterSettings?.linkStatusFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        linkStatusFilterEnabled: !(s.filterSettings?.linkStatusFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Featured Filter"
                  description="Hide/show Featured groups tab"
                  enabled={settings.filterSettings?.featuredFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        featuredFilterEnabled: !(s.filterSettings?.featuredFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Popular Filter"
                  description="Hide/show Popular groups tab"
                  enabled={settings.filterSettings?.popularFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        popularFilterEnabled: !(s.filterSettings?.popularFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Newest Filter"
                  description="Hide/show Newest/Latest groups tab"
                  enabled={settings.filterSettings?.newestFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        newestFilterEnabled: !(s.filterSettings?.newestFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Verified Filter"
                  description="Hide/show Verified badge filter"
                  enabled={settings.filterSettings?.verifiedFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        verifiedFilterEnabled: !(s.filterSettings?.verifiedFilterEnabled ?? true),
                      },
                    }))
                  }
                />
                <ToggleCard
                  title="Approval Status Filter"
                  description="Hide/show Approval status filter"
                  enabled={settings.filterSettings?.approvalStatusFilterEnabled ?? true}
                  onToggle={() =>
                    setSettings((s) => ({
                      ...s,
                      filterSettings: {
                        ...(s.filterSettings || {
                          categoryFilterEnabled: true,
                          platformFilterEnabled: true,
                          contentTypeFilterEnabled: true,
                          languageFilterEnabled: true,
                          stateFilterEnabled: true,
                          districtFilterEnabled: true,
                          cityFilterEnabled: true,
                          linkStatusFilterEnabled: true,
                          featuredFilterEnabled: true,
                          popularFilterEnabled: true,
                          newestFilterEnabled: true,
                          verifiedFilterEnabled: true,
                          approvalStatusFilterEnabled: true,
                        }),
                        approvalStatusFilterEnabled: !(s.filterSettings?.approvalStatusFilterEnabled ?? true),
                      },
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* TAB 9: SEARCH ANALYTICS */}
          {tab === "analytics" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
              <h2 className="font-bold text-base border-b border-border pb-3 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" /> Most Searched Keywords & Query Analytics
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchAnalytics.map((item) => (
                  <div key={item.id} className="p-4 bg-muted/20 border border-border rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-sm text-foreground">"{item.keyword}"</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground mt-1 font-mono">
                        {item.category && <span>Cat: {item.category}</span>}
                        {item.platform && <span>Plat: {item.platform}</span>}
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-primary/10 text-primary font-extrabold text-xs rounded-full">
                      {item.count} searches
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: AUDIT LOGS */}
          {tab === "auditLog" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> Webmaster System Audit Log
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Chronological record of critical administrative actions performed in the console.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-muted/20 border border-border rounded-xl flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{log.action}</span>
                        <span className="text-[10px] text-muted-foreground">by {log.adminEmail}</span>
                      </div>
                      <p className="text-muted-foreground">{log.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : "Recently"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 11: CLOUDINARY MEDIA */}
          {tab === "cloudinary" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm max-w-2xl">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <UploadCloud className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-base">Cloudinary Direct Image Upload Integration</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                Cloudinary handles high-performance image uploads for group logos, platform icons, and user avatars.
              </p>

              <div>
                <label className={labelClass}>Cloudinary Cloud Name</label>
                <input
                  value={settings.cloudinaryCloudName || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, cloudinaryCloudName: e.target.value }))}
                  placeholder="e.g. linkcloud-prod"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Unsigned Upload Preset</label>
                <input
                  value={settings.cloudinaryUploadPreset || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, cloudinaryUploadPreset: e.target.value }))}
                  placeholder="e.g. linkcloud_unsigned_preset"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Sticky Footer Save Action */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              All settings are synced directly to Firestore collection <code className="text-primary font-mono">/settings/site</code>
            </p>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Webmaster Settings
            </button>
          </div>
        </form>
      )}

      {/* FAQ Add/Edit Modal */}
      {faqModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h2 className="font-bold text-lg">{editingFaq ? "Edit FAQ Item" : "Create New FAQ Item"}</h2>
            <form onSubmit={handleSaveFaq} className="space-y-4">
              <div>
                <label className={labelClass}>Question</label>
                <input
                  value={faqForm.question}
                  onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Answer</label>
                <textarea
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
                  className="w-full h-24 p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <input
                    value={faqForm.category}
                    onChange={(e) => setFaqForm((f) => ({ ...f, category: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sort Order</label>
                  <input
                    type="number"
                    value={faqForm.sortOrder}
                    onChange={(e) => setFaqForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 1 }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFaqModalOpen(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl"
                >
                  Save FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help Article Modal */}
      {articleModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h2 className="font-bold text-lg">Create Help Center Article</h2>
            <form onSubmit={handleSaveArticle} className="space-y-4">
              <div>
                <label className={labelClass}>Article Title</label>
                <input
                  value={articleForm.title}
                  onChange={(e) => setArticleForm((a) => ({ ...a, title: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <input
                  value={articleForm.category}
                  onChange={(e) => setArticleForm((a) => ({ ...a, category: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Content / Instructions</label>
                <textarea
                  value={articleForm.content}
                  onChange={(e) => setArticleForm((a) => ({ ...a, content: e.target.value }))}
                  className="w-full h-32 p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setArticleModalOpen(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl"
                >
                  Publish Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcement Modal with Live Device Preview */}
      {announcementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" />
                {editingAnnouncement ? "Edit Announcement" : "Create New Announcement"}
              </h3>
              <button
                type="button"
                onClick={() => setAnnouncementModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Interactive Preview Box */}
            <div className="border border-border/80 rounded-2xl p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <Eye className="w-4 h-4 text-primary" /> Live Interactive Preview
                </div>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                      previewDevice === "desktop"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                      previewDevice === "mobile"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile (375px)
                  </button>
                </div>
              </div>

              <div
                className={`transition-all duration-300 mx-auto overflow-hidden rounded-xl border border-border bg-card ${
                  previewDevice === "mobile" ? "max-w-[375px] shadow-lg" : "w-full"
                }`}
              >
                <AnnouncementBanner
                  previewItem={{
                    id: "preview_banner",
                    title: announcementForm.title.trim() || "Announcement Headline",
                    message:
                      announcementForm.message.trim() ||
                      "This is how your live announcement banner will look to all visitors across India.",
                    type: announcementForm.type,
                    displayMode: announcementForm.displayMode,
                    priority: announcementForm.priority,
                    enabled: announcementForm.enabled,
                    dismissible: announcementForm.dismissible,
                    actionLabel: announcementForm.actionLabel?.trim() || undefined,
                    actionUrl: announcementForm.actionUrl?.trim() || undefined,
                    startAt: announcementForm.startAt || undefined,
                    endAt: announcementForm.endAt || undefined,
                  }}
                  previewMode={previewDevice}
                />
              </div>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              {/* Title Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClass}>Headline / Title *</label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {announcementForm.title.length} / 100
                  </span>
                </div>
                <input
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm((a) => ({ ...a, title: e.target.value }))}
                  placeholder="e.g. New WhatsApp Community Added for Developers"
                  maxLength={100}
                  className={inputClass}
                  required
                />
              </div>

              {/* Message Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClass}>Message Body *</label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {announcementForm.message.length} / 500
                  </span>
                </div>
                <textarea
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm((a) => ({ ...a, message: e.target.value }))}
                  placeholder="Provide clear details, update notes, or guidance for LinkCloud members..."
                  maxLength={500}
                  rows={3}
                  className="w-full p-3 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
                  required
                />
              </div>

              {/* Type & Display Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Category Theme / Type</label>
                  <select
                    value={announcementForm.type}
                    onChange={(e) =>
                      setAnnouncementForm((a) => ({ ...a, type: e.target.value as AnnouncementType }))
                    }
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary font-mono"
                  >
                    <option value="announcement">Announcement (Indigo)</option>
                    <option value="info">Info / Tip (Blue)</option>
                    <option value="important">Important (Purple)</option>
                    <option value="warning">Notice / Warning (Yellow)</option>
                    <option value="maintenance">Maintenance (Amber)</option>
                    <option value="success">Success / Highlight (Emerald)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Display Presentation</label>
                  <select
                    value={announcementForm.displayMode}
                    onChange={(e) =>
                      setAnnouncementForm((a) => ({
                        ...a,
                        displayMode: e.target.value as AnnouncementDisplayMode,
                      }))
                    }
                    className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary font-mono"
                  >
                    <option value="banner">Static Banner (Top full-width card)</option>
                    <option value="ticker">Scrolling Ticker (Continuous marquee)</option>
                  </select>
                </div>
              </div>

              {/* Priority & Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <label className={labelClass}>Display Priority (1–100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={announcementForm.priority}
                    onChange={(e) =>
                      setAnnouncementForm((a) => ({
                        ...a,
                        priority: parseInt(e.target.value) || 10,
                      }))
                    }
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">Higher = shown first</span>
                </div>

                <div className="pt-2 sm:pt-0">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={announcementForm.enabled}
                      onChange={(e) => setAnnouncementForm((a) => ({ ...a, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                    />
                    <span>Active / Enabled</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">Turn on/off immediately</span>
                </div>

                <div className="pt-2 sm:pt-0">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={announcementForm.dismissible}
                      onChange={(e) =>
                        setAnnouncementForm((a) => ({ ...a, dismissible: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-primary focus:ring-primary"
                    />
                    <span>Allow Dismissal</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">Show (X) button to close</span>
                </div>
              </div>

              {/* Action Button & Link URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Action Button Label (Optional)</label>
                  <input
                    value={announcementForm.actionLabel || ""}
                    onChange={(e) => setAnnouncementForm((a) => ({ ...a, actionLabel: e.target.value }))}
                    placeholder="e.g. Explore Groups, Read Guidelines"
                    maxLength={50}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Action Link URL (Optional)</label>
                  <input
                    value={announcementForm.actionUrl || ""}
                    onChange={(e) => setAnnouncementForm((a) => ({ ...a, actionUrl: e.target.value }))}
                    placeholder="e.g. /groups, /faq, https://t.me/..."
                    maxLength={300}
                    className={inputClass}
                  />
                  {announcementForm.actionUrl && !isSafeActionUrl(announcementForm.actionUrl) && (
                    <span className="text-[10px] text-destructive font-semibold flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Disallowed URL protocol detected
                    </span>
                  )}
                </div>
              </div>

              {/* Schedule Start & End */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Schedule Start (Optional)</label>
                  <input
                    type="datetime-local"
                    value={announcementForm.startAt ? announcementForm.startAt.slice(0, 16) : ""}
                    onChange={(e) =>
                      setAnnouncementForm((a) => ({
                        ...a,
                        startAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      }))
                    }
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Leave blank to activate immediately
                  </span>
                </div>

                <div>
                  <label className={labelClass}>Schedule Expiry (Optional)</label>
                  <input
                    type="datetime-local"
                    value={announcementForm.endAt ? announcementForm.endAt.slice(0, 16) : ""}
                    onChange={(e) =>
                      setAnnouncementForm((a) => ({
                        ...a,
                        endAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      }))
                    }
                    className={inputClass}
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Leave blank for permanent display
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAnnouncementModalOpen(false)}
                  disabled={announcementSaving}
                  className="px-4 py-2 bg-muted text-muted-foreground text-xs font-bold rounded-xl hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={announcementSaving}
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-primary/90 shadow-md"
                >
                  {announcementSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingAnnouncement ? "Update Announcement" : "Publish Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Record Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={
          deleteConfirm?.type === "faq"
            ? "Delete FAQ"
            : deleteConfirm?.type === "article"
            ? "Delete Help Article"
            : "Delete Announcement"
        }
        description={`Are you sure you want to permanently delete this ${
          deleteConfirm?.type === "faq"
            ? "FAQ"
            : deleteConfirm?.type === "article"
            ? "help article"
            : "announcement banner"
        }? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteAction}
      />
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function ToggleCard({
  title,
  description,
  enabled,
  onToggle,
  danger = false,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
        danger
          ? "bg-destructive/5 border-destructive/20"
          : enabled
          ? "bg-card border-border/80"
          : "bg-muted/20 border-border/40 opacity-70"
      }`}
    >
      <div>
        <p className={`font-bold text-xs ${danger ? "text-destructive" : "text-foreground"}`}>{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
          enabled ? (danger ? "bg-destructive" : "bg-primary") : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            enabled ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function SocialInput({ label, value, onChange }: { label: string; value?: string; onChange: (val: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-muted-foreground mb-1">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
