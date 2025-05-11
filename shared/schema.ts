import { pgTable, text, serial, integer, timestamp, jsonb, real, varchar, index, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles
export enum UserRole {
  ADMIN = "admin",
  INSTALLER = "installer",
}

// User status
export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

// Transaction types
export enum TransactionType {
  EARNING = "earning",
  REDEMPTION = "redemption",
}

// Activity types
export enum ActivityType {
  INSTALLATION = "installation",
  MAINTENANCE = "maintenance",
  TRAINING = "training",
  OTHER = "other",
}

// Reward types
export enum RewardType {
  VOUCHER = "voucher",
  PRODUCT = "product",
  TRAVEL = "travel",
  OTHER = "other",
}

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(), // Egyptian phone numbers, required for authentication
  region: text("region"),
  role: text("role").notNull().default(UserRole.INSTALLER),
  status: text("status").notNull().default(UserStatus.ACTIVE), // Changed default to ACTIVE since we're using direct auth
  points: integer("points").notNull().default(0),
  invitedBy: integer("invited_by").references(() => users.id),
  level: integer("level").notNull().default(1),
  badgeIds: jsonb("badge_ids").default([]),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Magic links table
export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  phone: text("phone").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: integer("used").notNull().default(0),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rewards table
export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  points: integer("points").notNull(),
  active: integer("active").notNull().default(1),
});

// Badges table
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  description: text("description"),
  requirements: jsonb("requirements"),
  active: integer("active").notNull().default(1),
});

// Scanned QR codes table
export const scannedCodes = pgTable("scanned_codes", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(),
  scannedAt: timestamp("scanned_at").defaultNow(),
  scannedBy: integer("scanned_by").references(() => users.id),
  productName: text("product_name"),
});

// Define relations
export const usersRelations = relations(users, ({ one, many }) => ({
  inviter: one(users, {
    fields: [users.invitedBy],
    references: [users.id],
  }),
  invitees: many(users),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

// INSERT SCHEMAS
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, badgeIds: true, createdAt: true })
  .extend({
    name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
    phone: z.string().regex(/^(\+20|0)1[0-2,5]{1}[0-9]{8}$/, { 
      message: "يرجى إدخال رقم هاتف مصري صالح (يبدأ بـ 01 أو +201)" 
    }),
    region: z.string().optional(),
  });

export const insertMagicLinkSchema = createInsertSchema(magicLinks)
  .omit({ id: true })
  .extend({
    phone: z.string().regex(/^(\+20|0)1[0-2,5]{1}[0-9]{8}$/, { 
      message: "يرجى إدخال رقم هاتف مصري صالح (يبدأ بـ 01 أو +201)" 
    }),
  });

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true, createdAt: true })
  .extend({
    userId: z.number(),
    amount: z.number().min(1, { message: "يجب أن تكون القيمة أكبر من صفر" }),
  });

export const insertRewardSchema = createInsertSchema(rewards)
  .omit({ id: true })
  .extend({
    name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
    points: z.number().min(1, { message: "يجب أن تكون النقاط أكبر من صفر" }),
  });

export const insertBadgeSchema = createInsertSchema(badges)
  .omit({ id: true })
  .extend({
    name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  });

export const insertScannedCodeSchema = createInsertSchema(scannedCodes)
  .omit({ id: true, scannedAt: true })
  .extend({
    uuid: z.string().uuid({ message: "يجب أن يكون المعرف بصيغة UUID صالحة" }),
  });

// TYPES
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertMagicLink = z.infer<typeof insertMagicLinkSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type InsertScannedCode = z.infer<typeof insertScannedCodeSchema>;

export type User = typeof users.$inferSelect;
export type MagicLink = typeof magicLinks.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type ScannedCode = typeof scannedCodes.$inferSelect;

// AUTH SCHEMAS
// Egyptian phone number validation (01xxxxxxxxx or +201xxxxxxxxx format)
const egyptianPhoneRegex = /^(\+20|0)1[0-2,5]{1}[0-9]{8}$/;

export const requestOtpSchema = z.object({
  phone: z.string().regex(egyptianPhoneRegex, {
    message: "يرجى إدخال رقم هاتف مصري صالح (يبدأ بـ 01)"
  }),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(egyptianPhoneRegex, {
    message: "يرجى إدخال رقم هاتف مصري صالح"
  }),
  otp: z.string().length(6, {
    message: "رمز التحقق يجب أن يتكون من 6 أرقام"
  }),
});

// ALLOCATION SCHEMA
export const pointsAllocationSchema = z.object({
  userId: z.number({ required_error: "يرجى اختيار المستخدم" }),
  activityType: z.string({ required_error: "يرجى اختيار نوع النشاط" }),
  amount: z.number().min(1, { message: "يجب أن تكون القيمة أكبر من صفر" }),
  description: z.string().optional(),
});

export type PointsAllocation = z.infer<typeof pointsAllocationSchema>;

// REDEEM SCHEMA
export const redeemRewardSchema = z.object({
  userId: z.number(),
  rewardId: z.number(),
});

export type RedeemReward = z.infer<typeof redeemRewardSchema>;
