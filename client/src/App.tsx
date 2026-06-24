import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/admin/dashboard";
import TvDisplay from "@/pages/tv";
import Checkin from "@/pages/checkin";
import InterviewerDashboard from "@/pages/interviewer/dashboard";
import Candidates from "@/pages/hr/candidates";
import Tables from "@/pages/admin/tables";
import SitePositions from "@/pages/admin/site-positions";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/tv" component={TvDisplay} />
      <Route path="/checkin" component={Checkin} />
      <Route path="/interviewer" component={InterviewerDashboard} />
      <Route path="/candidates" component={Candidates} />
      <Route path="/tables" component={Tables} />
      <Route path="/admin/site-positions" component={SitePositions} />
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
