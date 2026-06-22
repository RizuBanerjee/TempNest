import { useState, useEffect, useRef } from "react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Shield, Zap, Mail, Key, Copy, Check, RefreshCw, Trash2, Clock, ArrowRight, Lock, Globe, X, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TempInbox {
  id: string;
  address: string;
  token: string | null;
}

interface TempEmail {
  id: string;
  from: string;
  subject: string;
  preview: string;
  hasOtp: boolean;
  otpCode: string | null;
  createdAt: string;
  bodyText?: string;
  bodyHtml?: string | null;
}

function TryItSection() {
  const [inbox, setInbox] = useState<TempInbox | null>(null);
  const [emails, setEmails] = useState<TempEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [selectedEmail, setSelectedEmail] = useState<TempEmail | null>(null);
  const [emailDetailLoading, setEmailDetailLoading] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function generateInbox() {
    setLoading(true);
    setEmails([]);
    try {
      const res = await fetch(`${BASE}/api/public/temp-inbox`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInbox(data);
      setCountdown(30);
      startCountdown(data);
    } catch {
      toast.error("Could not generate inbox. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function checkEmails(inboxData: TempInbox) {
    if (!inboxData.token) return;
    try {
      const res = await fetch(`${BASE}/api/public/temp-inbox/messages?token=${encodeURIComponent(inboxData.token)}`);
      if (!res.ok) return;
      const data = await res.json();
      setEmails(data);
    } catch {}
  }

  async function handleRefresh() {
    if (!inbox) return;
    setRefreshing(true);
    await checkEmails(inbox);
    setCountdown(30);
    setRefreshing(false);
    toast.success("Inbox refreshed");
  }

  function startCountdown(inboxData: TempInbox) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          checkEmails(inboxData);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleCopy() {
    if (!inbox) return;
    navigator.clipboard.writeText(inbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied!");
  }

  function handleDelete() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setInbox(null);
    setEmails([]);
    setSelectedEmail(null);
  }

  async function openEmailDetail(email: TempEmail) {
    if (!inbox?.token) return;
    setSelectedEmail(email);
    setEmailDetailLoading(true);
    try {
      const res = await fetch(`${BASE}/api/public/temp-inbox/messages/${email.id}?token=${encodeURIComponent(inbox.token)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSelectedEmail({ ...email, bodyText: data.bodyText, bodyHtml: data.bodyHtml });
    } catch {
      toast.error("Could not load email details");
    } finally {
      setEmailDetailLoading(false);
    }
  }

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 200);
        setIframeHeight(height + 32);
      }
    } catch (_) {}
  }

  function buildIframeContent(html: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; line-height: 1.6; color: #1a1a1a; background: #ffffff;
    margin: 0; padding: 16px; user-select: text; cursor: auto; overflow-x: hidden;
  }
  img { max-width: 100%; height: auto; }
  a { color: #7c3aed; text-decoration: underline; cursor: pointer; }
  a:hover { color: #6d28d9; }
  table { max-width: 100% !important; width: 100% !important; }
</style>
</head>
<body>${html}</body>
</html>`;
  }

  useEffect(() => {
    generateInbox();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  return (
    <section id="try-it" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-4 px-3 py-1">No account needed</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Try it right now</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Your temporary email address is ready. Use it anywhere, receive emails instantly — no sign-up required.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Email address display */}
          <div className="border-2 border-dashed border-primary/30 rounded-2xl p-6 bg-primary/5 mb-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">Your Temporary Email Address</p>
            {loading ? (
              <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 font-mono text-xl font-semibold text-foreground bg-background/60 px-4 py-2.5 rounded-xl border border-border/60 truncate">
                  {inbox?.address}
                </div>
                <button
                  onClick={handleCopy}
                  className="w-11 h-11 rounded-xl bg-background border border-border/60 flex items-center justify-center hover:bg-muted hover:border-primary/40 transition-all shrink-0"
                >
                  {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-muted-foreground" />}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Share this address, then watch emails arrive below. Auto-refreshes every {countdown}s.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-6">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || !inbox} className="gap-2 flex-1">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh ({countdown}s)
            </Button>
            <Button variant="outline" size="sm" onClick={generateInbox} disabled={loading} className="gap-2 flex-1">
              <Mail size={14} />
              New Address
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-2 text-destructive hover:text-destructive">
              <Trash2 size={14} />
              Delete
            </Button>
          </div>

          {/* Inbox table */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/30 border-b border-border">
              <div className="col-span-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sender</div>
              <div className="col-span-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</div>
              <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Time</div>
            </div>

            <AnimatePresence>
              {emails.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="relative inline-flex mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Mail size={28} className="text-muted-foreground/40" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    </div>
                  </div>
                  <p className="font-semibold text-foreground mb-1">Your inbox is empty</p>
                  <p className="text-sm text-muted-foreground">Waiting for incoming emails…</p>
                  <p className="text-xs text-muted-foreground/60 mt-2">Auto-refreshing every {countdown} seconds</p>
                </div>
              ) : (
                emails.map((email, i) => (
                  <motion.div
                    key={email.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => openEmailDetail(email)}
                    className="grid grid-cols-12 gap-2 px-4 py-3.5 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-mono text-xs truncate text-muted-foreground">{email.from}</span>
                    </div>
                    <div className="col-span-6 flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate font-medium">{email.subject}</span>
                      {email.hasOtp && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20 shrink-0 animate-pulse">
                          OTP: {email.otpCode}
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground text-right flex items-center justify-end">
                      <Clock size={10} className="mr-1" />
                      {new Date(email.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm mb-4">Want to save emails, extract OTPs, and manage multiple inboxes?</p>
            <Link href="/sign-up">
              <Button className="gap-2 h-11 px-8">
                Create free account <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Email Detail Modal */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setSelectedEmail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border/40 px-6 py-4 flex items-center justify-between z-10">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{selectedEmail.subject}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">From {selectedEmail.from}</p>
                </div>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* OTP Banner */}
                {selectedEmail.hasOtp && selectedEmail.otpCode && (
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Key size={18} className="text-primary" />
                      </div>
                      <div>
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-xs mb-1">OTP DETECTED</Badge>
                        <span className="font-mono text-2xl font-bold tracking-[0.15em] text-foreground block">{selectedEmail.otpCode}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedEmail.otpCode!);
                        toast.success("OTP copied!");
                      }}
                      className="gap-1.5 shrink-0"
                    >
                      <Copy size={13} /> Copy
                    </Button>
                  </div>
                )}

                {/* Email Body */}
                <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/30">
                    <span className="text-xs text-muted-foreground font-medium">Message</span>
                    <span className="text-xs text-muted-foreground">{new Date(selectedEmail.createdAt).toLocaleString()}</span>
                  </div>

                  {emailDetailLoading ? (
                    <div className="p-6 space-y-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                      ))}
                    </div>
                  ) : selectedEmail.bodyHtml ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={buildIframeContent(selectedEmail.bodyHtml)}
                      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      onLoad={handleIframeLoad}
                      style={{ width: "100%", height: `${iframeHeight}px`, border: "none", display: "block" }}
                      title="Email content"
                    />
                  ) : selectedEmail.bodyText ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed p-6">
                      {selectedEmail.bodyText}
                    </pre>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mail size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm italic">This email has no readable content.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>Received securely via TempNest</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Next-gen throwaway inboxes
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-balance text-foreground">
              Disposable emails for <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                power users.
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
              Instant, secure, and API-ready temporary inboxes. Built for speed, designed for privacy. No data harvesting.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] transition-shadow">
                  Start For Free
                </Button>
              </Link>
              <a href="#try-it">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base">
                  Try it now — no signup
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Try It Section */}
      <TryItSection />

      {/* Features */}
      <section id="features" className="py-24 bg-card/30 border-y border-border/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Engineered for speed.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to bypass spam, verify accounts, and protect your identity.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: Zap,
                title: "Instant Setup",
                desc: "Generate a new inbox in milliseconds. Emails arrive in real-time with automatic 30-second polling.",
                color: "text-amber-400",
                bg: "bg-amber-400/10",
              },
              {
                icon: Key,
                title: "Auto OTP Extraction",
                desc: "We automatically find and highlight verification codes so you can copy them with one click.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                icon: Shield,
                title: "Privacy First",
                desc: "No tracking scripts. Emails are automatically wiped after they expire. You own your data.",
                color: "text-emerald-400",
                bg: "bg-emerald-400/10",
              },
              {
                icon: Lock,
                title: "Credit-Based Fair Use",
                desc: "Transparent pricing with credits. Free plan gives 20 credits/day. No hidden fees, ever.",
                color: "text-violet-400",
                bg: "bg-violet-400/10",
              },
              {
                icon: Globe,
                title: "Real Mail.tm Backend",
                desc: "Powered by Mail.tm — a real email service. Emails actually arrive, no simulation.",
                color: "text-cyan-400",
                bg: "bg-cyan-400/10",
              },
              {
                icon: Mail,
                title: "Multi-Inbox Management",
                desc: "Pro users can manage 5 inboxes simultaneously. Business gets unlimited. Full email history kept.",
                color: "text-rose-400",
                bg: "bg-rose-400/10",
              },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors">
                <div className={`w-12 h-12 rounded-lg ${f.bg} flex items-center justify-center ${f.color} mb-6`}>
                  <f.icon size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to protect your real inbox?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Join thousands of users who use TempNest to keep spam out and stay anonymous online.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 px-8">Get Started Free</Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="h-12 px-8">View Pricing</Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
