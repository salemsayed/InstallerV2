import { SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userRole?: string;
    createdAt?: string;
    lastActive?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }
}