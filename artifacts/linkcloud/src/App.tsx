import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TaxonomyProvider } from '@/contexts/TaxonomyContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { logout } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import React, { lazy, Suspense, Component, type ReactNode } from 'react';

import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

// Core direct imports to avoid dynamic chunk loading failures on primary landing routes
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Register from '@/pages/register';
import VerifyEmail from '@/pages/verify-email';
import EmailActionPage from '@/pages/email-action';
import VerifyHandlerPage from '@/pages/verify-handler';
import Dashboard from '@/pages/dashboard';
import GroupsPage from '@/pages/groups';
import GroupDetail from '@/pages/group-detail';

// Helper for resilient lazy loading with auto-retry
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      console.error('Dynamic import failed, retrying once...', error);
      return new Promise<{ default: T }>((resolve, reject) => {
        setTimeout(() => {
          factory().then(resolve).catch(reject);
        }, 1000);
      });
    })
  );
}

// User Dashboard secondary pages
const DashboardSubmit = lazyWithRetry(() => import('@/pages/dashboard-submit'));
const DashboardEdit = lazyWithRetry(() => import('@/pages/dashboard-edit'));

// Webmaster Admin Pages
const WebmasterLogin = lazyWithRetry(() => import('@/pages/webmaster-login'));
const AdminOverview = lazyWithRetry(() => import('@/pages/admin-overview'));
const AdminGroups = lazyWithRetry(() => import('@/pages/admin-groups'));
const AdminUsers = lazyWithRetry(() => import('@/pages/admin-users'));
const AdminCategories = lazyWithRetry(() => import('@/pages/admin-categories'));
const AdminLocations = lazyWithRetry(() => import('@/pages/admin-locations'));
const AdminReports = lazyWithRetry(() => import('@/pages/admin-reports'));
const AdminContacts = lazyWithRetry(() => import('@/pages/admin-contacts'));
const AdminNotifications = lazyWithRetry(() => import('@/pages/admin-notifications'));
const AdminSettings = lazyWithRetry(() => import('@/pages/admin-settings'));

// Information Pages
const AboutPage = lazyWithRetry(() => import('@/pages/about'));
const FAQPage = lazyWithRetry(() => import('@/pages/faq'));
const HelpPage = lazyWithRetry(() => import('@/pages/help'));
const PrivacyPage = lazyWithRetry(() => import('@/pages/privacy'));
const TermsPage = lazyWithRetry(() => import('@/pages/terms'));
const DMCAPage = lazyWithRetry(() => import('@/pages/dmca'));
const ContactPage = lazyWithRetry(() => import('@/pages/contact'));
const ComplaintPage = lazyWithRetry(() => import('@/pages/complaint'));

// Error boundary to catch any runtime or chunk loading issues gracefully
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Route caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 mb-4 shadow-inner">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Something unexpected occurred
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6">
            We encountered a temporary loading issue. Please reload the view to continue.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Static route wrapper components to prevent component remounting loops in wouter
const ProtectedDashboard = () => <ProtectedRoute component={Dashboard} allowBoth />;
const ProtectedDashboardSubmit = () => <ProtectedRoute component={DashboardSubmit} allowBoth />;
const ProtectedDashboardEdit = () => <ProtectedRoute component={DashboardEdit} allowBoth />;

const ProtectedWebmasterOverview = () => <ProtectedRoute component={AdminOverview} webmasterOnly />;
const ProtectedWebmasterGroups = () => <ProtectedRoute component={AdminGroups} webmasterOnly />;
const ProtectedWebmasterUsers = () => <ProtectedRoute component={AdminUsers} webmasterOnly />;
const ProtectedWebmasterCategories = () => <ProtectedRoute component={AdminCategories} webmasterOnly />;
const ProtectedWebmasterLocations = () => <ProtectedRoute component={AdminLocations} webmasterOnly />;
const ProtectedWebmasterReports = () => <ProtectedRoute component={AdminReports} webmasterOnly />;
const ProtectedWebmasterContacts = () => <ProtectedRoute component={AdminContacts} webmasterOnly />;
const ProtectedWebmasterNotifications = () => <ProtectedRoute component={AdminNotifications} webmasterOnly />;
const ProtectedWebmasterSettings = () => <ProtectedRoute component={AdminSettings} webmasterOnly />;
const ProtectedWebmasterSecurity = () => <ProtectedRoute component={Dashboard} webmasterOnly />;
const ProtectedWebmasterChangePassword = () => <ProtectedRoute component={Dashboard} webmasterOnly />;

const queryClient = new QueryClient();

