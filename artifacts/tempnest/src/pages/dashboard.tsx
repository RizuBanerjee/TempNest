import { useGetDashboardSummary } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Mail, Inbox, Key, Zap, ArrowRight, TrendingUp } from "lucide-react";

function CreditBar({ current, max }: { current: number; max: number }) {
  const isUnlimited = max === -1;
  const pct = isUnlimited ? 100 : (max > 0 ? Math.min((current / max) * 100, 100) : 0);
  const color = isUnlimited ? "bg-emerald-500" : (pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Credits</span>
        <span className="font-mono font-semibold">{isUnlimited ? "Unlimited" : `${current.toLocaleString()} / ${max.toLocaleString()}`}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{isUnlimited ? "Admin · Unlimited usage" : `${pct.toFixed(0)}% remaining`}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Your personal activity overview — inboxes, emails, and credits at a glance.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Credits Left",
                value: isLoading ? null : (summary?.maxCredits === -1 ? "∞" : summary?.credits),
                sub: summary?.maxCredits === -1 ? "unlimited" : `/ ${summary?.maxCredits ?? "—"} max`,
                icon: Zap,
                desc: "Used to create inboxes & refresh emails",
                color: "text-amber-400",
              },
              {
                label: "Active Inboxes",
                value: isLoading ? null : summary?.inboxCount,
                sub: summary?.maxInboxes === -1 ? "unlimited" : `/ ${summary?.maxInboxes ?? "—"} limit`,
                icon: Inbox,
                desc: "Temp email addresses currently active",
                color: "text-violet-400",
              },
              {
                label: "Emails Today",
                value: isLoading ? null : summary?.emailsToday,
                sub: "received",
                icon: Mail,
                desc: "Emails received across all your inboxes",
                color: "text-cyan-400",
              },
              {
                label: "OTPs Extracted",
                value: isLoading ? null : summary?.otpsExtracted,
                sub: "today",
                icon: Key,
                desc: "Verification codes auto-detected",
                color: "text-emerald-400",
              },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 bg-card border-border/60 group hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <stat.icon size={16} className={`${stat.color} opacity-70 mt-0.5`} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 mb-1" />
                ) : (
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-bold font-mono">{stat.value ?? 0}</span>
                    <span className="text-xs text-muted-foreground mb-1">{stat.sub}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground/60 leading-tight hidden group-hover:block">{stat.desc}</p>
              </Card>
            ))}
          </div>

          {/* Credit Bar */}
          <Card className="p-5 bg-card border-border/60">
            {isLoading ? <Skeleton className="h-10 w-full" /> : (
              <CreditBar current={summary?.maxCredits === -1 ? 999999 : (summary?.credits ?? 0)} max={summary?.maxCredits ?? 100} />
            )}
          </Card>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Link href="/inboxes">
              <Card className="p-4 bg-card border-border/60 hover:border-primary/30 cursor-pointer transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Inbox size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">My Inboxes</p>
                      <p className="text-xs text-muted-foreground">Create or view inboxes</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>
            </Link>
            <Link href="/credits">
              <Card className="p-4 bg-card border-border/60 hover:border-primary/30 cursor-pointer transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <Zap size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Buy Credits</p>
                      <p className="text-xs text-muted-foreground">Top up your balance</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>
            </Link>
            <Link href="/analytics">
              <Card className="p-4 bg-card border-border/60 hover:border-primary/30 cursor-pointer transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Analytics</p>
                      <p className="text-xs text-muted-foreground">View usage charts</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>
            </Link>
          </div>

          {/* Recent Emails */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Emails</h2>
              <Link href="/inboxes">
                <button className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors">
                  View all <ArrowRight size={14} />
                </button>
              </Link>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : !summary?.recentEmails?.length ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
                <Mail size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No emails yet</p>
                <p className="text-sm mt-1">Create an inbox to start receiving emails.</p>
                <Link href="/inboxes">
                  <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                    Create Inbox
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.recentEmails.map((email) => (
                  <Link key={email.id} href={`/emails/${email.id}`}>
                    <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors hover:border-primary/30 hover:bg-card/80 ${email.isRead ? "border-border/40 bg-card/30" : "border-border/60 bg-card"}`}>
                      <div className="mt-1">
                        {!email.isRead && <div className="w-2 h-2 rounded-full bg-primary" />}
                        {email.isRead && <div className="w-2 h-2 rounded-full bg-transparent" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-muted-foreground truncate">{email.from}</span>
                          {email.hasOtp && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/20 animate-pulse">
                              OTP
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm truncate ${email.isRead ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                          {email.subject}
                        </p>
                        {email.hasOtp && email.otpCode && (
                          <p className="text-xs text-primary font-mono mt-0.5">Code: {email.otpCode}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(email.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
