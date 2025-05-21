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
  // Fixed session TTL - 1 week in minutes
  const sessionTtlMinutes = 7 * 24 * 60;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Get the domain for cookie configuration
  const domain = process.env.REPLIT_DOMAINS ? 
    process.env.REPLIT_DOMAINS.split(',')[0] : undefined;
  
  // Use a consistent secret
  const sessionSecret = process.env.SESSION_SECRET || 
    (isDevelopment ? 'bareeq-dev-secret-key-do-not-use-in-production' : '');
    
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️ WARNING: SESSION_SECRET not set. Using fallback key which is insecure.');
  }
  
  // Create session store with PostgreSQL
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtlMinutes,
    tableName: "sessions",
  });

  // Log session configuration for debugging
  console.log('[SESSION CONFIG] Environment:', process.env.NODE_ENV);
  if (domain) console.log('[SESSION CONFIG] Domain:', domain);
  console.log('[SESSION CONFIG] Cookie secure: false'); // False for both environments
  console.log('[SESSION CONFIG] Cookie sameSite: lax'); // Lax is more compatible
  console.log('[SESSION CONFIG] Session TTL:', sessionTtlMinutes, 'minutes');

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: 'bareeq.sid',
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for both environments to ensure cookies work properly
      sameSite: 'lax', // Using lax for better browser compatibility
      maxAge: sessionTtlMinutes * 60 * 1000, // Convert minutes to milliseconds
      path: '/',
    },
    // Essential for Replit's environment
    proxy: true, // Trust reverse proxies
    rolling: true, // Refresh cookie expiration on each request
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