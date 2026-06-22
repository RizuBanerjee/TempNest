import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, creditTransactionsTable, inboxesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req);
    const clerkId = auth!.userId!;
    const email = (auth?.sessionClaims?.email as string) || (auth?.sessionClaims?.primaryEmail as string) || "";
    const name = (auth?.sessionClaims?.fullName as string) || (auth?.sessionClaims?.firstName as string) || "";

    const user = await getOrCreateUser(clerkId, email, name);

    // Daily credit refill logic
    const now = new Date();
    const lastRefill = user.lastRefillAt;
    const shouldRefill = !lastRefill || (now.getTime() - lastRefill.getTime()) >= 24 * 60 * 60 * 1000;

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
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
