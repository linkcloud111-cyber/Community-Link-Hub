import { ShieldCheck, Users, Globe2, Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Hero */}
      <div className="text-center space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          About LinkCloud
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Connecting India's Digital Communities
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          LinkCloud is India's premier community discovery index, providing verified invite links for WhatsApp, Telegram, Discord, and leading social channels.
        </p>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold">100% Moderated</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every community listing is verified by our human moderation team before public approval to maintain safety and combat spam.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Globe2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold">Localized Discovery</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Discover localized groups by State, District, City, and regional languages across all major Indian territories.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold">Multi-Platform Support</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Seamless support for WhatsApp, Telegram, Discord, Facebook Groups, Instagram Broadcast, X, LinkedIn, YouTube, and Reddit.
          </p>
        </div>
      </div>

      {/* Mission */}
      <div className="bg-card border border-border/80 rounded-3xl p-8 sm:p-12 space-y-6">
        <h2 className="text-2xl font-bold">Our Mission</h2>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          In an era of fragmented messaging apps, finding high-quality, safe, and relevant community groups can be frustrating. LinkCloud eliminates spam, broken links, and fake groups by hosting a centralized, human-curated directory. Whether you are seeking tech discussions, local study groups, job updates, hobbies, or regional news, LinkCloud connects you safely.
        </p>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            "Realtime link status validation",
            "Zero fees for public browsing & submitting",
            "Robust complaint & DMCA reporting desk",
            "Granular regional & language categorization",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-blue-500/10 border border-primary/20 rounded-3xl p-8 text-center space-y-4">
        <h3 className="text-2xl font-bold">Want to feature your community?</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Submit your WhatsApp, Telegram, or Discord community today and reach thousands of active members across India.
        </p>
        <div className="pt-2">
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20"
          >
            Submit Your Community <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
