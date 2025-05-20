import { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { UserRole, UserStatus, ActivityType, requestOtpSchema, verifyOtpSchema, pointsAllocationSchema, redeemRewardSchema } from "../shared/schema";
import { eq, gt, gte, lt, lte, sql, and, count, desc, inArray, between } from "drizzle-orm";
import { randomUUID } from "crypto";
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
  
  // API base URLs
  const WASAGE_API_BASE_URL = 'https://wasage.com/api/otp/';

  // AUTH ROUTES
  // WhatsApp Authentication with Wasage
  app.post("/api/auth/wasage/otp", async (req: Request, res: Response) => {
    try {
      // Generate a unique reference ID as a single continuous word
      const timestamp = Date.now();
      const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      const reference = `webapp${timestamp}${randomPart}`;
      
      console.log("[DEBUG WASAGE] Requesting OTP from Wasage API");
      
      // Call Wasage API to request OTP
      const wasageResponse = await fetch(WASAGE_API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          Username: process.env.WASAGE_USER,
          Password: process.env.WASAGE_PASS,
          Reference: reference,
          Message: "Welcome to BAREEQ Installers. Need help? 0109990555"
        })
      });
      
      // Parse response from Wasage
      const responseData = await wasageResponse.json();
      console.log("[DEBUG WASAGE] Response:", responseData);
      
      // Check if Wasage request was successful
      if (responseData.Code === "5500") {
        return res.json({
          success: true,
          qrImageUrl: responseData.QR,
          clickableUrl: responseData.Clickable,
          otp: responseData.OTP,
          reference: reference
        });
      } else {
        console.error("[ERROR WASAGE] Failed to generate OTP:", responseData);
        return res.status(400).json({
          success: false,
          message: "فشل في إنشاء رمز تحقق واتساب، يرجى المحاولة مرة أخرى"
        });
      }
    } catch (error) {
      console.error("[ERROR WASAGE] Exception:", error);
      return res.status(500).json({
        success: false,
        message: "حدث خطأ في الخادم، يرجى المحاولة مرة أخرى"
      });
    }
  });
  
  // Test endpoint for Wasage callback
  app.get("/api/wasage/test", async (req: Request, res: Response) => {
    console.log("[DEBUG WASAGE TEST] Test endpoint called with query:", req.query);
    return res.json({
      success: true,
      message: "Test endpoint working"
    });
  });
  
  // Endpoint to clear authentication errors
  app.post("/api/auth/wasage/clear-error", async (req: Request, res: Response) => {
    try {
      console.log("[DEBUG WASAGE] Clearing all authentication errors");
      
      // Find and remove any error entries
      const referencesToClear: string[] = [];
      
      authenticationResults.forEach((value, key) => {
        if (!value.success && value.errorCode) {
          referencesToClear.push(key);
        }
      });
      
      // Remove the entries
      referencesToClear.forEach(ref => {
        authenticationResults.delete(ref);
      });
      
      console.log(`[DEBUG WASAGE] Cleared ${referencesToClear.length} error entries`);
      
      return res.json({
        success: true,
        message: "All errors cleared"
      });
    } catch (error) {
      console.error("[ERROR WASAGE] Error clearing authentication errors:", error);
      return res.status(500).json({
        success: false,
        message: "Error clearing authentication errors"
      });
    }
  });
  
  // Status check endpoint for WhatsApp authentication
  app.get("/api/auth/wasage/status", async (req: Request, res: Response) => {
    try {
      // Get and trim reference to ensure consistent matching
      const reference = req.query.reference ? String(req.query.reference).trim() : null;
      
      console.log("[DEBUG WASAGE STATUS] Checking authentication status for reference:", reference);
      
      if (!reference) {
        return res.status(400).json({
          success: false,
          message: "Missing reference parameter"
        });
      }
      
      // Check if the reference exists in our authentication results map
      const storedReferences = Array.from(authenticationResults.keys());
      console.log(`[DEBUG WASAGE STATUS] Checking if reference "${reference}" is authenticated. Current references:`, 
        storedReferences.map(ref => `"${ref}"`));
      
      // Get latest error (if any) to pass to the current reference
      // This helps with error propagation between different stages of authentication
      let latestErrorReference = storedReferences.find(ref => {
        const result = authenticationResults.get(ref);
        return result && !result.success && result.errorCode === "USER_NOT_REGISTERED";
      });
      
      if (latestErrorReference && !authenticationResults.has(reference)) {
        console.log(`[DEBUG WASAGE STATUS] Found unregistered phone error, propagating to current reference: ${reference}`);
        const errorInfo = authenticationResults.get(latestErrorReference);
        if (errorInfo && !errorInfo.success) {
          // Copy the error to the current reference
          authenticationResults.set(reference, {
            success: false,
            errorCode: errorInfo.errorCode,
            errorMessage: errorInfo.errorMessage
          });
        }
      }
      
      // Try to find the reference in our map
      const authInfo = authenticationResults.get(reference);
      
      // If the reference exists in our map, return the result (success or error)
      if (authInfo) {
        console.log(`[DEBUG WASAGE STATUS] Reference ${reference} found in results:`, authInfo);
        
        if (authInfo.success) {
          // Successful authentication
          return res.json({
            success: true,
            authenticated: true,
            userId: authInfo.userId,
            userRole: authInfo.userRole,
            message: "Authentication successful"
          });
        } else {
          // Authentication error
          return res.json({
            success: false,
            authenticated: false,
            errorCode: authInfo.errorCode,
            message: authInfo.errorMessage,
          });
        }
      }
      
      // By default, not authenticated until callback is received
      const authenticated = false;
      const userId = undefined;
      const userRole = undefined;
      
      return res.json({
        success: true,
        authenticated,
        userId,
        userRole,
        message: "Authentication status check successful"
      });
    } catch (error) {
      console.error("[ERROR WASAGE STATUS] Error checking status:", error);
      return res.status(500).json({
        success: false,
        message: "Error checking authentication status"
      });
    }
  });

  // Wasage callback endpoint - handles both POST and GET requests
  // Store authentication results in memory (in a real app, this would be in a database)
  // This map stores both successful authentications and authentication errors
  const authenticationResults = new Map<string, { 
    success: boolean;
    userId?: number; 
    userRole?: string;
    errorCode?: string;
    errorMessage?: string;
  }>();
  
  app.all("/api/wasage/callback", async (req: Request, res: Response) => {
    try {
      // Log both query parameters and body for debugging
      console.log("[DEBUG WASAGE CALLBACK] Received callback request with query:", req.query);
      console.log("[DEBUG WASAGE CALLBACK] Received callback request with body:", req.body);
      
      // Extract data from either query parameters (GET) or request body (POST)
      // Based on the example URL format: /api/wasage/callback?OTP=xxx&Mobile=xxx&Reference=xxx&Secret=xxx
      const otp = req.query.OTP || req.body.otp;
      const phoneNumber = req.query.Mobile || req.body.phoneNumber;
      const callbackReference = req.query.Reference || req.body.reference;
      
      if (!phoneNumber) {
        console.error("[ERROR WASAGE CALLBACK] Missing phone number in callback");
        return res.status(400).json({ 
          success: false, 
          message: "Missing phone number"
        });
      }
      
      // Format phone number (ensure consistent format with DB)
      let formattedPhone = String(phoneNumber);
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      // Find user by phone number
      const user = await storage.getUserByPhone(formattedPhone);
      
      if (!user) {
        console.error(`[ERROR WASAGE CALLBACK] User not found for phone: ${formattedPhone}`);
        
        // Store the error in our authentication results map
        if (callbackReference) {
          const trimmedReference = String(callbackReference).trim();
          console.log(`[DEBUG WASAGE CALLBACK] Storing error for reference: "${trimmedReference}"`);
          
          // Also store the error for the current reference being checked
          // This allows the polling system to find the error
          const referencesArray = Array.from(authenticationResults.keys());
          console.log(`[DEBUG WASAGE CALLBACK] Current references in system: ${referencesArray.length} references`);
          
          // Store error for each active reference (in a real system we'd store this in a database)
          if (referencesArray.length > 0) {
            const lastReference = referencesArray[referencesArray.length - 1];
            console.log(`[DEBUG WASAGE CALLBACK] Also storing error for active reference: "${lastReference}"`);
            
            authenticationResults.set(lastReference, {
              success: false,
              errorCode: "USER_NOT_REGISTERED",
              errorMessage: "تعذر العثور على رقم الهاتف هذا. يرجى التواصل مع الدعم الفني على 0109990555 للمساعدة."
            });
          }
          
          authenticationResults.set(trimmedReference, {
            success: false,
            errorCode: "USER_NOT_REGISTERED",
            errorMessage: "تعذر العثور على رقم الهاتف هذا. يرجى التواصل مع الدعم الفني على 0109990555 للمساعدة."
          });
        }
        
        return res.status(404).json({ 
          success: false, 
          message: "تعذر العثور على رقم الهاتف هذا. يرجى التواصل مع الدعم الفني على 0109990555 للمساعدة.",
          errorCode: "USER_NOT_REGISTERED" 
        });
      }
      
      console.log(`[DEBUG WASAGE CALLBACK] User found:`, {
        id: user.id,
        name: user.name,
        role: user.role
      });
      
      // Extract the reference from the request if available
      if (callbackReference) {
        // Trim any whitespace from the reference for consistency
        const trimmedReference = String(callbackReference).trim();
        console.log(`[DEBUG WASAGE CALLBACK] Trimmed reference: "${trimmedReference}"`);
        
        // Store the authenticated reference with user information
        authenticationResults.set(trimmedReference, {
          success: true,
          userId: user.id,
          userRole: user.role
        });
        
        console.log(`[DEBUG WASAGE CALLBACK] Stored authenticated reference: ${trimmedReference} for user:`, {
          userId: user.id,
          userRole: user.role
        });
      }
      
      // Create session for user (similar to existing login flow)
      if (req.session) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        await req.session.save();
        console.log(`[DEBUG WASAGE CALLBACK] Session created for user ${user.id}`);
      }
      
      return res.json({ 
        success: true,
        userId: user.id,
        userRole: user.role,
        message: "Authentication successful" 
      });
    } catch (error) {
      console.error("[ERROR WASAGE CALLBACK] Processing error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });
  
  // Request OTP for SMS authentication
  app.post("/api/auth/request-otp", async (req: Request, res: Response) => {
    try {
      const { phone } = requestOtpSchema.parse(req.body);
      
      // Format phone number - ensure it has the +2 prefix for Egyptian numbers
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+') && formattedPhone.startsWith('0')) {
        formattedPhone = '+2' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      // Check if phone number exists in our database
      const user = await storage.getUserByPhone(formattedPhone);
      
      if (!user) {
        return res.status(404).json({ 
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
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        message: "رمز التحقق غير صالح." 
      });
    }
  });

  // Get current user
  app.get("/api/users/me", async (req: Request, res: Response) => {
    try {
      // If using Replit auth
      if (req.session && req.session.userId) {
        const userId = req.session.userId;
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        return res.json(user);
      }
      
      return res.status(401).json({ message: "Not authenticated" });
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Error fetching user" });
    }
  });

  // ADMIN ROUTES
  // Create a new user (admin only)
  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      // Validate the request data
      const userData = req.body;
      
      // Create the user
      const user = await storage.createUser(userData);
      
      return res.status(201).json(user);
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Invalid user data",
          errors: error.errors
        });
      }
      return res.status(500).json({ message: "Error creating user" });
    }
  });
  
  // Get all users (admin only)
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 100;
      const offset = req.query.offset ? parseInt(String(req.query.offset)) : 0;
      
      const users = await storage.listUsers(limit, offset);
      return res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Error fetching users" });
    }
  });
  
  // Update a user (admin only)
  app.patch("/api/admin/users/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const userData = req.body;
      
      // Ensure phone number is formatted correctly if provided
      if (userData.phone && !userData.phone.startsWith('+')) {
        userData.phone = '+' + userData.phone;
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Error updating user" });
    }
  });
  
  // Delete a user (admin only)
  app.delete("/api/admin/users/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const deleted = await storage.deleteUser(userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json({ message: "User deleted" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Error deleting user" });
    }
  });
  
  // Allocate points to a user (admin only)
  app.post("/api/admin/points", async (req: Request, res: Response) => {
    try {
      // Validate the request
      const pointsData = pointsAllocationSchema.parse(req.body);
      
      // Get user
      const user = await storage.getUser(pointsData.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create the transaction
      const transaction = await storage.createTransaction({
        userId: pointsData.userId,
        points: pointsData.points,
        type: pointsData.type,
        description: pointsData.description,
        activity: pointsData.activity,
        createdAt: new Date(),
      });
      
      // Update user's points balance
      const newBalance = await storage.calculateUserPointsBalance(pointsData.userId);
      await storage.updateUser(pointsData.userId, { points: newBalance });
      
      return res.status(201).json({
        transaction,
        newBalance
      });
    } catch (error: any) {
      console.error("Error allocating points:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Invalid points data",
          errors: error.errors
        });
      }
      return res.status(500).json({ message: "Error allocating points" });
    }
  });
  
  // TRANSACTION ROUTES
  // Get user's transactions
  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      // Get user from session
      let userId: number;
      if (req.query.userId) {
        userId = parseInt(String(req.query.userId));
      } else if (req.session && req.session.userId) {
        userId = req.session.userId;
      } else {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get transactions
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 100;
      const transactions = await storage.getTransactionsByUserId(userId, limit);
      
      // Get current point balance
      const pointsBalance = await storage.calculateUserPointsBalance(userId);
      
      // Group transactions by month and year for reporting
      const groupedTransactions = new Map();
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      let thisMonthPoints = 0;
      
      for (const transaction of transactions) {
        const date = new Date(transaction.createdAt || Date.now());
        const month = date.getMonth();
        const year = date.getFullYear();
        
        console.log(`DEBUG: Transaction ${transaction.id} date parsed as ${date}, Month: ${month}, Year: ${year}`);
        
        // Check if this transaction is from current month
        if (month === currentMonth && year === currentYear) {
          console.log(`DEBUG: Transaction ${transaction.id} current month check: ${month === currentMonth}, ${month} === ${currentMonth}, ${year} === ${currentYear}`);
          console.log(`DEBUG: Examining transaction ${transaction.id} type: ${transaction.type}, points: ${transaction.points}`);
          
          if (transaction.type === "earning") {
            thisMonthPoints += transaction.points;
          }
        }
        
        const key = `${year}-${month}`;
        if (!groupedTransactions.has(key)) {
          groupedTransactions.set(key, {
            month,
            year,
            transactions: []
          });
        }
        
        groupedTransactions.get(key).transactions.push(transaction);
      }
      
      // Convert map to array and sort by date (newest first)
      const monthlyTransactions = Array.from(groupedTransactions.values())
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
      
      return res.json({
        transactions,
        monthlyTransactions,
        pointsBalance,
        thisMonthPoints
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ message: "Error fetching transactions" });
    }
  });
  
  // Get all transactions (admin only)
  app.get("/api/admin/transactions", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 100;
      
      const transactions = await storage.getAllTransactions(limit);
      return res.json(transactions);
    } catch (error) {
      console.error("Error fetching all transactions:", error);
      return res.status(500).json({ message: "Error fetching all transactions" });
    }
  });
  
  // BADGE ROUTES
  // Get all badges
  app.get("/api/badges", async (req: Request, res: Response) => {
    try {
      const active = req.query.active === 'true';
      const badges = await storage.listBadges(active);
      return res.json(badges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      return res.status(500).json({ message: "Error fetching badges" });
    }
  });
  
  // Create a new badge (admin only)
  app.post("/api/admin/badges", async (req: Request, res: Response) => {
    try {
      const badge = await storage.createBadge(req.body);
      return res.status(201).json(badge);
    } catch (error) {
      console.error("Error creating badge:", error);
      return res.status(500).json({ message: "Error creating badge" });
    }
  });
  
  // Update a badge (admin only)
  app.patch("/api/admin/badges/:id", async (req: Request, res: Response) => {
    try {
      const badgeId = parseInt(req.params.id);
      const badge = await storage.updateBadge(badgeId, req.body);
      
      if (!badge) {
        return res.status(404).json({ message: "Badge not found" });
      }
      
      return res.json(badge);
    } catch (error) {
      console.error("Error updating badge:", error);
      return res.status(500).json({ message: "Error updating badge" });
    }
  });
  
  // Delete a badge (admin only)
  app.delete("/api/admin/badges/:id", async (req: Request, res: Response) => {
    try {
      const badgeId = parseInt(req.params.id);
      const deleted = await storage.deleteBadge(badgeId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Badge not found" });
      }
      
      return res.json({ message: "Badge deleted" });
    } catch (error) {
      console.error("Error deleting badge:", error);
      return res.status(500).json({ message: "Error deleting badge" });
    }
  });
  
  // SCAN QR ROUTES
  // Scan a QR code
  app.post("/api/scan-qr", async (req: Request, res: Response) => {
    try {
      console.log("Scan QR request:", req.body);
      const { code, userId } = req.body;
      
      // Validate the request
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: "QR code is required" 
        });
      }
      
      // Get user ID from the request or session
      let scanningUserId: number;
      if (userId) {
        scanningUserId = parseInt(String(userId));
      } else if (req.session && req.session.userId) {
        scanningUserId = req.session.userId;
      } else {
        return res.status(401).json({ 
          success: false,
          message: "User ID is required" 
        });
      }
      
      // Extract the UUID from the QR code
      let uuid: string;
      
      // Handle different QR code formats
      if (code.includes("warranty.bareeq.lighting") || code.includes("w.bareeq.lighting")) {
        // Format: https://warranty.bareeq.lighting/p/{uuid}
        // or: https://w.bareeq.lighting/p/{uuid}
        const urlParts = code.split('/');
        uuid = urlParts[urlParts.length - 1];
      } else if (code.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
        // Format: direct UUID format like: 123e4567-e89b-12d3-a456-426614174000
        uuid = code;
      } else {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid QR code format" 
        });
      }
      
      console.log(`Extracted UUID: ${uuid} for user ${scanningUserId}`);
      
      // Check if the code has already been scanned by this user
      const existingCode = await storage.checkScannedCode(uuid);
      if (existingCode) {
        return res.status(400).json({ 
          success: false, 
          message: "This code has already been scanned",
          alreadyScanned: true
        });
      }
      
      // Check if the code exists in the manufacturing database
      const isValid = await checkSerialNumber(uuid);
      if (!isValid) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid product code" 
        });
      }
      
      // Get the product name from the manufacturing database
      const productName = await getProductNameBySerialNumber(uuid);
      
      // Record the scanned code
      const scannedCode = await storage.createScannedCode({
        uuid,
        scannedBy: scanningUserId,
        productName: productName || undefined
      });
      
      // Allocate points for the scan
      const pointsValue = 10; // Default points for a scan
      
      const transaction = await storage.createTransaction({
        userId: scanningUserId,
        points: pointsValue,
        type: "earning",
        description: `Scanned product: ${productName || "Unknown product"}`,
        activity: "installation",
        createdAt: new Date(),
      });
      
      // Update user's points balance
      const user = await storage.getUser(scanningUserId);
      if (user) {
        const newBalance = await storage.calculateUserPointsBalance(scanningUserId);
        await storage.updateUser(scanningUserId, { points: newBalance });
        
        // Return success response
        return res.json({
          success: true,
          message: "Product scanned successfully",
          pointsEarned: pointsValue,
          newBalance,
          productName: productName || "Unknown product",
          transaction
        });
      } else {
        // This should not happen, but just in case
        return res.status(404).json({ 
          success: false, 
          message: "User not found" 
        });
      }
    } catch (error) {
      console.error("Error scanning QR:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error processing scan" 
      });
    }
  });
  
  // Get user's scanned products
  app.get("/api/scanned-products", async (req: Request, res: Response) => {
    try {
      // Get user from session or query
      let userId: number;
      if (req.query.userId) {
        userId = parseInt(String(req.query.userId));
      } else if (req.session && req.session.userId) {
        userId = req.session.userId;
      } else {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get user's transactions for scanned products
      const transactions = await storage.getTransactionsByUserId(userId);
      const scannedProductTransactions = transactions.filter(t => 
        t.activity === "installation" && t.description.includes("Scanned product")
      );
      
      return res.json({
        scannedProducts: scannedProductTransactions,
        count: scannedProductTransactions.length
      });
    } catch (error) {
      console.error("Error fetching scanned products:", error);
      return res.status(500).json({ message: "Error fetching scanned products" });
    }
  });
  
  // PRODUCT ROUTES
  // Get all products
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const active = req.query.active === 'true';
      const products = await storage.listLocalProducts(active);
      return res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      return res.status(500).json({ message: "Error fetching products" });
    }
  });
  
  // Get a product by ID
  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getLocalProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      return res.status(500).json({ message: "Error fetching product" });
    }
  });
  
  // Get a product by name
  app.get("/api/products/byName/:name", async (req: Request, res: Response) => {
    try {
      const productName = req.params.name;
      const product = await storage.getLocalProductByName(productName);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.json(product);
    } catch (error) {
      console.error("Error fetching product by name:", error);
      return res.status(500).json({ message: "Error fetching product" });
    }
  });
  
  // Create a new product (admin only)
  app.post("/api/products", async (req: Request, res: Response) => {
    try {
      const product = await storage.createLocalProduct(req.body);
      return res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      return res.status(500).json({ message: "Error creating product" });
    }
  });
  
  // Update a product (admin only)
  app.patch("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.updateLocalProduct(productId, req.body);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      return res.status(500).json({ message: "Error updating product" });
    }
  });
  
  // Delete a product (admin only)
  app.delete("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const deleted = await storage.deleteLocalProduct(productId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.json({ message: "Product deleted" });
    } catch (error) {
      console.error("Error deleting product:", error);
      return res.status(500).json({ message: "Error deleting product" });
    }
  });
  
  // AI ANALYTICS ROUTES
  // Generate insights from data
  app.post("/api/analytics/insight", async (req: Request, res: Response) => {
    try {
      const insightData = req.body;
      
      // Generate insight using OpenAI
      const insight = await generateInsight(insightData);
      
      return res.json({
        success: true,
        insight
      });
    } catch (error) {
      console.error("Error generating insight:", error);
      return res.status(500).json({ 
        success: false,
        message: "Error generating insight" 
      });
    }
  });
  
  // Generate a summary for analytics dashboard
  app.post("/api/analytics/summary", async (req: Request, res: Response) => {
    try {
      const data = req.body;
      
      // Generate summary using OpenAI
      const summary = await generateAnalyticsSummary(data);
      
      return res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      return res.status(500).json({ 
        success: false,
        message: "Error generating summary" 
      });
    }
  });

  // Set up Replit authentication if enabled
  if (process.env.REPLIT_DEPLOYMENT && process.env.REPLIT_DB_URL) {
    console.log("Setting up Replit authentication...");
    await setupAuth(app);
  }

  // Return the HTTP server (don't listen here, this will happen in index.ts)
  const http = await import('node:http');
  return http.createServer(app);
}