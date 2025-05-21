import { 
  users, User, InsertUser, 
  magicLinks, MagicLink, InsertMagicLink,
  transactions, Transaction, InsertTransaction,
  rewards, Reward, InsertReward,
  badges, Badge, InsertBadge,
  localProducts, LocalProduct, InsertLocalProduct,
  scannedCodes, ScannedCode, InsertScannedCode,
  UserRole, UserStatus, TransactionType
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  getAllTransactions(limit?: number): Promise<Transaction[]>;
  calculateUserPointsBalance(userId: number): Promise<number>;
  
  // Reward operations
  createReward(reward: InsertReward): Promise<Reward>;
  getReward(id: number): Promise<Reward | undefined>;
  listRewards(active?: boolean): Promise<Reward[]>;
  
  // Badge operations
  createBadge(badge: InsertBadge): Promise<Badge>;
  getBadge(id: number): Promise<Badge | undefined>;
  listBadges(active?: boolean): Promise<Badge[]>;
  
  // Local Products operations
  createLocalProduct(product: InsertLocalProduct): Promise<LocalProduct>;
  getLocalProduct(id: number): Promise<LocalProduct | undefined>;
  getLocalProductByName(name: string): Promise<LocalProduct | undefined>;
  updateLocalProduct(id: number, data: Partial<LocalProduct>): Promise<LocalProduct | undefined>;
  deleteLocalProduct(id: number): Promise<boolean>;
  listLocalProducts(active?: boolean): Promise<LocalProduct[]>;
  
  // Scanned codes operations
  checkScannedCode(uuid: string): Promise<ScannedCode | undefined>;
  createScannedCode(data: { uuid: string; scannedBy: number; productName?: string; productId?: number }): Promise<ScannedCode>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
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

  async getTransactionsByUserId(userId: number, limit = 10000): Promise<Transaction[]> {
    // Use much higher default limit to make sure we get ALL transactions
    console.log(`[STORAGE] Fetching transactions for user ${userId} with limit ${limit}`);
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    console.log(`[STORAGE] Found ${result.length} transactions for user ${userId}`);
    return result;
  }
  
  async getAllTransactions(limit = 10000): Promise<Transaction[]> {
    // For admin dashboard - get all transactions across all users
    // Use much higher default limit to make sure we get ALL transactions
    console.log(`[STORAGE] Fetching all transactions with limit ${limit}`);
    const result = await db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    console.log(`[STORAGE] Found ${result.length} total transactions`);
    return result;
  }
  
  async calculateUserPointsBalance(userId: number): Promise<number> {
    // Calculate the user's actual points balance from transactions
    const earningTransactions = await db
      .select({ sum: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.type, TransactionType.EARNING)
      ));
      
    const redemptionTransactions = await db
      .select({ sum: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.type, TransactionType.REDEMPTION)
      ));
    
    const totalEarnings = earningTransactions[0]?.sum || 0;
    const totalRedemptions = redemptionTransactions[0]?.sum || 0;
    
    console.log(`[DEBUG] User ${userId} points calculation: earnings=${totalEarnings}, redemptions=${totalRedemptions}`);
    
    return totalEarnings - totalRedemptions;
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
    // Clean and validate numeric values
    const cleanData = { ...insertBadge };
    
    if (cleanData.requiredPoints !== undefined) {
      cleanData.requiredPoints = typeof cleanData.requiredPoints === 'number' && !isNaN(cleanData.requiredPoints) 
        ? cleanData.requiredPoints : 0;
    }
    
    if (cleanData.minInstallations !== undefined) {
      cleanData.minInstallations = typeof cleanData.minInstallations === 'number' && !isNaN(cleanData.minInstallations) 
        ? cleanData.minInstallations : 0;
    }
    
    if (cleanData.active !== undefined) {
      cleanData.active = cleanData.active === true || cleanData.active === 1 ? 1 : 0;
    }
    
    const [badge] = await db
      .insert(badges)
      .values(cleanData)
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
  
  async updateBadge(id: number, data: Partial<Badge>): Promise<Badge | undefined> {
    try {
      console.log('===== BADGE UPDATE DEBUG =====');
      console.log('Original input data:', JSON.stringify(data));
      
      // Convert potential NaN values to 0
      const cleanData = { ...data };
      
      // Remove any minLevel if it's somehow still in the data
      if ('minLevel' in cleanData) {
        console.log('Removing minLevel property from data');
        delete cleanData.minLevel;
      }
      
      if (cleanData.requiredPoints !== undefined) {
        console.log('requiredPoints before:', cleanData.requiredPoints, 'type:', typeof cleanData.requiredPoints);
        cleanData.requiredPoints = typeof cleanData.requiredPoints === 'number' && !isNaN(cleanData.requiredPoints) 
          ? cleanData.requiredPoints : 0;
        console.log('requiredPoints after:', cleanData.requiredPoints);
      }
      
      if (cleanData.minInstallations !== undefined) {
        console.log('minInstallations before:', cleanData.minInstallations, 'type:', typeof cleanData.minInstallations);
        cleanData.minInstallations = typeof cleanData.minInstallations === 'number' && !isNaN(cleanData.minInstallations) 
          ? cleanData.minInstallations : 0;
        console.log('minInstallations after:', cleanData.minInstallations);
      }
      
      if (cleanData.active !== undefined) {
        console.log('active before:', cleanData.active, 'type:', typeof cleanData.active);
        cleanData.active = cleanData.active === true || cleanData.active === 1 ? 1 : 0;
        console.log('active after:', cleanData.active);
      }
      
      console.log('Cleaned data being sent to database:', JSON.stringify(cleanData));
      
      try {
        const [badge] = await db
          .update(badges)
          .set(cleanData)
          .where(eq(badges.id, id))
          .returning();
        console.log('Badge update successful:', badge);
        return badge;
      } catch (dbError) {
        console.error('Database error during badge update:', dbError);
        if (dbError.message) console.error('Error message:', dbError.message);
        if (dbError.stack) console.error('Error stack:', dbError.stack);
        throw dbError;
      }
    } catch (error) {
      console.error('Error updating badge:', error);
      if (error.message) console.error('Error message:', error.message);
      if (error.stack) console.error('Error stack:', error.stack);
      return undefined;
    }
  }
  
  async deleteBadge(id: number): Promise<boolean> {
    try {
      await db.delete(badges).where(eq(badges.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting badge:', error);
      return false;
    }
  }
  
  // Local Products operations
  async createLocalProduct(product: InsertLocalProduct): Promise<LocalProduct> {
    const [localProduct] = await db
      .insert(localProducts)
      .values(product)
      .returning();
    return localProduct;
  }

  async getLocalProduct(id: number): Promise<LocalProduct | undefined> {
    const [product] = await db
      .select()
      .from(localProducts)
      .where(eq(localProducts.id, id));
    return product;
  }

  async getLocalProductByName(name: string): Promise<LocalProduct | undefined> {
    console.log(`[DEBUG] Looking for product with name: "${name}"`);
    
    // Try exact match first
    let [product] = await db
      .select()
      .from(localProducts)
      .where(eq(localProducts.name, name));
      
    if (product) {
      console.log(`[DEBUG] Found exact match for product: "${name}"`);
      return product;
    }
    
    // If no exact match, try to find if the name contains this product name
    // or if any product name contains this name
    console.log(`[DEBUG] No exact match found for "${name}", trying partial matches`);
    
    // Get all products for logging and diagnostic purposes
    const allProducts = await db.select().from(localProducts);
    console.log(`[DEBUG] All available products in database:`, 
      allProducts.map(p => `"${p.name}" (ID: ${p.id}, Points: ${p.rewardPoints}, Active: ${p.isActive})`));
    
    // Look for partial matches both ways
    for (const prod of allProducts) {
      // Check if the product name from manufacturing DB contains our local product name
      // or if our local product name contains the manufacturing name
      if (name.includes(prod.name) || prod.name.includes(name)) {
        console.log(`[DEBUG] Found partial match: "${prod.name}" for product: "${name}"`);
        return prod;
      }
    }
    
    console.log(`[DEBUG] No matching product found for: "${name}"`);
    return undefined;
  }

  async updateLocalProduct(id: number, data: Partial<LocalProduct>): Promise<LocalProduct | undefined> {
    const [updatedProduct] = await db
      .update(localProducts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(localProducts.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteLocalProduct(id: number): Promise<boolean> {
    try {
      await db.delete(localProducts).where(eq(localProducts.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting product:", error);
      return false;
    }
  }

  async listLocalProducts(active?: boolean): Promise<LocalProduct[]> {
    const query = db.select().from(localProducts);
    
    if (active !== undefined) {
      query.where(eq(localProducts.isActive, active ? 1 : 0));
    }
    
    const productsList = await query.orderBy(localProducts.name);
    return productsList;
  }

  // Scanned codes operations
  async checkScannedCode(uuid: string): Promise<ScannedCode | undefined> {
    const [code] = await db
      .select()
      .from(scannedCodes)
      .where(eq(scannedCodes.uuid, uuid));
    return code;
  }
  
  async createScannedCode(data: { uuid: string; scannedBy: number; productName?: string; productId?: number }): Promise<ScannedCode> {
    const [code] = await db
      .insert(scannedCodes)
      .values({
        uuid: data.uuid,
        scannedBy: data.scannedBy,
        productName: data.productName,
        productId: data.productId
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
    
    // Create sample products
    const productCount = await db.select({ count: sql`count(*)` }).from(localProducts);
    
    if (productCount[0] && productCount[0].count === BigInt(0)) {
      await db.insert(localProducts).values([
        {
          name: "BQ520 BAREEQ 50W",
          rewardPoints: 20,
          isActive: 1
        },
        {
          name: "BQ360 BAREEQ 30W",
          rewardPoints: 15,
          isActive: 1
        },
        {
          name: "BQ250 BAREEQ 25W",
          rewardPoints: 10,
          isActive: 1
        }
      ]);
      
      console.log("Database initialized with default products");
    }
    
    console.log("Database initialized with default data");
  }
}

// Initialize the database (will be called when this module is imported)
initializeDatabase().catch(error => {
  console.error("Failed to initialize database:", error);
});