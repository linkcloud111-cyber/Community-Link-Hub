import { useState, useEffect } from "react";
import {
  getContactMessages,
  updateContactMessage,
  deleteContactMessage,
  getComplaints,
  updateComplaintStatus,
  deleteComplaint,
} from "@/lib/firestore";
import type { ContactMessage, Complaint } from "@/lib/types";
import AdminNav from "@/components/admin-nav";
import { toast } from "sonner";
import { Loader2, MessageSquare, Mail, Phone, CheckCircle2, Trash2, AlertCircle } from "lucide-react";

export default function AdminContacts() {
  const [activeTab, setActiveTab] = useState<"contacts" | "complaints">("contacts");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [msgs, comps] = await Promise.all([getContactMessages(), getComplaints()]);
        setMessages(msgs);
        setComplaints(comps);
      } catch {
        toast.error("Failed to load records");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleStatusMsg = async (id: string, status: ContactMessage["status"]) => {
    try {
      await updateContactMessage(id, status);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
      toast.success(`Marked message as ${status}`);
    } catch {
      toast.error("Failed to update message");
    }
  };

  const handleDeleteMsg = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      await deleteContactMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const handleStatusComp = async (id: string, status: Complaint["status"]) => {
    try {
      await updateComplaintStatus(id, status);
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      toast.success(`Complaint status updated to ${status}`);
    } catch {
      toast.error("Failed to update complaint");
    }
  };

  const handleDeleteComp = async (id: string) => {
    if (!confirm("Delete this complaint record?")) return;
    try {
      await deleteComplaint(id);
      setComplaints((prev) => prev.filter((c) => c.id !== id));
      toast.success("Complaint deleted");
    } catch {
      toast.error("Failed to delete complaint");
    }
  };

  const filteredMessages = messages.filter((m) => filter === "all" || m.status === filter);
  const filteredComplaints = complaints.filter((c) => filter === "all" || c.status === filter);
  const unreadCount = messages.filter((m) => m.status === "unread").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-500" /> Inbox & Grievance Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review inquiries sent via Contact Webmaster and official Grievance complaints.
          </p>
        </div>
      </div>

      {/* Admin Nav */}
      <AdminNav stats={{ unreadContacts: unreadCount }} />

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <button
          onClick={() => {
            setActiveTab("contacts");
            setFilter("all");
          }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === "contacts"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Contact Messages ({messages.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("complaints");
            setFilter("all");
          }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeTab === "complaints"
              ? "bg-destructive text-destructive-foreground shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <AlertCircle className="w-4 h-4" /> Official Complaints ({complaints.length})
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {activeTab === "contacts" ? (
          ["unread", "read", "replied", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} ({messages.filter((m) => f === "all" || m.status === f).length})
            </button>
          ))
        ) : (
          ["pending", "investigating", "resolved", "dismissed", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition ${
                filter === f
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} ({complaints.filter((c) => f === "all" || c.status === f).length})
            </button>
          ))
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : activeTab === "contacts" ? (
        filteredMessages.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border/80 rounded-3xl">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-xs font-bold">No {filter} contact messages found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`bg-card border rounded-2xl p-5 shadow-sm transition ${
                  msg.status === "unread" ? "border-blue-500/40 bg-blue-500/5" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          msg.status === "unread"
                            ? "bg-blue-500/10 text-blue-500"
                            : msg.status === "replied"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {msg.status}
                      </span>
                      <span className="font-bold text-sm text-foreground">{msg.subject}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-semibold">
                        <Mail className="w-3.5 h-3.5 text-primary" /> {msg.name} ({msg.email})
                      </span>
                      {msg.phone && (
                        <span className="flex items-center gap-1 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" /> {msg.phone}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 whitespace-pre-wrap leading-relaxed font-mono">
                      {msg.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {msg.status === "unread" && (
                      <button
                        onClick={() => handleStatusMsg(msg.id, "read")}
                        className="px-3 py-1.5 text-xs font-bold bg-muted rounded-xl hover:bg-muted/80 transition"
                      >
                        Mark Read
                      </button>
                    )}
                    {msg.status !== "replied" && (
                      <button
                        onClick={() => handleStatusMsg(msg.id, "replied")}
                        className="p-2 hover:bg-emerald-500/10 rounded-xl text-muted-foreground hover:text-emerald-500 transition"
                        title="Mark replied"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <a
                      href={`mailto:${msg.email}?subject=Re: ${msg.subject}`}
                      className="px-3 py-1.5 text-xs font-extrabold bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition"
                    >
                      Reply
                    </a>
                    <button
                      onClick={() => handleDeleteMsg(msg.id)}
                      className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredComplaints.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-3xl">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive/40" />
          <p className="text-muted-foreground text-xs font-bold">No {filter} complaints found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((comp) => (
            <div
              key={comp.id}
              className={`bg-card border rounded-2xl p-5 shadow-sm transition ${
                comp.status === "pending"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        comp.status === "pending"
                          ? "bg-destructive/10 text-destructive"
                          : comp.status === "investigating"
                          ? "bg-amber-500/10 text-amber-500"
                          : comp.status === "resolved"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {comp.status}
                    </span>
                    <span className="font-bold text-sm text-foreground">{comp.subject}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-semibold">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-destructive" /> {comp.name} ({comp.email})
                    </span>
                    {comp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" /> {comp.phone}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 whitespace-pre-wrap leading-relaxed font-mono">
                    {comp.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={comp.status}
                    onChange={(e) =>
                      handleStatusComp(comp.id, e.target.value as Complaint["status"])
                    }
                    className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <a
                    href={`mailto:${comp.email}?subject=Re: Complaint - ${comp.subject}`}
                    className="px-3 py-1.5 text-xs font-extrabold bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition"
                  >
                    Respond
                  </a>
                  <button
                    onClick={() => handleDeleteComp(comp.id)}
                    className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition"
                  >
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
