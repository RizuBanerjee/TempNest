import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  LayoutDashboard, 
  Inbox, 
  CreditCard, 
  BarChart2, 
  Settings, 
  LogOut,
  ShieldAlert,
  Users
} from "lucide-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user, isLoaded, isSignedIn } = useUser();
  const { data: dbUser } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });

  if (isLoaded && !isSignedIn) {
    setLocation("/");
    return null;
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inboxes", label: "Inboxes", icon: Inbox },
    { href: "/credits", label: "Credits", icon: CreditCard },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const adminItems = [
    { href: "/admin", label: "Admin Overview", icon: ShieldAlert },
    { href: "/admin/users", label: "Manage Users", icon: Users },
    { href: "/admin/inboxes", label: "Manage Inboxes", icon: Inbox },
    { href: "/admin/revenue", label: "Revenue", icon: BarChart2 },
  ];

  // Prefer DB display name over Clerk's name
  const displayName = dbUser?.name || user?.fullName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "User";
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress || dbUser?.email || "";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-card/30 flex flex-col">
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/40">
          <Logo />
          <ThemeToggle />
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Menu
          </div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location === item.href || location.startsWith(item.href + "/") 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
                <item.icon size={18} />
                {item.label}
              </div>
            </Link>
          ))}

          {dbUser?.isAdmin && (
            <>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3 mt-6">
                Admin
              </div>
              {adminItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                    location === item.href 
                      ? "bg-destructive/10 text-destructive font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}>
                    <item.icon size={18} />
                    {item.label}
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border/40">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {displayName[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut size={18} className="mr-2" />
            Log Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
        {children}
      </main>
    </div>
  );
}
