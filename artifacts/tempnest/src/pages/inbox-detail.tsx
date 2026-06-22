import { useState, useEffect } from "react";
import { useGetInbox, useListInboxEmails, useRefreshInbox, useDeleteInbox, useGetMe, getListInboxEmailsQueryKey, getGetInboxQueryKey, getListInboxesQueryKey } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { RefreshCw, Trash2, Copy, Check, Mail, Key, Clock, Wifi } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function InboxDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const queryClient = useQueryClient();

  const { data: user } = useGetMe();
  const { data: inbox, isLoading: inboxLoading } = useGetInbox(id);
  const { data: emails, isLoading: emailsLoading } = useListInboxEmails(id);
  const refresh = useRefreshInbox();
  const deleteInbox = useDeleteInbox();

  function copyAddress() {
    if (!inbox?.address) return;
    navigator.clipboard.writeText(inbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied to clipboard");
  }

  async function doRefresh(silent = false) {
    try {
      const result = await refresh.mutateAsync({ inboxId: id });
      queryClient.invalidateQueries({ queryKey: getListInboxEmailsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(id) });
      setLastRefresh(new Date());
      setCountdown(30);
      if (!silent) toast.success(`${result.newEmails} new email${result.newEmails !== 1 ? "s" : ""}`);
      else if (result.newEmails > 0) toast.success(`${result.newEmails} new email${result.newEmails !== 1 ? "s" : ""} arrived`);
    } catch (err: any) {
      if (!silent) toast.error(err?.response?.data?.error || "Failed to refresh");
    }
  }

  // Free auto-poll: just re-fetch cached list without charging credits
  async function doPoll() {
    try {
      await queryClient.invalidateQueries({ queryKey: getListInboxEmailsQueryKey(id) });
      await queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(id) });
      setLastRefresh(new Date());
    } catch {}
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          doPoll();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleDelete() {
    if (!confirm("Delete this inbox? All emails will be lost.")) return;
    try {
      await deleteInbox.mutateAsync({ inboxId: id });
      queryClient.invalidateQueries({ queryKey: getListInboxesQueryKey() });
      toast.success("Inbox deleted");
      setLocation("/inboxes");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete inbox");
    }
  }

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <BackButton />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {inboxLoading ? (
                <Skeleton className="h-8 w-72" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="font-mono text-lg font-semibold">{inbox?.address}</h1>
                    {inbox?.isPriority && (
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/20 text-xs">Priority</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live monitoring</span>
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <Wifi size={11} />
                      <span>Auto-refresh in {countdown}s</span>
                    </div>
                    {lastRefresh && (
                      <>
                        <span>·</span>
                        <span>Last checked {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={copyAddress} className="gap-1.5">
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => doRefresh(false)} disabled={refresh.isPending} className="gap-1.5">
                <RefreshCw size={14} className={refresh.isPending ? "animate-spin" : ""} />
                Refresh
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:inline">{user?.isAdmin ? "Free" : "1 credit"}</span>
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive gap-1.5">
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {/* Stats row */}
          {!inboxLoading && inbox && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{inbox.emailCount} total emails</span>
              {inbox.unreadCount > 0 && (
                <Badge className="text-[10px] px-2 bg-primary/10 text-primary border-primary/20">
                  {inbox.unreadCount} unread
                </Badge>
              )}
            </div>
          )}

          {emailsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : !emails?.length ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl">
              <div className="relative inline-block mb-6">
                <Mail size={40} className="text-muted-foreground/30" />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                </div>
              </div>
              <p className="text-lg font-semibold mb-1">Inbox is empty</p>
              <p className="text-sm text-muted-foreground mb-2">Share this address and emails will appear here automatically.</p>
              <p className="text-xs text-muted-foreground font-mono bg-muted/40 px-3 py-1.5 rounded-lg inline-block">{inbox?.address}</p>
              <p className="text-xs text-muted-foreground mt-4">Auto-refreshing every 30 seconds · {countdown}s until next check</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <Link key={email.id} href={`/emails/${email.id}`}>
                  <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors hover:border-primary/30 hover:bg-card/80 ${email.isRead ? "border-border/40 bg-card/20" : "border-border/60 bg-card"}`}>
                    <div className="mt-1.5">
                      {email.hasOtp ? (
                        <Key size={14} className="text-primary" />
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${email.isRead ? "bg-transparent border border-border" : "bg-primary"}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-muted-foreground truncate">{email.from}</span>
                        {email.hasOtp && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20 animate-pulse">
                            OTP
                          </Badge>
                        )}
                      </div>
                      <p className={`text-sm truncate ${email.isRead ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                        {email.subject}
                      </p>
                      {email.preview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock size={11} />
                      {new Date(email.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
