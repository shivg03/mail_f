import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const labels = pgTable("labels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("bg-blue-400"),
  isVisible: boolean("is_visible").default(true),
  showIfUnread: boolean("show_if_unread").default(false),
  showInMessageList: boolean("show_in_message_list").default(true),
});

export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  sender: text("sender").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  isStarred: boolean("is_starred").default(false),
  isImportant: boolean("is_important").default(false),
  isSnoozed: boolean("is_snoozed").default(false),
  isTask: boolean("is_task").default(false),
  isAddToTask: boolean("is_add_to_task").default(false),
  isMuted: boolean("is_muted").default(false),
  isMute: boolean("is_mute").default(false),
  isSpam: boolean("is_spam").default(false),
  isArchived: boolean("is_archived").default(false),
  isTrash: boolean("is_trash").default(false),
  snoozeUntil: timestamp("snooze_until"),
  labels: text("labels").array().default([]), // Array of custom labels
  category: text("category").default("primary"), // primary, promotions, social, updates, snoozed, tasks
  timestamp: timestamp("timestamp").defaultNow(),
  attachments: text("attachments").array().default([]), // Array of attachment URLs/paths
});

export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  domain: text("domain").notNull(),
  isRestricted: boolean("is_restricted").default(false),
  incomingMailSuspended: boolean("incoming_mail_suspended").default(false),
  outgoingEmailSuspended: boolean("outgoing_email_suspended").default(false),
  holdMail: boolean("hold_mail").default(false),
  storageUsed: real("storage_used").default(0), // in MB
  storageAllocated: real("storage_allocated").default(1024), // in MB
  storagePercentage: real("storage_percentage").default(0),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertLabelSchema = createInsertSchema(labels).pick({
  name: true,
  color: true,
  isVisible: true,
  showIfUnread: true,
  showInMessageList: true,
});

export const insertEmailSchema = createInsertSchema(emails).pick({
  sender: true,
  recipient: true,
  subject: true,
  content: true,
  category: true,
  attachments: true,
});

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).pick({
  email: true,
  domain: true,
  isRestricted: true,
  incomingMailSuspended: true,
  outgoingEmailSuspended: true,
  holdMail: true,
  storageUsed: true,
  storageAllocated: true,
  storagePercentage: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLabel = z.infer<typeof insertLabelSchema>;
export type Label = typeof labels.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;
