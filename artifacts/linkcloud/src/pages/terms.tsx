import { useState, useEffect } from "react";
import { getSiteSettings, getStaticPages } from "@/lib/firestore";
import { usePageSEO } from "@/lib/page-meta";

export default function TermsPage() {
  const [customContent, setCustomContent] = useState<string | null>(null);

  usePageSEO({
    title: "Terms and Conditions",
    subtitle: "User Agreement & Rules",
    description: "Review the LinkCloud terms of service, platform rules, and community listing policies.",
    canonicalPath: "/terms",
  });

  useEffect(() => {
    Promise.all([getSiteSettings(), getStaticPages()])
      .then(([settings, pages]) => {
        if (settings?.termsContent && settings.termsContent.trim().length > 0) {
          setCustomContent(settings.termsContent);
        } else if (pages?.terms) {
          setCustomContent(pages.terms);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Legal Agreement
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Terms & Conditions</h1>
        <p className="text-xs text-muted-foreground">Effective Date: July 2026</p>
      </div>

      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {customContent ? (
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">{customContent}</div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
              <p>
                By accessing or using LinkCloud, you agree to be bound by these Terms and Conditions. If you do not agree to all terms, you may not use the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">2. Visitor and User Conduct</h2>
              <p>
                LinkCloud is a public index of community invite links. Users and visitors agree NOT to:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Submit fake, misleading, adult, pornographic, or unlawful community links.</li>
                <li>Promote gambling, scams, phishing schemes, or copyright-infringing content.</li>
                <li>Attempt to scrape, spam, or disrupt site services or servers.</li>
                <li>Impersonate any individual, organization, or brand.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">3. Community Listings & Moderation</h2>
              <p>
                LinkCloud reserves the absolute right to approve, reject, flag, or remove any community listing without prior notice if it violates our policies or receives reports from users.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">4. External Links Disclaimer</h2>
              <p>
                LinkCloud provides external invite links to third-party platforms (WhatsApp, Telegram, Discord, etc.). LinkCloud does not own or operate these external groups and accepts no liability for third-party group content, member actions, or privacy practices.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">5. Termination and Suspensions</h2>
              <p>
                Accounts found violating safety policies, submitting spam, or abusing the platform will be permanently suspended or deleted.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
