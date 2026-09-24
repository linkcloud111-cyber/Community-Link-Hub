import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { getSiteSettings, getStaticPages } from "@/lib/firestore";
import { usePageSEO } from "@/lib/page-meta";

export default function DisclaimerPage() {
  const [customContent, setCustomContent] = useState<string | null>(null);

  usePageSEO({
    title: "Legal Disclaimer",
    subtitle: "Public Platform & External Links Notice",
    description: "Read the official legal disclaimer and third-party platform notice for LinkCloud.",
    canonicalPath: "/disclaimer",
  });

  useEffect(() => {
    Promise.all([getSiteSettings(), getStaticPages()])
      .then(([settings, pages]) => {
        if (settings?.disclaimerContent && settings.disclaimerContent.trim().length > 0) {
          setCustomContent(settings.disclaimerContent);
        } else if (pages?.disclaimer && pages.disclaimer.trim().length > 0) {
          setCustomContent(pages.disclaimer);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold uppercase tracking-wider">
          <AlertCircle className="w-3.5 h-3.5" /> Legal Notice
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Legal Disclaimer</h1>
        <p className="text-xs text-muted-foreground">Effective Date: July 2026</p>
      </div>

      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {customContent ? (
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">{customContent}</div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">1. Nature of Directory Service</h2>
              <p>
                LinkCloud operates solely as a public indexing directory and user-curated discovery portal for social messaging groups, public forums, and channels across India. LinkCloud does not host, manage, monitor, or own the third-party groups, chat rooms, or communication channels listed on this directory.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">2. Third-Party Platform Affiliation</h2>
              <p>
                LinkCloud is an independent, non-affiliated platform. We are not endorsed, sponsored, affiliated, or officially connected with WhatsApp LLC, Meta Platforms Inc., Telegram FZ-LLC, Discord Inc., Google LLC, or any other respective messaging service or corporation. All trademarks, brand names, and logos belong to their respective registered owners.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">3. User Responsibility & Content Warning</h2>
              <p>
                External invite links redirect users to third-party group chats operated by independent group administrators. Users join these external groups at their own sole discretion and risk. LinkCloud cannot verify or control the real-time messages, media, files, or interactions occurring inside third-party groups. We strongly caution users never to share sensitive financial details, passwords, OTPs, or personally identifiable information within public groups.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">4. Reporting & Content Removal</h2>
              <p>
                We maintain a zero-tolerance policy towards child sexual abuse material (CSAM), non-consensual imagery, terrorist propaganda, gambling promotions, financial fraud, and copyright infringement. If you encounter any group violating our guidelines or Indian statutory regulations, please report it immediately using our "Report Group" tool or contact our Grievance Officer via the Complaint page.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">5. Limitation of Liability</h2>
              <p>
                Under no circumstances shall LinkCloud, its operators, or affiliates be liable for any direct, indirect, incidental, consequential, or punitive damages arising from the use of, or inability to use, our indexing service or any external links discovered through our platform.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
