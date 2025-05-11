import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import {
  UserRole, UserStatus, TransactionType,
  loginSchema, verifyTokenSchema, insertUserSchema,
  pointsAllocationSchema
} from "@shared/schema";
import { createTransport } from "nodemailer";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Import SMS service
  const { smsService } = await import('./sms');

  // AUTH ROUTES
  // Request OTP for login/registration
  app.post("/api/auth/request-otp", async (req: Request, res: Response) => {
    try {
      const { phone } = requestOtpSchema.parse(req.body);
      
      // Send OTP to the phone number
      const result = await smsService.sendOtp(phone);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "فشل إرسال رمز التحقق. يرجى التحقق من رقم الهاتف وإعادة المحاولة." 
        });
      }
      
      return res.json({
        success: true,
        message: "تم إرسال رمز التحقق بنجاح",
        // In development, return the OTP for easy testing
        ...(process.env.NODE_ENV !== 'production' && { otp: result.otp })
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "رقم الهاتف غير صالح. يرجى إدخال رقم هاتف مصري صحيح."
        });
      }
      return res.status(500).json({ 
        message: error.message || "حدث خطأ أثناء إرسال رمز التحقق" 
      });
    }
  });
  
  // Verify OTP and login/register user
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { phone, otp } = verifyOtpSchema.parse(req.body);
      
      // Verify the OTP
      const isValid = smsService.verifyOtp(phone, otp);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: "رمز التحقق غير صحيح أو منتهي الصلاحية" 
        });
      }
      
      // Check if user exists by phone number
      let user = await storage.getUserByPhone(phone);
      
      // If no user exists, create a new one
      if (!user) {
        // Format phone to standard format for saving
        const formattedPhone = phone.startsWith('0') ? '+2' + phone : phone;
        
        user = await storage.createUser({
          phone: formattedPhone,
          // Use a default email based on phone for systems that require email
          email: `user_${formattedPhone.replace(/\+/g, '').replace(/\s/g, '')}@example.com`,
          name: `مستخدم ${formattedPhone.slice(-4)}`, // Use last 4 digits as part of name
          role: UserRole.INSTALLER,
          status: UserStatus.ACTIVE,
          points: 0,
          level: 1,
          badgeIds: [],
        });
      }
      
      // Create a JWT or session token here if needed
      // For simplicity, we'll just return the user object
      
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          points: user.points,
          level: user.level,
          region: user.region
        }
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "بيانات غير صالحة. يرجى التحقق من رقم الهاتف ورمز التحقق."
        });
      }
      return res.status(400).json({ 
        message: error.message || "حدث خطأ أثناء التحقق من رمز OTP" 
      });
    }
  });
  
  // USER ROUTES

  // Legacy endpoint for the old auth system
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
      
      // Set invitedBy field and status to ACTIVE
      userData.invitedBy = adminId;
      userData.status = UserStatus.ACTIVE;
      
      // Create new user
      const newUser = await storage.createUser(userData);
      
      return res.status(201).json({
        success: true,
        message: "تمت إضافة المستخدم بنجاح",
        userId: newUser.id,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
          points: newUser.points,
          level: newUser.level,
          region: newUser.region,
        }
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
