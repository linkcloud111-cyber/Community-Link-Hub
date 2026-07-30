import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getSiteSettings, updateSiteSettings } from "@/lib/firestore";
import type { SiteSettings } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, Settings, Save } from "lucide-react";

export default function AdminSettings() {
  const [location] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: "LinkCloud",
    siteTagline: "India's Premium Community Directory",
    contactEmail: "hello@linkcloud.in",
    allowPublicSubmissions: true,
    maintenanceMode: false,
  });

  const adminNav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/groups", label: "Groups" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/categories", label: "Categories" },
    { href: "/admin/locations", label: "Locations" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/contacts", label: "Contacts" },
    { href: "/admin/settings", label: "Settings" },
  ];

  useEffect(() => {
    getSiteSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSiteSettings(settings);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none";
  const labelClass = "block text-sm font-semibold mb-1.5";

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="w-7 h-7 text-primary" /> Site Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure global site settings.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        {adminNav.map((nav) => (
          <Link key={nav.href} href={nav.href}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
              location === nav.href ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {nav.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5">
            <h2 className="font-bold">General</h2>
            <div>
              <label className={labelClass}>Site Name</label>
              <input value={settings.siteName} onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Site Tagline</label>
              <input value={settings.siteTagline} onChange={(e) => setSettings((s) => ({ ...s, siteTagline: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contact Email</label>
              <input type="email" value={settings.contactEmail} onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))} className={inputClass} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 space-y-5">
            <h2 className="font-bold">Submission Settings</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Allow Public Submissions</p>
                <p className="text-xs text-muted-foreground">Allow anyone to submit groups without signing in</p>
              </div>
              <button type="button" onClick={() => setSettings((s) => ({ ...s, allowPublicSubmissions: !s.allowPublicSubmissions }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${settings.allowPublicSubmissions ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.allowPublicSubmissions ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <div className="bg-card border border-destructive/30 rounded-3xl p-6 space-y-5">
            <h2 className="font-bold text-destructive">Danger Zone</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Show a maintenance notice to all visitors</p>
              </div>
              <button type="button" onClick={() => setSettings((s) => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? "bg-destructive" : "bg-muted"}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.maintenanceMode ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70 shadow-lg shadow-primary/20">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
        </form>
      )}
    </div>
  );
}
