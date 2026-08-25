import { useState, useEffect } from "react";
import { HelpCircle, Search, ShieldCheck, PlusCircle, AlertCircle, MessageSquare, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { getHelpArticles } from "@/lib/firestore";
import type { HelpArticle } from "@/lib/types";

export default function HelpPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);

  useEffect(() => {
    getHelpArticles().then(setArticles).catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          Help Center
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">How Can We Help You?</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Guides, instructions, and assistance for discovering communities, submitting listings, and reporting issues on LinkCloud.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold">Joining Communities</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Click on any community card to view details. Tap "Join Community" to open the official invite link. If a link is inactive or broken, use the "Report Group" option.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <PlusCircle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold">Submitting Your Community</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Log in to your account, click "Submit Community", fill in the platform, location, category, description, and invite URL. The Webmaster reviews submissions within 24 hours.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold">Reporting Violations & Complaints</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We maintain strict safety standards. If you encounter spam, fake groups, copyright issues, or inappropriate content, report it directly via our Complaint form.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold">Account & Security</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Update your profile info, mobile number, or request account deletion anytime from your User Dashboard under Profile Settings.
          </p>
        </div>
      </div>

      {/* Dynamic Articles from Webmaster Settings */}
      {articles.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Webmaster Guides & Knowledgebase
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((art) => (
              <div key={art.id} className="p-5 rounded-2xl bg-card border border-border/80 space-y-2">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {art.category || "General"}
                </span>
                <h4 className="font-bold text-sm text-foreground">{art.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{art.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border/80 rounded-3xl p-8 text-center space-y-4">
        <h3 className="text-xl font-bold">Need Personal Assistance?</h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Our support desk is always ready to answer your questions and assist with listings.
        </p>
        <div className="pt-2">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition"
          >
            <MessageSquare className="w-4 h-4" /> Contact Webmaster Desk
          </Link>
        </div>
      </div>
    </div>
  );
}
