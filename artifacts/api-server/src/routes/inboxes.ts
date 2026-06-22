import { Router } from "express";
import { db, usersTable, inboxesTable, emailsTable, otpRecordsTable, creditTransactionsTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";
import {
  getDomains, createAccount, getToken, deleteAccount,
  getMessages, getMessage, generatePassword, generateUsername, extractOtp
} from "../lib/mailtm";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", (auth?.sessionClaims?.fullName as string) || "");

    const inboxes = await db.select().from(inboxesTable)
      .where(and(eq(inboxesTable.userId, user.id), eq(inboxesTable.isActive, true)))
      .orderBy(desc(inboxesTable.createdAt));

    const result = await Promise.all(inboxes.map(async (inbox) => {
      const [emailCount] = await db.select({ count: count() }).from(emailsTable).where(eq(emailsTable.inboxId, inbox.id));
      const [unreadCount] = await db.select({ count: count() }).from(emailsTable)
        .where(and(eq(emailsTable.inboxId, inbox.id), eq(emailsTable.isRead, false)));
      return {
        id: inbox.id, address: inbox.address, domain: inbox.domain,
        isActive: inbox.isActive, isPriority: inbox.isPriority,
        expiresAt: inbox.expiresAt?.toISOString() ?? null,
        createdAt: inbox.createdAt.toISOString(),
        emailCount: Number(emailCount?.count || 0),
        unreadCount: Number(unreadCount?.count || 0),
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list inboxes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", (auth?.sessionClaims?.fullName as string) || "");

    if (user.status !== "active") { res.status(403).json({ error: "Account suspended" }); return; }

    const { customName, isPriority } = req.body;

    const isAdmin = user.isAdmin;
    let creditCost = 2;
    if (customName) creditCost += 5;
    if (isPriority) creditCost += 10;

    if (!isAdmin && user.credits < creditCost) {
      res.status(400).json({ error: "Insufficient credits", required: creditCost, available: user.credits }); return;
    }

    const [inboxCount] = await db.select({ count: count() }).from(inboxesTable)
      .where(and(eq(inboxesTable.userId, user.id), eq(inboxesTable.isActive, true)));
    if (!isAdmin && Number(inboxCount?.count || 0) >= user.maxInboxes) {
      res.status(400).json({ error: "Inbox limit reached. Upgrade your plan for more inboxes." }); return;
    }

    let domain = "mail.tm";
    try {
      const domains = await getDomains();
      if (domains.length > 0) domain = domains[0].domain;
    } catch (_) {}

    const username = generateUsername(customName);
    const address = `${username}@${domain}`;
    const password = generatePassword();

    let accountId = `local_${Date.now()}`;
    let token: string | undefined;
    try {
      const account = await createAccount(address, password);
      accountId = account.id;
      token = await getToken(address, password);
    } catch (err) {
      req.log.warn({ err }, "mail.tm account creation failed, using local fallback");
    }

    if (!isAdmin) {
      const newCredits = user.credits - creditCost;
      await db.update(usersTable).set({ credits: newCredits, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      await db.insert(creditTransactionsTable).values({
        userId: user.id, type: "debit", amount: creditCost,
        description: `Created inbox ${address}`, balanceAfter: newCredits,
      });
    }

    const [inbox] = await db.insert(inboxesTable).values({
      id: accountId, userId: user.id, address, domain, password,
      mailtmToken: token, isActive: true, isPriority: isPriority || false,
    }).returning();

    res.status(201).json({
      id: inbox.id, address: inbox.address, domain: inbox.domain,
      isActive: inbox.isActive, isPriority: inbox.isPriority,
      expiresAt: inbox.expiresAt?.toISOString() ?? null,
      createdAt: inbox.createdAt.toISOString(),
      emailCount: 0, unreadCount: 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create inbox");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:inboxId", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const inboxId = req.params.inboxId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", "");

    const [inbox] = await db.select().from(inboxesTable)
      .where(and(eq(inboxesTable.id, inboxId), eq(inboxesTable.userId, user.id)));
    if (!inbox) { res.status(404).json({ error: "Not found" }); return; }

    const [emailCount] = await db.select({ count: count() }).from(emailsTable).where(eq(emailsTable.inboxId, inbox.id));
    const [unreadCount] = await db.select({ count: count() }).from(emailsTable)
      .where(and(eq(emailsTable.inboxId, inbox.id), eq(emailsTable.isRead, false)));

    res.json({
      id: inbox.id, address: inbox.address, domain: inbox.domain,
      isActive: inbox.isActive, isPriority: inbox.isPriority,
      expiresAt: inbox.expiresAt?.toISOString() ?? null,
      createdAt: inbox.createdAt.toISOString(),
      emailCount: Number(emailCount?.count || 0),
      unreadCount: Number(unreadCount?.count || 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get inbox");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:inboxId", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const inboxId = req.params.inboxId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", "");

    const [inbox] = await db.select().from(inboxesTable)
      .where(and(eq(inboxesTable.id, inboxId), eq(inboxesTable.userId, user.id)));
    if (!inbox) { res.status(404).json({ error: "Not found" }); return; }

    if (inbox.mailtmToken) {
      try { await deleteAccount(inboxId, inbox.mailtmToken); } catch (_) {}
    }

    await db.update(inboxesTable).set({ isActive: false }).where(eq(inboxesTable.id, inboxId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete inbox");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:inboxId/refresh", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const inboxId = req.params.inboxId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", "");

    const isAdmin = user.isAdmin;
    if (!isAdmin && user.credits < 1) { res.status(400).json({ error: "Insufficient credits" }); return; }

    const [inbox] = await db.select().from(inboxesTable)
      .where(and(eq(inboxesTable.id, inboxId), eq(inboxesTable.userId, user.id)));
    if (!inbox) { res.status(404).json({ error: "Not found" }); return; }

    if (!isAdmin) {
      const newCredits = user.credits - 1;
      await db.update(usersTable).set({ credits: newCredits, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      await db.insert(creditTransactionsTable).values({
        userId: user.id, type: "debit", amount: 1,
        description: `Refreshed inbox ${inbox.address}`, balanceAfter: newCredits,
      });
    }

    let token = inbox.mailtmToken;
    if (!token && !inbox.id.startsWith("local_")) {
      try {
        token = await getToken(inbox.address, inbox.password);
        await db.update(inboxesTable).set({ mailtmToken: token }).where(eq(inboxesTable.id, inbox.id));
      } catch (_) {}
    }

    let newEmailCount = 0;
    if (token) {
      const messages = await getMessages(token);
      const existing = await db.select({ id: emailsTable.id }).from(emailsTable).where(eq(emailsTable.inboxId, inbox.id));
      const existingIds = new Set(existing.map(e => e.id));

      for (const msg of messages) {
        if (existingIds.has(msg.id)) continue;

        // Fetch the full message to get HTML body (list endpoint only has intro/preview)
        let fullMsg = msg;
        try {
          const fetched = await getMessage(token, msg.id);
          if (fetched) fullMsg = fetched;
        } catch (_) {}

        const bodyText = fullMsg.text || fullMsg.intro || msg.text || msg.intro || "";
        const bodyHtml = fullMsg.html?.[0] || msg.html?.[0] || null;
        const otpCode = extractOtp(bodyText);

        await db.insert(emailsTable).values({
          id: msg.id, inboxId: inbox.id, userId: user.id,
          fromAddress: msg.from.address, subject: msg.subject || "(no subject)",
          preview: (msg.intro || bodyText || "").substring(0, 200),
          bodyText, bodyHtml,
          isRead: false, hasOtp: !!otpCode, otpCode,
          receivedAt: new Date(msg.createdAt),
        }).onConflictDoNothing();

        if (otpCode) {
          await db.insert(otpRecordsTable).values({
            emailId: msg.id, userId: user.id, code: otpCode, length: otpCode.length
          }).onConflictDoNothing();
        }
        newEmailCount++;
      }
    }

    const [emailCount] = await db.select({ count: count() }).from(emailsTable).where(eq(emailsTable.inboxId, inbox.id));
    const [unreadCount] = await db.select({ count: count() }).from(emailsTable)
      .where(and(eq(emailsTable.inboxId, inbox.id), eq(emailsTable.isRead, false)));

    res.json({
      newEmails: newEmailCount,
      inbox: {
        id: inbox.id, address: inbox.address, domain: inbox.domain,
        isActive: inbox.isActive, isPriority: inbox.isPriority,
        expiresAt: inbox.expiresAt?.toISOString() ?? null,
        createdAt: inbox.createdAt.toISOString(),
        emailCount: Number(emailCount?.count || 0),
        unreadCount: Number(unreadCount?.count || 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to refresh inbox");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:inboxId/emails", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const inboxId = req.params.inboxId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", "");

    const [inbox] = await db.select().from(inboxesTable)
      .where(and(eq(inboxesTable.id, inboxId), eq(inboxesTable.userId, user.id)));
    if (!inbox) { res.status(404).json({ error: "Not found" }); return; }

    const emails = await db.select().from(emailsTable)
      .where(eq(emailsTable.inboxId, inboxId))
      .orderBy(desc(emailsTable.receivedAt));

    res.json(emails.map(e => ({
      id: e.id, inboxId: e.inboxId, from: e.fromAddress, subject: e.subject,
      preview: e.preview, isRead: e.isRead, hasOtp: e.hasOtp, otpCode: e.otpCode,
      createdAt: e.receivedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list inbox emails");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:inboxId/otp-history", requireAuth, async (req, res) => {
  try {
    const clerkId = (req as any).clerkId as string;
    const inboxId = req.params.inboxId as string;
    const auth = getAuth(req);
    const user = await getOrCreateUser(clerkId, (auth?.sessionClaims?.email as string) || "", "");

    const [inbox] = await db.select().from(inboxesTable)
      .where(and(eq(inboxesTable.id, inboxId), eq(inboxesTable.userId, user.id)));
    if (!inbox) { res.status(404).json({ error: "Not found" }); return; }

    const otps = await db.select().from(otpRecordsTable)
      .where(eq(otpRecordsTable.userId, user.id))
      .orderBy(desc(otpRecordsTable.extractedAt))
      .limit(50);

    res.json(otps.map(o => ({
      id: o.id, emailId: o.emailId, code: o.code, length: o.length,
      extractedAt: o.extractedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get OTP history");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
