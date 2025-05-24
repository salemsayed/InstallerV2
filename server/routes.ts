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
  
  // API base URLs
  const WASAGE_API_BASE_URL = 'https://wasage.com/api/otp/';
  
  // Direct, simplified logout endpoint that handles all cases
  app.post("/api/auth/logout", (req, res) => {
    console.log("[LOGOUT] Logout request received with direct implementation");
    
    // If we have an active session in our tracking map, remove it
    if (req.session?.sessionId && activeSessions.has(req.session.sessionId)) {
      console.log(`[LOGOUT] Removing session ${req.session.sessionId} from active sessions map`);
      activeSessions.delete(req.session.sessionId);
    }
    
    // Get environment info for proper cookie clearing
    const isReplit = !!process.env.REPLIT_DOMAINS;
    const sameSite = isReplit ? 'none' : 'lax';
    const secure = isReplit;
    
    // Clear all cookies directly - most important step
    const cookieNames = ['sid', 'connect.sid', 'bareeq.sid'];
    const paths = ['/', '/api', '/auth'];
    
    cookieNames.forEach(name => {
      // Clear for root path
      res.clearCookie(name, {
        path: '/',
        httpOnly: true,
        secure: secure,
        sameSite: sameSite as 'lax' | 'strict' | 'none',
        expires: new Date(0)
      });
      
      // Also clear for all other possible paths
      paths.forEach(path => {
        if (path !== '/') {
          res.clearCookie(name, {
            path,
            httpOnly: true,
            secure: secure,
            sameSite: sameSite as 'lax' | 'strict' | 'none',
            expires: new Date(0)
          });
        }
      });
      
      console.log(`[LOGOUT] Cleared cookie: ${name}`);
    });
    
    // If there is a session, destroy it
    if (req.session) {
      const sessionId = req.session.sessionId;
      
      req.session.destroy(err => {
        if (err) {
          console.error("[LOGOUT] Session destroy error:", err);
        } else {
          console.log(`[LOGOUT] Session ${sessionId} destroyed successfully`);
        }
        
        // Always respond with success, even if session destroy fails
        res.status(200).json({
          success: true,
          message: "Logged out successfully",
          timestamp: Date.now()
        });
      });
    } else {
      // No session to destroy
      res.status(200).json({
        success: true,
        message: "No active session to logout",
        timestamp: Date.now()
      });
    }
  });
  
  // Add a special HTML logout endpoint for direct browser access
  app.get("/auth/logout", (req, res) => {
    console.log("[LOGOUT] HTML logout page requested - sending HTML with auto-redirect");
    
    // If we have an active session in our tracking map, remove it
    if (req.session?.sessionId && activeSessions.has(req.session.sessionId)) {
      activeSessions.delete(req.session.sessionId);
    }
    
    // First, destroy the session
    if (req.session) {
      req.session.destroy(err => {
        if (err) console.error("[LOGOUT] HTML logout session destroy error:", err);
        sendLogoutPage();
      });
    } else {
      // No session to destroy
      sendLogoutPage();
    }
    
    // Helper function to send HTML that includes client-side clearing
    function sendLogoutPage() {
      // Clear primary cookies
      res.clearCookie('sid', { path: '/' });
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('bareeq.sid', { path: '/' });
      
      // Send special HTML page that clears everything and redirects
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>تسجيل الخروج</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding-top: 100px;
              background-color: #f7f7f7;
              direction: rtl;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid #f3f3f3;
              border-top: 4px solid #3498db;
              border-radius: 50%;
              margin: 20px auto;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          <script>
            // Clear all browser storage
            window.onload = function() {
              // Clear storage
              try {
                localStorage.clear();
                sessionStorage.clear();
                
                // Clear all cookies
                document.cookie.split(";").forEach(function(c) {
                  document.cookie = c.replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                
                console.log("All local data cleared");
                
                // Redirect after a short delay
                setTimeout(function() {
                  window.location.replace("/?t=" + Date.now());
                }, 1500);
              } catch(e) {
                console.error("Error during logout cleanup:", e);
                // Force redirect even on error
                window.location.replace("/?t=" + Date.now());
              }
            };
          </script>
        </head>
        <body>
          <h2>جاري تسجيل الخروج...</h2>
          <p>سيتم توجيهك إلى صفحة تسجيل الدخول خلال لحظات</p>
          <div class="spinner"></div>
        </body>
        </html>
      `);
    }
  });
  
  // Store active sessions for management and monitoring
  const activeSessions = new Map<string, {
    userId: number;
    userRole: string;
    createdAt: string;
    lastActive: string;
    ipAddress: string;
    userAgent: string;
    expiresAt: string;
  }>();
  
  // Session activity tracking middleware
  app.use((req, res, next) => {
    if (req.session && req.session.userId && req.session.sessionId) {
      // Update last active timestamp
      req.session.lastActive = new Date().toISOString();
      
      // Store in active sessions map if not already there
      if (!activeSessions.has(req.session.sessionId)) {
        activeSessions.set(req.session.sessionId, {
          userId: req.session.userId,
          userRole: req.session.userRole,
          createdAt: req.session.createdAt,
          lastActive: req.session.lastActive,
          ipAddress: req.session.ipAddress || req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.session.userAgent || req.headers['user-agent'] || 'unknown',
          expiresAt: new Date(Date.now() + (req.session.cookie.maxAge || 28800000)).toISOString()
        });
      } else {
        // Just update the lastActive time
        const session = activeSessions.get(req.session.sessionId);
        if (session) {
          session.lastActive = req.session.lastActive;
          activeSessions.set(req.session.sessionId, session);
        }
      }
    }
    next();
  });

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
      
      // Check if the reference exists in our authenticated references map
      console.log(`[DEBUG WASAGE STATUS] Checking if reference "${reference}" is authenticated. Current authenticated references:`, 
        Array.from(authenticatedReferences.keys()).map(ref => `"${ref}"`));
      
      // Check if there's an error for this reference in our errors map
      if (authenticationErrors.has(reference)) {
        const errorInfo = authenticationErrors.get(reference);
        console.log(`[DEBUG WASAGE STATUS] Reference ${reference} has an error:`, errorInfo);
        
        // Return error information to client
        return res.json({
          success: false,
          authenticated: false,
          error: true,
          message: errorInfo?.message || "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك."
        });
      }
      
      // Try to find the reference in our successful authentications map
      const authInfo = authenticatedReferences.get(reference);
      
      // If the reference exists and has been authenticated through the callback, return the user info
      if (authInfo) {
        console.log(`[DEBUG WASAGE STATUS] Reference ${reference} is authenticated with user:`, authInfo);
        return res.json({
          success: true,
          authenticated: true,
          userId: authInfo.userId,
          userRole: authInfo.userRole,
          message: "Authentication successful"
        });
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
  // Store authenticated references in memory (in a real app, this would be in a database)
  const authenticatedReferences = new Map<string, { userId: number; userRole: string }>();
  // Store authentication errors in memory (in a real app, this would be in a database)
  const authenticationErrors = new Map<string, { message: string; phoneNumber?: string }>();
  
  // Function to clear authentication data after timeout
  const clearAuthenticationData = (reference: string) => {
    setTimeout(() => {
      authenticatedReferences.delete(reference);
      authenticationErrors.delete(reference);
    }, 1000 * 60 * 30); // Clear after 30 minutes
  };
  
  app.all("/api/wasage/callback", async (req: Request, res: Response) => {
    try {
      // Log both query parameters and body for debugging
      console.log("[DEBUG WASAGE CALLBACK] Received callback request with query:", req.query);
      console.log("[DEBUG WASAGE CALLBACK] Received callback request with body:", req.body);
      
      // Extract data from either query parameters (GET) or request body (POST)
      // Based on the example URL format: /api/wasage/callback?OTP=xxx&Mobile=xxx&Reference=xxx&Secret=xxx
      const otp = req.query.OTP || req.body.otp;
      const phoneNumber = req.query.Mobile || req.body.phoneNumber;
      const reference = req.query.Reference || req.body.reference;
      
      if (!phoneNumber) {
        console.error("[ERROR WASAGE CALLBACK] Missing phone number in callback");
        return res.status(400).json({ 
          success: false, 
          message: "Missing phone number"
        });
      }
      
      // Format phone number (ensure consistent format with DB)
      let formattedPhone = phoneNumber;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      // Find user by phone number
      const user = await storage.getUserByPhone(formattedPhone);
      
      if (!user) {
        console.error(`[ERROR WASAGE CALLBACK] User not found for phone: ${formattedPhone}`);
        
        // Store error information for the reference so status check can report it to the client
        if (reference) {
          authenticationErrors.set(reference, {
            message: "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك.",
            phoneNumber: formattedPhone
          });
          
          // Set up cleanup
          clearAuthenticationData(reference);
        }
        
        return res.status(404).json({ 
          success: false, 
          message: "رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المسؤول لإضافة حسابك." 
        });
      }
      
      console.log(`[DEBUG WASAGE CALLBACK] User found:`, {
        id: user.id,
        name: user.name,
        role: user.role
      });
      
      // Extract the reference from the request if available
      let callbackReference = req.query.Reference || req.body.reference;
      
      // Trim any whitespace from the reference for consistency
      if (callbackReference) {
        callbackReference = String(callbackReference).trim();
        console.log(`[DEBUG WASAGE CALLBACK] Trimmed reference: "${callbackReference}"`);
        
        // Store the authenticated reference with user information
        authenticatedReferences.set(callbackReference, {
          userId: user.id,
          userRole: user.role
        });
        
        console.log(`[DEBUG WASAGE CALLBACK] Stored authenticated reference: ${callbackReference} for user:`, {
          userId: user.id,
          userRole: user.role
        });
      }
      
      // Enhanced session management - Create a robust session for the WhatsApp login flow
      if (req.session) {
        console.log(`[WASAGE AUTH] Creating session for user ${user.id} (${user.name})`);
        
        try {
          // Store essential user details
          req.session.userId = user.id;
          req.session.userRole = user.role;
          
          // Add security-related metadata
          req.session.createdAt = new Date().toISOString();
          req.session.lastActive = new Date().toISOString();
          req.session.ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
          req.session.userAgent = req.headers['user-agent'] || 'unknown';
          
          // Generate a unique session ID for tracking and revocation
          req.session.sessionId = `wasage_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // Set session expiration (24 hours)
          req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours for better persistence
          
          // Re-check and force proper cookie settings for maximum compatibility
          req.session.cookie.secure = false;
          req.session.cookie.sameSite = 'none';
          req.session.cookie.path = '/';
          
          // Save session - use promises for reliable async handling
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error(`[WASAGE AUTH ERROR] Failed to save session:`, err);
                reject(err);
                return;
              }
              console.log(`[WASAGE AUTH] Session saved successfully with ID ${req.session.sessionId}`);
              resolve();
            });
          });
          
          console.log(`[WASAGE AUTH] Enhanced session created for user ${user.id} with session ID ${req.session.sessionId}`);
        } catch (sessionError) {
          console.error(`[WASAGE AUTH ERROR] Session creation error:`, sessionError);
        }
      } else {
        console.error(`[WASAGE AUTH ERROR] No session object available for WhatsApp auth`);
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
      
      // Enhanced session management with improved robustness for SMS login flow
      if (req.session) {
        console.log(`[SMS AUTH] Creating session for user ${user.id} (${user.name})`);
        
        try {
          // Store essential user details - Important keys that must be set
          req.session.userId = user.id;
          req.session.userRole = user.role;
          
          // Add security-related metadata
          req.session.createdAt = new Date().toISOString();
          req.session.lastActive = new Date().toISOString();
          req.session.ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
          req.session.userAgent = req.headers['user-agent'] || 'unknown';
          
          // Generate a unique session ID for tracking and revocation
          req.session.sessionId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // Set session expiration (1 week) - longer for better persistence across environments
          req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; 
          
          // CRITICAL: Set cookie settings for maximum cross-environment compatibility
          // These settings must work in both development and production
          req.session.cookie.secure = false; // Works everywhere
          req.session.cookie.sameSite = 'lax'; // Most compatible setting
          req.session.cookie.path = '/';
          req.session.cookie.httpOnly = true;
          
          // Save session with promise-based approach
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error(`[SMS AUTH ERROR] Failed to save session:`, err);
                reject(err);
                return;
              }
              console.log(`[SMS AUTH] Session saved successfully with ID ${req.session.sessionId}`);
              resolve();
            });
          });
          
          // Add a special header to maintain auth state across redirects
          res.setHeader('X-Auth-Token', req.session.sessionId);
          
          console.log(`[SMS AUTH] Enhanced session created for user ${user.id} with session ID ${req.session.sessionId}`);
        } catch (sessionError) {
          console.error(`[SMS AUTH ERROR] Session creation error:`, sessionError);
        }
      } else {
        console.error(`[SMS AUTH ERROR] No session object available for SMS auth`);
      }
      
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

  // Session management endpoints
  app.get("/api/auth/sessions", async (req: Request, res: Response) => {
    // Get the userId from secure session only - removing query parameter for security
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const userId = req.session.userId;
    
    // Collect all sessions for the current user
    const userSessions = Array.from(activeSessions.entries())
      .filter(([_, session]) => session.userId === userId)
      .map(([sessionId, session]) => {
        // Calculate if this is the current session
        const isCurrentSession = req.session && req.session.sessionId === sessionId;
        
        return {
          sessionId,
          createdAt: session.createdAt,
          lastActive: session.lastActive,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress,
          // Truncate user agent to just the essential info
          device: parseUserAgent(session.userAgent),
          isCurrentSession
        };
      });
    
    return res.json({
      success: true,
      sessions: userSessions
    });
  });
  
  app.delete("/api/auth/sessions/:sessionId", async (req: Request, res: Response) => {
    // Get the userId from either the session or the query parameter for backward compatibility
    const userId = req.session?.userId || parseInt(req.query.userId as string);
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "غير مصرح. يرجى تسجيل الدخول." });
    }
    
    const { sessionId } = req.params;
    
    // Check if session exists and belongs to the current user
    const session = activeSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    }
    
    // If trying to delete current session, logout entirely
    if (req.session && req.session.sessionId === sessionId) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ success: false, message: "فشل في إنهاء الجلسة" });
        }
        
        // Remove from active sessions
        activeSessions.delete(sessionId);
        
        return res.json({
          success: true,
          message: "تم إنهاء الجلسة الحالية، سيتم تسجيل خروجك"
        });
      });
    } else {
      // Just remove from active sessions
      activeSessions.delete(sessionId);
      
      return res.json({
        success: true,
        message: "تم إنهاء الجلسة بنجاح"
      });
    }
  });
  
  // Helper function to parse user agent
  function parseUserAgent(userAgent: string): string {
    if (!userAgent) return "جهاز غير معروف";
    
    // Simple parsing for demo purposes
    if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
      return "جهاز iOS";
    } else if (userAgent.includes("Android")) {
      return "جهاز Android";
    } else if (userAgent.includes("Windows")) {
      return "جهاز Windows";
    } else if (userAgent.includes("Mac")) {
      return "جهاز Mac";
    } else if (userAgent.includes("Linux")) {
      return "جهاز Linux";
    } else {
      return "جهاز آخر";
    }
  }

  // Enhanced user information endpoint
  app.get("/api/users/me", async (req: Request, res: Response) => {
    try {
      // Method 1: Primary session-based authentication
      if (req.session && req.session.userId) {
        const userId = req.session.userId;
        // Session-based authentication successful (removed debug log)
        
        const user = await storage.getUser(userId);
        
        if (!user) {
          // Warning: User ID from session not found in database (removed debug log)
          return res.status(404).json({ 
            success: false,
            message: "المستخدم غير موجود.",
            error_code: "USER_NOT_FOUND"
          });
        }
        
        // Get session information if available
        let sessionInfo = null;
        if (req.session?.sessionId) {
          const currentSession = activeSessions.get(req.session.sessionId);
          if (currentSession) {
            sessionInfo = {
              createdAt: currentSession.createdAt,
              lastActive: currentSession.lastActive,
              device: parseUserAgent(currentSession.userAgent),
              ipAddress: currentSession.ipAddress
            };
            
            // Update last active time
            currentSession.lastActive = new Date().toISOString();
            activeSessions.set(req.session.sessionId, currentSession);
          }
        }
        
        // Session-based authentication successful
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
            status: user.status,
            sessionInfo
          }
        });
      }
      
      // Method 2: Header-based fallback for environments with cookie issues
      const tempUserId = req.headers['x-temp-user-id'];
      const tempUserRole = req.headers['x-temp-user-role'];
      
      if (tempUserId && typeof tempUserId === 'string') {
        try {
          // Header-based auth attempt (debug log removed)
          const userId = parseInt(tempUserId);
          const user = await storage.getUser(userId);
          
          if (user) {
            // Header-based auth successful (debug log removed)
            
            // Create a proper session for this user to fix future requests
            if (req.session) {
              req.session.userId = user.id;
              req.session.userRole = user.role;
              req.session.sessionId = `header_auth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
              
              await new Promise<void>((resolve) => {
                req.session.save(() => {
                  resolve();
                });
              });
              
              // Created new session from header auth (debug log removed)
            }
            
            // Header-based authentication successful
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
          }
        } catch (error) {
          console.error("[Auth Error] Header-based auth failed:", error);
        }
      }
      
      // If we reach here, no valid authentication method worked
      return res.status(401).json({
        success: false,
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED"
      });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع بيانات المستخدم" });
    }
  });
  
  // Special direct authentication endpoint that works when cookies fail in deployed environments
  app.get("/api/users/me-direct", async (req: Request, res: Response) => {
    try {
      // Get authentication from URL parameters (only for fallback)
      const userId = req.query.userId || req.headers['x-auth-user-id'];
      const userRole = req.query.userRole || req.headers['x-auth-user-role'];
      
      console.log(`[DIRECT AUTH] Request with userId=${userId}, userRole=${userRole}`);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "غير مصرح. معرف المستخدم مطلوب.",
          error_code: "MISSING_USER_ID"
        });
      }
      
      // Validate user ID is a number
      const userIdNum = parseInt(userId as string);
      if (isNaN(userIdNum)) {
        return res.status(400).json({
          success: false,
          message: "معرف المستخدم غير صالح.",
          error_code: "INVALID_USER_ID"
        });
      }
      
      // Get user from database
      const user = await storage.getUser(userIdNum);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "المستخدم غير موجود.",
          error_code: "USER_NOT_FOUND"
        });
      }
      
      // Verify role matches (basic security check)
      if (userRole && userRole !== user.role) {
        console.warn(`[DIRECT AUTH] Role mismatch: expected ${user.role}, got ${userRole}`);
      }
      
      // Try to set up a proper session for future requests
      if (req.session) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.sessionId = `direct_auth_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Force save the session
        await new Promise<void>((resolve) => {
          req.session.save(() => {
            console.log(`[DIRECT AUTH] Created session ${req.session.sessionId} for user ${user.id}`);
            resolve();
          });
        });
      }
      
      // Return user data
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
      console.error("[DIRECT AUTH] Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "حدث خطأ أثناء استرجاع بيانات المستخدم",
        error_code: "SERVER_ERROR"
      });
    }
  });
  
  // ADMIN ROUTES
  app.post("/api/admin/users", async (req: Request, res: Response) => {
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const adminId = req.session.userId;
    
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
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const adminId = req.session.userId;
    
    try {
      const admin = await storage.getUser(adminId);
      
      if (!admin || admin.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول إلى هذه الصفحة." });
      }
      
      // Get all users
      const users = await storage.listUsers();
      
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
      
      return res.status(200).json({ users: usersWithCalculatedPoints });
      
    } catch (error: any) {
      return res.status(400).json({ message: error.message || "حدث خطأ أثناء استرجاع المستخدمين" });
    }
  });
  
  // Update user
  app.patch("/api/admin/users/:userId", async (req: Request, res: Response) => {
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const adminId = req.session.userId;
    const targetUserId = parseInt(req.params.userId);
    
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
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const adminId = req.session.userId;
    const targetUserId = parseInt(req.params.userId);
    
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
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const adminId = req.session.userId;
    
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
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const userId = req.session.userId;
    // Use 1 million as default limit to handle extremely high transaction volumes
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000000;
    
    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود." });
      }
      
      // Get all transactions for this user with a high limit
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
    // Get user ID from secure session instead of query parameters
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const adminId = req.session.userId;
    
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
  

  // Robust helper function to accurately check badge qualifications and update user badges
  // This is the single source of truth for badge qualifications
  async function calculateUserBadgeQualifications(userId: number, forceUpdate = false): Promise<{
    badges: any[], 
    userUpdated: boolean,
    qualifiedBadgeIds: number[],
    installationCount: number,
    pointsBalance: number
  }> {
    try {
      console.log(`[BADGE SYSTEM] Calculating badge qualifications for user ${userId}, forceUpdate=${forceUpdate}`);
      
      // Get user data
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }
      
      // Get all active badges
      const allBadges = await storage.listBadges(true);
      console.log(`[BADGE SYSTEM] Found ${allBadges.length} active badges to check`);
      
      // Get all user transactions with a high limit to ensure we have complete data
      const transactions = await storage.getTransactionsByUserId(userId, 10000);
      console.log(`[BADGE SYSTEM] Retrieved ${transactions.length} transactions for user ${userId}`);
      
      // CRITICAL: Accurately count installations with case-insensitive type matching
      const installationTransactions = transactions.filter(t => {
        const isEarningType = t.type && typeof t.type === 'string' && t.type.toLowerCase() === 'earning';
        const isInstallation = t.description && typeof t.description === 'string' && 
                             (t.description.includes("تم تركيب منتج") || 
                              t.description.includes("تركيب منتج جديد"));
        return isEarningType && isInstallation;
      });
      
      // Count total lifetime installations
      const installationCount = installationTransactions.length;
      console.log(`[BADGE SYSTEM] User ${userId} has completed ${installationCount} total installations`);
      
      // Calculate accurate points balance from transactions
      const earningTransactions = transactions.filter(t => 
        t.type && typeof t.type === 'string' && t.type.toLowerCase() === 'earning');
      const redemptionTransactions = transactions.filter(t => 
        t.type && typeof t.type === 'string' && t.type.toLowerCase() === 'redemption');
      
      const totalEarnings = earningTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRedemptions = redemptionTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const pointsBalance = totalEarnings - totalRedemptions;
      
      console.log(`[BADGE SYSTEM] User ${userId} has ${pointsBalance} points balance (${totalEarnings} earned, ${totalRedemptions} redeemed)`);
      
      // Initialize clean badge arrays
      const currentBadgeIds = Array.isArray(user.badgeIds) ? [...user.badgeIds] : [];
      let qualifiedBadgeIds: number[] = [];
      
      // Check each badge qualification independently based on current criteria
      for (const badge of allBadges) {
        // Calculate if user meets badge requirements
        const meetsPointsRequirement = !badge.requiredPoints || pointsBalance >= badge.requiredPoints;
        const meetsInstallationRequirement = !badge.minInstallations || installationCount >= badge.minInstallations;
        
        // Both requirements must be met to qualify
        const qualifies = meetsPointsRequirement && meetsInstallationRequirement;
        
        if (qualifies) {
          qualifiedBadgeIds.push(badge.id);
          console.log(`[BADGE SYSTEM] User ${userId} qualifies for badge ${badge.id} (${badge.name})`);
          
          if (!currentBadgeIds.includes(badge.id)) {
            console.log(`[BADGE SYSTEM] Badge ${badge.id} (${badge.name}) is newly qualified`);
          }
        } else {
          // Log detailed qualification failure reasons for debugging
          if (!meetsPointsRequirement) {
            console.log(`[BADGE SYSTEM] User ${userId} does not meet points requirement (${pointsBalance}/${badge.requiredPoints}) for badge ${badge.id} (${badge.name})`);
          }
          if (!meetsInstallationRequirement) {
            console.log(`[BADGE SYSTEM] User ${userId} does not meet installation requirement (${installationCount}/${badge.minInstallations}) for badge ${badge.id} (${badge.name})`);
          }
        }
      }
      
      // Improved helper function to accurately check badge array differences
      function areBadgeArraysDifferent(arr1: number[], arr2: number[]): boolean {
        if (arr1.length !== arr2.length) return true;
        
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        
        // Check if all elements in arr2 are in arr1
        for (const id of arr2) {
          if (!set1.has(id)) return true;
        }
        
        // Check if all elements in arr1 are in arr2
        for (const id of arr1) {
          if (!set2.has(id)) return true;
        }
        
        return false;
      }
      
      // Determine if an update is needed
      const badgesChanged = areBadgeArraysDifferent(currentBadgeIds, qualifiedBadgeIds);
      const userBadgesUpdated = badgesChanged || forceUpdate;
      
      // Update user's badges in database if new badges were earned or force update requested
      if (userBadgesUpdated) {
        console.log(`[BADGE SYSTEM] Updating user ${userId} badges in database. Old: [${currentBadgeIds}], New: [${qualifiedBadgeIds}]`);
        await storage.updateUser(userId, { badgeIds: qualifiedBadgeIds });
      } else {
        console.log(`[BADGE SYSTEM] No badge changes for user ${userId}`);
      }
      
      // Mark which badges the user has now qualified for
      const badgesWithEarnedStatus = allBadges.map(badge => ({
        ...badge,
        earned: qualifiedBadgeIds.includes(badge.id)
      }));
      
      // Return complete badge qualification data
      return {
        badges: badgesWithEarnedStatus,
        userUpdated: userBadgesUpdated,
        qualifiedBadgeIds,
        installationCount,
        pointsBalance
      };
    
    // Helper function moved outside the try block to fix syntax error
    return {
      badges: badgesWithEarnedStatus,
      userUpdated: userBadgesUpdated,
      qualifiedBadgeIds,
      installationCount,
      pointsBalance
    };
    } catch (error) {
      console.error(`[ERROR] Failed to check badges for user ${userId}:`, error);
      throw error;
    }
  }
  
  app.get("/api/badges", async (req: Request, res: Response) => {
    // Get user ID from secure session
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    const userId = req.session.userId;
    
    try {
      // Use the new robust badge calculation system
      // This recalculates qualifications based on current badge criteria and user achievements
      const result = await calculateUserBadgeQualifications(userId);
      
      // Return badges with earned status to client
      return res.status(200).json({ 
        badges: result.badges,
        installationCount: result.installationCount,
        pointsBalance: result.pointsBalance
      });
    } catch (error: any) {
      console.error(`[ERROR] Badge API error for user ${userId}:`, error);
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء استرجاع الشارات",
        error_code: "BADGE_ERROR"
      });
    }
  });
  
  // Admin endpoint to recalculate badges for a specific user
  app.post("/api/admin/recalculate-user-badges/:userId", async (req: Request, res: Response) => {
    // Verify admin permissions
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    // Only admins can trigger badge recalculation
    const adminUser = await storage.getUser(req.session.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Admin access required",
        error_code: "FORBIDDEN" 
      });
    }
    
    // Get target user ID from request params
    const targetUserId = parseInt(req.params.userId);
    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Valid user ID is required",
        error_code: "INVALID_USER_ID"
      });
    }
    
    try {
      console.log(`[BADGE SYSTEM] Admin ${req.session.userId} requested badge recalculation for user ${targetUserId}`);
      
      // Check if target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          error_code: "USER_NOT_FOUND"
        });
      }
      
      // Force update badge calculations for this user
      const result = await calculateUserBadgeQualifications(targetUserId, true);
      
      return res.status(200).json({
        success: true,
        message: `Badge recalculation completed for user ${targetUserId}`,
        currentBadges: result.qualifiedBadgeIds,
        installationCount: result.installationCount,
        pointsBalance: result.pointsBalance,
        updated: result.userUpdated
      });
    } catch (error: any) {
      console.error(`[ERROR] Failed to recalculate badges for user ${targetUserId}:`, error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to recalculate badges",
        error_code: "BADGE_RECALCULATION_ERROR"
      });
    }
  });

  // Admin endpoint to recalculate all user badges (useful when badge requirements change)
  app.post("/api/admin/recalculate-badges", async (req: Request, res: Response) => {
    // Verify admin permissions
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required",
        error_code: "UNAUTHORIZED" 
      });
    }
    
    // Only admins can trigger badge recalculation
    const adminUser = await storage.getUser(req.session.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Admin access required",
        error_code: "FORBIDDEN" 
      });
    }
    
    try {
      console.log(`[BADGE SYSTEM] Starting system-wide badge recalculation requested by admin ${req.session.userId}`);
      
      // Get all users
      const users = await storage.listUsers(1000);
      console.log(`[BADGE SYSTEM] Recalculating badges for ${users.length} users`);
      
      // Track statistics
      let updatedCount = 0;
      let errorCount = 0;
      let unchangedCount = 0;
      
      // Process each user
      for (const user of users) {
        try {
          // Only process active installers (users who can earn badges)
          if (user.status === 'active' && user.role === 'installer') {
            console.log(`[BADGE SYSTEM] Recalculating badges for user ${user.id} (${user.name})`);
            
            // Force update to ensure proper recalculation
            const result = await calculateUserBadgeQualifications(user.id, true);
            
            if (result.userUpdated) {
              updatedCount++;
              console.log(`[BADGE SYSTEM] Updated badges for user ${user.id} - now has ${result.qualifiedBadgeIds.length} badges`);
            } else {
              unchangedCount++;
              console.log(`[BADGE SYSTEM] No badge changes for user ${user.id} - has ${result.qualifiedBadgeIds.length} badges`);
            }
          }
        } catch (userError) {
          errorCount++;
          console.error(`[ERROR] Failed to recalculate badges for user ${user.id}:`, userError);
        }
      }
      
      // Return results
      return res.status(200).json({
        success: true,
        message: "Badge recalculation completed",
        stats: {
          total: users.length,
          updated: updatedCount,
          unchanged: unchangedCount,
          errors: errorCount
        }
      });
    } catch (error: any) {
      console.error("[ERROR] Failed to recalculate badges:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to recalculate badges",
        error_code: "BADGE_RECALCULATION_ERROR"
      });
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
      
      console.log('Validated data to be sent:', JSON.stringify(validatedData));
      
      try {
        const updatedBadge = await storage.updateBadge(badgeId, validatedData);
        
        if (!updatedBadge) {
          console.error('Badge update failed - storage returned undefined');
          return res.status(500).json({
            success: false,
            message: "فشل تحديث الشارة - خطأ في قاعدة البيانات"
          });
        }
        
        console.log('Badge update successful:', JSON.stringify(updatedBadge));
        
        // Check if badge requirements changed (points or installations)
        const requirementsChanged = 
          badge.requiredPoints !== parsedRequiredPoints ||
          badge.minInstallations !== parsedMinInstallations ||
          badge.active !== parsedActive;
        
        // Prepare response object
        const response = { 
          success: true, 
          message: "تم تحديث الشارة بنجاح",
          badge: updatedBadge,
          recalculationNeeded: requirementsChanged 
        };
        
        // Check if automatic recalculation was requested
        if (requirementsChanged && req.query.autoRecalculate === 'true') {
          console.log(`[BADGE SYSTEM] Badge #${badgeId} requirements changed, performing auto-recalculation`);
          
          try {
            // Get all active installers
            const users = await storage.listUsers();
            const activeInstallers = users.filter(u => u.status === 'active' && u.role === 'installer');
            
            // Track statistics
            let updatedCount = 0;
            let unchangedCount = 0;
            let errorCount = 0;
            
            // Process each eligible user
            for (const user of activeInstallers) {
              try {
                // Force badge recalculation with new requirements
                const result = await calculateUserBadgeQualifications(user.id, true);
                
                if (result.userUpdated) {
                  updatedCount++;
                } else {
                  unchangedCount++;
                }
              } catch (recalcError) {
                errorCount++;
                console.error(`[ERROR] Failed to recalculate badges for user ${user.id}:`, recalcError);
              }
            }
            
            // Add recalculation results to response
            response.recalculation = {
              performed: true,
              total: activeInstallers.length,
              updated: updatedCount,
              unchanged: unchangedCount,
              errors: errorCount
            };
          } catch (recalcError) {
            console.error('[ERROR] Failed to perform badge recalculation:', recalcError);
            response.recalculation = {
              performed: false,
              error: "فشل في إعادة حساب المؤهلات"
            };
          }
        }
        
        return res.status(200).json(response);
      } catch (dbError: any) {
        console.error('Database error during badge update:', dbError);
        return res.status(500).json({
          success: false,
          message: "Database error during badge update",
          error: dbError.message
        });
      }
    } catch (error: any) {
      console.error('Unexpected error in badge update endpoint:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(400).json({ 
        success: false,
        message: error.message || "حدث خطأ أثناء تحديث الشارة",
        errorDetail: typeof error === 'object' ? JSON.stringify(error) : 'Unknown error'
      });
    } finally {
      console.log('========= BADGE UPDATE ENDPOINT END =========');
    }
  });
  
  app.delete("/api/admin/badges/:id", async (req: Request, res: Response) => {
    try {
      // Get user ID from secure session instead of query parameters
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ 
          success: false, 
          message: "غير مصرح. يرجى تسجيل الدخول.",
          error_code: "UNAUTHORIZED" 
        });
      }
      
      const badgeId = parseInt(req.params.id);
      const adminId = req.session.userId;
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
    uuid: z.string().uuid({ message: "رمز QR غير صالح. يجب أن يكون UUID" })
  });

  // QR code scanning endpoint - secured with session authentication
  app.post("/api/scan-qr", async (req: Request, res: Response) => {
    try {
      console.log("[DEBUG QR-SCAN] Request received:", {
        query: req.query,
        body: req.body,
        headers: req.headers['user-agent']
      });
      
      // Get user ID from secure session instead of query parameters
      if (!req.session || !req.session.userId) {
        console.log("[DEBUG QR-SCAN] No userId found in session");
        return res.status(401).json({ 
          success: false, 
          message: "غير مصرح. يرجى تسجيل الدخول.",
          error_code: "UNAUTHORIZED" 
        });
      }
      
      const userId = req.session.userId;
      console.log("[DEBUG QR-SCAN] UserId from session:", userId);
      
      // Validate the request body
      const validation = scanQrSchema.safeParse(req.body);
      
      console.log("[DEBUG QR-SCAN] Request body validation:", validation.success ? "Success" : "Failed", 
        !validation.success ? validation.error : "");
      
      if (!validation.success) {
        console.log("[DEBUG QR-SCAN] QR scan validation failed:", validation.error);
        return res.status(400).json({ 
          success: false, 
          message: "بيانات غير صالحة. الرجاء التحقق من المعلومات المقدمة.",
          error_code: "INVALID_INPUT",
          errors: validation.error.errors
        });
      }
      
      const { uuid } = validation.data;
      console.log("[DEBUG QR-SCAN] Extracted UUID:", uuid);
      
      // Verify user exists and is authorized
      const dbUser = await storage.getUser(userId);
      
      if (!dbUser) {
        return res.status(404).json({ 
          success: false, 
          message: "المستخدم غير موجود.",
          error_code: "USER_NOT_FOUND" 
        });
      }
      
      if (dbUser.status !== UserStatus.ACTIVE) {
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
          message: "هذا المنتج غير مسجل في قاعدة بيانات التصنيع لدينا",
          error_code: "INVALID_PRODUCT",
          details: { uuid, uuidNoHyphens }
        });
      }
      
      console.log(`[DEBUG] UUID found in manufacturing database: ${uuid}`);
      
      // Get product details from manufacturing database
      const productName = await getProductNameBySerialNumber(uuid);
      console.log(`[DEBUG] Product name from manufacturing database: "${productName}"`);
      
      // Find matching product in our local database to determine reward points
      let pointsAwarded = 0;
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
          console.log(`[DEBUG] No active local product match found for: "${productName}". Returning error.`);
          return res.status(400).json({ 
            success: false, 
            message: "هذا المنتج غير مؤهل للحصول على نقاط المكافأة",
            error_code: "INELIGIBLE_PRODUCT",
            details: { 
              productName,
              reason: localProduct ? "Product is inactive" : "Product not found in rewards database"
            }
          });
        }
      } else {
        console.log(`[DEBUG] No product name found. Returning error.`);
        return res.status(400).json({ 
          success: false, 
          message: "هذا المنتج غير مؤهل للحصول على نقاط المكافأة",
          error_code: "INELIGIBLE_PRODUCT",
          details: { reason: "No product name found" }
        });
      }
      
      // Save the scanned code to database with product reference if available
      const scannedCode = await storage.createScannedCode({
        uuid,
        scannedBy: userId, // Using the authenticated userId from session
        productName: productName || undefined,
        productId: localProduct ? localProduct.id : undefined
      });
      
      // We already have the user from authentication check above
      // Now just update their points
      const updatedUser = await storage.updateUser(userId, {
        points: dbUser.points + pointsAwarded
      });
      
      // Create a transaction record with product metadata
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
      console.log(`[BADGE SYSTEM] After QR scan, checking badges for user ${userId} with updated points ${updatedUser?.points}`);
      
      // Get badge updates using our robust badge qualification system
      const badgeResult = await calculateUserBadgeQualifications(userId);
      
      // Find newly earned badges in this scan
      let newBadges = [];
      
      // Get the original badge IDs before this scan
      const originalBadgeIds = Array.isArray(dbUser.badgeIds) ? dbUser.badgeIds : [];
      
      // Find badges that the user just earned in this scan
      if (badgeResult.userUpdated) {
        // Get all active badges
        const allBadges = await storage.listBadges(true);
        
        // A badge is newly earned if it's in the qualified list but wasn't in the original list
        newBadges = allBadges.filter(badge => 
          badgeResult.qualifiedBadgeIds.includes(badge.id) && 
          !originalBadgeIds.includes(badge.id)
        );
        
        console.log(`[BADGE SYSTEM] User ${userId} earned ${newBadges.length} new badges in this scan`);
        newBadges.forEach(badge => {
          console.log(`[BADGE SYSTEM] - New badge earned: ${badge.id} (${badge.name})`);
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "تم التحقق من المنتج بنجاح وتمت إضافة النقاط",
        productName,
        pointsAwarded,
        productDetails: localProduct,
        newPoints: badgeResult.pointsBalance, // Use more accurate points balance from badge system
        totalInstallations: badgeResult.installationCount, // Return accurate installation count
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
        (t.type === TransactionType.EARNING || t.type === 'earning') && 
        (t.description?.includes("تم تركيب منتج") || t.description?.includes("تركيب منتج جديد"))
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
