import { Request, Response } from "express";

/**
 * Specialized direct logout handler
 * Designed as a last resort for stubborn logout issues
 */
export function handleEmergencyLogout(req: Request, res: Response) {
  // Clear all session data
  req.session = null as any;
  
  // Get environment info
  const isReplit = !!process.env.REPLIT_DOMAINS;
  const secure = isReplit;
  
  // Forcefully clear all known cookies
  const cookieNames = ['sid', 'connect.sid', 'bareeq.sid'];
  
  // Clear them with basic settings
  cookieNames.forEach(name => {
    res.clearCookie(name, { path: '/' });
    res.clearCookie(name, { 
      path: '/',
      secure: secure
    });
    
    // Also try setting to empty with expiry
    res.cookie(name, '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0
    });
  });
  
  // Log completion
  console.log("[EMERGENCY-LOGOUT] Cookies cleared and session reset");
  
  // Send successful response
  return res.status(200).json({ 
    success: true,
    timestamp: Date.now()
  });
}