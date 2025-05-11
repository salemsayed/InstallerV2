import { 
  users, User, InsertUser, 
  magicLinks, MagicLink, InsertMagicLink,
  transactions, Transaction, InsertTransaction,
  rewards, Reward, InsertReward,
  badges, Badge, InsertBadge,
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
    // Format phone to international format if it starts with 0
    const formattedPhone = phone.startsWith('0') ? '+2' + phone : phone;
    const result = await db.select().from(users).where(eq(users.phone, formattedPhone));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    return await db.select().from(users).limit(limit).offset(offset);
  }

  // Magic link operations
  async createMagicLink(insertMagicLink: InsertMagicLink): Promise<MagicLink> {
    const [magicLink] = await db.insert(magicLinks).values(insertMagicLink).returning();
    return magicLink;
  }

  async getMagicLinkByToken(token: string): Promise<MagicLink | undefined> {
    const result = await db.select().from(magicLinks).where(eq(magicLinks.token, token));
    return result[0];
  }

  async updateMagicLink(id: number, data: Partial<MagicLink>): Promise<MagicLink | undefined> {
    const [updatedMagicLink] = await db.update(magicLinks)
      .set(data)
      .where(eq(magicLinks.id, id))
      .returning();
    return updatedMagicLink;
  }

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    // Start transaction to ensure user points update atomically with transaction creation
    return await db.transaction(async (tx) => {
      // Create the transaction
      const [transaction] = await tx.insert(transactions)
        .values(insertTransaction)
        .returning();
      
      // Update user points
      const [user] = await tx.select().from(users).where(eq(users.id, insertTransaction.userId));
      
      if (user) {
        let newPoints = user.points;
        
        if (insertTransaction.type === TransactionType.EARNING) {
          newPoints += insertTransaction.amount;
        } else if (insertTransaction.type === TransactionType.REDEMPTION) {
          newPoints -= insertTransaction.amount;
        }
        
        await tx.update(users)
          .set({ points: newPoints })
          .where(eq(users.id, user.id));
      }
      
      return transaction;
    });
  }

  async getTransactionsByUserId(userId: number, limit = 10): Promise<Transaction[]> {
    return await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  // Reward operations
  async createReward(insertReward: InsertReward): Promise<Reward> {
    const [reward] = await db.insert(rewards).values(insertReward).returning();
    return reward;
  }

  async getReward(id: number): Promise<Reward | undefined> {
    const result = await db.select().from(rewards).where(eq(rewards.id, id));
    return result[0];
  }

  async listRewards(active?: boolean): Promise<Reward[]> {
    if (active !== undefined) {
      return await db.select()
        .from(rewards)
        .where(eq(rewards.active, active ? 1 : 0));
    }
    return await db.select().from(rewards);
  }

  // Badge operations
  async createBadge(insertBadge: InsertBadge): Promise<Badge> {
    const [badge] = await db.insert(badges).values(insertBadge).returning();
    return badge;
  }

  async getBadge(id: number): Promise<Badge | undefined> {
    const result = await db.select().from(badges).where(eq(badges.id, id));
    return result[0];
  }

  async listBadges(active?: boolean): Promise<Badge[]> {
    if (active !== undefined) {
      return await db.select()
        .from(badges)
        .where(eq(badges.active, active ? 1 : 0));
    }
    return await db.select().from(badges);
  }
}

// Initialize database with default data
async function initializeDatabase() {
  // Check if we need to initialize sample data
  const badgesCheck = await db.select().from(badges);
  
  if (badgesCheck.length === 0) {
    console.log("Initializing sample badges and rewards data");
    
    // Add sample rewards
    await db.insert(rewards).values([
      {
        name: "كوبون هدية 200 ريال",
        description: "صالح لمدة 3 أشهر من تاريخ الإصدار",
        type: "voucher",
        points: 500,
        active: 1
      },
      {
        name: "قسيمة شراء 500 ريال",
        description: "صالحة لدى شركائنا المعتمدين",
        type: "voucher",
        points: 1000,
        active: 1
      },
      {
        name: "جهاز إلكتروني",
        description: "تابلت أو هاتف ذكي",
        type: "product",
        points: 5000,
        active: 1
      },
      {
        name: "رحلة عمرة",
        description: "شاملة التذاكر والإقامة",
        type: "travel",
        points: 10000,
        active: 1
      }
    ]);
    
    // Add sample badges
    await db.insert(badges).values([
      {
        name: "فني متميز",
        icon: "military_tech",
        description: "حاصل على تقييمات ممتازة",
        active: 1
      },
      {
        name: "50 تركيب",
        icon: "handyman",
        description: "أتم 50 عملية تركيب بنجاح",
        active: 1
      },
      {
        name: "تقييم 5 نجوم",
        icon: "thumb_up",
        description: "حاصل على تقييم 5 نجوم من العملاء",
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

// Create a new instance of DatabaseStorage
export const storage = new DatabaseStorage();

// Initialize the database (will be called when this module is imported)
initializeDatabase().catch(error => {
  console.error("Failed to initialize database:", error);
});
