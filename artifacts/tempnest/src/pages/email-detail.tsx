import { useState, useEffect, useRef } from "react";
import { useGetEmail, useMarkEmailRead, useExtractEmailOtp, getGetEmailQueryKey } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Copy, Check, Key, Mail, Clock, Shield } from "lucide-react";

function processHtmlForDisplay(html: string): string {
  // Add target="_blank" and rel="noopener noreferrer" to all links
  // Ensure links are styled and clickable
  let processed = html.replace(
    /<a\s+([^>]*)href="([^"]*)"([^>]*)>/gi,
    '<a $1href="$2"$3 target="_blank" rel="noopener noreferrer">'
  );
  // Add inline style to ensure text selection works
  processed = processed.replace(
    /<body/i,
    '<body style="user-select:text;cursor:auto;"'
  );
  return processed;
}

export default function EmailDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [otpCopied, setOtpCopied] = useState(false);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: email, isLoading } = useGetEmail(id);
  const markRead = useMarkEmailRead();
  const extractOtp = useExtractEmailOtp(id);

  // Lazily fetch full HTML body if only preview is available
  useEffect(() => {
    if (!email) return;
    if (email.bodyHtml) {
      setBodyHtml(processHtmlForDisplay(email.bodyHtml));
      return;
    }
    // If only text available, use text display
    if (!email.bodyHtml && email.bodyText) {
      setBodyHtml(null);
    }
  }, [email?.id, email?.bodyHtml]);

  // Post-process rendered HTML to ensure links are clickable
  useEffect(() => {
    if (!bodyRef.current) return;
    const links = bodyRef.current.querySelectorAll("a");
    links.forEach((a) => {
      if (!a.getAttribute("target")) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
      a.style.color = "hsl(260, 80%, 65%)";
      a.style.textDecoration = "underline";
      a.style.cursor = "pointer";
    });
  }, [bodyHtml, email?.bodyHtml]);

  useEffect(() => {
    if (email && !email.isRead) {
      markRead.mutate({ emailId: id, data: { isRead: true } });
    }
  }, [email?.id]);

  function copyOtp(code: string) {
    navigator.clipboard.writeText(code);
    setOtpCopied(true);
    setTimeout(() => setOtpCopied(false), 2000);
    toast.success("OTP copied to clipboard");
  }

  async function handleExtractOtp() {
    try {
      const result = await extractOtp.refetch();
      queryClient.invalidateQueries({ queryKey: getGetEmailQueryKey(id) });
      if (result.data?.found) {
        toast.success(`OTP found: ${result.data.code}`);
      } else {
        toast.info("No OTP detected in this email");
      }
    } catch {
      toast.error("Failed to extract OTP");
    }
  }

  const otp = email?.otpCode || (extractOtp.data?.found ? extractOtp.data.code : null);
  const displayBody = bodyHtml || email?.bodyHtml || null;
  const displayText = email?.bodyText || null;

  return (
    <MainLayout>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <BackButton />
          </div>

          {/* Subject */}
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-80 mb-2" />
            ) : (
              <h1 className="text-xl font-semibold text-foreground">{email?.subject || "(no subject)"}</h1>
            )}
          </div>

          {/* OTP Banner */}
          {(email?.hasOtp || otp) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl border border-primary/40 bg-primary/5 p-5"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.1),transparent)] pointer-events-none" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Key size={20} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">OTP DETECTED</Badge>
                    </div>
                    {otp && (
                      <span className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground">{otp}</span>
                    )}
                  </div>
                </div>
                {otp && (
                  <Button onClick={() => copyOtp(otp)} className="gap-2 shrink-0">
                    {otpCopied ? <Check size={14} /> : <Copy size={14} />}
                    {otpCopied ? "Copied!" : "Copy Code"}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Email Metadata */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Mail size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{email?.from || "Unknown sender"}</p>
                    <p className="text-xs text-muted-foreground">Sender</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} />
                  {email?.createdAt ? new Date(email.createdAt).toLocaleString() : ""}
                </div>
              </div>

              {!email?.hasOtp && (
                <div className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Key size={14} />
                    <span>No OTP detected automatically</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExtractOtp} disabled={extractOtp.isFetching} className="gap-1.5">
                    <Key size={13} />
                    {extractOtp.isFetching ? "Scanning..." : "Scan for OTP"}
                  </Button>
                </div>
              )}

              <div className="px-5 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={12} className="text-emerald-400" />
                <span>This email was received securely via TempNest</span>
                <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {email?.isRead ? "Read" : "Unread"}
                </Badge>
              </div>
            </div>
          )}

          {/* Email Body */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-6">
              {displayBody ? (
                <div
                  ref={bodyRef}
                  className="prose prose-sm dark:prose-invert max-w-none email-body"
                  style={{ userSelect: "text", cursor: "auto" }}
                  dangerouslySetInnerHTML={{ __html: displayBody }}
                />
              ) : displayText ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed" style={{ userSelect: "text" }}>{displayText}</pre>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm italic">This email has no readable content.</p>
                </div>
              )}
            </div>
          )}

          {/* Email Info Footer */}
          {!isLoading && email && (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground/80">Inbox:</span> {email.inboxId}</p>
              <p><span className="font-medium text-foreground/80">Email ID:</span> {email.id}</p>
              <p><span className="font-medium text-foreground/80">Received:</span> {new Date(email.createdAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
