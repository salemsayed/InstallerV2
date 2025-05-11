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
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private magicLinks: Map<number, MagicLink>;
  private transactions: Map<number, Transaction>;
  private rewards: Map<number, Reward>;
  private badges: Map<number, Badge>;
  
  private userCurrentId: number;
  private magicLinkCurrentId: number;
  private transactionCurrentId: number;
  private rewardCurrentId: number;
  private badgeCurrentId: number;

  constructor() {
    this.users = new Map();
    this.magicLinks = new Map();
    this.transactions = new Map();
    this.rewards = new Map();
    this.badges = new Map();
    
    this.userCurrentId = 1;
    this.magicLinkCurrentId = 1;
    this.transactionCurrentId = 1;
    this.rewardCurrentId = 1;
    this.badgeCurrentId = 1;
    
    // Initialize with an admin user
    this.createUser({
      email: "admin@breeg.com",
      name: "مدير النظام",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      points: 0
    });
    
    // Add sample rewards
    this.createReward({
      name: "كوبون هدية 200 ريال",
      description: "صالح لمدة 3 أشهر من تاريخ الإصدار",
      type: "voucher",
      points: 500,
      active: 1
    });
    
    this.createReward({
      name: "قسيمة شراء 500 ريال",
      description: "صالحة لدى شركائنا المعتمدين",
      type: "voucher",
      points: 1000,
      active: 1
    });
    
    this.createReward({
      name: "جهاز إلكتروني",
      description: "تابلت أو هاتف ذكي",
      type: "product",
      points: 5000,
      active: 1
    });
    
    this.createReward({
      name: "رحلة عمرة",
      description: "شاملة التذاكر والإقامة",
      type: "travel",
      points: 10000,
      active: 1
    });
    
    // Add sample badges
    this.createBadge({
      name: "فني متميز",
      icon: "military_tech",
      description: "حاصل على تقييمات ممتازة",
      active: 1
    });
    
    this.createBadge({
      name: "50 تركيب",
      icon: "handyman",
      description: "أتم 50 عملية تركيب بنجاح",
      active: 1
    });
    
    this.createBadge({
      name: "تقييم 5 نجوم",
      icon: "thumb_up",
      description: "حاصل على تقييم 5 نجوم من العملاء",
      active: 1
    });
    
    this.createBadge({
      name: "فني معتمد",
      icon: "verified",
      description: "فني معتمد من بريق",
      active: 1
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const timestamp = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      badgeIds: [],
      createdAt: timestamp
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    const users = Array.from(this.users.values());
    return users.slice(offset, offset + limit);
  }

  // Magic link operations
  async createMagicLink(insertMagicLink: InsertMagicLink): Promise<MagicLink> {
    const id = this.magicLinkCurrentId++;
    const magicLink: MagicLink = { ...insertMagicLink, id };
    this.magicLinks.set(id, magicLink);
    return magicLink;
  }

  async getMagicLinkByToken(token: string): Promise<MagicLink | undefined> {
    return Array.from(this.magicLinks.values()).find(
      (magicLink) => magicLink.token === token
    );
  }

  async updateMagicLink(id: number, data: Partial<MagicLink>): Promise<MagicLink | undefined> {
    const magicLink = this.magicLinks.get(id);
    if (!magicLink) return undefined;
    
    const updatedMagicLink = { ...magicLink, ...data };
    this.magicLinks.set(id, updatedMagicLink);
    return updatedMagicLink;
  }

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionCurrentId++;
    const timestamp = new Date();
    const transaction: Transaction = { ...insertTransaction, id, createdAt: timestamp };
    this.transactions.set(id, transaction);
    
    // Update user points
    const user = await this.getUser(insertTransaction.userId);
    if (user) {
      let newPoints = user.points;
      
      if (insertTransaction.type === TransactionType.EARNING) {
        newPoints += insertTransaction.amount;
      } else if (insertTransaction.type === TransactionType.REDEMPTION) {
        newPoints -= insertTransaction.amount;
      }
      
      await this.updateUser(user.id, { points: newPoints });
    }
    
    return transaction;
  }

  async getTransactionsByUserId(userId: number, limit = 10): Promise<Transaction[]> {
    const transactions = Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => {
        // Sort by createdAt date in descending order (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    
    return transactions.slice(0, limit);
  }

  // Reward operations
  async createReward(insertReward: InsertReward): Promise<Reward> {
    const id = this.rewardCurrentId++;
    const reward: Reward = { ...insertReward, id };
    this.rewards.set(id, reward);
    return reward;
  }

  async getReward(id: number): Promise<Reward | undefined> {
    return this.rewards.get(id);
  }

  async listRewards(active?: boolean): Promise<Reward[]> {
    let rewards = Array.from(this.rewards.values());
    
    if (active !== undefined) {
      rewards = rewards.filter(reward => reward.active === (active ? 1 : 0));
    }
    
    return rewards;
  }

  // Badge operations
  async createBadge(insertBadge: InsertBadge): Promise<Badge> {
    const id = this.badgeCurrentId++;
    const badge: Badge = { ...insertBadge, id };
    this.badges.set(id, badge);
    return badge;
  }

  async getBadge(id: number): Promise<Badge | undefined> {
    return this.badges.get(id);
  }

  async listBadges(active?: boolean): Promise<Badge[]> {
    let badges = Array.from(this.badges.values());
    
    if (active !== undefined) {
      badges = badges.filter(badge => badge.active === (active ? 1 : 0));
    }
    
    return badges;
  }
}

export const storage = new MemStorage();
