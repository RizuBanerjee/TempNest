import { Router } from "express";
import { db, usersTable, inboxesTable, emailsTable, paymentsTable, creditTransactionsTable } from "@workspace/db";
import { eq, ilike, or, count, desc, gte } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { getAuth, clerkClient } from "@clerk/express";

const router = Router();

// Claim admin — grants admin to the calling user if no admin exists yet
// or if ADMIN_EMAIL env var matches their verified Clerk email
router.post("/claim", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const auth = getAuth(req);

    const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    if (!user[0]) { res.status(404).json({ error: "User not found" }); return; }

    // Fetch real email from Clerk API since sessionClaims may not include it
    let clerkEmail = "";
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      clerkEmail = clerkUser?.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
        || clerkUser?.emailAddresses?.[0]?.emailAddress
        || "";
    } catch (e) {
      req.log.warn({ err: e }, "Could not fetch Clerk user email");
    }

    const adminEmail = process.env.ADMIN_EMAIL || "rizubanerjee456@gmail.com";
    const [existingAdmin] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isAdmin, true));
    const adminCount = Number(existingAdmin?.count || 0);

    const canClaim = adminCount === 0 || (adminEmail && adminEmail === clerkEmail);
    if (!canClaim) {
      res.status(403).json({ error: "Admin already exists or you are not authorized" }); return;
    }

    // Also update the user's email in DB if we got a real one from Clerk
    const updates: any = { isAdmin: true, updatedAt: new Date() };
    if (clerkEmail && user[0].email.includes("@noemail.tempnest.internal")) {
      updates.email = clerkEmail;
    }

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.clerkId, clerkId))
      .returning();

    res.json({ success: true, isAdmin: updated.isAdmin });
  } catch (err) {
    req.log.error({ err }, "Failed to claim admin");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const [activeUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "active"));
    const [totalInboxes] = await db.select({ count: count() }).from(inboxesTable);
    const [totalEmails] = await db.select({ count: count() }).from(emailsTable);
    const [proUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "pro"));
    const [businessUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "business"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [newToday] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, today));
    const [emailsToday] = await db.select({ count: count() }).from(emailsTable).where(gte(emailsTable.receivedAt, today));

    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "completed"));
    const totalRevenue = payments.reduce((a, p) => a + p.amount, 0);

    const allTxns = await db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.type, "credit"));
    const creditsIssued = allTxns.reduce((a, t) => a + t.amount, 0);

    res.json({
      totalUsers: Number(totalUsers?.count || 0),
      activeUsers: Number(activeUsers?.count || 0),
      totalInboxes: Number(totalInboxes?.count || 0),
      totalEmails: Number(totalEmails?.count || 0),
      totalRevenue,
      creditsIssued,
      proUsers: Number(proUsers?.count || 0),
      businessUsers: Number(businessUsers?.count || 0),
      newUsersToday: Number(newToday?.count || 0),
      emailsToday: Number(emailsToday?.count || 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const pageNum = parseInt((req.query.page as string) || "1") || 1;
    const pageSize = 20;
    const offset = (pageNum - 1) * pageSize;

    const users = await db.select().from(usersTable)
      .where(search ? or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`)) : undefined)
      .orderBy(desc(usersTable.createdAt)).limit(pageSize).offset(offset);
    const [totalCount] = await db.select({ count: count() }).from(usersTable);

    const result = await Promise.all(users.map(async (u) => {
      const [inboxCount] = await db.select({ count: count() }).from(inboxesTable).where(eq(inboxesTable.userId, u.id));
      const [emailCount] = await db.select({ count: count() }).from(emailsTable).where(eq(emailsTable.userId, u.id));
      return {
        id: u.id, clerkId: u.clerkId, email: u.email, name: u.name, plan: u.plan,
        credits: u.credits, status: u.status, isAdmin: u.isAdmin,
        inboxCount: Number(inboxCount?.count || 0),
        emailCount: Number(emailCount?.count || 0),
        createdAt: u.createdAt.toISOString(),
      };
    }));

    res.json({ users: result, total: Number(totalCount?.count || 0), page: pageNum, pageSize });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const { status, grantCredits, plan } = req.body;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (plan) updates.plan = plan;
    if (grantCredits) updates.credits = Math.min(user.credits + grantCredits, user.maxCredits);

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();

    res.json({
      id: updated.id, clerkId: updated.clerkId, email: updated.email, name: updated.name,
      plan: updated.plan, credits: updated.credits, status: updated.status, isAdmin: updated.isAdmin,
      inboxCount: 0, emailCount: 0, createdAt: updated.createdAt!.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update admin user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete admin user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/inboxes", requireAdmin, async (req, res) => {
  try {
    const pageNum = parseInt((req.query.page as string) || "1") || 1;
    const pageSize = 20;
    const offset = (pageNum - 1) * pageSize;

    const inboxes = await db.select({
      inbox: inboxesTable,
      user: usersTable,
    }).from(inboxesTable)
      .leftJoin(usersTable, eq(inboxesTable.userId, usersTable.id))
      .orderBy(desc(inboxesTable.createdAt))
      .limit(pageSize).offset(offset);

    const [totalCount] = await db.select({ count: count() }).from(inboxesTable);

    const result = await Promise.all(inboxes.map(async ({ inbox, user: u }) => {
      const [emailCount] = await db.select({ count: count() }).from(emailsTable).where(eq(emailsTable.inboxId, inbox.id));
      return {
        id: inbox.id, address: inbox.address, userId: inbox.userId,
        userEmail: u?.email || "unknown", isActive: inbox.isActive,
        emailCount: Number(emailCount?.count || 0),
        createdAt: inbox.createdAt.toISOString(),
      };
    }));

    res.json({ inboxes: result, total: Number(totalCount?.count || 0), page: pageNum, pageSize });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin inboxes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/revenue", requireAdmin, async (req, res) => {
  try {
    const payments = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.status, "completed"))
      .orderBy(desc(paymentsTable.createdAt));

    const totalRevenue = payments.reduce((a, p) => a + p.amount, 0);

    const monthly: Record<string, { revenue: number; transactions: number }> = {};
    payments.forEach(p => {
      const key = p.createdAt.toISOString().substring(0, 7);
      if (!monthly[key]) monthly[key] = { revenue: 0, transactions: 0 };
      monthly[key].revenue += p.amount;
      monthly[key].transactions++;
    });

    const monthlyArr = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    const [freeCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "free"));
    const [proCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "pro"));
    const [bizCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "business"));
    const total = Number(freeCount?.count || 0) + Number(proCount?.count || 0) + Number(bizCount?.count || 0);

    const planDistribution = [
      { plan: "free", count: Number(freeCount?.count || 0), percentage: total ? (Number(freeCount?.count || 0) / total) * 100 : 0 },
      { plan: "pro", count: Number(proCount?.count || 0), percentage: total ? (Number(proCount?.count || 0) / total) * 100 : 0 },
      { plan: "business", count: Number(bizCount?.count || 0), percentage: total ? (Number(bizCount?.count || 0) / total) * 100 : 0 },
    ];

    res.json({ totalRevenue, monthly: monthlyArr, planDistribution });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin revenue");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