const ProtectedRoute = ({
  component: Component,
  webmasterOnly = false,
  allowBoth = false,
}: {
  component: React.ComponentType;
  webmasterOnly?: boolean;
  allowBoth?: boolean;
}) => {
  const { user, profile, isWebmaster, loading, pendingEmail, isSessionHandoff } = useAuth();
  const [, setLocation] = useLocation();

  const isEmailVerified = Boolean(
    user?.emailVerified ||
    auth.currentUser?.emailVerified ||
    profile?.emailVerified ||
    profile?.status === "active" ||
    profile?.pendingEmail ||
    pendingEmail ||
    isWebmaster ||
    isSessionHandoff
  );

  React.useEffect(() => {
    if (!loading && !isSessionHandoff) {
      if (!user && !auth.currentUser) {
        if (webmasterOnly) {
          setLocation('/webmaster/login');
        } else {
          setLocation('/login');
        }
      } else if (webmasterOnly && !isWebmaster) {
        setLocation('/login');
      } else if (!webmasterOnly && !allowBoth && isWebmaster) {
        setLocation('/webmaster/dashboard');
      } else if (!isEmailVerified && !isWebmaster) {
        setLocation('/verify-email');
      }
    }
  }, [user, profile, isWebmaster, loading, isSessionHandoff, webmasterOnly, allowBoth, isEmailVerified, setLocation]);

  if (loading || isSessionHandoff) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if ((!user && !auth.currentUser) || (!isEmailVerified && !isWebmaster)) return null;
  if (webmasterOnly && !isWebmaster) return null;
  if (!webmasterOnly && !allowBoth && isWebmaster) return null;

  return <Component />;
};

function Router() {
  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden text-foreground">
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50 dark:opacity-20 animate-pulse duration-[10s]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[150px] mix-blend-screen opacity-50 dark:opacity-20" />
      </div>

      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-8 z-10 min-w-0 outline-none">
        <RouteErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-[50vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            }
          >
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/groups" component={GroupsPage} />
              <Route path="/groups/:id" component={GroupDetail} />
              <Route path="/login" component={Login} />
              <Route path="/register" component={Register} />
              <Route path="/verify-email" component={VerifyEmail} />
              <Route path="/email-action" component={EmailActionPage} />
              <Route path="/verify-handler" component={VerifyHandlerPage} />
              
              <Route path="/about" component={AboutPage} />
              <Route path="/faq" component={FAQPage} />
              <Route path="/help" component={HelpPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="/terms" component={TermsPage} />
              <Route path="/dmca" component={DMCAPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/complaint" component={ComplaintPage} />

              <Route path="/submit" component={ProtectedDashboardSubmit} />
              <Route path="/dashboard" component={ProtectedDashboard} />
              <Route path="/my-groups" component={ProtectedDashboard} />
              <Route path="/submitted-groups" component={ProtectedDashboard} />
              <Route path="/my-submitted-groups" component={ProtectedDashboard} />
              <Route path="/my-profile" component={ProtectedDashboard} />
              <Route path="/profile-settings" component={ProtectedDashboard} />
              <Route path="/change-password" component={ProtectedDashboard} />
              <Route path="/account-security" component={ProtectedDashboard} />
              <Route path="/favorites" component={ProtectedDashboard} />
              <Route path="/notifications" component={ProtectedDashboard} />
              <Route path="/dashboard/submit" component={ProtectedDashboardSubmit} />
              <Route path="/dashboard/edit/:id" component={ProtectedDashboardEdit} />
              
              {/* Single Webmaster Protected Routes */}
              <Route path="/webmaster/login" component={WebmasterLogin} />
              <Route path="/webmaster" component={ProtectedWebmasterOverview} />
              <Route path="/webmaster/dashboard" component={ProtectedWebmasterOverview} />
              <Route path="/webmaster/groups" component={ProtectedWebmasterGroups} />
              <Route path="/webmaster/users" component={ProtectedWebmasterUsers} />
              <Route path="/webmaster/categories" component={ProtectedWebmasterCategories} />
              <Route path="/webmaster/locations" component={ProtectedWebmasterLocations} />
              <Route path="/webmaster/reports" component={ProtectedWebmasterReports} />
              <Route path="/webmaster/contacts" component={ProtectedWebmasterContacts} />
              <Route path="/webmaster/notifications" component={ProtectedWebmasterNotifications} />
              <Route path="/webmaster/settings" component={ProtectedWebmasterSettings} />
              <Route path="/webmaster/security" component={ProtectedWebmasterSecurity} />
              <Route path="/webmaster/change-password" component={ProtectedWebmasterChangePassword} />
              <Route path="/webmaster/my-groups" component={ProtectedDashboard} />
              
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <TaxonomyProvider>
            <LocationProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <Router />
              </WouterRouter>
              <Toaster theme="system" />
            </LocationProvider>
          </TaxonomyProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
