import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure secure session storage with PostgreSQL
const configureSession = () => {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Fail fast if SESSION_SECRET is not set in production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production environment');
  }
  
  // In development, warn but allow fallback secret
  const sessionSecret = process.env.SESSION_SECRET || 'bareeq-installer-dev-session-secret';
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️ WARNING: SESSION_SECRET not set. Using a dev secret which is insecure for production.');
  }
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl
    }
  });
};

// Apply session middleware
app.use(configureSession());

// List of fields that should be redacted in logs
const SENSITIVE_FIELDS = [
  'phone', 
  'email', 
  'password', 
  'token', 
  'secret', 
  'badgeIds', 
  'profileImageUrl'
];

/**
 * Redacts sensitive information from objects to prevent PII leakage in logs
 * @param obj Object to be redacted
 * @returns Redacted object safe for logging
 */
export function redactSensitiveInfo(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveInfo(item));
  }

  // Deep copy the object to avoid mutations
  const redacted = { ...obj };

  // Recursively process object properties
  for (const key in redacted) {
    // Redact sensitive field names
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = typeof redacted[key] === 'string' ? '***REDACTED***' : '[REDACTED]';
    } 
    // Recursively process nested objects
    else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveInfo(redacted[key]);
    }
  }

  return redacted;
}

// Logging middleware with enhanced security (controlled verbosity)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Completely disable API logging in development mode to reduce console clutter
      if (false) {
        // Log request metadata without sensitive data
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        
        // Only log response keys for API insights, not the full contents
        if (capturedJsonResponse) {
          // For success responses, only log the structure, not the content
          if (res.statusCode >= 200 && res.statusCode < 400) {
            const keys = capturedJsonResponse && typeof capturedJsonResponse === 'object' ? 
              Object.keys(capturedJsonResponse as object) : [];
            logLine += ` :: Keys: [${keys.join(', ')}]`;
          } 
          // For error responses, redact sensitive info but log more details
          else {
            const redactedResponse = redactSensitiveInfo(capturedJsonResponse);
            logLine += ` :: ${JSON.stringify(redactedResponse)}`;
          }
        }

        log(logLine);
      }
    }
  });

  next();
});

// Initialize and start the server using an IIFE
(async () => {
  try {
    // Register all routes
    const server = await registerRoutes(app);

    // Error handler middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error(err);
    });

    // Setup front-end serving (Vite in dev, static in prod)
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
})();
