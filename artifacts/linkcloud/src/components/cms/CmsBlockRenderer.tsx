import { Link } from "wouter";
import {
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Info,
  Mail,
  Scale,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import type { CmsSectionBlock } from "@/lib/types";
import { isSafeCmsUrl } from "@/lib/cms-schema";

interface CmsBlockRendererProps {
  blocks: CmsSectionBlock[];
  compact?: boolean;
}

/**
 * Pure React JSX block renderer for LinkCloud CMS content.
 * Strictly prohibits dangerouslySetInnerHTML / innerHTML and re-validates
 * every link href with isSafeCmsUrl before rendering anchor tags.
 */
export default function CmsBlockRenderer({
  blocks,
  compact = false,
}: CmsBlockRendererProps) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {blocks.map((block, index) => {
        const key = block.id || `cms_block_${index}`;

        if (block.type === "heading") {
          const text = block.text || block.heading || "";
          if (block.level === 3) {
            return (
              <h3
                key={key}
                className="text-base sm:text-lg font-bold text-foreground pt-2"
              >
                {text}
              </h3>
            );
          }
          return (
            <h2
              key={key}
              className="text-lg sm:text-xl font-extrabold text-foreground pt-2 border-b border-border/50 pb-2"
            >
              {text}
            </h2>
          );
        }

        if (block.type === "paragraph") {
          return (
            <section key={key} className="space-y-2">
              {block.heading && (
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {block.heading}
                </h2>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {block.text}
              </p>
            </section>
          );
        }

        if (block.type === "bullet_list") {
          const items = Array.isArray(block.items) ? block.items : [];
          return (
            <section key={key} className="space-y-2">
              {block.heading && (
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {block.heading}
                </h2>
              )}
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {items.map((item, i) => (
                  <li key={`${key}_li_${i}`}>{item}</li>
                ))}
              </ul>
            </section>
          );
        }

        if (block.type === "numbered_list") {
          const items = Array.isArray(block.items) ? block.items : [];
          return (
            <section key={key} className="space-y-2">
              {block.heading && (
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {block.heading}
                </h2>
              )}
              <ol className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {items.map((item, i) => (
                  <li key={`${key}_ol_${i}`}>{item}</li>
                ))}
              </ol>
            </section>
          );
        }

        if (block.type === "notice") {
          const tone = block.tone || "info";
          const toneStyles: Record<string, string> = {
            info: "bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300",
            warning:
              "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
            important:
              "bg-primary/10 border-primary/25 text-primary dark:text-primary",
            legal:
              "bg-destructive/10 border-destructive/25 text-destructive dark:text-red-300",
          };
          const ToneIcon =
            tone === "warning"
              ? AlertTriangle
              : tone === "legal"
              ? Scale
              : tone === "important"
              ? AlertCircle
              : Info;

          return (
            <div
              key={key}
              className={`rounded-2xl border p-4 sm:p-5 space-y-1.5 ${
                toneStyles[tone] || toneStyles.info
              }`}
            >
              {block.heading && (
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ToneIcon className="w-4 h-4 shrink-0" />
                  <span>{block.heading}</span>
                </h3>
              )}
              <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                {block.text}
              </p>
            </div>
          );
        }

        if (block.type === "link") {
          const url = typeof block.url === "string" ? block.url.trim() : "";
          const safe = isSafeCmsUrl(url, true);
          const isInternal = safe && url.startsWith("/");
          return (
            <section
              key={key}
              className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 space-y-2.5"
            >
              {block.heading && (
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  {block.heading}
                </h3>
              )}
              {block.text && (
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {block.text}
                </p>
              )}
              {safe &&
                (isInternal ? (
                  <Link
                    href={url}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition"
                  >
                    <span>{block.label || "Open Link"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition"
                  >
                    <span>{block.label || "Open Link"}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ))}
            </section>
          );
        }

        if (block.type === "faq_item") {
          return (
            <div
              key={key}
              className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 space-y-2"
            >
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{block.question}</span>
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6 whitespace-pre-line">
                {block.answer}
              </p>
            </div>
          );
        }

        if (block.type === "steps") {
          const steps = Array.isArray(block.steps) ? block.steps : [];
          return (
            <section key={key} className="space-y-3">
              {block.heading && (
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  {block.heading}
                </h2>
              )}
              <div className="space-y-3">
                {steps.map((step, sIdx) => (
                  <div
                    key={`${key}_step_${sIdx}`}
                    className="flex items-start gap-3.5 rounded-2xl border border-border/80 bg-muted/20 p-4"
                  >
                    <span className="w-7 h-7 rounded-xl bg-primary/15 text-primary font-extrabold text-xs flex items-center justify-center shrink-0">
                      {sIdx + 1}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-foreground">
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (block.type === "contact_info") {
          return (
            <section
              key={key}
              className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 space-y-2"
            >
              {block.heading && (
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>{block.heading}</span>
                </h3>
              )}
              {block.contactEmail && (
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  Email:{" "}
                  <a
                    href={`mailto:${block.contactEmail}`}
                    className="text-primary hover:underline font-mono"
                  >
                    {block.contactEmail}
                  </a>
                </p>
              )}
              {block.contactNote && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {block.contactNote}
                </p>
              )}
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
