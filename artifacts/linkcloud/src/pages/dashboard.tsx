import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useDashboardTabs, type DashboardTab } from "@/hooks/useDashboardTabs";
import { useAuth } from "@/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  getUserGroups,
  deleteGroup,
  updateUserProfile,
  requestAccountDeletion,
  cancelDeletionRequest,
  getFavoriteGroups,
  removeFavorite,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createContactMessage,
  getUserContactMessages,
  createComplaint,
  getUserComplaints,
  checkDuplicateUser,
} from "@/lib/firestore";
import {
  resendVerificationEmail,
  updateUserPassword,
  updateUserEmailAddress,
  cancelPendingEmailChange,
  signInWithMobileOTP,
  verifyOTP,
  signOut,
  type ConfirmationResult,
} from "@/lib/auth";
import type { Group, Notification, ContactMessage, Complaint, UserProfile } from "@/lib/types";
import { validateGmailAddress, validateIndianMobile } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Lock, Eye, EyeOff, ShieldCheck, X, RefreshCw } from "lucide-react";

// Dashboard modular components
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatCards } from "@/components/dashboard/StatCards";
import { AccountSecuritySection } from "@/components/dashboard/AccountSecuritySection";
import { QuickActionsAndAlerts } from "@/components/dashboard/QuickActionsAndAlerts";
import { RecentGroups } from "@/components/dashboard/RecentGroups";
import { EditProfileModal } from "@/components/dashboard/EditProfileModal";
import { ChangeEmailModal } from "@/components/dashboard/ChangeEmailModal";
import { VerifyPhoneModal } from "@/components/dashboard/VerifyPhoneModal";
import { MobileTopNav, MobileBottomNav } from "@/components/dashboard/MobileNav";

// Tab Views
import { MyGroupsTab } from "@/components/dashboard/tabs/MyGroupsTab";
import { FavoritesTab } from "@/components/dashboard/tabs/FavoritesTab";
import { NotificationsTab } from "@/components/dashboard/tabs/NotificationsTab";
import { MessagesTab } from "@/components/dashboard/tabs/MessagesTab";
import { ActivityTab } from "@/components/dashboard/tabs/ActivityTab";
import { ProfileTab } from "@/components/dashboard/tabs/ProfileTab";
import { SecurityTab } from "@/components/dashboard/tabs/SecurityTab";
import { SettingsTab } from "@/components/dashboard/tabs/SettingsTab";
import { ConnectedAccountsTab } from "@/components/dashboard/tabs/ConnectedAccountsTab";
import { HelpTab } from "@/components/dashboard/tabs/HelpTab";
import { ComplaintTab } from "@/components/dashboard/tabs/ComplaintTab";
import { MoreTab } from "@/components/dashboard/tabs/MoreTab";

