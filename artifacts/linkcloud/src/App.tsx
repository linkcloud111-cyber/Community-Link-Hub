import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import React from 'react';

import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import GroupDetail from '@/pages/group-detail';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Dashboard from '@/pages/dashboard';
import DashboardSubmit from '@/pages/dashboard-submit';
import DashboardEdit from '@/pages/dashboard-edit';
import AdminOverview from '@/pages/admin-overview';
import AdminGroups from '@/pages/admin-groups';
import AdminUsers from '@/pages/admin-users';
import AdminCategories from '@/pages/admin-categories';
import AdminLocations from '@/pages/admin-locations';

const queryClient = new QueryClient();

const ProtectedRoute = ({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) => {
  const { user, isAdmin, loading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!loading) {
      if (!user) {
        setLocation('/login');
      } else if (adminOnly && !isAdmin) {
        setLocation('/');
      }
    }
  }, [user, isAdmin, loading, adminOnly, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (adminOnly && !isAdmin)) {
    return null;
  }

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
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/groups/:id" component={GroupDetail} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/dashboard/submit" component={() => <ProtectedRoute component={DashboardSubmit} />} />
          <Route path="/dashboard/edit/:id" component={() => <ProtectedRoute component={DashboardEdit} />} />
          
          <Route path="/admin" component={() => <ProtectedRoute component={AdminOverview} adminOnly />} />
          <Route path="/admin/groups" component={() => <ProtectedRoute component={AdminGroups} adminOnly />} />
          <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} adminOnly />} />
          <Route path="/admin/categories" component={() => <ProtectedRoute component={AdminCategories} adminOnly />} />
          <Route path="/admin/locations" component={() => <ProtectedRoute component={AdminLocations} adminOnly />} />
          
          <Route component={NotFound} />
        </Switch>
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
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster theme="system" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;