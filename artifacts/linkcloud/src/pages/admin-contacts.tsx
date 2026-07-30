import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getContactMessages, updateContactMessage, deleteContactMessage } from "@/lib/firestore";
import type { ContactMessage } from "@/lib/types";
import { toast } from "sonner";
import { Loader2, MessageSquare, Mail, CheckCircle2, Trash2 } from "lucide-react";

export default function AdminContacts() {
  const [location] = useLocation();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "replied">("unread");

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
    getContactMessages()
      .then(setMessages)
      .catch(() => toast.error("Failed to load messages"))
      .finally(() => setLoading(false));
  }, []);

  const handleStatus = async (id: string, status: ContactMessage["status"]) => {
    try {
      await updateContactMessage(id, status);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
      toast.success(`Marked as ${status}`);
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      await deleteContactMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const filtered = messages.filter((m) => filter === "all" || m.status === filter);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="w-7 h-7 text-blue-500" /> Contact Messages
        </h1>
        <p className="text-muted-foreground mt-1">Messages from the contact form.</p>
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

      <div className="flex gap-2 flex-wrap">
        {(["unread", "read", "replied", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}>
            {f} ({messages.filter((m) => f === "all" || m.status === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-3xl">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground">No {filter} messages</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((msg) => (
            <div key={msg.id} className={`bg-card border rounded-2xl p-5 ${msg.status === "unread" ? "border-blue-500/30" : "border-border"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      msg.status === "unread" ? "bg-blue-500/10 text-blue-500" :
                      msg.status === "replied" ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {msg.status}
                    </span>
                    <span className="font-semibold text-sm">{msg.subject}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{msg.name}</span>
                    <span>·</span>
                    <a href={`mailto:${msg.email}`} className="text-primary hover:underline">{msg.email}</a>
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {msg.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {msg.status === "unread" && (
                    <button onClick={() => handleStatus(msg.id, "read")}
                      className="px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                      Mark Read
                    </button>
                  )}
                  {msg.status !== "replied" && (
                    <button onClick={() => handleStatus(msg.id, "replied")}
                      className="p-2 hover:bg-emerald-500/10 rounded-lg text-muted-foreground hover:text-emerald-500 transition-colors"
                      title="Mark replied">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <a href={`mailto:${msg.email}?subject=Re: ${msg.subject}`}
                    className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                    Reply
                  </a>
                  <button onClick={() => handleDelete(msg.id)}
                    className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
