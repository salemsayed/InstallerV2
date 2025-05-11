import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import {
  UserRole, UserStatus, TransactionType,
  loginSchema, verifyTokenSchema, insertUserSchema,
  pointsAllocationSchema, redeemRewardSchema
} from "@shared/schema";
import { createTransport } from "nodemailer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up nodemailer with a mock transport for development
  const emailTransport = createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: process.env.EMAIL_USER || "mock_user",
      pass: process.env.EMAIL_PASS || "mock_pass",
    },
  });

  // AUTH ROUTES
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email } = loginSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود. يرجى التواصل مع الإدارة للحصول على دعوة." });
      }
      
      // Generate a token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expires in 1 hour
      
      // Store the magic link
      await storage.createMagicLink({
        token,
        email,
        expiresAt,
        used: 0
      });
      
      // In a production app, send an actual email
      // For development, we'll just return the token
      // The frontend will simulate the email flow
      
      /*
      await emailTransport.sendMail({
        from: '"برنامج مكافآت بريق" <noreply@breeg-rewards.com>',
        to: email,
        subject: "رابط تسجيل الدخول إلى برنامج مكافآت بريق",
        html: `
          <div dir="rtl" style="text-align: right; font-family: Arial, sans-serif;">
            <h2>مرحباً ${user.name},</h2>
            <p>يرجى استخدام الرابط التالي لتسجيل الدخول إلى برنامج مكافآت بريق:</p>
            <p>
              <a href="${process.env.APP_URL || "http://localhost:5000"}/auth/magic-link?token=${token}&email=${encodeURIComponent(email)}" 
                 style="display: inline-block; background-color: #1976D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                تسجيل الدخول
              </a>
            </p>
            <p>ينتهي هذا الرابط خلال ساعة واحدة.</p>
            <p>إذا لم تطلب تسجيل الدخول، يرجى تجاهل هذا البريد الإلكتروني.</p>
            <p>مع تحيات فريق بريق</p>
          </div>
        `
      });
      */
      
      return res.status(200).json({ 
        success: true, 
        message: "تم إرسال رابط تسجيل الدخول بنجاح",
        // Only for development to simulate the email flow
        token, 
        email 
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء تسجيل الدخول" });
    }
  });
  
  app.post("/api/auth/verify", async (req: Request, res: Response) => {
    try {
      const { token, email } = verifyTokenSchema.parse(req.body);
      
      // Find the magic link
      const magicLink = await storage.getMagicLinkByToken(token);
      
      if (!magicLink) {
        return res.status(400).json({ message: "رابط غير صالح. يرجى طلب رابط جديد." });
      }
      
      if (magicLink.email !== email) {
        return res.status(400).json({ message: "البريد الإلكتروني غير متطابق. يرجى طلب رابط جديد." });
      }
      
      if (magicLink.used === 1) {
        return res.status(400).json({ message: "تم استخدام هذا الرابط مسبقًا. يرجى طلب رابط جديد." });
      }
      
      const now = new Date();
      if (now > new Date(magicLink.expiresAt)) {
        return res.status(400).json({ message: "انتهت صلاحية الرابط. يرجى طلب رابط جديد." });
      }
      
      // Mark magic link as used
      await storage.updateMagicLink(magicLink.id, { used: 1 });
      
      // Get user
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // If account is pending, activate it
      if (user.status === UserStatus.PENDING) {
        await storage.updateUser(user.id, { status: UserStatus.ACTIVE });
      }
      
      // Return user data
      return res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points,
          level: user.level,
          region: user.region
        }
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء التحقق من الرمز" });
    }
  });
  
  // USER ROUTES
  app.get("/api/users/me", async (req: Request, res: Response) => {
    // This would typically check session/token
    // For demo, we'll use a query param
    const userId = parseInt(req.query.userId as string);
    
    if (!userId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      return res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points,
          level: user.level,
          region: user.region,
          badgeIds: user.badgeIds
        }
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع بيانات المستخدم" });
    }
  });
  
  // ADMIN ROUTES
  app.post("/api/admin/users", async (req: Request, res: Response) => {
    // Check if the requester is an admin
    const adminId = parseInt(req.query.userId as string);
    
    if (!adminId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      // Validate and create user
      const userData = insertUserSchema.parse(req.body);
      
      // Check if email is already in use
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل." });
      }
      
      // Set invitedBy field
      userData.invitedBy = adminId;
      
      // Create new user
      const newUser = await storage.createUser(userData);
      
      // Generate a token for magic link
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days for invites
      
      // Store the magic link
      await storage.createMagicLink({
        token,
        email: newUser.email,
        expiresAt,
        used: 0
      });
      
      // In a production app, send invite email
      // For development, we'll just return the token
      
      /*
      await emailTransport.sendMail({
        from: '"برنامج مكافآت بريق" <noreply@breeg-rewards.com>',
        to: newUser.email,
        subject: "دعوة للانضمام إلى برنامج مكافآت بريق",
        html: `
          <div dir="rtl" style="text-align: right; font-family: Arial, sans-serif;">
            <h2>مرحباً ${newUser.name},</h2>
            <p>تمت دعوتك للانضمام إلى برنامج مكافآت بريق - برنامج المكافآت الخاص بالفنيين المعتمدين.</p>
            <p>يرجى استخدام الرابط التالي لإكمال تسجيلك:</p>
            <p>
              <a href="${process.env.APP_URL || "http://localhost:5000"}/auth/magic-link?token=${token}&email=${encodeURIComponent(newUser.email)}" 
                 style="display: inline-block; background-color: #1976D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                إكمال التسجيل
              </a>
            </p>
            <p>ينتهي هذا الرابط خلال 7 أيام.</p>
            <p>مع تحيات فريق بريق</p>
          </div>
        `
      });
      */
      
      return res.status(201).json({
        success: true,
        message: "تمت إضافة المستخدم وإرسال الدعوة بنجاح",
        userId: newUser.id,
        // For development
        inviteToken: token
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء إضافة المستخدم" });
    }
  });
  
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    // Check if the requester is an admin
    const adminId = parseInt(req.query.userId as string);
    
    if (!adminId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      // Get all users
      const users = await storage.listUsers();
      
      // Filter out sensitive information
      const filteredUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        region: user.region,
        role: user.role,
        status: user.status,
        points: user.points,
        level: user.level
      }));
      
      return res.status(200).json({ users: filteredUsers });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع المستخدمين" });
    }
  });
  
  app.post("/api/admin/points", async (req: Request, res: Response) => {
    // Check if the requester is an admin
    const adminId = parseInt(req.query.userId as string);
    
    if (!adminId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      // Validate request
      const { userId, amount, activityType, description } = pointsAllocationSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Create a transaction for points
      const transaction = await storage.createTransaction({
        userId,
        type: TransactionType.EARNING,
        amount,
        description: description || `نقاط مكافآت - ${activityType}`,
        metadata: { activityType, allocatedBy: adminId }
      });
      
      // Get updated user with new points
      const updatedUser = await storage.getUser(userId);
      
      return res.status(200).json({
        success: true,
        message: "تمت إضافة النقاط بنجاح",
        transaction,
        userPoints: updatedUser?.points
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء إضافة النقاط" });
    }
  });
  
  // INSTALLER ROUTES
  app.get("/api/transactions", async (req: Request, res: Response) => {
    const userId = parseInt(req.query.userId as string);
    
    if (!userId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Get user transactions
      const transactions = await storage.getTransactionsByUserId(userId);
      
      return res.status(200).json({ transactions });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع المعاملات" });
    }
  });
  
  app.get("/api/rewards", async (req: Request, res: Response) => {
    const userId = parseInt(req.query.userId as string);
    
    if (!userId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Get active rewards
      const rewards = await storage.listRewards(true);
      
      return res.status(200).json({ rewards });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع المكافآت" });
    }
  });
  
  app.post("/api/rewards/redeem", async (req: Request, res: Response) => {
    const userId = parseInt(req.query.userId as string);
    
    if (!userId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      // Validate request
      const { rewardId } = redeemRewardSchema.parse({ ...req.body, userId });
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Check if reward exists
      const reward = await storage.getReward(rewardId);
      if (!reward) {
        return res.status(404).json({ message: "المكافأة غير موجودة." });
      }
      
      // Check if user has enough points
      if (user.points < reward.points) {
        return res.status(400).json({ message: "نقاط غير كافية للاستبدال." });
      }
      
      // Create a transaction for redemption
      const transaction = await storage.createTransaction({
        userId,
        type: TransactionType.REDEMPTION,
        amount: reward.points,
        description: `استبدال مكافأة: ${reward.name}`,
        metadata: { rewardId }
      });
      
      // Get updated user with new points
      const updatedUser = await storage.getUser(userId);
      
      return res.status(200).json({
        success: true,
        message: "تم استبدال المكافأة بنجاح",
        transaction,
        userPoints: updatedUser?.points
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استبدال المكافأة" });
    }
  });
  
  app.get("/api/badges", async (req: Request, res: Response) => {
    const userId = parseInt(req.query.userId as string);
    
    if (!userId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Get all badges
      const allBadges = await storage.listBadges(true);
      
      // Mark which ones the user has
      const badges = allBadges.map(badge => ({
        ...badge,
        earned: user.badgeIds && Array.isArray(user.badgeIds) && user.badgeIds.includes(badge.id)
      }));
      
      return res.status(200).json({ badges });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع الشارات" });
    }
  });
  
  // Create the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
