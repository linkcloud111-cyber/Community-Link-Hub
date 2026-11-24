import { Link } from "wouter";
import { AlertCircle, ArrowLeft, Compass, Home } from "lucide-react";
import { usePageSEO } from "@/lib/page-meta";

export default function NotFound() {
  usePageSEO({
    title: "404 Page Not Found",
    description: "The requested page could not be found.",
    noIndex: true,
  });

  return (
    <div className="min-h-[75vh] w-full flex items-center justify-center bg-background text-foreground px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 sm:p-10 text-center shadow-lg space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            The page you are looking for may have been moved, unpublished, or does not exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <Link
            href="/groups"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-sm font-semibold transition"
          >
            <Compass className="w-4 h-4" />
            <span>Explore Groups</span>
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
