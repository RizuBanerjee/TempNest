import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useGetMe, useUpdateMe, getGetMeQueryKey, useGetCurrentSubscription } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, CreditCard, Shield, Bell, Palette, ShieldAlert } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { Link } from "wouter";

export default function Settings() {
  const { data: user, isLoading } = useGetMe();
  const { data: subscription } = useGetCurrentSubscription();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { user: clerkUser } = useUser();
  const [name, setName] = useState("");
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  useEffect(() => {
    if (user?.name && !name) {
      setName(user.name);
    }
  }, [user?.name]);

  const displayEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || user?.email || "";

  async function handleClaimAdmin() {
    setClaimingAdmin(true);
    try {
      const res = await fetch("/api/admin/claim", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Admin access granted! Reload the page to see admin menu.");
    } catch (err: any) {
      toast.error(err?.message || "Could not claim admin access");
    } finally {
      setClaimingAdmin(false);
    }
  }

  const planColors: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    pro: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    business: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };

  async function handleSave() {
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    try {
      await updateMe.mutateAsync({ data: { name: name.trim() } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update");
    }
  }

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences.</p>
          </div>

          {/* Profile */}
          <Card className="p-6 bg-card border-border/60 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <User size={16} className="text-primary" />
              <h2 className="font-semibold">Profile</h2>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={displayEmail} disabled className="font-mono opacity-70" />
                  <p className="text-xs text-muted-foreground">Your email address cannot be changed here. Manage it through your Clerk account.</p>
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name"
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                  />
                  <p className="text-xs text-muted-foreground">This name is shown in the app sidebar and your profile.</p>
                </div>
                <Button onClick={handleSave} disabled={updateMe.isPending || !name.trim()}>
                  {updateMe.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </Card>

          {/* Appearance */}
          <Card className="p-6 bg-card border-border/60 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette size={16} className="text-primary" />
              <h2 className="font-semibold">Appearance</h2>
            </div>
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="flex gap-3">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium capitalize transition-all ${
                      theme === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 hover:border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Plan & Subscription */}
          <Card className="p-6 bg-card border-border/60 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={16} className="text-primary" />
              <h2 className="font-semibold">Plan & Credits</h2>
            </div>
            {isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Plan</span>
                  <Badge className={planColors[user?.plan ?? "free"]}>
                    {(user?.plan ?? "free").charAt(0).toUpperCase() + (user?.plan ?? "free").slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Credits</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Credits are used to create inboxes, refresh emails, and more.</p>
                  </div>
                  <span className="font-mono text-sm">{user?.credits ?? 0} / {user?.maxCredits ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Daily Refill</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Credits added automatically each day.</p>
                  </div>
                  <span className="font-mono text-sm">{user?.dailyRefill ?? 0} credits/day</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Inboxes</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">How many temp email addresses you can have at once.</p>
                  </div>
                  <span className="font-mono text-sm">{user?.activeInboxCount ?? 0} / {user?.maxInboxes === -1 ? "∞" : (user?.maxInboxes ?? 1)}</span>
                </div>
                {subscription && subscription.planId !== "free" && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-sm text-muted-foreground">Next renewal</span>
                    <span className="text-sm">{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "—"}</span>
                  </div>
                )}
                {user?.plan === "free" && (
                  <div className="pt-2 flex gap-3">
                    <Link href="/pricing" className="flex-1">
                      <Button className="w-full">Upgrade Plan</Button>
                    </Link>
                    <Link href="/credits" className="flex-1">
                      <Button variant="outline" className="w-full">Buy Credits</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Notifications */}
          <Card className="p-6 bg-card border-border/60 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={16} className="text-primary" />
              <h2 className="font-semibold">Notifications</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: "New email received", desc: "Get notified when a new email arrives in any inbox", enabled: true },
                { label: "OTP detected", desc: "Alert when a verification code is found in an email", enabled: true },
                { label: "Low credits warning", desc: "Notify when credits drop below 20% of your limit", enabled: false },
                { label: "Weekly usage summary", desc: "Email digest of your TempNest activity each week", enabled: false },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-2 border-b border-border/20 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <div className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${item.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                    {item.enabled ? "On" : "Off"}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">Notification controls coming soon.</p>
            </div>
          </Card>

          {/* Account Info */}
          <Card className="p-6 bg-card border-border/60 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-primary" />
              <h2 className="font-semibold">Account</h2>
            </div>
            {isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Member since</span>
                  <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Account status</span>
                  <Badge className={user?.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" : "bg-red-500/20 text-red-400"}>
                    {user?.status ?? "active"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="font-mono text-xs text-muted-foreground/70">#{user?.id}</span>
                </div>
                <div className="pt-3 border-t border-border/30">
                  <p className="text-xs text-muted-foreground">To delete your account or manage authentication methods, visit your <span className="text-primary cursor-pointer">account settings</span>.</p>
                </div>
              </div>
            )}
          </Card>

          {/* Admin Access */}
          {!user?.isAdmin && (
            <Card className="p-6 bg-card border-border/60 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={16} className="text-amber-400" />
                <h2 className="font-semibold">Admin Access</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                If you are the platform owner, you can claim admin rights here. This only works if no admin exists yet.
              </p>
              <Button
                variant="outline"
                onClick={handleClaimAdmin}
                disabled={claimingAdmin}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <ShieldAlert size={14} className="mr-2" />
                {claimingAdmin ? "Claiming..." : "Claim Admin Access"}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
