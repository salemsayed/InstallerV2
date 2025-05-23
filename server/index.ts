import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getSession } from "./replitAuth";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add session middleware with PostgreSQL storage
app.use(getSession());

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
function redactSensitiveInfo(obj: any): any {
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
            const keys = Object.keys(capturedJsonResponse);
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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
