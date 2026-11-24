import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AlertTriangle, Send } from "lucide-react";
import { getSiteSettings, getStaticPages } from "@/lib/firestore";
import { usePageSEO } from "@/lib/page-meta";

export default function DMCAPage() {
  const [customContent, setCustomContent] = useState<string | null>(null);

  usePageSEO({
    title: "DMCA Copyright Policy",
    subtitle: "Notice and Takedown Procedure",
    description: "Submit a copyright infringement notice or DMCA takedown request to LinkCloud.",
    canonicalPath: "/dmca",
  });

  useEffect(() => {
    Promise.all([getSiteSettings(), getStaticPages()])
      .then(([settings, pages]) => {
        if (settings?.dmcaContent && settings.dmcaContent.trim().length > 0) {
          setCustomContent(settings.dmcaContent);
        } else if (pages?.dmca) {
          setCustomContent(pages.dmca);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-wider">
          Copyright Compliance
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">DMCA & Copyright Takedown Policy</h1>
        <p className="text-xs text-muted-foreground">Digital Millennium Copyright Act Notice</p>
      </div>

      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {customContent ? (
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">{customContent}</div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Copyright Policy</h2>
              <p>
                LinkCloud respects the intellectual property rights of creators and copyright owners. We comply with the Digital Millennium Copyright Act (DMCA) and Indian copyright legislation.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Notice of Copyright Infringement</h2>
              <p>
                If you believe that a community listed on LinkCloud infringes upon your copyrighted material, trademark, or intellectual property rights, you may submit a formal Takedown Request.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">Required Notice Elements</h2>
              <p>Your takedown notice must include the following information:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Identification of the copyrighted work claimed to have been infringed.</li>
                <li>The exact URL or LinkCloud listing ID of the infringing material.</li>
                <li>Your contact details: Name, Organization, Address, Telephone, and Email.</li>
                <li>A statement that you have a good faith belief that use of the material is unauthorized.</li>
                <li>A statement under penalty of perjury that the information in the notice is accurate.</li>
              </ul>
            </section>
          </>
        )}

        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Submit DMCA Takedown Request
          </h3>
          <p className="text-xs text-muted-foreground">
            You can file a DMCA notice directly online through our official Complaint portal or email our designated agent.
          </p>
          <div className="pt-1">
            <Link
              href="/complaint"
              className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground font-semibold text-xs rounded-xl hover:bg-destructive/90 transition"
            >
              <Send className="w-3.5 h-3.5" /> Submit DMCA Complaint
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
