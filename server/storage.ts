import { 
  users, User, InsertUser, 
  magicLinks, MagicLink, InsertMagicLink,
  transactions, Transaction, InsertTransaction,
  rewards, Reward, InsertReward,
  badges, Badge, InsertBadge,
  scannedCodes, ScannedCode, InsertScannedCode,
  UserRole, UserStatus, TransactionType
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  listUsers(limit?: number, offset?: number): Promise<User[]>;
  
  // Magic link operations
  createMagicLink(magicLink: InsertMagicLink): Promise<MagicLink>;
  getMagicLinkByToken(token: string): Promise<MagicLink | undefined>;
  updateMagicLink(id: number, data: Partial<MagicLink>): Promise<MagicLink | undefined>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUserId(userId: number, limit?: number): Promise<Transaction[]>;
  
  // Reward operations
  createReward(reward: InsertReward): Promise<Reward>;
  getReward(id: number): Promise<Reward | undefined>;
  listRewards(active?: boolean): Promise<Reward[]>;
  
  // Badge operations
  createBadge(badge: InsertBadge): Promise<Badge>;
  getBadge(id: number): Promise<Badge | undefined>;
  listBadges(active?: boolean): Promise<Badge[]>;
  
  // Scanned codes operations
  checkScannedCode(uuid: string): Promise<ScannedCode | undefined>;
  createScannedCode(data: { uuid: string; scannedBy: number; productName?: string }): Promise<ScannedCode>;
}

import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import { json } from "drizzle-orm/pg-core";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      await db.delete(users).where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    const result = await db
      .select()
      .from(users)
      .limit(limit)
      .offset(offset);
    return result;
  }

  // Magic link operations
  async createMagicLink(insertMagicLink: InsertMagicLink): Promise<MagicLink> {
    const [magicLink] = await db
      .insert(magicLinks)
      .values(insertMagicLink)
      .returning();
    return magicLink;
  }

  async getMagicLinkByToken(token: string): Promise<MagicLink | undefined> {
    const [magicLink] = await db
      .select()
      .from(magicLinks)
      .where(eq(magicLinks.token, token));
    return magicLink;
  }

  async updateMagicLink(id: number, data: Partial<MagicLink>): Promise<MagicLink | undefined> {
    const [updatedMagicLink] = await db
      .update(magicLinks)
      .set(data)
      .where(eq(magicLinks.id, id))
      .returning();
    return updatedMagicLink;
  }

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async getTransactionsByUserId(userId: number, limit = 10): Promise<Transaction[]> {
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    return result;
  }

  // Reward operations
  async createReward(insertReward: InsertReward): Promise<Reward> {
    const [reward] = await db
      .insert(rewards)
      .values(insertReward)
      .returning();
    return reward;
  }

  async getReward(id: number): Promise<Reward | undefined> {
    const [reward] = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, id));
    return reward;
  }

  async listRewards(active?: boolean): Promise<Reward[]> {
    const query = db.select().from(rewards);
    
    if (active !== undefined) {
      query.where(eq(rewards.active, active ? 1 : 0));
    }
    
    const rewardsList = await query;
    return rewardsList;
  }

  // Badge operations
  async createBadge(insertBadge: InsertBadge): Promise<Badge> {
    const [badge] = await db
      .insert(badges)
      .values(insertBadge)
      .returning();
    return badge;
  }

  async getBadge(id: number): Promise<Badge | undefined> {
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, id));
    return badge;
  }

  async listBadges(active?: boolean): Promise<Badge[]> {
    const query = db.select().from(badges);
    
    if (active !== undefined) {
      query.where(eq(badges.active, active ? 1 : 0));
    }
    
    const badgesList = await query;
    return badgesList;
  }
  
  // Scanned codes operations
  async checkScannedCode(uuid: string): Promise<ScannedCode | undefined> {
    const [code] = await db
      .select()
      .from(scannedCodes)
      .where(eq(scannedCodes.uuid, uuid));
    return code;
  }
  
  async createScannedCode(data: { uuid: string; scannedBy: number; productName?: string }): Promise<ScannedCode> {
    const [code] = await db
      .insert(scannedCodes)
      .values({
        uuid: data.uuid,
        scannedBy: data.scannedBy,
        productName: data.productName
      })
      .returning();
    return code;
  }
}

// Create a new instance of DatabaseStorage
export const storage = new DatabaseStorage();

// Initialize the database with sample data if needed
async function initializeDatabase() {
  const userCount = await db.select({ count: sql`count(*)` }).from(users);
  
  // Only seed the database if it's empty
  if (userCount[0] && userCount[0].count === BigInt(0)) {
    // Create an admin user
    await db.insert(users).values({
      name: "مدير النظام",
      phone: "+201012345678",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      points: 0,
      level: 1
    });
    
    // Create badges
    await db.insert(badges).values([
      {
        name: "المبتدئ",
        icon: "star",
        description: "أول تسجيل دخول في النظام",
        active: 1
      },
      {
        name: "فني ذهبي",
        icon: "award",
        description: "إتمام 5 تركيبات بنجاح",
        active: 1
      },
      {
        name: "فني معتمد",
        icon: "verified",
        description: "فني معتمد من بريق",
        active: 1
      }
    ]);
    
    console.log("Database initialized with default data");
  }
}

// Initialize the database (will be called when this module is imported)
initializeDatabase().catch(error => {
  console.error("Failed to initialize database:", error);
});