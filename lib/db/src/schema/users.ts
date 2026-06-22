import { pgTable, text, integer, boolean, timestamp, serial, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planEnum = pgEnum("plan", ["free", "pro", "business"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "banned"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  plan: planEnum("plan").notNull().default("free"),
  credits: integer("credits").notNull().default(50),
  maxCredits: integer("max_credits").notNull().default(50),
  dailyRefill: integer("daily_refill").notNull().default(20),
  maxInboxes: integer("max_inboxes").notNull().default(1),
  status: userStatusEnum("status").notNull().default("active"),
  isAdmin: boolean("is_admin").notNull().default(false),
  lastRefillAt: timestamp("last_refill_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
