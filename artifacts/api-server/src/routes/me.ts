import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable, creditTransactionsTable, inboxesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req);
    const clerkId = auth!.userId!;
    let email = (auth?.sessionClaims?.email as string) || (auth?.sessionClaims?.primaryEmail as string) || "";
    const name = (auth?.sessionClaims?.fullName as string) || (auth?.sessionClaims?.firstName as string) || "";

    // If sessionClaims doesn't have email, try fetching from Clerk API
    if (!email) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        email = clerkUser?.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
          || clerkUser?.emailAddresses?.[0]?.emailAddress
          || "";
      } catch (e) {
        req.log.warn({ err: e }, "Could not fetch Clerk user email");
      }
    }

    const user = await getOrCreateUser(clerkId, email, name);

    // If the DB email is a placeholder and we now have a real one, update it
    if (email && user.email.includes("@noemail.tempnest.internal") && email !== user.email) {
      await db.update(usersTable).set({ email, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user.email = email;
    }

    // Daily credit refill logic:
    // - Use lastRefillAt if set; fall back to createdAt for existing users without it.
    // - This prevents new users from getting an immediate refill (their lastRefillAt is set at creation).
    // - Old users with null lastRefillAt will refill once createdAt is 24h+ in the past.
    const now = new Date();
    const refillBasis = user.lastRefillAt || user.createdAt;
    const hoursSince = (now.getTime() - refillBasis.getTime()) / (1000 * 60 * 60);
    const shouldRefill = hoursSince >= 24;

    if (shouldRefill && user.credits < user.maxCredits) {
      const newCredits = Math.min(user.credits + user.dailyRefill, user.maxCredits);
      const refillAmount = newCredits - user.credits;
      if (refillAmount > 0) {
        await db.update(usersTable).set({ credits: newCredits, lastRefillAt: now, updatedAt: now }).where(eq(usersTable.id, user.id));
        await db.insert(creditTransactionsTable).values({
          userId: user.id,
          type: "refill",
          amount: refillAmount,
          description: "Daily credit refill",
          balanceAfter: newCredits,
        });
        user.credits = newCredits;
        user.lastRefillAt = now;
      }
    }

    const [inboxCount] = await db.select({ count: count() }).from(inboxesTable).where(eq(inboxesTable.userId, user.id));

    res.json({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      plan: user.plan,
      credits: user.credits,
      maxCredits: user.maxCredits,
      dailyRefill: user.dailyRefill,
      activeInboxCount: Number(inboxCount?.count || 0),
      maxInboxes: user.maxInboxes,
      status: user.status,
      isAdmin: user.isAdmin,
      notifyNewEmail: user.notifyNewEmail,
      notifyOtp: user.notifyOtp,
      notifyLowCredits: user.notifyLowCredits,
      notifyWeeklySummary: user.notifyWeeklySummary,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId;
    const { name } = req.body;

    const [user] = await db.update(usersTable)
      .set({ name: name || "", updatedAt: new Date() })
      .where(eq(usersTable.clerkId, clerkId))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    res.json({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      plan: user.plan,
      credits: user.credits,
      maxCredits: user.maxCredits,
      dailyRefill: user.dailyRefill,
      activeInboxCount: 0,
      maxInboxes: user.maxInboxes,
      status: user.status,
      isAdmin: user.isAdmin,
      notifyNewEmail: user.notifyNewEmail,
      notifyOtp: user.notifyOtp,
      notifyLowCredits: user.notifyLowCredits,
      notifyWeeklySummary: user.notifyWeeklySummary,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId;
    const { notifyNewEmail, notifyOtp, notifyLowCredits, notifyWeeklySummary } = req.body;

    const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (typeof notifyNewEmail === "boolean") updates.notifyNewEmail = notifyNewEmail;
    if (typeof notifyOtp === "boolean") updates.notifyOtp = notifyOtp;
    if (typeof notifyLowCredits === "boolean") updates.notifyLowCredits = notifyLowCredits;
    if (typeof notifyWeeklySummary === "boolean") updates.notifyWeeklySummary = notifyWeeklySummary;

    const [user] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.clerkId, clerkId))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    res.json({
      notifyNewEmail: user.notifyNewEmail,
      notifyOtp: user.notifyOtp,
      notifyLowCredits: user.notifyLowCredits,
      notifyWeeklySummary: user.notifyWeeklySummary,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
