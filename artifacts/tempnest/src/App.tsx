import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient, QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "./lib/theme-provider";
import { Toaster } from "sonner";

import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Inboxes from "./pages/inboxes";
import InboxDetail from "./pages/inbox-detail";
import EmailDetail from "./pages/email-detail";
import Credits from "./pages/credits";
import Analytics from "./pages/analytics";
import Settings from "./pages/settings";
import Pricing from "./pages/pricing";
import AdminDashboard from "./pages/admin/index";
import AdminUsers from "./pages/admin/users";
import AdminInboxes from "./pages/admin/inboxes";
import AdminRevenue from "./pages/admin/revenue";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  layout: {
    logoPlacement: "inside" as const,
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(260, 80%, 65%)",
    colorBackground: "hsl(224, 35%, 10%)",
    colorInput: "hsl(224, 30%, 15%)",
    colorInputForeground: "hsl(210, 20%, 98%)",
    colorText: "hsl(210, 20%, 98%)",
    colorTextSecondary: "hsl(215, 20%, 65%)",
    colorNeutral: "hsl(215, 20%, 65%)",
    fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-2xl w-[440px] max-w-full overflow-hidden border border-border shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    formFieldLabel: "text-foreground",
    formFieldInput: "bg-input border-border text-foreground",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    socialButtonsBlockButton: "border-border bg-card hover:bg-muted text-foreground",
    identityPreviewText: "text-foreground",
    identityPreviewEditButtonIcon: "text-muted-foreground",
    footer: "hidden",
    "cl-internal-1d5bpac": "hidden",
    "cl-internal-b3fm6y": "hidden",
    "cl-internal-1b3fm6y": "hidden",
  }
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M2 6l6 4 6-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-foreground">TempNest</span>
          </div>
          <p className="text-muted-foreground text-sm">Welcome back</p>
        </div>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M2 6l6 4 6-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-foreground">TempNest</span>
          </div>
          <p className="text-muted-foreground text-sm">Create your account</p>
        </div>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function HomeRoute() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Home />;
}

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/" />;
  return <Route {...rest} component={Component} />;
}

function RouterContent() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        {/* Public */}
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/pricing" component={Pricing} />

        {/* Protected */}
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/inboxes" component={Inboxes} />
        <ProtectedRoute path="/inboxes/:id" component={InboxDetail} />
        <ProtectedRoute path="/emails/:id" component={EmailDetail} />
        <ProtectedRoute path="/credits" component={Credits} />
        <ProtectedRoute path="/analytics" component={Analytics} />
        <ProtectedRoute path="/settings" component={Settings} />

        {/* Admin */}
        <ProtectedRoute path="/admin" component={AdminDashboard} />
        <ProtectedRoute path="/admin/users" component={AdminUsers} />
        <ProtectedRoute path="/admin/inboxes" component={AdminInboxes} />
        <ProtectedRoute path="/admin/revenue" component={AdminRevenue} />

        <Route>
          <div className="flex items-center justify-center min-h-[100dvh] text-muted-foreground">
            404 - Page not found
          </div>
        </Route>
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="tempnest-theme">
      <QueryClientProvider client={queryClient}>
        <RouterContent />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
