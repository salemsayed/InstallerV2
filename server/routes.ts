import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import {
  UserRole, UserStatus, TransactionType, ActivityType,
  requestOtpSchema, verifyOtpSchema, insertUserSchema,
  pointsAllocationSchema
} from "@shared/schema";
import { createTransport } from "nodemailer";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Import SMS service
  const { smsService } = await import('./sms');
  
  // Import manufacturing database functions
  const { checkSerialNumber, getProductNameBySerialNumber } = await import('./manufacturing');

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
      const isValid = smsService.verifyOtp(formattedPhone, otp);
      
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
      
      // Format phone to international format if needed
      if (userData.phone.startsWith('0')) {
        userData.phone = '+2' + userData.phone;
      }
      
      // Check if phone is already in use
      const existingUser = await storage.getUserByPhone(userData.phone);
      if (existingUser) {
        return res.status(400).json({ message: "رقم الهاتف مستخدم بالفعل." });
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
          phone: newUser.phone,
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
  
  // Update user
  app.patch("/api/admin/users/:userId", async (req: Request, res: Response) => {
    const adminId = parseInt(req.query.userId as string);
    const targetUserId = parseInt(req.params.userId);
    
    if (!adminId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      // Validate input data
      let { name, phone, region, status, points } = req.body;
      
      // Format phone to international format if needed
      if (phone && phone.startsWith('0')) {
        phone = '+2' + phone;
      }
      
      // Update user data
      const updatedUser = await storage.updateUser(targetUserId, {
        name,
        phone,
        region,
        status,
        points
      });
      
      if (!updatedUser) {
        return res.status(404).json({ 
          success: false,
          message: "لم يتم العثور على المستخدم."
        });
      }
      
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
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء تحديث بيانات المستخدم" 
      });
    }
  });
  
  // Delete user
  app.delete("/api/admin/users/:userId", async (req: Request, res: Response) => {
    const adminId = parseInt(req.query.userId as string);
    const targetUserId = parseInt(req.params.userId);
    
    if (!adminId) {
      return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      // Check if user exists
      const targetUser = await storage.getUser(targetUserId);
      
      if (!targetUser) {
        return res.status(404).json({ 
          success: false,
          message: "لم يتم العثور على المستخدم."
        });
      }
      
      // Prevent deleting yourself
      if (targetUserId === adminId) {
        return res.status(400).json({
          success: false,
          message: "لا يمكن حذف حسابك الخاص."
        });
      }
      
      const result = await storage.deleteUser(targetUserId);
      
      if (!result) {
        return res.status(500).json({
          success: false,
          message: "فشل حذف المستخدم. يرجى المحاولة مرة أخرى."
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "تم حذف المستخدم بنجاح"
      });
      
    } catch (error: any) {
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
  
  // QR code scanning endpoint
  app.post("/api/scan-qr", async (req: Request, res: Response) => {
    console.log('[DEBUG] POST /api/scan-qr received with body:', req.body);
    try {
      const { uuid, userId } = req.body;
      
      if (!uuid || !userId) {
        return res.status(400).json({ 
          success: false, 
          message: "Please provide both user ID and QR code",
          error_code: "MISSING_PARAMS",
          details: { missing: !uuid ? "uuid" : "userId" } 
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
      console.log(`[DEBUG] About to check UUID in manufacturing database: "${uuid}"`);
      
      // Try different formats - sometimes UUIDs might be stored differently
      const uuidNoHyphens = uuid.replace(/-/g, '');
      console.log(`[DEBUG] UUID without hyphens: "${uuidNoHyphens}"`);
      
      // First try with normal UUID format
      console.log(`[DEBUG] Checking with original UUID format`);
      let isValid = await checkSerialNumber(uuid);
      
      // If not found, try without hyphens
      if (!isValid) {
        console.log(`[DEBUG] Original UUID not found, trying without hyphens`);
        isValid = await checkSerialNumber(uuidNoHyphens);
      }
      
      if (!isValid) {
        console.log(`[DEBUG] UUID not found in manufacturing database: ${uuid}`);
        return res.status(400).json({ 
          success: false, 
          message: "This product is not registered in our manufacturing database",
          error_code: "INVALID_PRODUCT",
          details: { uuid, uuidNoHyphens }
        });
      }
      
      console.log(`[DEBUG] UUID found in manufacturing database: ${uuid}`);
      
      // Get product details from manufacturing database
      const productName = await getProductNameBySerialNumber(uuid);
      console.log(`[DEBUG] Product name from manufacturing database: "${productName}"`);
      
      // Find matching product in our local database to determine reward points
      let pointsAwarded = 10; // Default points if no match found
      let localProduct = null;
      
      if (productName) {
        // Look up the product name in our local database
        localProduct = await storage.getLocalProductByName(productName);
        console.log(`[DEBUG] Local product match:`, localProduct);
        
        if (localProduct && localProduct.isActive === 1) {
          // Use the reward points defined in our local database
          pointsAwarded = localProduct.rewardPoints;
          console.log(`[DEBUG] Using custom reward points: ${pointsAwarded} for product: ${productName}`);
        } else {
          console.log(`[DEBUG] No active local product match found for: "${productName}". Using default points.`);
        }
      }
      
      // Save the scanned code to database with product reference if available
      const scannedCode = await storage.createScannedCode({
        uuid,
        scannedBy: parseInt(userId.toString()),
        productName: productName || undefined,
        productId: localProduct ? localProduct.id : undefined
      });
      
      // Add points to the user for scanning
      const user = await storage.getUser(parseInt(userId.toString()));
      if (user) {
        const updatedUser = await storage.updateUser(user.id, {
          points: user.points + pointsAwarded
        });
        
        // Create a transaction record with product metadata
        await storage.createTransaction({
          userId: user.id,
          type: TransactionType.EARNING,
          amount: pointsAwarded,
          description: productName 
            ? `تم تركيب منتج ${productName}`
            : "تم تركيب منتج جديد",
          metadata: localProduct ? { productId: localProduct.id } : undefined
        });
        
        return res.status(200).json({
          success: true,
          message: "تم التحقق من المنتج بنجاح وتمت إضافة النقاط",
          productName,
          pointsAwarded,
          productDetails: localProduct,
          newPoints: updatedUser?.points || user.points + pointsAwarded
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "User not found",
          error_code: "USER_NOT_FOUND",
          details: { userId }
        });
      }
      
    } catch (error: any) {
      console.error("QR scanning error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while processing the QR code",
        error_code: "PROCESSING_ERROR",
        details: { error: error.message || "Unknown error" }
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
          message: "Please provide a user ID",
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
        message: "Error retrieving installed products",
        error_code: "FETCH_ERROR",
        details: { error: error.message || "Unknown error" }
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
      if (!req.user || req.user.role !== UserRole.ADMIN) {
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
      if (!req.user || req.user.role !== UserRole.ADMIN) {
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
      if (!req.user || req.user.role !== UserRole.ADMIN) {
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
  
  // Create the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
