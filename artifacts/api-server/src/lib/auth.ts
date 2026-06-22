import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkId = clerkId;
  next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user[0] || !user[0].isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).clerkId = clerkId;
  (req as any).dbUser = user[0];
  next();
};

export const getOrCreateUser = async (clerkId: string, email: string, name: string) => {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing[0]) {
    const user = existing[0];
    // Backfill email if it was previously empty
    if (!user.email && email) {
      await db.update(usersTable).set({ email, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      user.email = email;
    }
    return user;
  }

  const [newUser] = await db.insert(usersTable).values({
    clerkId,
    email,
    name: name || email.split("@")[0],
    plan: "free",
    credits: 50,
    maxCredits: 50,
    dailyRefill: 20,
    maxInboxes: 1,
    status: "active",
    isAdmin: false,
  }).returning();
  return newUser;
};
