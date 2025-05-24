import { Router, Request, Response } from 'express';
import * as debug from '../debug';

const router = Router();

/**
 * Debug test endpoint to demonstrate different log levels and categories
 * Only accessible in development environment
 */
router.get('/test', (req: Request, res: Response) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Only allow in development mode
  if (!isDev) {
    return res.status(403).json({
      success: false,
      message: 'Debug endpoints are only available in development mode'
    });
  }
  
  // Log various messages at different levels and categories
  debug.info('Debug test endpoint accessed', 'api');
  
  // Get query parameters
  const category = (req.query.category as string) || 'all';
  const level = (req.query.level as string) || 'info';
  const message = (req.query.message as string) || 'Test debug message';
  
  // Log with the specified category and level
  if (level === 'error') {
    debug.error(message, category as any);
  } else if (level === 'warn') {
    debug.warn(message, category as any);
  } else if (level === 'debug') {
    debug.debug(message, category as any);
  } else if (level === 'verbose') {
    debug.verbose(message, category as any);
  } else {
    debug.info(message, category as any);
  }
  
  // Return configuration
  return res.status(200).json({
    success: true,
    message: 'Debug test successful',
    timestamp: new Date().toISOString(),
    params: {
      category,
      level,
      message
    },
    nodeEnv: process.env.NODE_ENV
  });
});

export default router;