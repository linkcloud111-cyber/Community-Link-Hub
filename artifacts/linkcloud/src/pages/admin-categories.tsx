import { useState, useEffect } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCustomPlatforms,
  createCustomPlatform,
  updateCustomPlatform,
  deleteCustomPlatform,
  getCustomContentTypes,
  createCustomContentType,
  updateCustomContentType,
  deleteCustomContentType,
  getCustomLanguages,
  createCustomLanguage,
  updateCustomLanguage,
  deleteCustomLanguage,
  checkTaxonomyUsage,
  reassignTaxonomyAndDelete,
  seedDefaultTaxonomies,
  slugify,
} from "@/lib/firestore";
import type { Category, PlatformItem, ContentTypeItem, LanguageItem } from "@/lib/types";
import AdminNav from "@/components/admin-nav";
import { TaxonomyBadge } from "@/components/taxonomy-badge";
import { COMMON_ICON_OPTIONS, getTaxonomyVisual, getDeterministicColor } from "@/lib/taxonomy-visuals";
import { resolveTaxonomyInput } from "@/lib/taxonomy-resolver";
import { toast } from "sonner";
import {
  Loader2,
  FolderTree,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Share2,
  Globe,
  FileText,
  Sparkles,
  AlertTriangle,
  Search,
  Power,
  Eye,
  Wand2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

type TaxonomyTab = "categories" | "platforms" | "contentTypes" | "languages";

export default function AdminCategories() {
  const [tab, setTab] = useState<TaxonomyTab>("categories");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<PlatformItem[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentTypeItem[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);

  // Category Form State
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catIcon, setCatIcon] = useState("");
  const [catColor, setCatColor] = useState("#3b82f6");
  const [catOrder, setCatOrder] = useState<number>(1);
  const [catStatus, setCatStatus] = useState<"active" | "disabled">("active");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Platform Form State
  const [platName, setPlatName] = useState("");
  const [platSlug, setPlatSlug] = useState("");
  const [platIcon, setPlatIcon] = useState("");
  const [platColor, setPlatColor] = useState("#22c55e");
  const [platInvitePattern, setPlatInvitePattern] = useState("");
  const [platHelpText, setPlatHelpText] = useState("");
  const [platOrder, setPlatOrder] = useState<number>(1);
  const [platStatus, setPlatStatus] = useState<"active" | "disabled">("active");
  const [editingPlatId, setEditingPlatId] = useState<string | null>(null);

  // Content Type Form State
  const [ctName, setCtName] = useState("");
  const [ctSlug, setCtSlug] = useState("");
  const [ctIcon, setCtIcon] = useState("");
  const [ctColor, setCtColor] = useState("#8b5cf6");
  const [ctCategory, setCtCategory] = useState("");
  const [ctOrder, setCtOrder] = useState<number>(1);
  const [ctStatus, setCtStatus] = useState<"active" | "disabled">("active");
  const [editingCtId, setEditingCtId] = useState<string | null>(null);

  // Language Form State
  const [langName, setLangName] = useState("");
  const [langSlug, setLangSlug] = useState("");
  const [langCode, setLangCode] = useState("");
  const [langIcon, setLangIcon] = useState("");
  const [langColor, setLangColor] = useState("#f97316");
  const [langOrder, setLangOrder] = useState<number>(1);
  const [langStatus, setLangStatus] = useState<"active" | "disabled">("active");
  const [editingLangId, setEditingLangId] = useState<string | null>(null);

  // Auto Resolver & UI states
  const [isResolving, setIsResolving] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Safe Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "category" | "platform" | "contentType" | "language";
    id: string;
    name: string;
    slug?: string;
  } | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState<number>(0);
  const [sampleGroups, setSampleGroups] = useState<{ id: string; name: string }[]>([]);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");
  const [reassignTargetName, setReassignTargetName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAllTaxonomies = async () => {
    setLoading(true);
    try {
      const [cats, plats, cts, langs] = await Promise.all([
        getCategories(false),
        getCustomPlatforms(false),
        getCustomContentTypes(false),
        getCustomLanguages(false),
      ]);
      setCategories(cats);
      setPlatforms(plats);
      setContentTypes(cts);
      setLanguages(langs);
    } catch {
      toast.error("Failed to load taxonomy metadata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTaxonomies();
  }, []);

  // ─── SMART AUTO-RESOLVER EFFECTS ──────────────────────────────────────────

  // Category Auto Resolver
  useEffect(() => {
    if (tab !== "categories") return;
    if (editingCatId || !catName.trim()) {
      if (!catName.trim()) setDupWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      try {
        const res = await resolveTaxonomyInput("category", catName);
        setCatSlug(res.slug);
        setCatIcon(res.icon);
        setCatColor(res.color);
        setCatOrder(categories.length + 1);

        const dup = categories.some(
          (c) =>
            c.slug?.toLowerCase() === res.slug.toLowerCase() ||
            c.name.toLowerCase().trim() === catName.toLowerCase().trim()
        );
        if (dup) {
          setDupWarning(`Category "${res.name}" (${res.slug}) already exists.`);
        } else {
          setDupWarning(null);
        }
      } catch (err) {
        console.error("Category auto-resolve error:", err);
      } finally {
        setIsResolving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [catName, editingCatId, categories, tab]);

  // Platform Auto Resolver
  useEffect(() => {
    if (tab !== "platforms") return;
    if (editingPlatId || !platName.trim()) {
      if (!platName.trim()) setDupWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      try {
        const res = await resolveTaxonomyInput("platform", platName);
        setPlatSlug(res.slug);
        setPlatIcon(res.icon);
        setPlatColor(res.color);
        if (res.invitePattern) setPlatInvitePattern(res.invitePattern);
        if (res.helpText) setPlatHelpText(res.helpText);
        setPlatOrder(platforms.length + 1);

        const dup = platforms.some(
          (p) =>
            p.slug?.toLowerCase() === res.slug.toLowerCase() ||
            p.name.toLowerCase().trim() === platName.toLowerCase().trim()
        );
        if (dup) {
          setDupWarning(`Platform "${res.name}" (${res.slug}) already exists.`);
        } else {
          setDupWarning(null);
        }
      } catch (err) {
        console.error("Platform auto-resolve error:", err);
      } finally {
        setIsResolving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [platName, editingPlatId, platforms, tab]);

  // Content Type Auto Resolver
  useEffect(() => {
    if (tab !== "contentTypes") return;
    if (editingCtId || !ctName.trim()) {
      if (!ctName.trim()) setDupWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      try {
        const res = await resolveTaxonomyInput("contentType", ctName);
        setCtSlug(res.slug);
        setCtIcon(res.icon);
        setCtColor(res.color);
        setCtOrder(contentTypes.length + 1);

        const dup = contentTypes.some(
          (ct) =>
            ct.slug?.toLowerCase() === res.slug.toLowerCase() ||
            ct.name.toLowerCase().trim() === ctName.toLowerCase().trim()
        );
        if (dup) {
          setDupWarning(`Content Type "${res.name}" (${res.slug}) already exists.`);
        } else {
          setDupWarning(null);
        }
      } catch (err) {
        console.error("Content Type auto-resolve error:", err);
      } finally {
        setIsResolving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [ctName, editingCtId, contentTypes, tab]);

  // Language Auto Resolver
  useEffect(() => {
    if (tab !== "languages") return;
    if (editingLangId || !langName.trim()) {
      if (!langName.trim()) setDupWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsResolving(true);
      try {
        const res = await resolveTaxonomyInput("language", langName);
        setLangSlug(res.slug);
        if (res.code) setLangCode(res.code);
        setLangIcon(res.icon);
        setLangColor(res.color);
        setLangOrder(languages.length + 1);

        const dup = languages.some(
          (l) =>
            l.slug?.toLowerCase() === res.slug.toLowerCase() ||
            l.name.toLowerCase().trim() === langName.toLowerCase().trim()
        );
        if (dup) {
          setDupWarning(`Language "${res.name}" (${res.slug}) already exists.`);
        } else {
          setDupWarning(null);
        }
      } catch (err) {
        console.error("Language auto-resolve error:", err);
      } finally {
        setIsResolving(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [langName, editingLangId, languages, tab]);

  // Manual Auto-Resolve Trigger (e.g. for Edit mode or explicit refresh)
  const handleTriggerAutoResolve = async (taxonomyType: TaxonomyTab) => {
    setIsResolving(true);
    try {
      if (taxonomyType === "categories" && catName.trim()) {
        const res = await resolveTaxonomyInput("category", catName);
        setCatSlug(res.slug);
        setCatIcon(res.icon);
        setCatColor(res.color);
        toast.success("Resolved Category metadata");
      } else if (taxonomyType === "platforms" && platName.trim()) {
        const res = await resolveTaxonomyInput("platform", platName);
        setPlatSlug(res.slug);
        setPlatIcon(res.icon);
        setPlatColor(res.color);
        if (res.invitePattern) setPlatInvitePattern(res.invitePattern);
        if (res.helpText) setPlatHelpText(res.helpText);
        toast.success("Resolved Platform specs & brand logo");
      } else if (taxonomyType === "contentTypes" && ctName.trim()) {
        const res = await resolveTaxonomyInput("contentType", ctName);
        setCtSlug(res.slug);
        setCtIcon(res.icon);
        setCtColor(res.color);
        toast.success("Resolved Content Type metadata");
      } else if (taxonomyType === "languages" && langName.trim()) {
        const res = await resolveTaxonomyInput("language", langName);
        setLangSlug(res.slug);
        if (res.code) setLangCode(res.code);
        setLangIcon(res.icon);
        setLangColor(res.color);
        toast.success("Resolved Language specs & ISO code");
      }
    } catch {
      toast.error("Failed to auto-resolve details");
    } finally {
      setIsResolving(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await seedDefaultTaxonomies();
      const total = res.categories + res.platforms + res.contentTypes + res.languages;
      if (total > 0) {
        toast.success(
          `Seeded default taxonomies: ${res.categories} categories, ${res.platforms} platforms, ${res.contentTypes} content types, ${res.languages} languages.`
        );
      } else {
        toast.info("All default taxonomies already exist in Firestore.");
      }
      await loadAllTaxonomies();
    } catch (err: any) {
      toast.error(err?.message || "Failed to seed default taxonomies.");
    } finally {
      setSeeding(false);
    }
  };

  // ─── CATEGORY HANDLERS ──────────────────────────────────────────────────────
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      toast.error("Category name is required");
      return;
    }
    if (dupWarning && !editingCatId) {
      toast.error(dupWarning);
      return;
    }

    try {
      if (editingCatId) {
        await updateCategory(editingCatId, {
          name: catName.trim(),
          slug: catSlug.trim() || slugify(catName),
          icon: catIcon.trim() || "Folder",
          color: catColor,
          themeColor: catColor,
          displayOrder: Number(catOrder),
          status: catStatus,
        });
        toast.success("Category updated successfully");
      } else {
        await createCategory({
          name: catName.trim(),
          slug: catSlug.trim() || slugify(catName),
          icon: catIcon.trim() || "Folder",
          color: catColor,
          themeColor: catColor,
          displayOrder: Number(catOrder) || categories.length + 1,
          status: catStatus,
        });
        toast.success("Category created successfully");
      }
      resetCatForm();
      await loadAllTaxonomies();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save category");
    }
  };

  const resetCatForm = () => {
    setCatName("");
    setCatSlug("");
    setCatIcon("");
    setCatColor("#3b82f6");
    setCatOrder(categories.length + 1);
    setCatStatus("active");
    setEditingCatId(null);
    setDupWarning(null);
  };

  const startEditCategory = (c: Category) => {
    setEditingCatId(c.id);
    setCatName(c.name);
    setCatSlug(c.slug || slugify(c.name));
    setCatIcon(c.icon || "Folder");
    setCatColor(c.color || c.themeColor || "#3b82f6");
    setCatOrder(c.displayOrder ?? (c as any).order ?? 1);
    setCatStatus(c.status === "disabled" || c.enabled === false ? "disabled" : "active");
    setDupWarning(null);
  };

  const toggleCategoryStatus = async (c: Category) => {
    const nextStatus = c.status === "active" && c.enabled !== false ? "disabled" : "active";
    try {
      await updateCategory(c.id, { status: nextStatus, enabled: nextStatus === "active" });
      toast.success(`Category "${c.name}" is now ${nextStatus}`);
      await loadAllTaxonomies();
    } catch {
      toast.error("Failed to update category status");
    }
  };

  // ─── PLATFORM HANDLERS ──────────────────────────────────────────────────────
  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platName.trim()) {
      toast.error("Platform name is required");
      return;
    }
    if (dupWarning && !editingPlatId) {
      toast.error(dupWarning);
      return;
    }

    try {
      if (editingPlatId) {
        await updateCustomPlatform(editingPlatId, {
          name: platName.trim(),
          slug: platSlug.trim() || slugify(platName),
          icon: platIcon.trim() || "Share2",
          color: platColor,
          invitePattern: platInvitePattern.trim(),
          helpText: platHelpText.trim(),
          displayOrder: Number(platOrder),
          status: platStatus,
        });
        toast.success("Platform updated successfully");
      } else {
        await createCustomPlatform({
          name: platName.trim(),
          slug: platSlug.trim() || slugify(platName),
          icon: platIcon.trim() || "Share2",
          color: platColor,
          invitePattern: platInvitePattern.trim(),
          helpText: platHelpText.trim(),
          displayOrder: Number(platOrder) || platforms.length + 1,
          status: platStatus,
        });
        toast.success("Platform created successfully");
      }
      resetPlatForm();
      await loadAllTaxonomies();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save platform");
    }
  };

  const resetPlatForm = () => {
    setPlatName("");
    setPlatSlug("");
    setPlatIcon("");
    setPlatColor("#22c55e");
    setPlatInvitePattern("");
    setPlatHelpText("");
    setPlatOrder(platforms.length + 1);
    setPlatStatus("active");
    setEditingPlatId(null);
    setDupWarning(null);
  };

  const startEditPlatform = (p: PlatformItem) => {
    setEditingPlatId(p.id);
    setPlatName(p.name);
    setPlatSlug(p.slug || slugify(p.name));
    setPlatIcon(p.icon || "");
    setPlatColor(p.color || p.themeColor || "#22c55e");
    setPlatInvitePattern(p.invitePattern || "");
    setPlatHelpText(p.helpText || "");
    setPlatOrder(p.displayOrder ?? p.order ?? 1);
    setPlatStatus(p.status === "disabled" || p.enabled === false ? "disabled" : "active");
    setDupWarning(null);
  };

  const togglePlatformStatus = async (p: PlatformItem) => {
    const nextStatus = p.status === "active" && p.enabled !== false ? "disabled" : "active";
    try {
      await updateCustomPlatform(p.id, { status: nextStatus, enabled: nextStatus === "active" });
      toast.success(`Platform "${p.name}" is now ${nextStatus}`);
      await loadAllTaxonomies();
    } catch {
      toast.error("Failed to update platform status");
    }
  };

  // ─── CONTENT TYPE HANDLERS ──────────────────────────────────────────────────
  const handleSaveContentType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctName.trim()) {
      toast.error("Content Type name is required");
      return;
    }
    if (dupWarning && !editingCtId) {
      toast.error(dupWarning);
      return;
    }

    try {
      if (editingCtId) {
        await updateCustomContentType(editingCtId, {
          name: ctName.trim(),
          slug: ctSlug.trim() || slugify(ctName),
          icon: ctIcon.trim() || "MessageCircle",
          color: ctColor,
          themeColor: ctColor,
          categoryId: ctCategory,
          displayOrder: Number(ctOrder),
          status: ctStatus,
        });
        toast.success("Content Type updated successfully");
      } else {
        await createCustomContentType({
          name: ctName.trim(),
          slug: ctSlug.trim() || slugify(ctName),
          icon: ctIcon.trim() || "MessageCircle",
          color: ctColor,
          themeColor: ctColor,
          categoryId: ctCategory,
          displayOrder: Number(ctOrder) || contentTypes.length + 1,
          status: ctStatus,
        });
        toast.success("Content Type created successfully");
      }
      resetCtForm();
      await loadAllTaxonomies();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save content type");
    }
  };

  const resetCtForm = () => {
    setCtName("");
    setCtSlug("");
    setCtIcon("");
    setCtColor("#8b5cf6");
    setCtCategory("");
    setCtOrder(contentTypes.length + 1);
    setCtStatus("active");
    setEditingCtId(null);
    setDupWarning(null);
  };

  const startEditContentType = (ct: ContentTypeItem) => {
    setEditingCtId(ct.id);
    setCtName(ct.name);
    setCtSlug(ct.slug || slugify(ct.name));
    setCtIcon(ct.icon || "");
    setCtColor(ct.color || ct.themeColor || "#8b5cf6");
    setCtCategory(ct.categoryId || "");
    setCtOrder(ct.displayOrder ?? ct.order ?? 1);
    setCtStatus(ct.status === "disabled" || ct.enabled === false ? "disabled" : "active");
    setDupWarning(null);
  };

  const toggleContentTypeStatus = async (ct: ContentTypeItem) => {
    const nextStatus = ct.status === "active" && ct.enabled !== false ? "disabled" : "active";
    try {
      await updateCustomContentType(ct.id, { status: nextStatus, enabled: nextStatus === "active" });
      toast.success(`Content Type "${ct.name}" is now ${nextStatus}`);
      await loadAllTaxonomies();
    } catch {
      toast.error("Failed to update content type status");
    }
  };

  // ─── LANGUAGE HANDLERS ──────────────────────────────────────────────────────
  const handleSaveLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!langName.trim()) {
      toast.error("Language name is required");
      return;
    }
    if (dupWarning && !editingLangId) {
      toast.error(dupWarning);
      return;
    }

    try {
      if (editingLangId) {
        await updateCustomLanguage(editingLangId, {
          name: langName.trim(),
          slug: langSlug.trim() || slugify(langName),
          code: langCode.trim(),
          icon: langIcon.trim() || "Languages",
          color: langColor,
          themeColor: langColor,
          displayOrder: Number(langOrder),
          status: langStatus,
        });
        toast.success("Language updated");
      } else {
        await createCustomLanguage({
          name: langName.trim(),
          slug: langSlug.trim() || slugify(langName),
          code: langCode.trim(),
          icon: langIcon.trim() || "Languages",
          color: langColor,
          themeColor: langColor,
          displayOrder: Number(langOrder) || languages.length + 1,
          status: langStatus,
        });
        toast.success("Language created successfully");
      }
      resetLangForm();
      await loadAllTaxonomies();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save language");
    }
  };

  const resetLangForm = () => {
    setLangName("");
    setLangSlug("");
    setLangCode("");
    setLangIcon("");
    setLangColor("#f97316");
    setLangOrder(languages.length + 1);
    setLangStatus("active");
    setEditingLangId(null);
    setDupWarning(null);
  };

  const startEditLanguage = (l: LanguageItem) => {
    setEditingLangId(l.id);
    setLangName(l.name);
    setLangSlug(l.slug || slugify(l.name));
    setLangCode(l.code || "");
    setLangIcon(l.icon || "");
    setLangColor(l.color || l.themeColor || "#f97316");
    setLangOrder(l.displayOrder ?? l.order ?? 1);
    setLangStatus(l.status === "disabled" || l.enabled === false ? "disabled" : "active");
    setDupWarning(null);
  };

  const toggleLanguageStatus = async (l: LanguageItem) => {
    const nextStatus = l.status === "active" && l.enabled !== false ? "disabled" : "active";
    try {
      await updateCustomLanguage(l.id, { status: nextStatus, enabled: nextStatus === "active" });
      toast.success(`Language "${l.name}" is now ${nextStatus}`);
      await loadAllTaxonomies();
    } catch {
      toast.error("Failed to update language status");
    }
  };

  // ─── SAFE DELETE MODAL FLOW ──────────────────────────────────────────────────
  const openDeleteModal = async (
    type: "category" | "platform" | "contentType" | "language",
    item: { id: string; name: string; slug?: string }
  ) => {
    setDeleteTarget({ type, id: item.id, name: item.name, slug: item.slug });
    setDeleteModalOpen(true);
    setIsDeleting(false);

    try {
      const usage = await checkTaxonomyUsage(type, item.id, item.name);
      setDeleteUsageCount(usage.count);
      setSampleGroups(usage.sampleGroups);

      if (type === "category") {
        const active = categories.filter((c) => c.id !== item.id && c.status !== "disabled");
        if (active.length > 0) {
          setReassignTargetId(active[0].id);
          setReassignTargetName(active[0].name);
        }
      } else if (type === "platform") {
        const active = platforms.filter((p) => p.id !== item.id && p.status !== "disabled");
        if (active.length > 0) {
          setReassignTargetId(active[0].id);
          setReassignTargetName(active[0].name);
        }
      } else if (type === "contentType") {
        const active = contentTypes.filter((ct) => ct.id !== item.id && ct.status !== "disabled");
        if (active.length > 0) {
          setReassignTargetId(active[0].id);
          setReassignTargetName(active[0].name);
        }
      } else if (type === "language") {
        const active = languages.filter((l) => l.id !== item.id && l.status !== "disabled");
        if (active.length > 0) {
          setReassignTargetId(active[0].id);
          setReassignTargetName(active[0].name);
        }
      }
    } catch {
      setDeleteUsageCount(0);
      setSampleGroups([]);
    }
  };

  const handleConfirmDeleteOrReassign = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteUsageCount > 0) {
        if (!reassignTargetName) {
          toast.error("Please select an item to reassign existing communities to");
          setIsDeleting(false);
          return;
        }
        await reassignTaxonomyAndDelete(
          deleteTarget.type,
          deleteTarget.id,
          { id: reassignTargetId, name: reassignTargetName },
          deleteTarget.id,
          deleteTarget.name
        );
        toast.success(`Reassigned ${deleteUsageCount} community/communities and deleted "${deleteTarget.name}"`);
      } else {
        if (deleteTarget.type === "category") await deleteCategory(deleteTarget.id);
        else if (deleteTarget.type === "platform") await deleteCustomPlatform(deleteTarget.id);
        else if (deleteTarget.type === "contentType") await deleteCustomContentType(deleteTarget.id);
        else if (deleteTarget.type === "language") await deleteCustomLanguage(deleteTarget.id);
        toast.success(`Deleted "${deleteTarget.name}"`);
      }

      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadAllTaxonomies();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete taxonomy item");
    } finally {
      setIsDeleting(false);
    }
  };

  // Search Filter
  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.slug && c.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPlatforms = platforms.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.slug && p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredContentTypes = contentTypes.filter(
    (ct) =>
      ct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ct.slug && ct.slug.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredLanguages = languages.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.slug && l.slug.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.code && l.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <AdminNav />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Module */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              <FolderTree className="h-4 w-4" />
              Taxonomy Architecture
            </div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Smart Dynamic Taxonomy System
              <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-amber-500" /> Auto-Resolve Active
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Webmaster enters name — system automatically resolves icon, brand colors, URL validation regex, and ISO codes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="px-4 py-2 bg-secondary text-secondary-foreground text-xs font-semibold rounded-xl hover:bg-secondary/80 border border-border transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
              {seeding ? "Seeding System..." : "Seed Default Taxonomies"}
            </button>
          </div>
        </div>

        {/* Tab Navigation & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => {
                setTab("categories");
                setDupWarning(null);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                tab === "categories" ? "bg-background text-foreground shadow-xs border border-border/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderTree className="h-3.5 w-3.5 text-blue-500" />
              Categories ({categories.length})
            </button>
            <button
              onClick={() => {
                setTab("platforms");
                setDupWarning(null);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                tab === "platforms" ? "bg-background text-foreground shadow-xs border border-border/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Share2 className="h-3.5 w-3.5 text-emerald-500" />
              Platforms ({platforms.length})
            </button>
            <button
              onClick={() => {
                setTab("contentTypes");
                setDupWarning(null);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                tab === "contentTypes" ? "bg-background text-foreground shadow-xs border border-border/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-purple-500" />
              Content Types ({contentTypes.length})
            </button>
            <button
              onClick={() => {
                setTab("languages");
                setDupWarning(null);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                tab === "languages" ? "bg-background text-foreground shadow-xs border border-border/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-sky-500" />
              Languages ({languages.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search taxonomy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Loading taxonomy architecture...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Form Module */}
            <div className="lg:col-span-4 bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4 sticky top-20">
              {tab === "categories" && (
                <form onSubmit={handleSaveCategory} className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-blue-500" />
                      {editingCatId ? "Edit Category" : "Add New Category"}
                    </h2>
                    {editingCatId && (
                      <button type="button" onClick={resetCatForm} className="text-xs text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Smart Name Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                      <span>Category Name *</span>
                      <span className="text-[10px] text-primary flex items-center gap-1 font-normal">
                        <Wand2 className="w-3 h-3 text-amber-500" /> Smart Auto-Resolve
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Photography or AI & Tech"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {isResolving && (
                        <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Auto-Resolve Status & Feedback */}
                  {catName.trim() && (
                    <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3 text-primary" /> Live UI Badge Preview
                        </div>
                        {editingCatId && (
                          <button
                            type="button"
                            onClick={() => handleTriggerAutoResolve("categories")}
                            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            <RotateCcw className="w-3 h-3" /> Re-resolve
                          </button>
                        )}
                      </div>
                      <div className="pt-0.5 flex items-center gap-2">
                        <TaxonomyBadge
                          type="category"
                          name={catName.trim()}
                          color={catColor}
                          icon={catIcon}
                          size="md"
                        />
                      </div>
                      {!isResolving && (
                        <div className="pt-1 text-[11px] text-muted-foreground flex flex-wrap gap-2 border-t border-border/60">
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Icon: {catIcon}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Slug: {catSlug}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duplicate Warning */}
                  {dupWarning && !editingCatId && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{dupWarning}</span>
                    </div>
                  )}

                  {/* Advanced Settings Collapsible */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full py-1 font-semibold"
                    >
                      <span>Advanced Settings (Optional)</span>
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showAdvanced && (
                      <div className="space-y-3 pt-2 border-t border-border mt-1">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Slug Override</label>
                          <input
                            type="text"
                            placeholder="e.g. photography"
                            value={catSlug}
                            onChange={(e) => setCatSlug(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Icon Name</label>
                          <div className="space-y-1.5">
                            <select
                              value={catIcon}
                              onChange={(e) => setCatIcon(e.target.value)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            >
                              <option value="">Choose standard icon...</option>
                              {COMMON_ICON_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Or Lucide icon name (e.g. Camera, Cpu)"
                              value={catIcon}
                              onChange={(e) => setCatIcon(e.target.value)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Theme Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={catColor || "#3b82f6"}
                              onChange={(e) => setCatColor(e.target.value)}
                              className="h-8 w-8 rounded border border-border cursor-pointer bg-background p-0.5 shrink-0"
                            />
                            <input
                              type="text"
                              value={catColor}
                              onChange={(e) => setCatColor(e.target.value)}
                              placeholder="#3B82F6"
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono uppercase"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Display Order</label>
                            <input
                              type="number"
                              min="1"
                              value={catOrder}
                              onChange={(e) => setCatOrder(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                            <select
                              value={catStatus}
                              onChange={(e) => setCatStatus(e.target.value as "active" | "disabled")}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isResolving || (!!dupWarning && !editingCatId)}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {editingCatId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingCatId ? "Update Category" : "Save Category"}
                  </button>
                </form>
              )}

              {tab === "platforms" && (
                <form onSubmit={handleSavePlatform} className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-emerald-500" />
                      {editingPlatId ? "Edit Platform" : "Add New Platform"}
                    </h2>
                    {editingPlatId && (
                      <button type="button" onClick={resetPlatForm} className="text-xs text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Smart Name Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                      <span>Platform Name *</span>
                      <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-normal">
                        <Wand2 className="w-3 h-3 text-amber-500" /> Auto Brand Specs
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Snapchat Groups or Signal"
                        value={platName}
                        onChange={(e) => setPlatName(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {isResolving && (
                        <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Live Visual Preview & Auto Specs */}
                  {platName.trim() && (
                    <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3 text-emerald-500" /> Live UI Badge Preview
                        </div>
                        {editingPlatId && (
                          <button
                            type="button"
                            onClick={() => handleTriggerAutoResolve("platforms")}
                            className="text-[11px] text-emerald-500 hover:underline flex items-center gap-1 font-medium"
                          >
                            <RotateCcw className="w-3 h-3" /> Re-resolve Brand
                          </button>
                        )}
                      </div>
                      <div className="pt-0.5 flex items-center gap-2">
                        <TaxonomyBadge
                          type="platform"
                          name={platName.trim()}
                          color={platColor}
                          icon={platIcon}
                          size="md"
                        />
                      </div>
                      {!isResolving && (
                        <div className="pt-1 text-[11px] text-muted-foreground space-y-1 border-t border-border/60">
                          <div className="flex flex-wrap gap-2">
                            <span className="flex items-center gap-1 text-emerald-500 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Icon: {platIcon || "Official SVG Logo"}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-500 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Color: {platColor}
                            </span>
                          </div>
                          {platHelpText && (
                            <p className="text-[11px] text-foreground/80 font-mono italic truncate">
                              Help: {platHelpText}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duplicate Warning */}
                  {dupWarning && !editingPlatId && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{dupWarning}</span>
                    </div>
                  )}

                  {/* Advanced Settings Collapsible */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full py-1 font-semibold"
                    >
                      <span>Advanced Settings (Optional)</span>
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showAdvanced && (
                      <div className="space-y-3 pt-2 border-t border-border mt-1">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Slug</label>
                          <input
                            type="text"
                            placeholder="e.g. snapchat-groups"
                            value={platSlug}
                            onChange={(e) => setPlatSlug(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Custom Icon Identifier</label>
                          <input
                            type="text"
                            placeholder="e.g. snapchat, Share2, MessageSquare"
                            value={platIcon}
                            onChange={(e) => setPlatIcon(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Theme Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={platColor || "#22c55e"}
                              onChange={(e) => setPlatColor(e.target.value)}
                              className="h-8 w-8 rounded border border-border cursor-pointer bg-background p-0.5 shrink-0"
                            />
                            <input
                              type="text"
                              value={platColor}
                              onChange={(e) => setPlatColor(e.target.value)}
                              placeholder="#22C55E"
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono uppercase"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Invite URL Validation Regex</label>
                          <input
                            type="text"
                            placeholder="e.g. ^https?:\/\/(snapchat\.com)\/.+"
                            value={platInvitePattern}
                            onChange={(e) => setPlatInvitePattern(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Submission Help Text</label>
                          <input
                            type="text"
                            placeholder="e.g. Enter a valid Snapchat group invite link."
                            value={platHelpText}
                            onChange={(e) => setPlatHelpText(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Display Order</label>
                            <input
                              type="number"
                              min="1"
                              value={platOrder}
                              onChange={(e) => setPlatOrder(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                            <select
                              value={platStatus}
                              onChange={(e) => setPlatStatus(e.target.value as "active" | "disabled")}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isResolving || (!!dupWarning && !editingPlatId)}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {editingPlatId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingPlatId ? "Update Platform" : "Save Platform"}
                  </button>
                </form>
              )}

              {tab === "contentTypes" && (
                <form onSubmit={handleSaveContentType} className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      {editingCtId ? "Edit Content Type" : "Add New Content Type"}
                    </h2>
                    {editingCtId && (
                      <button type="button" onClick={resetCtForm} className="text-xs text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Smart Name Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                      <span>Content Type Name *</span>
                      <span className="text-[10px] text-purple-500 flex items-center gap-1 font-normal">
                        <Wand2 className="w-3 h-3 text-amber-500" /> Auto Semantic Specs
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Masterclass & Webinars"
                        value={ctName}
                        onChange={(e) => setCtName(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {isResolving && (
                        <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Live Visual Preview */}
                  {ctName.trim() && (
                    <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3 text-purple-500" /> Live UI Badge Preview
                        </div>
                        {editingCtId && (
                          <button
                            type="button"
                            onClick={() => handleTriggerAutoResolve("contentTypes")}
                            className="text-[11px] text-purple-500 hover:underline flex items-center gap-1 font-medium"
                          >
                            <RotateCcw className="w-3 h-3" /> Re-resolve
                          </button>
                        )}
                      </div>
                      <div className="pt-0.5 flex items-center gap-2">
                        <TaxonomyBadge
                          type="contentType"
                          name={ctName.trim()}
                          color={ctColor}
                          icon={ctIcon}
                          size="md"
                        />
                      </div>
                      {!isResolving && (
                        <div className="pt-1 text-[11px] text-muted-foreground flex flex-wrap gap-2 border-t border-border/60">
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Icon: {ctIcon}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Slug: {ctSlug}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duplicate Warning */}
                  {dupWarning && !editingCtId && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{dupWarning}</span>
                    </div>
                  )}

                  {/* Advanced Settings Collapsible */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full py-1 font-semibold"
                    >
                      <span>Advanced Settings (Optional)</span>
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showAdvanced && (
                      <div className="space-y-3 pt-2 border-t border-border mt-1">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Slug</label>
                          <input
                            type="text"
                            placeholder="e.g. masterclass-webinars"
                            value={ctSlug}
                            onChange={(e) => setCtSlug(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Icon Name</label>
                          <input
                            type="text"
                            placeholder="e.g. GraduationCap, BookOpen, MessageCircle"
                            value={ctIcon}
                            onChange={(e) => setCtIcon(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Theme Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={ctColor || "#8b5cf6"}
                              onChange={(e) => setCtColor(e.target.value)}
                              className="h-8 w-8 rounded border border-border cursor-pointer bg-background p-0.5 shrink-0"
                            />
                            <input
                              type="text"
                              value={ctColor}
                              onChange={(e) => setCtColor(e.target.value)}
                              placeholder="#8B5CF6"
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono uppercase"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Category Link (Optional)</label>
                          <select
                            value={ctCategory}
                            onChange={(e) => setCtCategory(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                          >
                            <option value="">Global (Applies to all categories)</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Display Order</label>
                            <input
                              type="number"
                              min="1"
                              value={ctOrder}
                              onChange={(e) => setCtOrder(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                            <select
                              value={ctStatus}
                              onChange={(e) => setCtStatus(e.target.value as "active" | "disabled")}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isResolving || (!!dupWarning && !editingCtId)}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {editingCtId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingCtId ? "Update Content Type" : "Save Content Type"}
                  </button>
                </form>
              )}

              {tab === "languages" && (
                <form onSubmit={handleSaveLanguage} className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-sky-500" />
                      {editingLangId ? "Edit Language" : "Add New Language"}
                    </h2>
                    {editingLangId && (
                      <button type="button" onClick={resetLangForm} className="text-xs text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Smart Name Input */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                      <span>Language Name *</span>
                      <span className="text-[10px] text-sky-500 flex items-center gap-1 font-normal">
                        <Wand2 className="w-3 h-3 text-amber-500" /> Auto ISO & Specs
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. French, Spanish, Hindi"
                        value={langName}
                        onChange={(e) => setLangName(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {isResolving && (
                        <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Live Visual Preview & ISO Badge */}
                  {langName.trim() && (
                    <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                          <Eye className="w-3 h-3 text-sky-500" /> Live UI Badge Preview
                        </div>
                        {editingLangId && (
                          <button
                            type="button"
                            onClick={() => handleTriggerAutoResolve("languages")}
                            className="text-[11px] text-sky-500 hover:underline flex items-center gap-1 font-medium"
                          >
                            <RotateCcw className="w-3 h-3" /> Re-resolve
                          </button>
                        )}
                      </div>
                      <div className="pt-0.5 flex items-center gap-2">
                        <TaxonomyBadge
                          type="language"
                          name={langName.trim()}
                          color={langColor}
                          icon={langIcon}
                          size="md"
                        />
                        {langCode && (
                          <span className="text-[10px] font-mono bg-sky-500/10 text-sky-500 border border-sky-500/20 px-2 py-0.5 rounded font-bold uppercase">
                            ISO: {langCode}
                          </span>
                        )}
                      </div>
                      {!isResolving && (
                        <div className="pt-1 text-[11px] text-muted-foreground flex flex-wrap gap-2 border-t border-border/60">
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Icon: {langIcon}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Slug: {langSlug}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duplicate Warning */}
                  {dupWarning && !editingLangId && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{dupWarning}</span>
                    </div>
                  )}

                  {/* Advanced Settings Collapsible */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full py-1 font-semibold"
                    >
                      <span>Advanced Settings (Optional)</span>
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showAdvanced && (
                      <div className="space-y-3 pt-2 border-t border-border mt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Slug</label>
                            <input
                              type="text"
                              placeholder="e.g. french"
                              value={langSlug}
                              onChange={(e) => setLangSlug(e.target.value)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">ISO Code</label>
                            <input
                              type="text"
                              placeholder="e.g. fr"
                              value={langCode}
                              onChange={(e) => setLangCode(e.target.value)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs uppercase font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Icon Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Globe, Languages"
                            value={langIcon}
                            onChange={(e) => setLangIcon(e.target.value)}
                            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Theme Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={langColor || "#f97316"}
                              onChange={(e) => setLangColor(e.target.value)}
                              className="h-8 w-8 rounded border border-border cursor-pointer bg-background p-0.5 shrink-0"
                            />
                            <input
                              type="text"
                              value={langColor}
                              onChange={(e) => setLangColor(e.target.value)}
                              placeholder="#F97316"
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-mono uppercase"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Display Order</label>
                            <input
                              type="number"
                              min="1"
                              value={langOrder}
                              onChange={(e) => setLangOrder(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                            <select
                              value={langStatus}
                              onChange={(e) => setLangStatus(e.target.value as "active" | "disabled")}
                              className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs"
                            >
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isResolving || (!!dupWarning && !editingLangId)}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {editingLangId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingLangId ? "Update Language" : "Save Language"}
                  </button>
                </form>
              )}
            </div>

            {/* Right: Catalog Table / Cards Module */}
            <div className="lg:col-span-8 space-y-4">
              {tab === "categories" && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
                    <span className="font-semibold text-sm">Category Catalog ({filteredCategories.length})</span>
                    <span className="text-xs text-muted-foreground">Disabled items are hidden from submission forms and public filters.</span>
                  </div>

                  {filteredCategories.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No categories found matching your search.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredCategories.map((c) => {
                        const isDisabled = c.status === "disabled" || c.enabled === false;
                        const visual = getTaxonomyVisual("category", c.name, c.color || c.themeColor, c.icon);
                        return (
                          <div key={c.id} className={`p-4 flex items-center justify-between gap-4 transition-colors ${isDisabled ? "bg-muted/20 opacity-75" : "hover:bg-muted/30"}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <TaxonomyBadge type="category" name={c.name} color={c.color || c.themeColor} icon={c.icon} size="lg" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                    {c.slug || slugify(c.name)}
                                  </span>
                                  {isDisabled ? (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Disabled
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span>Order: #{c.displayOrder ?? 1}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[11px] text-foreground/80">Icon: {c.icon || visual.iconName}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => toggleCategoryStatus(c)}
                                title={isDisabled ? "Enable Category" : "Disable Category"}
                                className={`p-2 rounded-lg border transition-colors ${
                                  isDisabled
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEditCategory(c)}
                                title="Edit Category"
                                className="p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-foreground"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal("category", c)}
                                title="Delete Category"
                                className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "platforms" && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
                    <span className="font-semibold text-sm">Platform Catalog ({filteredPlatforms.length})</span>
                    <span className="text-xs text-muted-foreground font-mono">Dynamic Brand Logos & Regex URL Validation</span>
                  </div>

                  {filteredPlatforms.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No platforms found matching your search.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredPlatforms.map((p) => {
                        const isDisabled = p.status === "disabled" || p.enabled === false;
                        return (
                          <div key={p.id} className={`p-4 flex items-center justify-between gap-4 transition-colors ${isDisabled ? "bg-muted/20 opacity-75" : "hover:bg-muted/30"}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <TaxonomyBadge type="platform" name={p.name} color={p.color || p.themeColor} icon={p.icon} size="lg" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                    {p.slug || slugify(p.name)}
                                  </span>
                                  {isDisabled ? (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Disabled
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                                  <span>Order: #{p.displayOrder ?? p.order ?? 1}</span>
                                  {p.invitePattern && (
                                    <span className="font-mono text-[11px] text-primary/80 truncate">Regex: {p.invitePattern}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => togglePlatformStatus(p)}
                                title={isDisabled ? "Enable Platform" : "Disable Platform"}
                                className={`p-2 rounded-lg border transition-colors ${
                                  isDisabled
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEditPlatform(p)}
                                title="Edit Platform"
                                className="p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-foreground"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal("platform", p)}
                                title="Delete Platform"
                                className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "contentTypes" && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
                    <span className="font-semibold text-sm">Content Types ({filteredContentTypes.length})</span>
                  </div>

                  {filteredContentTypes.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No content types found matching your search.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredContentTypes.map((ct) => {
                        const isDisabled = ct.status === "disabled" || ct.enabled === false;
                        const linkedCat = categories.find((c) => c.id === ct.categoryId);
                        return (
                          <div key={ct.id} className={`p-4 flex items-center justify-between gap-4 transition-colors ${isDisabled ? "bg-muted/20 opacity-75" : "hover:bg-muted/30"}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <TaxonomyBadge type="contentType" name={ct.name} color={ct.color || ct.themeColor} icon={ct.icon} size="lg" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                    {ct.slug || slugify(ct.name)}
                                  </span>
                                  {isDisabled ? (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Disabled
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span>Order: #{ct.displayOrder ?? ct.order ?? 1}</span>
                                  {linkedCat && (
                                    <>
                                      <span>•</span>
                                      <span className="text-primary font-medium">Linked Category: {linkedCat.name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => toggleContentTypeStatus(ct)}
                                title={isDisabled ? "Enable Content Type" : "Disable Content Type"}
                                className={`p-2 rounded-lg border transition-colors ${
                                  isDisabled
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEditContentType(ct)}
                                title="Edit Content Type"
                                className="p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-foreground"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal("contentType", ct)}
                                title="Delete Content Type"
                                className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "languages" && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
                    <span className="font-semibold text-sm">Languages ({filteredLanguages.length})</span>
                  </div>

                  {filteredLanguages.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No languages found matching your search.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredLanguages.map((l) => {
                        const isDisabled = l.status === "disabled" || l.enabled === false;
                        return (
                          <div key={l.id} className={`p-4 flex items-center justify-between gap-4 transition-colors ${isDisabled ? "bg-muted/20 opacity-75" : "hover:bg-muted/30"}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <TaxonomyBadge type="language" name={l.name} color={l.color || l.themeColor} icon={l.icon} size="lg" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  {l.code && (
                                    <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                      {l.code}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                                    {l.slug || slugify(l.name)}
                                  </span>
                                  {isDisabled ? (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Disabled
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">Order: #{l.displayOrder ?? l.order ?? 1}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => toggleLanguageStatus(l)}
                                title={isDisabled ? "Enable Language" : "Disable Language"}
                                className={`p-2 rounded-lg border transition-colors ${
                                  isDisabled
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => startEditLanguage(l)}
                                title="Edit Language"
                                className="p-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-foreground"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal("language", l)}
                                title="Delete Language"
                                className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─── SAFE DELETE MODAL ─── */}
      {deleteModalOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Delete {deleteTarget.type}?</h3>
                  <p className="text-xs text-muted-foreground font-mono">ID: {deleteTarget.id}</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {deleteUsageCount > 0 ? (
              <div className="space-y-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-200">
                <div className="font-semibold text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Warning: In Use by {deleteUsageCount} Community/Communities
                </div>
                <p>
                  Deleting <strong className="text-foreground">{deleteTarget.name}</strong> will leave existing communities without a taxonomy association.
                </p>
                {sampleGroups.length > 0 && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Sample Communities:</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-foreground/80">
                      {sampleGroups.map((g) => (
                        <li key={g.id} className="truncate">
                          {g.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-amber-500/20 space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Reassign all {deleteUsageCount} communities to:
                  </label>
                  <select
                    value={reassignTargetId}
                    onChange={(e) => {
                      setReassignTargetId(e.target.value);
                      const selected =
                        deleteTarget.type === "category"
                          ? categories.find((c) => c.id === e.target.value)?.name
                          : deleteTarget.type === "platform"
                          ? platforms.find((p) => p.id === e.target.value)?.name
                          : deleteTarget.type === "contentType"
                          ? contentTypes.find((ct) => ct.id === e.target.value)?.name
                          : languages.find((l) => l.id === e.target.value)?.name;
                      if (selected) setReassignTargetName(selected);
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select replacement...</option>
                    {deleteTarget.type === "category" &&
                      categories
                        .filter((c) => c.id !== deleteTarget.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    {deleteTarget.type === "platform" &&
                      platforms
                        .filter((p) => p.id !== deleteTarget.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    {deleteTarget.type === "contentType" &&
                      contentTypes
                        .filter((ct) => ct.id !== deleteTarget.id)
                        .map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.name}
                          </option>
                        ))}
                    {deleteTarget.type === "language" &&
                      languages
                        .filter((l) => l.id !== deleteTarget.id)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This item is currently not used by any community. Safe to delete immediately.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-border bg-background rounded-lg text-xs font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteOrReassign}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {deleteUsageCount > 0 ? "Reassign & Delete" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
