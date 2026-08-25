import { useState, useEffect } from "react";
import { Shield } from "lucide-react";
import { getStaticPages } from "@/lib/firestore";

export default function PrivacyPage() {
  const [customContent, setCustomContent] = useState<string | null>(null);

  useEffect(() => {
    getStaticPages().then((pages) => {
      if (pages?.privacy) {
        setCustomContent(pages.privacy);
      }
    }).catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Legal & Trust
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground">Last updated: July 2026</p>
      </div>

      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {customContent ? (
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">{customContent}</div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">1. Introduction</h2>
              <p>
                Welcome to LinkCloud ("we", "our", or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, store, and safeguard your information when you visit our website or use our services.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">2. Information We Collect</h2>
              <p>
                <strong>Visitor Data:</strong> Visitors can freely browse our public community directory without providing any personal data.
              </p>
              <p>
                <strong>Registered User Data:</strong> When you register an account, we collect your Full Name, Date of Birth, Email Address, Mobile Number, State, District, and City.
              </p>
              <p>
                <strong>Submitted Content:</strong> When you list a community group, we collect the Group Name, Platform, Category, Description, Rules, Tags, Location, and Invite Link.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">3. How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To operate, maintain, and provide the features of the LinkCloud index.</li>
                <li>To verify community submissions and prevent spam, fraud, and illegal content.</li>
                <li>To communicate with you regarding your account, group approvals, or support inquiries.</li>
                <li>To comply with statutory legal obligations and law enforcement requests.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">4. Data Storage and Security</h2>
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
                If you have any questions regarding this Privacy Policy, please contact our Compliance Officer at <strong>support@linkcloud.app</strong> or via our Contact Webmaster page.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
