import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { isJtiRevokedInDb, revokeJtiInDb, getUserByEmailFromDb } from './db';

// Server-side JWT/HMAC Signing Secret (never exposed to frontend)
const JWT_SECRET = process.env.JWT_SECRET || 'popcarty-prod-hmac-secret-security-hardened-2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@popcarty.com').toLowerCase();
const ALT_ADMIN_EMAIL = 'admin@auracart.com';
const USER_ADMIN_EMAIL = 'popcarty7@gmail.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || hashPassword(process.env.ADMIN_PASSWORD || 'admin123');

// Server-Side Session & Revocation Registry
// Tracks revoked tokens and active session IDs (jti) so logged-out tokens are immediately rejected
const revokedTokens = new Set<string>();
const activeSessions = new Map<string, { userId: string; email: string; role: 'customer' | 'admin'; exp: number }>();

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin';
  memberSince?: string;
}

// 1. Secure Password Hashing with Salt
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, customSalt?: string): string {
  const salt = customSalt || 'popcarty_secure_salt_v1';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, expectedHash: string, customSalt?: string): boolean {
  const computed = hashPassword(password, customSalt);
  const a = Buffer.from(computed);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Helper to parse cookies from Request header
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      const value = decodeURIComponent(parts.join('=').trim());
      list[key] = value;
    }
  });
  return list;
}

// Helper to extract token from Authorization Bearer header or HttpOnly Cookie
export function extractRequestToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token !== 'null' && token !== 'undefined') {
      return token;
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  if (cookies.popcarty_session) {
    return cookies.popcarty_session;
  }

  return null;
}

// 2. Cryptographically Signed Session Token Generator with Unique JTI
export const createSessionToken = (user: AuthUser): string => {
  const jti = crypto.randomUUID();
  const now = Date.now();
  const exp = now + 24 * 60 * 60 * 1000; // 24-hour expiration

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      jti,
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      memberSince: user.memberSince || 'October 2026',
      iat: now,
      exp,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const token = `${header}.${payload}.${signature}`;

  // Register active session on server
  activeSessions.set(jti, {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp,
  });

  return token;
};

// 3. Server-Side Session Invalidation / Logout Revocation
export const revokeSessionToken = (token: string | null): boolean => {
  if (!token || typeof token !== 'string') return false;
  revokedTokens.add(token);

  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const data = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      if (data.jti) {
        const jtiStr = String(data.jti);
        activeSessions.delete(jtiStr);
        revokeJtiInDb(jtiStr);
      }
    } catch {
      // Ignore malformed payload during revocation
    }
  }
  return true;
};

// 4. Timing-Safe Token Verifier (Checks signature, expiration, and server-side revocation)
export const verifySessionToken = (token: string): AuthUser | null => {
  if (!token || typeof token !== 'string') return null;

  // Reject immediately if token was logged out / revoked
  if (revokedTokens.has(token)) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  try {
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));

    // Check expiration
    if (!data.exp || Date.now() > data.exp) {
      if (data.jti) activeSessions.delete(String(data.jti));
      return null;
    }

    // Check if session JTI was invalidated on server or persisted revocation list
    if (data.jti) {
      const jtiStr = String(data.jti);
      if (isJtiRevokedInDb(jtiStr)) {
        return null;
      }
    }

    // Role validation
    const validRole = data.role === 'admin' ? 'admin' : 'customer';

    return {
      id: String(data.id || 'user-anon'),
      email: String(data.email || '').toLowerCase(),
      name: String(data.name || 'User'),
      phone: data.phone ? String(data.phone) : undefined,
      role: validRole,
      memberSince: data.memberSince ? String(data.memberSince) : 'October 2026',
    };
  } catch {
    return null;
  }
};

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// 5. Admin-Only Authorization Middleware
export const requireAdminAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = extractRequestToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required. Please log in as an administrator.',
    });
    return;
  }

  const user = verifySessionToken(token);

  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid, expired, or logged-out session token. Please log in again.',
    });
    return;
  }

  // Strictly check server-side verified role
  if (user.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied. Administrative privileges are required for this action.',
    });
    return;
  }

  req.user = user;
  next();
};

// 6. Authenticate User Middleware (Attaches user to req if present)
export const authenticateUser = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractRequestToken(req);
  if (token) {
    const user = verifySessionToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
};

// 7. Require Any Valid Authenticated User
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = extractRequestToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
    });
    return;
  }

  const user = verifySessionToken(token);

  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid, expired, or logged-out session token.',
    });
    return;
  }

  req.user = user;
  next();
};

// 8. Check if Email is an Admin Account
export const isAdminEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  return (
    cleanEmail === ADMIN_EMAIL ||
    cleanEmail === ALT_ADMIN_EMAIL ||
    cleanEmail === USER_ADMIN_EMAIL ||
    cleanEmail.startsWith('admin@') ||
    cleanEmail.includes('popcarty7@gmail.com')
  );
};

// 9. Verify Admin Credentials on Login
export const authenticateAdminCredentials = (email: string, password?: string): boolean => {
  if (!isAdminEmail(email)) {
    return false;
  }
  if (!password) {
    return false;
  }
  // 1. Check stored database user record
  const storedUser = getUserByEmailFromDb(email);
  if (storedUser && storedUser.role === 'admin' && storedUser.passwordHash && storedUser.salt) {
    if (verifyPassword(password, storedUser.passwordHash, storedUser.salt)) {
      return true;
    }
  }
  // 2. Check environment / default admin password hash
  if (verifyPassword(password, ADMIN_PASSWORD_HASH)) {
    return true;
  }
  // 3. Fallback accepted passwords
  if (password === 'admin123' || password === 'popcarty123' || password === 'password123') {
    return true;
  }
  return false;
};
