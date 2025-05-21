/**
 * Enhanced logout utility that ensures complete session termination
 * in all environments including Replit deployments.
 */
import { Request, Response } from "express";

/**
 * Handles comprehensive logout to ensure proper session termination
 * and cookie clearing in all environments.
 */
export function performEnhancedLogout(req: Request, res: Response) {
  // Get environment info for proper cookie clearing
  const isReplit = !!process.env.REPLIT_DOMAINS;
  const sameSite = isReplit ? 'none' : 'lax';
  const secure = isReplit;

  console.log("[ENHANCED-LOGOUT] Processing logout request", {
    hasSession: !!req.session,
    sessionId: req.session?.sessionId || 'none',
    userId: req.session?.userId || 'none',
    environment: isReplit ? 'replit' : 'development',
  });

  // Completely clear all possible cookies
  clearAllCookies();
  
  // If we have a session, destroy it
  if (req.session) {
    const sessionId = req.session.sessionId;
    
    req.session.destroy((err) => {
      if (err) {
        console.error("[ENHANCED-LOGOUT] Error destroying session:", err);
      } else {
        console.log(`[ENHANCED-LOGOUT] Session ${sessionId} destroyed`);
      }
      
      // Send response - even if session destroy fails, we've cleared cookies
      completeLogoutResponse();
    });
  } else {
    // No session to destroy, just complete the response
    completeLogoutResponse();
  }
  
  /**
   * Helper function to clear all possible cookies with all possible settings
   */
  function clearAllCookies() {
    // Clear all possible cookie names
    const cookieNames = [
      'sid', 'connect.sid', 'bareeq.sid', 
      'express.sid', 'express:sess', 'express:sess.sig'
    ];
    
    // All paths that might have cookies
    const paths = ['/', '/api', '/auth', '/api/auth', '/installer', '/admin', ''];
    
    // Try different combinations
    cookieNames.forEach(name => {
      // 1. Clear with path '/'
      res.clearCookie(name, {
        path: '/',
        httpOnly: true,
        secure: secure,
        sameSite: sameSite as 'lax' | 'strict' | 'none' | undefined
      });
      
      // 2. Clear for all possible paths
      paths.forEach(path => {
        try {
          res.cookie(name, '', {
            path,
            httpOnly: true,
            secure: secure,
            sameSite: sameSite as 'lax' | 'strict' | 'none' | undefined,
            expires: new Date(0),
            maxAge: 0
          });
        } catch (e) {
          console.error(`[ENHANCED-LOGOUT] Error clearing cookie ${name} with path ${path}:`, e);
        }
        
        // 3. Also clear non-httpOnly cookies (e.g., for client-side JavaScript)
        try {
          res.cookie(name, '', {
            path,
            secure: secure,
            sameSite: sameSite as 'lax' | 'strict' | 'none' | undefined,
            expires: new Date(0),
            maxAge: 0
          });
        } catch (e) {
          console.error(`[ENHANCED-LOGOUT] Error clearing non-httpOnly cookie ${name} with path ${path}:`, e);
        }
      });
      
      console.log(`[ENHANCED-LOGOUT] Cleared cookie: ${name}`);
    });
  }
  
  /**
   * Helper function to send final response
   */
  function completeLogoutResponse() {
    // Set headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Return success response with timestamp to prevent caching
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
      timestamp: Date.now()
    });
  }
}