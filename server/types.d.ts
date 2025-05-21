import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: string;
    sessionId: string;
    createdAt: string;
    lastActive: string;
    ipAddress: string;
    userAgent: string;
  }
}