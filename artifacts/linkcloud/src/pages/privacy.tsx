import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { getStaticPages } from "@/lib/firestore";
import { usePageSEO } from "@/lib/page-meta";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export default function PrivacyPage() {
  const { settings } = useSiteSettings();
  const [customContent, setCustomContent] = useState<string | null>(null);

  usePageSEO({
    title: "Privacy Policy",
    subtitle: "Data Protection & Privacy Notice",
    description: "Learn how LinkCloud protects your personal privacy and manages user data.",
    canonicalPath: "/privacy",
  });

  useEffect(() => {
    if (settings?.privacyPolicyContent && settings.privacyPolicyContent.trim().length > 0) {
      setCustomContent(settings.privacyPolicyContent);
    } else {
      getStaticPages()
        .then((pages) => {
          if (pages?.privacy) {
            setCustomContent(pages.privacy);
          }
        })
        .catch(console.error);
    }
  }, [settings?.privacyPolicyContent]);

  const supportEmail = settings?.supportEmail || settings?.contactEmail || "linkcloud111@gmail.com";
  const siteName = settings?.siteName || "LinkCloud";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Legal & Trust
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: {new Date().getFullYear()}</p>
      </div>

      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {customContent ? (
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">{customContent}</div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">1. Introduction</h2>
              <p>
                Welcome to {siteName} ("we", "our", or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, store, and safeguard your information when you visit our website or use our services.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">2. Information We Collect</h2>
              <p>
                We collect information you provide directly to us when creating an account, submitting a public community link, submitting a grievance, or contacting the webmaster. This may include your display name, email address, mobile number, and community link metadata.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">3. How We Use Information</h2>
              <p>
                We use collected information solely to maintain, secure, and operate the {siteName} public community directory, prevent malicious spam submissions, verify community legitimacy, and enforce our Terms of Service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">4. Storage & Security</h2>
              <p>
                All user data and community listings are securely stored in Google Cloud Firestore infrastructure with strict security rules. We enforce authentication controls and data encryption in transit and at rest.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">5. Account Deletion & Data Rights</h2>
              <p>
                You have the right to access, update, or request the deletion of your account and associated listings at any time. You can submit an official account deletion request directly from your User Dashboard settings or via our Complaint Desk.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">6. Contact Us</h2>
              <p>
                If you have any questions regarding this Privacy Policy, please contact our Compliance Officer at <strong>{supportEmail}</strong> or via our Contact Webmaster page.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
