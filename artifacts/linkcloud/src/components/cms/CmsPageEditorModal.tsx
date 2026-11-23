import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  FileText,
  Globe,
  History,
  Loader2,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AuthorableCmsBlockType,
  CmsPageAdminOverview,
  CmsPageDocument,
  CmsSectionBlock,
  CmsVersionRecord,
} from "@/lib/types";
import {
  ALLOWED_BLOCK_TYPES,
  buildDefaultCmsSeedTemplate,
  CMS_PAGE_LABELS,
  detectUnverifiedClaims,
  generateBlockId,
  validateAndNormalizeCmsPageInput,
} from "@/lib/cms-schema";
import {
  adminDeleteCmsPage,
  adminFetchCmsVersions,
  adminPublishCmsPage,
  adminRestoreCmsVersion,
  adminSaveCmsDraft,
  adminUnpublishCmsPage,
} from "@/lib/cms-client";
import CmsBlockRenderer from "./CmsBlockRenderer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CmsPageEditorModalProps {
  open: boolean;
  overview: CmsPageAdminOverview | null;
  user: User | null;
  supportEmail?: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

type EditorSubTab = "content" | "seo" | "preview" | "history";

const BLOCK_TYPE_LABELS: Record<AuthorableCmsBlockType, string> = {
  heading: "Section Heading",
  paragraph: "Paragraph Section",
  bullet_list: "Bulleted List",
  numbered_list: "Numbered List",
  link: "Action Link",
  notice: "Important Notice",
  steps: "Step-by-Step Guide",
  contact_info: "Contact Info",
};

function createEmptyBlock(type: AuthorableCmsBlockType): CmsSectionBlock {
  const id = generateBlockId();
  switch (type) {
    case "heading":
      return { id, type, level: 2, text: "New Section Heading" };
    case "paragraph":
      return { id, type, heading: "Section Title", text: "Write clear, verified details here." };
    case "bullet_list":
      return { id, type, heading: "Key Points", items: ["First point", "Second point"] };
    case "numbered_list":
      return { id, type, heading: "Ordered List", items: ["Step one", "Step two"] };
    case "link":
      return {
        id,
        type,
        heading: "Related Resource",
        text: "Navigate to the linked portal below.",
        label: "Open Page",
        url: "/contact",
      };
    case "notice":
      return {
        id,
        type,
        heading: "Important Notice",
        tone: "info",
        text: "Provide clear guidance or notice text here.",
      };
    case "steps":
      return {
        id,
        type,
        heading: "Step-by-Step Guide",
        steps: [{ title: "Step 1", description: "Describe what the visitor should do." }],
      };
    case "contact_info":
      return {
        id,
        type,
        heading: "Verified Contact",
        contactEmail: "support@linkcloud.in",
        contactNote: "Use this contact for official directory inquiries.",
      };
  }
}

