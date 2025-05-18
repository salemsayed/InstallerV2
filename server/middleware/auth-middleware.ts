import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { createAdminLogger } from '../utils/admin-logger';

const logger = createAdminLogger('auth');

/**
 * Middleware to ensure user is authenticated
 * Checks if user is present in session and adds user data to request
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check if we have a session with a userId
  const sessionUserId = req.session?.userId;
  
  if (!sessionUserId) {
    logger.error('Authentication failed - No user ID in session');
    return res.status(401).json({
      success: false,
      message: "يجب تسجيل الدخول للوصول إلى هذه الواجهة",
      error_code: "UNAUTHORIZED"
    });
  }
  
  // Set userId on request for downstream handlers
  req.userId = sessionUserId;
  
  // Continue to the protected route
  next();
}

/**
 * Middleware to ensure user has admin role
 * Must be used after requireAuth middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // First ensure user is authenticated
  if (!req.userId) {
    logger.error('Admin check failed - User not authenticated');
    return res.status(401).json({
      success: false,
      message: "يجب تسجيل الدخول للوصول إلى هذه الواجهة",
      error_code: "UNAUTHORIZED"
    });
  }
  
  // Check if user has admin role
  storage.getUser(req.userId)
    .then(user => {
      if (!user) {
        logger.error('Admin check failed - User not found', { userId: req.userId });
        return res.status(404).json({
          success: false,
          message: "المستخدم غير موجود",
          error_code: "USER_NOT_FOUND"
        });
      }
      
      if (user.role !== "admin") {
        logger.error('Admin check failed - Insufficient permissions', { 
          userId: req.userId,
          role: user.role
        });
        return res.status(403).json({
          success: false,
          message: "ليس لديك الصلاحيات الكافية للوصول إلى هذه الواجهة",
          error_code: "FORBIDDEN"
        });
      }
      
      // User has admin role, continue to admin route
      next();
    })
    .catch(err => {
      logger.error('Admin check failed - Database error', {
        userId: req.userId,
        error: err.message
      });
      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء التحقق من صلاحيات المستخدم",
        error_code: "SERVER_ERROR"
      });
    });
}

/**
 * Middleware to load user data if authenticated
 * Does not reject unauthenticated requests
 */
export function loadUserIfAuthenticated(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = req.session?.userId;
  
  if (sessionUserId) {
    req.userId = sessionUserId;
    
    // Optionally load full user data
    storage.getUser(sessionUserId)
      .then(user => {
        if (user) {
          req.user = user;
        }
        next();
      })
      .catch(err => {
        // Just log error but continue - user data loading is optional
        logger.error('Error loading user data', {
          userId: sessionUserId,
          error: err.message
        });
        next();
      });
  } else {
    // Continue without authentication
    next();
  }
}

// Add to global Express namespace
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: any;
    }
  }
}