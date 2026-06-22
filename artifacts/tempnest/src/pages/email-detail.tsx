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
    font-size: 14px;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
    margin: 0;
    padding: 16px;
    user-select: text;
    cursor: auto;
    overflow-x: hidden;
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

export default function EmailDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [otpCopied, setOtpCopied] = useState(false);
  const [bodyCopied, setBodyCopied] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();

  const { data: email, isLoading } = useGetEmail(id);
  const markRead = useMarkEmailRead();
  const extractOtp = useExtractEmailOtp(id);

  // Auto-resize iframe to content height
  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 200);
        setIframeHeight(height + 32);
      }
    } catch (_) {}
  };

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

  function copyBodyText() {
    const text = email?.bodyText || "";
    navigator.clipboard.writeText(text);
    setBodyCopied(true);
    setTimeout(() => setBodyCopied(false), 2000);
    toast.success("Email text copied");
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
            <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/30">
                <span className="text-xs text-muted-foreground font-medium">Message</span>
                <Button variant="ghost" size="sm" onClick={copyBodyText} className="h-7 gap-1.5 text-xs">
                  {bodyCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {bodyCopied ? "Copied!" : "Copy text"}
                </Button>
              </div>

              {email?.bodyHtml ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={buildIframeContent(email.bodyHtml)}
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  onLoad={handleIframeLoad}
                  style={{ width: "100%", height: `${iframeHeight}px`, border: "none", display: "block" }}
                  title="Email content"
                />
              ) : email?.bodyText ? (
                <pre
                  className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed p-6"
                  style={{ userSelect: "text", cursor: "auto" }}
                >
                  {email.bodyText}
                </pre>
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
