import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { UserRole, UserStatus } from "@shared/schema";

if (!process.env.REPLIT_DOMAINS) {
  console.warn("Environment variable REPLIT_DOMAINS not provided - Replit Auth may not work");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Fail fast if SESSION_SECRET is not set in production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production environment');
  }
  
  // In development, warn but allow fallback
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.warn('⚠️ WARNING: SESSION_SECRET not set. Using a random secret for development only. This would be insecure in production.');
  }
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return session({
    secret: sessionSecret || (isDevelopment ? Math.random().toString(36).substring(2, 15) : ''),
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // In deployed environments, cookies need to work in iframe context
      // Use secure=false to ensure cookies work in both HTTP and HTTPS
      secure: false,
      // Use 'none' for cross-site iframe usage in Replit deployment
      sameSite: 'none',
      maxAge: sessionTtl,
      // Make sure the cookie is accessible from all subdomains
      domain: process.env.REPLIT_DOMAINS ? 
        (process.env.REPLIT_DOMAINS.split(',')[0] || undefined) : 
        undefined,
    },
    proxy: true, // Trust the reverse proxy when setting secure cookies
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const existingUser = await storage.getUserByEmail(claims["email"]);
  
  if (existingUser) {
    // Update existing user with latest information from Replit
    return await storage.updateUser(existingUser.id, {
      email: claims["email"],
      name: `${claims["first_name"] || ''} ${claims["last_name"] || ''}`.trim() || existingUser.name,
      profileImageUrl: claims["profile_image_url"],
    });
  } else {
    // Create a new user
    return await storage.createUser({
      email: claims["email"],
      name: `${claims["first_name"] || ''} ${claims["last_name"] || ''}`.trim() || claims["email"].split('@')[0],
      role: UserRole.INSTALLER, // Default role
      status: UserStatus.ACTIVE,
      points: 0,
      level: 1,
      profileImageUrl: claims["profile_image_url"],
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS?.split(",") || ["localhost:5000"]) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `${domain.includes("localhost") ? "http" : "https"}://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const hostname = req.hostname || "localhost:5000";
    passport.authenticate(`replitauth:${hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const hostname = req.hostname || "localhost:5000";
    passport.authenticate(`replitauth:${hostname}`, {
      successRedirect: "/auth/callback",
      failureRedirect: "/",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // Clear server-side session
      req.session.destroy(() => {
        // Build OpenID Connect end session URL
        const logoutUrl = client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href;
        
        res.redirect(logoutUrl);
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // Check if user exists and has required data instead of using isAuthenticated()
  if (!user || !user?.claims) {
    return res.status(401).json({ message: "غير مصرح. يرجى تسجيل الدخول." });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.redirect("/api/login");
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    return res.redirect("/api/login");
  }
};