export default function CmsPageEditorModal({
  open,
  overview,
  user,
  supportEmail = "support@linkcloud.in",
  onClose,
  onChanged,
}: CmsPageEditorModalProps) {
  const [subTab, setSubTab] = useState<EditorSubTab>("content");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [form, setForm] = useState<CmsPageDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState<CmsVersionRecord[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [compareVersion, setCompareVersion] = useState<CmsVersionRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { type: "publish" }
    | { type: "unpublish" }
    | { type: "delete"; isPublished: boolean }
    | { type: "restore"; version: CmsVersionRecord }
    | null
  >(null);

  useEffect(() => {
    if (!open || !overview) return;
    setSubTab("content");
    setCompareVersion(null);
    const initial =
      overview.draft ||
      overview.published ||
      buildDefaultCmsSeedTemplate(overview.slug, supportEmail);
    setForm(JSON.parse(JSON.stringify(initial)));

    setLoadingVersions(true);
    adminFetchCmsVersions(user, overview.slug)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoadingVersions(false));
  }, [open, overview, supportEmail, user]);

  if (!open || !overview || !form) return null;

  const liveValidation = validateAndNormalizeCmsPageInput(form, {
    requireSubstantiveBlocks: false,
  });
  const claimWarnings = detectUnverifiedClaims(form);

  const reloadVersions = async () => {
    setLoadingVersions(true);
    try {
      const v = await adminFetchCmsVersions(user, overview.slug);
      setVersions(v);
    } catch {
      // ignore non-fatal list error
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSaveDraft = async () => {
    const check = validateAndNormalizeCmsPageInput(form, { requireSubstantiveBlocks: false });
    if (!check.valid) {
      toast.error(check.error || "Please fix validation errors before saving draft.");
      return;
    }
    setSaving(true);
    try {
      const res = await adminSaveCmsDraft(user, form);
      if (res?.draft) {
        setForm(res.draft);
      }
      toast.success(res?.message || "Draft saved");
      await reloadVersions();
      await onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save CMS draft");
    } finally {
      setSaving(false);
    }
  };

  const executePublish = async () => {
    const check = validateAndNormalizeCmsPageInput(form, { requireSubstantiveBlocks: true });
    if (!check.valid) {
      toast.error(check.error || "Content incomplete: add substantive sections before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const res = await adminPublishCmsPage(user, form);
      if (res?.page) {
        setForm(res.page);
      }
      toast.success(res?.message || "Published live");
      await reloadVersions();
      await onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish CMS page");
    } finally {
      setPublishing(false);
      setConfirmAction(null);
    }
  };

  const executeUnpublish = async () => {
    setPublishing(true);
    try {
      const res = await adminUnpublishCmsPage(user, overview.slug);
      if (res?.draft) {
        setForm(res.draft);
      }
      toast.success(res?.message || "Page unpublished (moved to draft)");
      await reloadVersions();
      await onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Failed to unpublish page");
    } finally {
      setPublishing(false);
      setConfirmAction(null);
    }
  };

  const executeDelete = async (isPublished: boolean) => {
    setPublishing(true);
    try {
      const res = await adminDeleteCmsPage(user, overview.slug, isPublished);
      toast.success(res?.message || "CMS page deleted");
      setConfirmAction(null);
      await onChanged();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete CMS page");
    } finally {
      setPublishing(false);
    }
  };

  const executeRestore = async (ver: CmsVersionRecord) => {
    setSaving(true);
    try {
      const res = await adminRestoreCmsVersion(user, overview.slug, ver.versionId);
      if (res?.draft) {
        setForm(res.draft);
      }
      toast.success(res?.message || `Restored v${ver.version} into draft`);
      setSubTab("content");
      await reloadVersions();
      await onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore revision");
    } finally {
      setSaving(false);
      setConfirmAction(null);
    }
  };

  const updateBlock = (index: number, patch: Partial<CmsSectionBlock>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = [...prev.blocks];
      next[index] = { ...next[index], ...patch };
      return { ...prev, blocks: next };
    });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    setForm((prev) => {
      if (!prev) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.blocks.length) return prev;
      const next = [...prev.blocks];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, blocks: next };
    });
  };

  const removeBlock = (index: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, blocks: prev.blocks.filter((_, idx) => idx !== index) };
    });
  };

  const addBlock = (type: AuthorableCmsBlockType) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, blocks: [...prev.blocks, createEmptyBlock(type)] };
    });
  };

  const inputClass =
    "w-full p-2.5 bg-muted/30 border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary font-mono";

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-3xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border bg-muted/20">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg">
                CMS Editor: {CMS_PAGE_LABELS[overview.slug]}
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted border border-border">
                {overview.route}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                  overview.hasPublished
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                }`}
              >
                {overview.hasPublished ? "Published Live" : "Draft Only"}
              </span>
              {overview.isLegalPage && (
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30">
                  Legal Page — Owner Approval Required
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Revision v{form.version || 1} • Edits save to private draft first; public visitors only see published projections.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Close CMS Editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-card overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab("content")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === "content"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Content & Blocks ({form.blocks.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("seo")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === "seo"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> SEO & Indexing
          </button>
          <button
            type="button"
            onClick={() => setSubTab("preview")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === "preview"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Live Preview
          </button>
          <button
            type="button"
            onClick={() => setSubTab("history")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              subTab === "history"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Version History ({versions.length})
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!liveValidation.valid && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{liveValidation.error}</span>
            </div>
          )}
          {claimWarnings.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" /> Accuracy Review Notice
              </p>
              {claimWarnings.map((w, idx) => (
                <p key={idx}>• {w}</p>
              ))}
            </div>
          )}

          {subTab === "content" && (
            <div className="space-y-5">
              {/* Page Header Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 border border-border rounded-2xl p-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-bold text-muted-foreground">Page Title *</label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {form.title.length}/140
                    </span>
                  </div>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    maxLength={140}
                    className={inputClass}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-bold text-muted-foreground">Subtitle / Eyebrow</label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {(form.subtitle || "").length}/200
                    </span>
                  </div>
                  <input
                    value={form.subtitle || ""}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-bold text-muted-foreground">Page Summary Description *</label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {form.description.length}/400
                    </span>
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={400}
                    rows={2}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Structured Content Blocks */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Structured Content Sections
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {ALLOWED_BLOCK_TYPES.map((bType) => (
                      <button
                        key={bType}
                        type="button"
                        onClick={() => addBlock(bType)}
                        className="px-2.5 py-1 rounded-lg bg-muted hover:bg-primary/15 hover:text-primary text-[11px] font-semibold border border-border flex items-center gap-1 transition"
                      >
                        <Plus className="w-3 h-3" /> {BLOCK_TYPE_LABELS[bType]}
                      </button>
                    ))}
                  </div>
                </div>

                {form.blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="p-4 rounded-2xl bg-muted/15 border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <span className="text-[11px] font-extrabold uppercase text-primary">
                        #{idx + 1} •{" "}
                        {block.type === "faq_item"
                          ? "Retired Legacy FAQ Block (Read-Only)"
                          : BLOCK_TYPE_LABELS[block.type]}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveBlock(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(idx, 1)}
                          disabled={idx === form.blocks.length - 1}
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(idx)}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/15"
                          title="Delete Section"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {block.type === "heading" && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                            Level
                          </label>
                          <select
                            value={block.level === 3 ? 3 : 2}
                            onChange={(e) =>
                              updateBlock(idx, { level: Number(e.target.value) === 3 ? 3 : 2 })
                            }
                            className={inputClass}
                          >
                            <option value={2}>H2 Section Heading</option>
                            <option value={3}>H3 Subheading</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                            Heading Text
                          </label>
                          <input
                            value={block.text || ""}
                            onChange={(e) => updateBlock(idx, { text: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}

                    {block.type === "paragraph" && (
                      <div className="space-y-2">
                        <input
                          value={block.heading || ""}
                          onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                          placeholder="Optional section heading"
                          className={inputClass}
                        />
                        <textarea
                          value={block.text || ""}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                          rows={3}
                          placeholder="Paragraph text..."
                          className={inputClass}
                        />
                      </div>
                    )}

                    {(block.type === "bullet_list" || block.type === "numbered_list") && (
                      <div className="space-y-2">
                        <input
                          value={block.heading || ""}
                          onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                          placeholder="List heading (optional)"
                          className={inputClass}
                        />
                        <textarea
                          value={(block.items || []).join("\n")}
                          onChange={(e) =>
                            updateBlock(idx, {
                              items: e.target.value.split("\n"),
                            })
                          }
                          rows={4}
                          placeholder="One list item per line"
                          className={inputClass}
                        />
                        <span className="text-[10px] text-muted-foreground block">
                          Enter one list item per line.
                        </span>
                      </div>
                    )}

                    {block.type === "link" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          value={block.heading || ""}
                          onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                          placeholder="Card heading (optional)"
                          className={inputClass}
                        />
                        <input
                          value={block.label || ""}
                          onChange={(e) => updateBlock(idx, { label: e.target.value })}
                          placeholder="Button / link label *"
                          className={inputClass}
                        />
                        <input
                          value={block.url || ""}
                          onChange={(e) => updateBlock(idx, { url: e.target.value })}
                          placeholder="/contact or https://..."
                          className={inputClass}
                        />
                        <input
                          value={block.text || ""}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                          placeholder="Supporting text (optional)"
                          className={inputClass}
                        />
                      </div>
                    )}

                    {block.type === "notice" && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select
                            value={block.tone || "info"}
                            onChange={(e) => updateBlock(idx, { tone: e.target.value as any })}
                            className={inputClass}
                          >
                            <option value="info">Info Notice</option>
                            <option value="important">Important Callout</option>
                            <option value="warning">Warning Notice</option>
                            <option value="legal">Legal / Compliance Notice</option>
                          </select>
                          <div className="sm:col-span-2">
                            <input
                              value={block.heading || ""}
                              onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                              placeholder="Notice heading"
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <textarea
                          value={block.text || ""}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                          rows={2}
                          placeholder="Notice content..."
                          className={inputClass}
                        />
                      </div>
                    )}

                    {block.type === "faq_item" && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                        <p className="font-bold text-amber-600 dark:text-amber-400">
                          Retired FAQ Q&amp;A Block (Preserved Read-Only)
                        </p>
                        <p className="text-muted-foreground">
                          Actual FAQ questions and answers are managed exclusively in{" "}
                          <strong className="text-foreground">Webmaster → FAQ Management</strong>.
                          Move this Q&amp;A there and remove this legacy block before saving.
                        </p>
                        <p className="font-semibold text-foreground pt-1">Q: {block.question || "—"}</p>
                        <p className="text-muted-foreground whitespace-pre-line">A: {block.answer || "—"}</p>
                      </div>
                    )}

                    {block.type === "steps" && (
                      <div className="space-y-2">
                        <input
                          value={block.heading || ""}
                          onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                          placeholder="Steps section heading"
                          className={inputClass}
                        />
                        {(block.steps || []).map((st, sIdx) => (
                          <div
                            key={sIdx}
                            className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-start bg-background/60 p-2.5 rounded-xl border border-border/60"
                          >
                            <input
                              value={st.title}
                              onChange={(e) => {
                                const steps = [...(block.steps || [])];
                                steps[sIdx] = { ...st, title: e.target.value };
                                updateBlock(idx, { steps });
                              }}
                              placeholder={`Step ${sIdx + 1} title`}
                              className={`${inputClass} sm:col-span-2`}
                            />
                            <input
                              value={st.description}
                              onChange={(e) => {
                                const steps = [...(block.steps || [])];
                                steps[sIdx] = { ...st, description: e.target.value };
                                updateBlock(idx, { steps });
                              }}
                              placeholder="Step instructions..."
                              className={`${inputClass} sm:col-span-2`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const steps = (block.steps || []).filter((_, i) => i !== sIdx);
                                updateBlock(idx, { steps });
                              }}
                              className="px-2 py-2 rounded-xl bg-destructive/10 text-destructive text-[11px] font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            updateBlock(idx, {
                              steps: [
                                ...(block.steps || []),
                                {
                                  title: `Step ${(block.steps || []).length + 1}`,
                                  description: "Enter instructions",
                                },
                              ],
                            })
                          }
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Step
                        </button>
                      </div>
                    )}

                    {block.type === "contact_info" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          value={block.heading || ""}
                          onChange={(e) => updateBlock(idx, { heading: e.target.value })}
                          placeholder="Contact block heading"
                          className={inputClass}
                        />
                        <input
                          type="email"
                          value={block.contactEmail || ""}
                          onChange={(e) => updateBlock(idx, { contactEmail: e.target.value })}
                          placeholder="Verified contact email"
                          className={inputClass}
                        />
                        <input
                          value={block.contactNote || ""}
                          onChange={(e) => updateBlock(idx, { contactNote: e.target.value })}
                          placeholder="Contact note (only verified info)"
                          className={`${inputClass} sm:col-span-2`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === "seo" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 border border-border rounded-2xl p-5">
              <div className="md:col-span-2 p-3 rounded-xl bg-background/70 border border-border text-[11px] text-muted-foreground">
                <strong className="text-foreground">Per-Page SEO Override ({overview.route}):</strong> Values saved here apply specifically to this page and override Global Website SEO defaults. Leave Open Graph overrides blank to inherit from this page&apos;s title and description.
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-bold text-muted-foreground">SEO Title</label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {(form.seo.seoTitle || "").length}/160
                  </span>
                </div>
                <input
                  value={form.seo.seoTitle}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, seoTitle: e.target.value } })
                  }
                  maxLength={160}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Canonical URL or Path
                </label>
                <input
                  value={form.seo.canonicalUrl ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, canonicalUrl: e.target.value } })
                  }
                  placeholder={`${overview.route} or https://linkcloud.in${overview.route}`}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-bold text-muted-foreground">SEO Description</label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {(form.seo.seoDescription || "").length}/320
                  </span>
                </div>
                <textarea
                  value={form.seo.seoDescription}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, seoDescription: e.target.value } })
                  }
                  maxLength={320}
                  rows={2}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  SEO Keywords (comma separated)
                </label>
                <input
                  value={form.seo.seoKeywords || ""}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, seoKeywords: e.target.value } })
                  }
                  maxLength={400}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Open Graph Title Override
                </label>
                <input
                  value={form.seo.ogTitle || ""}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, ogTitle: e.target.value } })
                  }
                  placeholder="Optional social share title"
                  maxLength={160}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Open Graph Image URL
                </label>
                <input
                  value={form.seo.ogImage || ""}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, ogImage: e.target.value } })
                  }
                  placeholder="https://... or /og-banner.png"
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    Open Graph Description Override
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {(form.seo.ogDescription || "").length}/320
                  </span>
                </div>
                <textarea
                  value={form.seo.ogDescription || ""}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, ogDescription: e.target.value } })
                  }
                  placeholder="Optional social share description"
                  maxLength={320}
                  rows={2}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-between p-3 rounded-xl bg-background/60 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">Exclude from Search Indexing (noindex)</p>
                  <p className="text-[11px] text-muted-foreground">
                    When enabled, sets meta robots to noindex, nofollow when this page is rendered.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form.seo.noIndex)}
                  onChange={(e) =>
                    setForm({ ...form, seo: { ...form.seo, noIndex: e.target.checked } })
                  }
                  className="w-4 h-4 accent-primary"
                />
              </div>
            </div>
          )}

          {subTab === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Safe JSX Render Preview (Zero HTML Execution)
                </span>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium ${
                      previewDevice === "desktop" ? "bg-card shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium ${
                      previewDevice === "mobile" ? "bg-card shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile (375px)
                  </button>
                </div>
              </div>

              <div
                className={`mx-auto rounded-3xl border border-border bg-background p-6 sm:p-8 space-y-6 transition-all ${
                  previewDevice === "mobile" ? "max-w-[375px] shadow-xl" : "w-full"
                }`}
              >
                <div className="space-y-2 border-b border-border pb-4">
                  {form.subtitle && (
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                      {form.subtitle}
                    </span>
                  )}
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {form.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">{form.description}</p>
                </div>
                <CmsBlockRenderer blocks={form.blocks} />
              </div>
            </div>
          )}

          {subTab === "history" && (
            <div className="space-y-4">
              {loadingVersions ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : versions.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-2xl text-xs text-muted-foreground">
                  No saved revisions yet. Saving a draft or publishing creates immutable version snapshots.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {versions.map((ver) => (
                      <div
                        key={ver.versionId}
                        className={`p-3.5 rounded-2xl border space-y-2 ${
                          compareVersion?.versionId === ver.versionId
                            ? "border-primary bg-primary/5"
                            : "border-border bg-muted/15"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-extrabold">
                              v{ver.version}
                            </span>
                            <span className="text-xs font-bold uppercase text-foreground">
                              {ver.action.replace("_", " ")}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {new Date(ver.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Actor: {ver.actorEmail} {ver.note ? `• ${ver.note}` : ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCompareVersion(ver)}
                            className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-semibold"
                          >
                            Compare with Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: "restore", version: ver })}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore to Draft
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Version Comparison Panel */}
                  <div className="border border-border rounded-2xl p-4 bg-muted/10 space-y-3">
                    {compareVersion ? (
                      <>
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <h4 className="text-xs font-bold">
                            Comparing v{compareVersion.version} vs Current Editor Draft
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {compareVersion.snapshot.blocks?.length || 0} vs {form.blocks.length} blocks
                          </span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                              Snapshot Title (v{compareVersion.version})
                            </span>
                            <p className="font-semibold">{compareVersion.snapshot.title}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                              Snapshot Summary
                            </span>
                            <p className="text-muted-foreground">{compareVersion.snapshot.description}</p>
                          </div>
                          <div className="border-t border-border pt-2 max-h-52 overflow-y-auto">
                            <CmsBlockRenderer blocks={compareVersion.snapshot.blocks || []} compact />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-xs text-muted-foreground">
                        Select any revision on the left to inspect and compare its snapshot before restoring.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            {(overview.hasDraft || overview.hasPublished) && (
              <button
                type="button"
                disabled={publishing || saving}
                onClick={() =>
                  setConfirmAction({ type: "delete", isPublished: overview.hasPublished })
                }
                className="px-3.5 py-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete CMS Page
              </button>
            )}
            {overview.hasPublished && (
              <button
                type="button"
                disabled={publishing || saving}
                onClick={() => setConfirmAction({ type: "unpublish" })}
                className="px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold"
              >
                Unpublish (Move to Draft)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || publishing}
              onClick={handleSaveDraft}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold flex items-center gap-1.5 border border-border"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button
              type="button"
              disabled={publishing || saving}
              onClick={() => setConfirmAction({ type: "publish" })}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              {publishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {overview.isLegalPage ? "Review & Publish Legal Page" : "Publish Live"}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmAction?.type === "publish"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          overview.isLegalPage
            ? `Publish Legal Page (${overview.route})?`
            : `Publish CMS Page (${overview.route})?`
        }
        description={
          overview.isLegalPage
            ? "Legal pages must only be published after explicit Website Owner review and verification that all claims, contacts, and terms are accurate. Confirm publishing live?"
            : `This will publish your current sections and SEO settings live to public visitors at ${overview.route}.`
        }
        confirmText="Publish Live"
        onConfirm={executePublish}
      />

      <ConfirmDialog
        open={confirmAction?.type === "unpublish"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={`Unpublish ${overview.route}?`}
        description="This removes the public projection immediately so public visitors no longer see it, while keeping your draft and version history intact."
        confirmText="Unpublish"
        variant="destructive"
        onConfirm={executeUnpublish}
      />

      <ConfirmDialog
        open={confirmAction?.type === "delete"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction?.type === "delete" && confirmAction.isPublished
            ? `Confirm Deletion of LIVE Page (${overview.route})`
            : `Delete Draft for ${overview.route}?`
        }
        description={
          confirmAction?.type === "delete" && confirmAction.isPublished
            ? "WARNING: This page is currently PUBLISHED live to public visitors! Deleting will archive a recoverable snapshot in version history and remove both draft and live projections."
            : "This deletes the current draft while preserving a recoverable archive snapshot in revision history."
        }
        confirmText="Confirm Delete"
        variant="destructive"
        onConfirm={() => {
          if (confirmAction?.type === "delete") {
            void executeDelete(confirmAction.isPublished);
          }
        }}
      />

      <ConfirmDialog
        open={confirmAction?.type === "restore"}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={
          confirmAction?.type === "restore"
            ? `Restore Revision v${confirmAction.version.version} into Draft?`
            : "Restore Version"
        }
        description="Restoring loads this historical snapshot into your working draft and creates a new revision entry without erasing any previous history."
        confirmText="Restore to Draft"
        onConfirm={() => {
          if (confirmAction?.type === "restore") {
            void executeRestore(confirmAction.version);
          }
        }}
      />
    </div>
  );
}
