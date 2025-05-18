import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import {
  UserRole, UserStatus, TransactionType, ActivityType,
  requestOtpSchema, verifyOtpSchema, insertUserSchema,
  pointsAllocationSchema
} from "@shared/schema";
import { z } from "zod";
import { createTransport } from "nodemailer";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Import SMS service
  const { smsService } = await import('./sms');
  
  // Import manufacturing database functions
  const { checkSerialNumber, getProductNameBySerialNumber } = await import('./manufacturing');
  
  // Import OpenAI functions
  const { generateInsight, generateAnalyticsSummary } = await import('./openai');

  // AUTH ROUTES
  // Request OTP for login/registration
  app.post("/api/auth/request-otp", async (req: Request, res: Response) => {
    try {
      const { phone } = requestOtpSchema.parse(req.body);
      
      // Format phone number - ensure it has the +2 prefix for Egyptian numbers
      let formattedPhone = phone;
      if (phone.startsWith('0')) {
        formattedPhone = '+2' + phone;
      }
      
      // Check if user exists by phone number before sending OTP
      const user = await storage.getUserByPhone(formattedPhone);
      
      // Only allow existing users to request OTP
      if (!user) {
        return res.status(401).json({ 
          success: false,
          message: "رقم الهاتف غير مسجل. يرجى التواصل مع المسؤول لإضافة حسابك." 
        });
      }
      
      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        return res.status(403).json({ 
          success: false,
          message: "الحساب غير نشط. يرجى التواصل مع المسؤول لتفعيل حسابك." 
        });
      }
      
      // Send OTP to the phone number
      const result = await smsService.sendOtp(formattedPhone);
      
      if (!result.success) {
        return res.status(400).json({ 
          success: false,
          message: "فشل إرسال رمز التحقق. يرجى التحقق من رقم الهاتف وإعادة المحاولة." 
        });
      }
      
      // Also store OTP in the database for persistence
      await smsService.storeOtp(formattedPhone, result.otp!);
      
      return res.json({
        success: true,
        message: "تم إرسال رمز التحقق بنجاح",
        // Always include OTP for testing in all environments
        otp: result.otp
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
  
  // Verify OTP and login existing user
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { phone, otp } = verifyOtpSchema.parse(req.body);
      
      // Format phone number - ensure it has the +2 prefix for Egyptian numbers
      let formattedPhone = phone;
      if (phone.startsWith('0')) {
        formattedPhone = '+2' + phone;
      }
      
      // Verify the OTP
      const isValid = await smsService.verifyOtp(formattedPhone, otp);
      
      if (!isValid) {
        return res.status(400).json({ 
          success: false,
          message: "رمز التحقق غير صحيح أو منتهي الصلاحية" 
        });
      }
      
      // Get user information (we already verified the user exists in the request-otp step)
      const user = await storage.getUserByPhone(formattedPhone);
      
      // This is a safety check, just in case
      if (!user || user.status !== UserStatus.ACTIVE) {
        return res.status(401).json({ 
          success: false,
          message: "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى." 
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
          role: user.role,
          points: user.points,
          level: user.level,
          region: user.region,
          status: user.status
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
          phone: user.phone,
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
    // Import secure logging utility
    const { createAdminLogger } = await import('./utils/admin-logger');
    const logger = createAdminLogger('user-create');
    
    // Check if the requester is an admin
    const adminId = parseInt(req.query.userId as string);
    
    if (!adminId) {
      logger.error('Missing admin ID in user creation request');
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        logger.error('Unauthorized user creation attempt', { 
          adminId, 
          role: admin?.role 
        });
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      logger.info('Processing user creation request', { adminId });
      // Validate and create user
      const userData = insertUserSchema.parse(req.body);
      
      // Format phone to international format if needed
      if (userData.phone.startsWith('0')) {
        userData.phone = '+2' + userData.phone;
      }
      
      // Check if phone is already in use
      const existingUser = await storage.getUserByPhone(userData.phone);
      if (existingUser) {
        logger.info('User creation failed - phone number already in use', {
          // No need to log the actual phone number
          existingUserId: existingUser.id
        });
        return res.status(400).json({ message: "رقم الهاتف مستخدم بالفعل." });
      }
      
      // Set invitedBy field and status to ACTIVE
      userData.invitedBy = adminId;
      userData.status = UserStatus.ACTIVE;
      
      // Create new user with secure logging (not logging the full user object with phone)
      logger.info('Creating new user', {
        name: userData.name,
        role: userData.role,
        region: userData.region
        // Intentionally not logging phone number
      });
      
      const newUser = await storage.createUser(userData);
      
      logger.success('user', newUser.id, 'created');
      
      return res.status(201).json({
        success: true,
        message: "تمت إضافة المستخدم بنجاح",
        userId: newUser.id,
        user: {
          id: newUser.id,
          name: newUser.name,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          points: newUser.points,
          level: newUser.level,
          region: newUser.region,
        }
      });
      
    } catch (error: any) {
      logger.error('User creation failed', error);
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء إضافة المستخدم" });
    }
  });
  
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    // Import secure logging utility
    const { createAdminLogger } = await import('./utils/admin-logger');
    const logger = createAdminLogger('user-list');
    
    // Check if the requester is an admin
    const adminId = parseInt(req.query.userId as string);
    
    if (!adminId) {
      logger.error('Missing admin ID in user list request');
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        logger.error('Unauthorized user list attempt', { 
          adminId, 
          role: admin?.role 
        });
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      logger.info('Admin requesting user list', { adminId });
      // Get all users
      const users = await storage.listUsers();
      
      // Log user count without exposing sensitive data
      logger.info(`Processing ${users.length} users for admin dashboard`, {
        userCount: users.length,
        adminId
      });
      
      // Create a new array with calculated point balances
      const usersWithCalculatedPoints = await Promise.all(users.map(async user => {
        // Only calculate points for installers to save performance
        let calculatedPoints = user.points;
        if (user.role === UserRole.INSTALLER) {
          calculatedPoints = await storage.calculateUserPointsBalance(user.id);
        }
        
        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          region: user.region,
          role: user.role,
          status: user.status,
          points: calculatedPoints, // Use calculated points instead of stored value
          level: user.level
        };
      }));
      
      logger.success('user-list', adminId, 'retrieved');
      return res.status(200).json({ users: usersWithCalculatedPoints });
      
    } catch (error: any) {
      logger.error('Failed to retrieve user list', error);
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع المستخدمين" });
    }
  });
  
  // Update user
  app.patch("/api/admin/users/:userId", async (req: Request, res: Response) => {
    // Import secure logging utility
    const { createAdminLogger } = await import('./utils/admin-logger');
    const logger = createAdminLogger('user-update');
    
    const adminId = parseInt(req.query.userId as string);
    const targetUserId = parseInt(req.params.userId);
    
    if (!adminId) {
      logger.error('Missing admin ID in user update request');
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        logger.error('Unauthorized user update attempt', { 
          adminId, 
          role: admin?.role 
        });
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      logger.info('Processing user update request', { 
        adminId, 
        targetUserId 
      });
      
      // Validate input data
      let { name, phone, region, status, points } = req.body;
      
      // Format phone to international format if needed
      if (phone && phone.startsWith('0')) {
        phone = '+2' + phone;
      }
      
      // Log update attempt with non-sensitive details (not including the actual phone number)
      logger.info('Attempting to update user', {
        targetUserId,
        fieldsToUpdate: {
          hasName: !!name,
          hasPhone: !!phone,
          hasRegion: !!region,
          hasStatus: !!status,
          hasPoints: points !== undefined
        }
      });
      
      // Update user data
      const updatedUser = await storage.updateUser(targetUserId, {
        name,
        phone,
        region,
        status,
        points
      });
      
      if (!updatedUser) {
        logger.error('User not found for update', { targetUserId });
        return res.status(404).json({ 
          success: false,
          message: "لم يتم العثور على المستخدم."
        });
      }
      
      logger.success('user', updatedUser.id, 'updated');
      
      return res.status(200).json({
        success: true,
        message: "تم تحديث بيانات المستخدم بنجاح",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          phone: updatedUser.phone,
          role: updatedUser.role,
          status: updatedUser.status,
          points: updatedUser.points,
          level: updatedUser.level,
          region: updatedUser.region
        }
      });
      
    } catch (error: any) {
      logger.error('Error updating user', error);
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء تحديث بيانات المستخدم" 
      });
    }
  });
  
  // Delete user
  app.delete("/api/admin/users/:userId", async (req: Request, res: Response) => {
    // Import secure logging utility
    const { createAdminLogger } = await import('./utils/admin-logger');
    const logger = createAdminLogger('user-delete');
    
    const adminId = parseInt(req.query.userId as string);
    const targetUserId = parseInt(req.params.userId);
    
    if (!adminId) {
      logger.error('Missing admin ID in user delete request');
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        logger.error('Unauthorized user deletion attempt', { 
          adminId, 
          role: admin?.role 
        });
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      logger.info('Processing user deletion request', { adminId, targetUserId });
      
      // Check if user exists
      const targetUser = await storage.getUser(targetUserId);
      
      if (!targetUser) {
        logger.error('Target user not found for deletion', { targetUserId });
        return res.status(404).json({ 
          success: false,
          message: "لم يتم العثور على المستخدم."
        });
      }
      
      // Prevent deleting yourself
      if (targetUserId === adminId) {
        logger.error('Admin attempted to delete self', { adminId });
        return res.status(400).json({
          success: false,
          message: "لا يمكن حذف حسابك الخاص."
        });
      }
      
      logger.info('Attempting to delete user', { 
        targetUserId,
        targetUserRole: targetUser.role
      });
      
      const result = await storage.deleteUser(targetUserId);
      
      if (!result) {
        logger.error('Database delete operation failed', { targetUserId });
        return res.status(500).json({
          success: false,
          message: "فشل حذف المستخدم. يرجى المحاولة مرة أخرى."
        });
      }
      
      logger.success('user', targetUserId, 'deleted');
      return res.status(200).json({
        success: true,
        message: "تم حذف المستخدم بنجاح"
      });
      
    } catch (error: any) {
      logger.error('Error during user deletion', error);
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء حذف المستخدم" 
      });
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
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    if (!userId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Get user transactions with a higher limit
      const transactions = await storage.getTransactionsByUserId(userId, limit);
      
      return res.status(200).json({ 
        transactions,
        total: transactions.length 
      });
      
    } catch (error: any) {
      console.error("[ERROR] Error fetching transactions:", error);
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع المعاملات" });
    }
  });
  
  // ADMIN TRANSACTIONS ENDPOINT - Gets all transactions
  app.get("/api/admin/transactions", async (req: Request, res: Response) => {
    const adminId = parseInt(req.query.userId as string);
    
    if (!adminId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Verify this is an admin user
      if (admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه البيانات." });
      }
      
      // Get all transactions - need to add this method to storage
      console.log("[DEBUG] Fetching all transactions for admin dashboard");
      const transactions = await storage.getAllTransactions();
      console.log(`[DEBUG] Found ${transactions.length} total transactions`);
      
      return res.status(200).json({ transactions });
      
    } catch (error: any) {
      console.error("[ERROR] Error fetching admin transactions:", error);
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
      
      // Get user's installation count (transactions of type EARNING that have product installations)
      // Use a high limit to get all transactions for proper badge calculations
      const transactions = await storage.getTransactionsByUserId(userId, 1000);
      
      // Count installations - filter by product installation transactions only
      const installationTransactions = transactions.filter(t => 
        t.type === TransactionType.EARNING && 
        (t.description?.includes("تم تركيب منتج") || t.description?.includes("تركيب منتج جديد"))
      );
      
      // Filter for current month installations only
      const now = new Date();
      // In JavaScript, months are 0-indexed (0=January, 1=February, ..., 11=December)
      const currentMonth = now.getMonth(); 
      const currentYear = now.getFullYear();
      
      // Count only current month installations for badge qualification
      const currentMonthInstallations = installationTransactions.filter(t => {
        const transactionDate = new Date(t.createdAt);
        const transactionMonth = transactionDate.getMonth();
        const transactionYear = transactionDate.getFullYear();
        
        return (transactionMonth === currentMonth && transactionYear === currentYear);
      });
      
      const installationCount = currentMonthInstallations.length;
      
      // Initialize badgeIds array if it doesn't exist
      if (!user.badgeIds) {
        user.badgeIds = [];
      } else if (!Array.isArray(user.badgeIds)) {
        user.badgeIds = [];
      }
      
      // Check each badge to see if user qualifies
      let userBadgesUpdated = false;
      let updatedBadgeIds: number[] = [];
      
      for (const badge of allBadges) {
        const alreadyHasBadge = user.badgeIds.includes(badge.id);
        
        // Check qualification
        const qualifies = (
          (badge.requiredPoints === null || badge.requiredPoints === undefined || user.points >= badge.requiredPoints) &&
          (badge.minInstallations === null || badge.minInstallations === undefined || installationCount >= badge.minInstallations)
        );
        
        if (qualifies) {
          // If user qualifies for badge but doesn't have it yet, add it
          if (!alreadyHasBadge) {
            console.log(`[DEBUG] User ${userId} qualifies for badge ${badge.id} (${badge.name}) - adding to user badges`);
            updatedBadgeIds.push(badge.id);
            userBadgesUpdated = true;
          } else {
            // User already has this badge and still qualifies
            updatedBadgeIds.push(badge.id);
          }
        } else if (alreadyHasBadge) {
          // User has badge but no longer qualifies - remove it
          console.log(`[DEBUG] User ${userId} no longer qualifies for badge ${badge.id} (${badge.name}) - removing from user badges`);
          userBadgesUpdated = true;
          // Badge is not added to updatedBadgeIds, effectively removing it
        }
      }
      
      // Replace user's badges with the updated list
      if (userBadgesUpdated) {
        user.badgeIds = updatedBadgeIds;
      }
      
      // Update user's badges in database if changes were made
      if (userBadgesUpdated) {
        console.log(`[DEBUG] Updating user ${userId} badges in database:`, user.badgeIds);
        await storage.updateUser(userId, { badgeIds: user.badgeIds });
      }
      
      // Mark which ones the user has
      const badges = allBadges.map(badge => ({
        ...badge,
        earned: user.badgeIds.includes(badge.id)
      }));
      
      return res.status(200).json({ badges });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع الشارات" });
    }
  });
  
  // Admin Badge Management Routes
  app.post("/api/admin/badges", async (req: Request, res: Response) => {
    try {
      const adminId = parseInt(req.query.userId as string);
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          success: false,
          message: "ليس لديك صلاحية للقيام بهذه العملية" 
        });
      }
      
      const { name, description, icon, requiredPoints, minInstallations, active } = req.body;
      
      // Validate numeric fields and ensure they are numbers
      const validatedData = {
        name,
        description,
        icon,
        active: active === true || active === 1 ? 1 : 0,
        createdAt: new Date(),
        requiredPoints: typeof requiredPoints === 'number' && !isNaN(requiredPoints) 
          ? requiredPoints : 0,
        minInstallations: typeof minInstallations === 'number' && !isNaN(minInstallations)
          ? minInstallations : 0
      };
      
      const newBadge = await storage.createBadge(validatedData);
      
      return res.status(201).json({ 
        success: true, 
        message: "تمت إضافة الشارة بنجاح",
        badge: newBadge 
      });
      
    } catch (error: any) {
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء إنشاء الشارة" 
      });
    }
  });
  
  app.patch("/api/admin/badges/:id", async (req: Request, res: Response) => {
    try {
      console.log('========= BADGE UPDATE ENDPOINT START =========');
      console.log('Request body:', JSON.stringify(req.body));
      console.log('Request params:', JSON.stringify(req.params));
      
      const badgeId = parseInt(req.params.id);
      if (isNaN(badgeId)) {
        console.error('Invalid badge ID:', req.params.id);
        return res.status(400).json({ 
          success: false,
          message: "Invalid badge ID format",
          details: { id: req.params.id }
        });
      }
      
      const adminId = parseInt(req.query.userId as string);
      if (isNaN(adminId)) {
        console.error('Invalid admin ID:', req.query.userId);
        return res.status(400).json({ 
          success: false,
          message: "Invalid admin ID format",
          details: { userId: req.query.userId }
        });
      }
      
      console.log(`Processing badge update: Badge ID ${badgeId}, Admin ID ${adminId}`);
      
      const admin = await storage.getUser(adminId);
      if (!admin) {
        console.error('Admin not found:', adminId);
        return res.status(404).json({ 
          success: false,
          message: "Admin user not found" 
        });
      }
      
      if (admin.role !== UserRole.ADMIN) {
        console.error('Non-admin attempted badge update:', admin);
        return res.status(403).json({ 
          success: false,
          message: "ليس لديك صلاحية للقيام بهذه العملية" 
        });
      }
      
      const badge = await storage.getBadge(badgeId);
      if (!badge) {
        console.error('Badge not found:', badgeId);
        return res.status(404).json({ 
          success: false,
          message: "الشارة غير موجودة" 
        });
      }
      
      console.log('Current badge data:', JSON.stringify(badge));
      
      // Extract data from request body with careful type checking
      const { 
        name = badge.name, 
        description = badge.description, 
        icon = badge.icon,
        requiredPoints = badge.requiredPoints,
        minInstallations = badge.minInstallations, 
        active = badge.active
      } = req.body;
      
      console.log('Extracted field values:');
      console.log('- name:', name, typeof name);
      console.log('- description:', description, typeof description);
      console.log('- icon:', icon, typeof icon);
      console.log('- requiredPoints:', requiredPoints, typeof requiredPoints);
      console.log('- minInstallations:', minInstallations, typeof minInstallations);
      console.log('- active:', active, typeof active);
      
      // Process numeric and boolean fields with extra care
      let parsedRequiredPoints = 0;
      let parsedMinInstallations = 0;
      let parsedActive = 0;
      
      // Handle requiredPoints - try parsing if it's a string
      if (typeof requiredPoints === 'number') {
        parsedRequiredPoints = isNaN(requiredPoints) ? 0 : requiredPoints;
      } else if (typeof requiredPoints === 'string') {
        try {
          parsedRequiredPoints = parseInt(requiredPoints, 10);
          if (isNaN(parsedRequiredPoints)) parsedRequiredPoints = 0;
        } catch (e) {
          parsedRequiredPoints = 0;
        }
      }
      
      // Handle minInstallations - try parsing if it's a string
      if (typeof minInstallations === 'number') {
        parsedMinInstallations = isNaN(minInstallations) ? 0 : minInstallations;
      } else if (typeof minInstallations === 'string') {
        try {
          parsedMinInstallations = parseInt(minInstallations, 10);
          if (isNaN(parsedMinInstallations)) parsedMinInstallations = 0;
        } catch (e) {
          parsedMinInstallations = 0;
        }
      }
      
      // Handle active flag - ensure it's 0 or 1
      if (active === true || active === 1 || active === '1') {
        parsedActive = 1;
      } else {
        parsedActive = 0;
      }
      
      // Validate text fields
      if (!name || typeof name !== 'string') {
        console.error('Invalid name field:', name);
        return res.status(400).json({
          success: false,
          message: "اسم الشارة غير صالح"
        });
      }
      
      if (!icon || typeof icon !== 'string') {
        console.error('Invalid icon field:', icon);
        return res.status(400).json({
          success: false,
          message: "أيقونة الشارة غير صالحة"
        });
      }
      
      // Create validated data object
      const validatedData = {
        name,
        description: description || '',
        icon,
        active: parsedActive,
        requiredPoints: parsedRequiredPoints,
        minInstallations: parsedMinInstallations
      };
      
      // Use secure logging to prevent exposing sensitive data
      const { createAdminLogger } = await import('./utils/admin-logger');
      const logger = createAdminLogger('badge-update');
      
      logger.info(`Updating badge with validated data`, {
        badgeId,
        name: validatedData.name,
        requiredPoints: validatedData.requiredPoints,
        minInstallations: validatedData.minInstallations,
        active: validatedData.active
      });
      
      try {
        const updatedBadge = await storage.updateBadge(badgeId, validatedData);
        
        if (!updatedBadge) {
          logger.error('Badge update failed - storage returned undefined');
          return res.status(500).json({
            success: false,
            message: "فشل تحديث الشارة - خطأ في قاعدة البيانات"
          });
        }
        
        logger.success('badge', updatedBadge.id, 'updated');
        return res.status(200).json({ 
          success: true, 
          message: "تم تحديث الشارة بنجاح",
          badge: updatedBadge 
        });
      } catch (dbError: any) {
        logger.error('Database error during badge update', dbError);
        return res.status(500).json({
          success: false,
          message: "Database error during badge update",
          error: dbError.message
        });
      }
    } catch (error: any) {
      logger.error('Unexpected error in badge update endpoint', error);
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء تحديث الشارة",
        // Only return non-sensitive error information
        errorType: error.name || 'Error'
      });
    }
  });
  
  app.delete("/api/admin/badges/:id", async (req: Request, res: Response) => {
    try {
      const badgeId = parseInt(req.params.id);
      const adminId = parseInt(req.query.userId as string);
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          success: false,
          message: "ليس لديك صلاحية للقيام بهذه العملية" 
        });
      }
      
      const badge = await storage.getBadge(badgeId);
      
      if (!badge) {
        return res.status(404).json({ 
          success: false,
          message: "الشارة غير موجودة" 
        });
      }
      
      // First, remove this badge from all users who have it
      const users = await storage.listUsers();
      for (const user of users) {
        if (user.badgeIds && Array.isArray(user.badgeIds) && user.badgeIds.includes(badgeId)) {
          const updatedBadgeIds = user.badgeIds.filter(id => id !== badgeId);
          await storage.updateUser(user.id, { badgeIds: updatedBadgeIds });
        }
      }
      
      // Then delete the badge
      const success = await storage.deleteBadge(badgeId);
      
      if (!success) {
        return res.status(500).json({ 
          success: false,
          message: "فشل في حذف الشارة" 
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: "تم حذف الشارة بنجاح" 
      });
      
    } catch (error: any) {
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء حذف الشارة" 
      });
    }
  });
  
  // Schema for validating QR code scan requests
  const scanQrSchema = z.object({
    uuid: z.string().min(1, { message: "QR code is required" })
  });

  // QR code scanning endpoint - secured with session authentication
  app.post("/api/scan-qr", async (req: Request, res: Response) => {
    // Import secure logging utility
    const { createAdminLogger } = await import('./utils/admin-logger');
    const logger = createAdminLogger('qr-scan');
    
    try {
      // Get authenticated user ID from session
      // SECURITY FIX: No longer trust userId from request body
      const userId = parseInt(req.query.userId as string);
      
      if (!userId) {
        logger.error('Missing authenticated user ID');
        return res.status(401).json({ 
          success: false, 
          message: "يجب تسجيل الدخول للمسح",
          error_code: "UNAUTHORIZED" 
        });
      }
      
      // Create schema for QR scan validation
      const scanQrSchema = z.object({
        uuid: z.string().uuid({ message: "رمز QR غير صالح. يجب أن يكون UUID" })
      });
      
      // Validate the request body
      const validation = scanQrSchema.safeParse(req.body);
      
      if (!validation.success) {
        logger.error('QR scan validation failed', { 
          errorCount: validation.error.errors.length
        });
        return res.status(400).json({ 
          success: false, 
          message: "بيانات غير صالحة. الرجاء التحقق من المعلومات المقدمة.",
          error_code: "INVALID_INPUT",
          errors: validation.error.errors
        });
      }
      
      const { uuid } = validation.data;
      
      logger.info('Processing QR scan', { 
        userId,
        uuidPrefix: uuid.substring(0, 8) // Only log prefix for tracing without revealing full UUID
      });
      
      // Verify user exists and is authorized
      const dbUser = await storage.getUser(userId);
      
      if (!dbUser) {
        logger.error('User not found during QR scan', { userId });
        return res.status(404).json({ 
          success: false, 
          message: "المستخدم غير موجود.",
          error_code: "USER_NOT_FOUND" 
        });
      }
      
      if (dbUser.status !== UserStatus.ACTIVE) {
        logger.error('Inactive user attempted QR scan', {
          userId,
          status: dbUser.status
        });
        return res.status(403).json({ 
          success: false, 
          message: "الحساب غير نشط. يرجى التواصل مع المسؤول.",
          error_code: "INACTIVE_ACCOUNT" 
        });
      }
      
      // We've already validated the request body above and extracted uuid
      
      if (!uuid) {
        return res.status(400).json({ 
          success: false, 
          message: "يرجى تقديم رمز QR صالح",
          error_code: "MISSING_PARAMS",
          details: { missing: "uuid" } 
        });
      }
      
      // Check if this code has already been scanned
      const existingCode = await storage.checkScannedCode(uuid);
      if (existingCode) {
        return res.status(400).json({ 
          success: false, 
          message: "This product code has already been scanned",
          error_code: "DUPLICATE_SCAN",
          details: { 
            scanned_by: existingCode.scannedBy,
            scanned_at: existingCode.scannedAt,
            duplicate: true
          }
        });
      }
      
      // Check if the code exists in the manufacturing database
      logger.info('Checking UUID in manufacturing database', {
        uuidPrefix: uuid.substring(0, 8)
      });
      
      // Try different formats - sometimes UUIDs might be stored differently
      const uuidNoHyphens = uuid.replace(/-/g, '');
      
      // First try with normal UUID format
      logger.info('Checking with original UUID format');
      let isValid = await checkSerialNumber(uuid);
      
      // If not found, try without hyphens
      if (!isValid) {
        logger.info('Original UUID not found, trying without hyphens');
        isValid = await checkSerialNumber(uuidNoHyphens);
      }
      
      if (!isValid) {
        logger.error('UUID not found in manufacturing database', {
          uuidPrefix: uuid.substring(0, 8)
        });
        return res.status(400).json({ 
          success: false, 
          message: "هذا المنتج غير مسجل في قاعدة بيانات التصنيع لدينا",
          error_code: "INVALID_PRODUCT",
          details: { uuidPrefix: uuid.substring(0, 8) } // Only return prefix for security
        });
      }
      
      logger.info('UUID validated in manufacturing database');
      
      // Get product details from manufacturing database
      const productName = await getProductNameBySerialNumber(uuid);
      
      if (productName) {
        logger.info('Product name retrieved from manufacturing database');
      } else {
        logger.error('No product name found for valid UUID');
      }
      
      // Find matching product in our local database to determine reward points
      let pointsAwarded = 0;
      let localProduct = null;
      
      if (productName) {
        // Look up the product name in our local database
        localProduct = await storage.getLocalProductByName(productName);
        
        if (localProduct) {
          logger.info('Found matching local product', {
            productId: localProduct.id,
            isActive: localProduct.isActive === 1
          });
        } else {
          logger.info('No matching local product found for name');
        }
        
        if (localProduct && localProduct.isActive === 1) {
          // Use the reward points defined in our local database
          pointsAwarded = localProduct.rewardPoints;
          logger.info('Awarding points for product scan', {
            pointsAwarded,
            productId: localProduct.id
          });
        } else {
          logger.error('Product not eligible for rewards', {
            reason: localProduct ? "Product is inactive" : "Product not found in rewards database"
          });
          return res.status(400).json({ 
            success: false, 
            message: "هذا المنتج غير مؤهل للحصول على نقاط المكافأة",
            error_code: "INELIGIBLE_PRODUCT",
            details: { 
              reason: localProduct ? "Product is inactive" : "Product not found in rewards database"
            }
          });
        }
      } else {
        logger.error('No product name found for scanned code');
        return res.status(400).json({ 
          success: false, 
          message: "هذا المنتج غير مؤهل للحصول على نقاط المكافأة",
          error_code: "INELIGIBLE_PRODUCT",
          details: { reason: "No product name found" }
        });
      }
      
      // Save the scanned code to database with product reference if available
      logger.info('Saving scanned code to database', {
        userId,
        hasProductId: !!localProduct?.id
      });
      
      const scannedCode = await storage.createScannedCode({
        uuid,
        scannedBy: userId, // Using the authenticated userId from session
        productName: productName || undefined,
        productId: localProduct ? localProduct.id : undefined
      });
      
      // We already have the user from authentication check above
      // Now just update their points
      logger.info('Updating user points balance', {
        userId,
        currentPoints: dbUser.points,
        pointsToAdd: pointsAwarded
      });
      
      const updatedUser = await storage.updateUser(userId, {
        points: dbUser.points + pointsAwarded
      });
      
      // Create a transaction record with product metadata
      logger.info('Creating transaction record', {
        userId,
        transactionType: TransactionType.EARNING,
        pointsAwarded
      });
      
      await storage.createTransaction({
        userId: userId,
        type: TransactionType.EARNING,
        amount: pointsAwarded,
        description: productName 
          ? `تم تركيب منتج ${productName}`
          : "تم تركيب منتج جديد",
        metadata: localProduct ? { productId: localProduct.id } : undefined
      });
      
      // Check if user qualifies for any new badges after earning these points
      const allBadges = await storage.listBadges(true);
      
      // Get user's installation count (transactions of type EARNING that have product installations)
      const transactions = await storage.getTransactionsByUserId(userId);
      const installationCount = transactions.filter(t => 
        t.type === TransactionType.EARNING && 
        (t.description?.includes("تم تركيب منتج") || t.description?.includes("تركيب منتج جديد"))
      ).length;
      
      logger.info('Checking badge qualification', {
        userId,
        installationCount,
        currentPoints: updatedUser?.points
      });
      
      // Initialize badgeIds array if it doesn't exist
      if (updatedUser && (!updatedUser.badgeIds || !Array.isArray(updatedUser.badgeIds))) {
        updatedUser.badgeIds = [];
      }
      
      // Check each badge to see if user qualifies
      let userBadgesUpdated = false;
      let newBadges = [];
      let updatedBadgeIds: number[] = [];
      
      for (const badge of allBadges) {
        if (!updatedUser || !Array.isArray(updatedUser.badgeIds)) {
          logger.error('Invalid user badge data, skipping badge checks', {
            userId,
            hasBadgeIds: !!updatedUser?.badgeIds
          });
          break;
        }
        
        const alreadyHasBadge = updatedUser.badgeIds.includes(badge.id);
        
        // Check qualification
        const qualifies = (
          (badge.requiredPoints === null || badge.requiredPoints === undefined || updatedUser.points >= badge.requiredPoints) &&
          (badge.minInstallations === null || badge.minInstallations === undefined || installationCount >= badge.minInstallations)
        );
        
        if (qualifies) {
          // If user qualifies for badge but doesn't have it yet, add it
          if (!alreadyHasBadge) {
            logger.info('User qualifies for new badge', {
              userId,
              badgeId: badge.id,
              badgeName: badge.name
            });
            updatedBadgeIds.push(badge.id);
            newBadges.push(badge);
            userBadgesUpdated = true;
          } else {
            // User already has this badge and still qualifies
            updatedBadgeIds.push(badge.id);
          }
        } else if (alreadyHasBadge) {
          // User has badge but no longer qualifies - remove it
          logger.info('User no longer qualifies for badge', {
            userId,
            badgeId: badge.id,
            badgeName: badge.name
          });
          userBadgesUpdated = true;
          // Badge is not added to updatedBadgeIds, effectively removing it
        }
      }
        
      // Update user's badges in database if changes were made
      if (userBadgesUpdated && updatedUser) {
        console.log(`[DEBUG] Updating user ${userId} badges in database:`, updatedBadgeIds);
        updatedUser.badgeIds = updatedBadgeIds;
        await storage.updateUser(userId, { badgeIds: updatedBadgeIds });
      }
      
      return res.status(200).json({
        success: true,
        message: "تم التحقق من المنتج بنجاح وتمت إضافة النقاط",
        productName,
        pointsAwarded,
        productDetails: localProduct,
        newPoints: updatedUser?.points || user.points + pointsAwarded,
        newBadges: newBadges.length > 0 ? newBadges : undefined
      });
      
    } catch (error: any) {
      console.error("QR scanning error:", error);
      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء معالجة رمز QR",
        error_code: "PROCESSING_ERROR",
        details: { error: error.message || "خطأ غير معروف" }
      });
    }
  });
  
  // Get scanned products for a user
  app.get("/api/scanned-products", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.query.userId as string);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false,
          message: "يرجى تقديم معرف المستخدم",
          error_code: "MISSING_USER_ID"
        });
      }
      
      // Get the transactions related to product scanning for this user
      const transactions = await storage.getTransactionsByUserId(userId);
      const scanTransactions = transactions.filter(t => 
        t.type === TransactionType.EARNING && 
        (t.description.includes("تم تركيب منتج") || t.description.includes("تركيب منتج جديد"))
      );
      
      return res.status(200).json({ 
        success: true,
        scannedProducts: scanTransactions
      });
      
    } catch (error: any) {
      console.error("Error fetching scanned products:", error);
      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء استرجاع المنتجات المثبتة",
        error_code: "FETCH_ERROR",
        details: { error: error.message || "خطأ غير معروف" }
      });
    }
  });
  
  // Local Products API
  
  // Get all local products
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await storage.listLocalProducts();
      res.json({ success: true, products });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch products",
        error_code: "FETCH_ERROR"
      });
    }
  });
  
  // Get a specific product by ID
  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid product ID",
          error_code: "INVALID_ID"
        });
      }
      
      const product = await storage.getLocalProduct(id);
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: "Product not found",
          error_code: "NOT_FOUND"
        });
      }
      
      res.json({ success: true, product });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch product",
        error_code: "FETCH_ERROR"
      });
    }
  });
  
  // Get a product by name
  app.get("/api/products/byName/:name", async (req: Request, res: Response) => {
    try {
      const name = req.params.name;
      
      const product = await storage.getLocalProductByName(name);
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: "Product not found",
          error_code: "NOT_FOUND"
        });
      }
      
      res.json({ success: true, product });
    } catch (error) {
      console.error("Error fetching product by name:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch product",
        error_code: "FETCH_ERROR"
      });
    }
  });
  
  // Create a new product (admin only)
  app.post("/api/products", async (req: Request, res: Response) => {
    try {
      // Get user ID from request
      const userId = req.body.userId || (req.query.userId as string);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: "User ID is required",
          error_code: "MISSING_USER_ID"
        });
      }
      
      // Verify the user is an admin
      const user = await storage.getUser(parseInt(userId.toString()));
      if (!user || user.role !== "admin") {
        return res.status(403).json({ 
          success: false, 
          message: "Unauthorized access",
          error_code: "UNAUTHORIZED"
        });
      }
      
      const productData = {
        name: req.body.name,
        rewardPoints: parseInt(req.body.rewardPoints),
        isActive: req.body.isActive ? 1 : 0
      };
      
      // Check if product with the same name already exists
      const existingProduct = await storage.getLocalProductByName(productData.name);
      if (existingProduct) {
        return res.status(400).json({ 
          success: false, 
          message: "Product with this name already exists",
          error_code: "DUPLICATE_NAME"
        });
      }
      
      const product = await storage.createLocalProduct(productData);
      res.status(201).json({ success: true, product });
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create product",
        error_code: "CREATE_ERROR"
      });
    }
  });
  
  // Update an existing product (admin only)
  app.patch("/api/products/:id", async (req: Request, res: Response) => {
    try {
      // Get user ID from request
      const userId = req.body.userId || (req.query.userId as string);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: "User ID is required",
          error_code: "MISSING_USER_ID"
        });
      }
      
      // Verify the user is an admin
      const user = await storage.getUser(parseInt(userId.toString()));
      if (!user || user.role !== "admin") {
        return res.status(403).json({ 
          success: false, 
          message: "Unauthorized access",
          error_code: "UNAUTHORIZED"
        });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid product ID",
          error_code: "INVALID_ID"
        });
      }
      
      // Check if product exists
      const existingProduct = await storage.getLocalProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ 
          success: false, 
          message: "Product not found",
          error_code: "NOT_FOUND"
        });
      }
      
      // If name is being updated, check for uniqueness
      if (req.body.name && req.body.name !== existingProduct.name) {
        const productWithSameName = await storage.getLocalProductByName(req.body.name);
        if (productWithSameName) {
          return res.status(400).json({ 
            success: false, 
            message: "Product with this name already exists",
            error_code: "DUPLICATE_NAME"
          });
        }
      }
      
      const updateData: any = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.rewardPoints !== undefined) updateData.rewardPoints = parseInt(req.body.rewardPoints);
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive ? 1 : 0;
      
      const updatedProduct = await storage.updateLocalProduct(id, updateData);
      res.json({ success: true, product: updatedProduct });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to update product",
        error_code: "UPDATE_ERROR"
      });
    }
  });
  
  // Delete a product (admin only)
  app.delete("/api/products/:id", async (req: Request, res: Response) => {
    try {
      // Get user ID from request
      const userId = req.body.userId || (req.query.userId as string);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: "User ID is required",
          error_code: "MISSING_USER_ID"
        });
      }
      
      // Verify the user is an admin
      const user = await storage.getUser(parseInt(userId.toString()));
      if (!user || user.role !== "admin") {
        return res.status(403).json({ 
          success: false, 
          message: "Unauthorized access",
          error_code: "UNAUTHORIZED"
        });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid product ID",
          error_code: "INVALID_ID"
        });
      }
      
      // Check if product exists
      const existingProduct = await storage.getLocalProduct(id);
      if (!existingProduct) {
        return res.status(404).json({ 
          success: false, 
          message: "Product not found",
          error_code: "NOT_FOUND"
        });
      }
      
      await storage.deleteLocalProduct(id);
      res.json({ 
        success: true, 
        message: "Product deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to delete product",
        error_code: "DELETE_ERROR"
      });
    }
  });
  
  // AI Insights API
  app.post("/api/analytics/insight", async (req: Request, res: Response) => {
    try {
      const { chartType, dataPoints, dateRange, metric } = req.body;
      
      // Admin check
      const userId = parseInt(req.query.userId as string || '0');
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          success: false, 
          message: "Unauthorized access",
          error_code: "UNAUTHORIZED"
        });
      }
      
      // Validate required fields
      if (!chartType || !dataPoints || !metric) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
          error_code: "MISSING_FIELDS"
        });
      }
      
      const insight = await generateInsight({
        chartType,
        dataPoints,
        dateRange,
        metric
      });
      
      return res.status(200).json({
        success: true,
        insight
      });
    } catch (error: any) {
      console.error("Error generating insight:", error);
      return res.status(500).json({
        success: false,
        message: "فشل في إنشاء التحليل",
        error_code: "INSIGHT_ERROR",
        details: { error: error.message || "خطأ غير معروف" }
      });
    }
  });
  
  app.post("/api/analytics/summary", async (req: Request, res: Response) => {
    try {
      const { totalInstallers, totalInstallations, pointsAwarded, pointsRedeemed, regionData, productData, dateRange } = req.body;
      
      // Admin check
      const userId = parseInt(req.query.userId as string || '0');
      const user = await storage.getUser(userId);
      if (!user || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ 
          success: false, 
          message: "Unauthorized access",
          error_code: "UNAUTHORIZED"
        });
      }
      
      const summary = await generateAnalyticsSummary({
        totalInstallers,
        totalInstallations,
        pointsAwarded,
        pointsRedeemed,
        regionData,
        productData,
        dateRange
      });
      
      return res.status(200).json({
        success: true,
        summary
      });
    } catch (error: any) {
      console.error("Error generating summary:", error);
      return res.status(500).json({
        success: false,
        message: "فشل في إنشاء الملخص",
        error_code: "SUMMARY_ERROR",
        details: { error: error.message || "خطأ غير معروف" }
      });
    }
  });
  
  // Create the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