export default function Dashboard() {
  const { user, profile, isWebmaster, pendingEmail, refreshProfile, checkAndSyncEmailChangeStatus } = useAuth();
  const [, setLocation] = useLocation();

  // Tab State
  const [activeTab, handleTabChange] = useDashboardTabs("overview");
  const [groupFilter, setGroupFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Mobile Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modals State
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  // Firestore Data Collections
  const [groups, setGroups] = useState<Group[]>([]);
  const [favorites, setFavorites] = useState<Group[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Data
  useEffect(() => {
    async function loadData() {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const [grps, favs, notifs, msgs, comps] = await Promise.all([
          getUserGroups(user.uid),
          getFavoriteGroups(user.uid),
          getUserNotifications(user.uid),
          user.email ? getUserContactMessages(user.email) : Promise.resolve([]),
          user.email ? getUserComplaints(user.email) : Promise.resolve([]),
        ]);
        setGroups(grps);
        setFavorites(favs);
        setNotifications(notifs);
        setMessages(msgs);
        setComplaints(comps);
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.uid, user?.email]);

  const unreadNotifsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const stats = useMemo(
    () => ({
      total: groups.length,
      approved: groups.filter((g) => g.status === "approved").length,
      pending: groups.filter((g) => g.status === "pending").length,
      rejected: groups.filter((g) => g.status === "rejected").length,
      favorites: favorites.length,
      notifications: notifications.length,
      unreadNotifs: unreadNotifsCount,
    }),
    [groups, favorites, notifications, unreadNotifsCount]
  );

  // Logout
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully.");
      setLocation("/login");
    } catch {
      toast.error("Failed to sign out.");
    }
  };

  // Group Delete
  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success("Group deleted successfully.");
    } catch {
      toast.error("Failed to delete group.");
    }
  };

  // Remove Favorite
  const handleRemoveFavorite = async (id: string) => {
    if (!user) return;
    try {
      await removeFavorite(user.uid, id);
      setFavorites((prev) => prev.filter((g) => g.id !== id));
      toast.success("Removed from favorites.");
    } catch {
      toast.error("Failed to remove favorite.");
    }
  };

  // Notification actions
  const handleMarkNotifRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      toast.error("Failed to update notification.");
    }
  };

  const handleMarkAllNotifsRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read.");
    } catch {
      toast.error("Failed to update notifications.");
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification removed.");
    } catch {
      toast.error("Failed to delete notification.");
    }
  };

  // Account Deletion Request
  const handleRequestDeletion = async (reason: string) => {
    if (!user) return;
    await requestAccountDeletion(
      user.uid,
      profile?.displayName || "User",
      profile?.email || user.email || "",
      profile?.phone || "",
      reason
    );
    await refreshProfile();
    toast.success("Account deletion request submitted to Webmaster.");
  };

  // Cancel Account Deletion
  const handleCancelDeletion = async () => {
    if (!user) return;
    await cancelDeletionRequest(user.uid);
    await refreshProfile();
    toast.success("Account deletion request has been withdrawn.");
  };

  // Save Profile Details
  const handleSaveProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    await updateUserProfile(user.uid, data);
    await refreshProfile();
  };

  // Password Change
  const handleChangePassword = async (currentPass: string, newPass: string) => {
    if (!user) return;
    await updateUserPassword(user, currentPass, newPass);
  };

  // Send Message
  const handleSendMessage = async (subject: string, message: string) => {
    if (!user) return;
    await createContactMessage({
      name: profile?.displayName || user?.displayName || "User",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
      subject,
      message,
    });
    toast.success("Your message has been sent to Webmaster!");
    if (user?.email) {
      const msgs = await getUserContactMessages(user.email);
      setMessages(msgs);
    }
  };

  // Submit Grievance
  const handleSubmitComplaint = async (type: string, subject: string, description: string) => {
    if (!user) return;
    await createComplaint({
      name: profile?.displayName || user?.displayName || "User",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
      subject: `[${type}] ${subject}`,
      message: description,
    });
    toast.success("Grievance report submitted successfully!");
    if (user?.email) {
      const comps = await getUserComplaints(user.email);
      setComplaints(comps);
    }
  };

  // Check Email Status / Refresh Verification Status
  const handleCheckEmailStatus = async () => {
    try {
      const currentUser = auth.currentUser || user;
      if (!currentUser) {
        toast.error("Session not found. Please log in again.");
        return;
      }

      if (auth.currentUser) {
        await auth.currentUser.reload();
      }

      if (auth.currentUser?.emailVerified) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          await updateDoc(userDocRef, {
            emailVerified: true,
            status: "active",
            updatedAt: new Date(),
          });
        } catch (dbErr) {
          console.warn("Notice: Firestore update in handleCheckEmailStatus:", dbErr);
        }

        await refreshProfile();
        handleTabChange("profile");
        toast.success("Email verified successfully!");
        return;
      }

      const result = await checkAndSyncEmailChangeStatus({
        manual: true,
        targetPendingEmail: pendingEmail,
      });
      if (result.status === "success") {
        await refreshProfile();
        handleTabChange("profile");
        toast.success("Email verified successfully!");
      } else {
        toast.info("Email not verified yet. Please check your inbox or spam folder.");
      }
    } catch {
      toast.error("Unable to check verification status. Please try again.");
    }
  };

  const isEmailVerified = Boolean(user?.emailVerified || profile?.emailVerified);

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <div id="dash-recaptcha"></div>

      {/* MAIN LAYOUT WRAPPER */}
      <div className="flex flex-col lg:flex-row flex-1 w-full max-w-[1440px] mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-4 gap-0 lg:gap-6 min-w-0">
        {/* DESKTOP SIDEBAR + MOBILE DRAWER */}
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          unreadNotifsCount={unreadNotifsCount}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobileOpen={mobileDrawerOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
        />

        {/* MAIN DASHBOARD CONTENT AREA */}
        <main className="flex-1 min-w-0 space-y-4 sm:space-y-6 pb-28 lg:pb-8 w-full max-w-full">
          {/* MOBILE TOP NAVIGATION BAR */}
          <MobileTopNav
            onOpenDrawer={() => setMobileDrawerOpen(true)}
            unreadCount={unreadNotifsCount}
            profile={profile}
            onNavigateNotifications={() => handleTabChange("notifications")}
            onNavigateProfile={() => handleTabChange("profile")}
          />

          {/* DASHBOARD HEADER */}
          <DashboardHeader
            profile={profile}
            email={user?.email || null}
            isEmailVerified={isEmailVerified}
            isWebmaster={isWebmaster}
            onEditProfile={() => setEditProfileOpen(true)}
            onLogout={handleLogout}
          />

          {/* TAB ROUTING */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* 1. STATISTICS CARDS */}
              <StatCards
                stats={stats}
                onNavigate={(tab, filter) => {
                  if (filter) setGroupFilter(filter);
                  handleTabChange(tab);
                }}
              />

              {/* 2. QUICK ACTIONS & IMPORTANT ALERTS */}
              <QuickActionsAndAlerts
                onNavigate={handleTabChange}
                onEditProfile={() => setEditProfileOpen(true)}
                unreadNotifications={notifications.filter((n) => !n.read)}
                isEmailVerified={isEmailVerified}
                hasPhone={Boolean(profile?.phone)}
              />

              {/* 3. ACCOUNT SECURITY & DELETION CARD */}
              <AccountSecuritySection
                profile={profile}
                email={user?.email || null}
                isEmailVerified={isEmailVerified}
                onRequestDeletion={handleRequestDeletion}
                onCancelDeletion={handleCancelDeletion}
                onOpenChangePassword={() => handleTabChange("security")}
              />

              {/* 4. RECENT GROUPS */}
              <RecentGroups
                groups={groups}
                onViewAll={() => handleTabChange("my-groups")}
              />
            </div>
          )}

          {/* MY GROUPS TAB */}
          {(activeTab === "my-groups" || activeTab === "groups" || activeTab === "submitted") && (
            <MyGroupsTab
              groups={groups}
              filter={groupFilter}
              onFilterChange={setGroupFilter}
              onDeleteGroup={handleDeleteGroup}
            />
          )}

          {/* FAVORITES TAB */}
          {activeTab === "favorites" && (
            <FavoritesTab
              favorites={favorites}
              onRemoveFavorite={handleRemoveFavorite}
            />
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <NotificationsTab
              notifications={notifications}
              onMarkRead={handleMarkNotifRead}
              onMarkAllRead={handleMarkAllNotifsRead}
              onDeleteNotification={handleDeleteNotif}
            />
          )}

          {/* MESSAGES TAB */}
          {activeTab === "messages" && (
            <MessagesTab
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          )}

          {/* ACTIVITY TAB */}
          {activeTab === "activity" && (
            <ActivityTab
              profile={profile}
              groups={groups}
              notifications={notifications}
            />
          )}

          {/* PROFILE TAB */}
          {(activeTab === "profile" || activeTab === "my-profile") && (
            <ProfileTab
              profile={profile}
              email={user?.email || null}
              isEmailVerified={isEmailVerified}
              pendingEmail={pendingEmail}
              onEditProfile={() => setEditProfileOpen(true)}
              onOpenEmailModal={() => setEmailModalOpen(true)}
              onOpenPhoneModal={() => setPhoneModalOpen(true)}
              onCheckEmailStatus={handleCheckEmailStatus}
            />
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <SecurityTab
              profile={profile}
              email={user?.email || null}
              isEmailVerified={isEmailVerified}
              onChangePassword={handleChangePassword}
              onRequestDeletion={handleRequestDeletion}
              onCancelDeletion={handleCancelDeletion}
              onOpenPhoneModal={() => setPhoneModalOpen(true)}
            />
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <SettingsTab
              profile={profile}
              email={user?.email || null}
              isEmailVerified={isEmailVerified}
              pendingEmail={pendingEmail}
              onCheckEmailStatus={handleCheckEmailStatus}
              onSavePreferences={async (prefs) => {
                if (!user) return;
                await updateUserProfile(user.uid, prefs);
                await refreshProfile();
              }}
            />
          )}

          {/* CONNECTED ACCOUNTS TAB */}
          {activeTab === "connected-accounts" && (
            <ConnectedAccountsTab
              profile={profile}
              email={user?.email || null}
              isEmailVerified={isEmailVerified}
            />
          )}

          {/* HELP TAB */}
          {activeTab === "help" && (
            <HelpTab onNavigate={handleTabChange} />
          )}

          {/* COMPLAINT / GRIEVANCE TAB */}
          {activeTab === "complaint" && (
            <ComplaintTab
              complaints={complaints}
              onSubmitComplaint={handleSubmitComplaint}
            />
          )}

          {/* MORE TAB */}
          {activeTab === "more" && (
            <MoreTab
              profile={profile}
              email={user?.email || null}
              isEmailVerified={isEmailVerified}
              unreadNotifsCount={unreadNotifsCount}
              onNavigate={handleTabChange}
              onEditProfile={() => setEditProfileOpen(true)}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* EDIT PROFILE MODAL */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
      />

      {/* CHANGE EMAIL MODAL */}
      <ChangeEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        user={user}
        profile={profile}
        pendingEmail={pendingEmail}
        onSuccess={async () => {
          await refreshProfile();
          handleTabChange("profile");
        }}
      />

      {/* VERIFY / CHANGE MOBILE MODAL */}
      <VerifyPhoneModal
        isOpen={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        user={user}
        profile={profile}
        onSuccess={refreshProfile}
      />
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenMenu={() => setMobileDrawerOpen(true)}
        unreadCount={unreadNotifsCount}
      />
    </div>
  );
}
