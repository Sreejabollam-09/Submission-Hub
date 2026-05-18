import { useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import Layout from "@/components/layout/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import GoalSheets from "@/pages/GoalSheets";
import CheckIns from "@/pages/CheckIns";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import SharedGoals from "@/pages/SharedGoals";
import Scorecard from "@/pages/Scorecard";
import Notifications from "@/pages/Notifications";
import Escalations from "@/pages/Escalations";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AppRoutes({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const isManagerOrAdmin = user.role === "manager" || user.role === "admin";
  const isAdmin = user.role === "admin";

  return (
    <Layout user={user} onLogout={onLogout}>
      <Switch>
        <Route path="/" component={() => <Dashboard user={user} />} />
        <Route path="/goal-sheets" component={() => <GoalSheets user={user} />} />
        <Route path="/check-ins" component={() => <CheckIns user={user} />} />
        <Route path="/shared-goals" component={() => <SharedGoals user={user} />} />
        {user.role === "employee" && <Route path="/scorecard" component={() => <Scorecard user={user} />} />}
        <Route path="/notifications" component={() => <Notifications user={user} />} />
        {isManagerOrAdmin && <Route path="/analytics" component={() => <Analytics user={user} />} />}
        {isAdmin && <Route path="/reports" component={() => <Reports user={user} />} />}
        {isAdmin && <Route path="/escalations" component={() => <Escalations user={user} />} />}
        {isAdmin && <Route path="/admin" component={() => <Admin user={user} />} />}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);

  function handleLogin(u: AuthUser) {
    setUser(u);
  }

  function handleLogout() {
    setUser(null);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          {user ? (
            <AppRoutes user={user} onLogout={handleLogout} />
          ) : (
            <Switch>
              <Route path="/*?" component={() => <Login onLogin={handleLogin} />} />
            </Switch>
          )}
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
