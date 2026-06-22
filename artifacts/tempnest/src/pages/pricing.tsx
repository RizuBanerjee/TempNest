import { useListPlans, useCreateCheckoutSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Logo } from "@/components/logo";
import { BackButton } from "@/components/back-button";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["1 active inbox", "100 credit cap", "20 daily credit refill", "7-day email history", "OTP detection"],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9.99",
    period: "/month",
    features: ["5 active inboxes", "1,000 credits/month", "Unlimited email history", "Priority inbox processing", "Custom inbox names", "OTP history", "Priority support"],
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$29.99",
    period: "/month",
    features: ["Unlimited inboxes", "5,000 credits/month", "Unlimited email history", "API access", "Advanced analytics", "Custom domains", "Dedicated support"],
    highlight: false,
  },
];

export default function Pricing() {
  const checkout = useCreateCheckoutSession();

  async function subscribe(planId: string) {
    if (planId === "free") {
      window.location.href = "/sign-up";
      return;
    }
    try {
      const result = await checkout.mutateAsync({ data: { type: "subscription", planId } });
      if (result.url) window.location.href = result.url;
    } catch {
      toast.error("Stripe is not configured yet.");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="h-16 border-b border-border/40 flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <Logo />
        </div>
        <div className="flex gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free. Upgrade when you need more power. No surprises.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-8 ${
                plan.highlight
                  ? "border-primary/50 bg-primary/5 shadow-[0_0_40px_rgba(124,58,237,0.15)]"
                  : "border-border/60 bg-card"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 flex items-center gap-1">
                    <Zap size={11} /> Most Popular
                  </Badge>
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm mb-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check size={14} className="text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.highlight ? "default" : "outline"}
                onClick={() => subscribe(plan.id)}
                disabled={checkout.isPending}
              >
                {plan.id === "free" ? "Get Started Free" : `Subscribe to ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
