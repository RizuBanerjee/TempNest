import { useState } from "react";
import { useListInboxes, useCreateInbox, useGetMe, getListInboxesQueryKey } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Plus, Inbox, Mail, Copy, Check, Zap, Shield, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function InboxCard({ inbox }: { inbox: any }) {
  const [copied, setCopied] = useState(false);

  function copyAddress(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(inbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied");
  }

  const expiresIn = inbox.expiresAt
    ? Math.max(0, Math.floor((new Date(inbox.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
    : null;

  return (
    <Link href={`/inboxes/${inbox.id}`}>
      <Card className="p-5 bg-card border-border/60 hover:border-primary/40 transition-all cursor-pointer group hover:shadow-sm">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm text-foreground truncate">{inbox.address}</span>
              {inbox.isPriority && (
                <Badge className="text-[10px] px-1.5 bg-amber-500/20 text-amber-400 border-amber-500/20">
                  <Zap size={9} className="mr-0.5" /> Priority
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={10} />
              Created {new Date(inbox.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={copyAddress}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-muted-foreground" />}
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail size={13} />
            <span className="text-xs">{inbox.emailCount} emails</span>
          </div>
          {inbox.unreadCount > 0 && (
            <Badge className="text-[10px] px-2 bg-primary/10 text-primary border-primary/20">
              {inbox.unreadCount} new
            </Badge>
          )}
          {expiresIn !== null && expiresIn < 24 && (
            <Badge className="text-[10px] px-2 bg-amber-500/10 text-amber-400 border-amber-500/20">
              Expires in {expiresIn}h
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${inbox.isActive ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">{inbox.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Inboxes() {
  const { data: user } = useGetMe();
  const { data: inboxes, isLoading } = useListInboxes();
  const createInbox = useCreateInbox();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [isPriority, setIsPriority] = useState(false);

  const isAdmin = user?.isAdmin;
  const creditCost = isAdmin ? 0 : (2 + (customName.trim() ? 5 : 0) + (isPriority ? 10 : 0));

  async function handleCreate() {
    try {
      await createInbox.mutateAsync({ data: { customName: customName.trim() || null, isPriority } });
      queryClient.invalidateQueries({ queryKey: getListInboxesQueryKey() });
      setOpen(false);
      setCustomName("");
      setIsPriority(false);
      toast.success("Inbox created! Check your new address.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create inbox");
    }
  }

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Inboxes</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {isLoading ? "Loading…" : `${inboxes?.length ?? 0} active ${inboxes?.length === 1 ? "inbox" : "inboxes"}${user?.isAdmin ? " · Unlimited" : ""}`}
              </p>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus size={16} /> New Inbox
            </Button>
          </div>

          {/* What are inboxes? */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
            <Shield size={18} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-0.5">How inboxes work</p>
              <p className="text-muted-foreground text-xs">Each inbox is a real disposable email address (e.g. <code className="font-mono bg-muted px-1 rounded">abc123@mail.tm</code>). Share it anywhere you'd normally give your real email. Emails arrive here in real-time.{user?.isAdmin ? " As an admin, you can create unlimited inboxes for free." : " Costs 2 credits to create."}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : !inboxes?.length ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl">
              <Inbox size={40} className="mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg font-semibold text-foreground mb-1">No inboxes yet</p>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">Create your first temporary inbox to start receiving emails without revealing your real address.</p>
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus size={16} /> Create your first inbox
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {inboxes.map((inbox) => <InboxCard key={inbox.id} inbox={inbox} />)}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create New Inbox</DialogTitle>
            <DialogDescription>
              A new disposable email address will be created for you.{isAdmin ? " As admin, this is free." : ` Costs <strong>${creditCost} credits</strong>.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Custom Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. myalias → myalias@mail.tm"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Leave empty for a random address. Custom names cost +5 credits.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 cursor-pointer" onClick={() => setIsPriority(!isPriority)}>
              <Checkbox
                id="priority"
                checked={isPriority}
                onCheckedChange={(v) => setIsPriority(Boolean(v))}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="priority" className="cursor-pointer flex items-center gap-1.5 font-medium">
                  <Zap size={14} className="text-amber-400" />
                  Priority Inbox <span className="text-muted-foreground font-normal">(+10 credits)</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Emails are checked more frequently for faster delivery.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm border border-primary/20">
              <Zap size={14} className="text-primary" />
              <span>Total cost: <strong className="text-foreground">{isAdmin ? "Free (admin)" : `${creditCost} credits`}</strong></span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInbox.isPending}>
              {createInbox.isPending ? "Creating…" : `Create Inbox (${creditCost} credits)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
