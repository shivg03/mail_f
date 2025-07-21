import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Mailbox from "@/pages/mailbox";
import NotFound from "@/pages/not-found";
import { TranslationProvider } from "./contexts/TranslationContext";
import { FontProvider } from "./contexts/FontContext";
import { FontSizeProvider } from "./contexts/FontSizeContext";
import { TextColorProvider } from "./contexts/TextColorContext";
import Dashboard from "@/pages/dashboard";
import NewMail from "@/pages/new-mail";
import ManageMail from "@/pages/manage-mail";
import ShowOriginal from "@/pages/show-original";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new-mail" component={NewMail} />
      <Route path="/manage-mail/:mail_Id" component={ManageMail} />
      <Route path="/mailbox/m/:mail_Id/:view/email/:emailId" component={Mailbox} />
      <Route path="/mailbox/m/:mail_Id/:view/:tab?" component={Mailbox} />
      <Route path="/mailbox/m/:mail_Id/:view/email/:emailId/original" component={ShowOriginal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <FontProvider>
          <FontSizeProvider>
            <TextColorProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </TextColorProvider>
          </FontSizeProvider>
        </FontProvider>
      </TranslationProvider>
    </QueryClientProvider>
  );
}

export default App;
