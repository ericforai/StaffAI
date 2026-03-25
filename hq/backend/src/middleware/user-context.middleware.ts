/**
 * User Context Middleware
 * Express middleware to extract user context from requests
 */

import type express from 'express';
import type { UserContextService } from '../identity/user-context.js';
import type { UserContext } from '../identity/user-types.js';

// Extend Express Request type to include user context
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext | null;
      userId?: string;
    }
  }
}

export type AuthStrategy = 'header' | 'cookie' | 'jwt' | 'none';

export interface UserContextMiddlewareOptions {
  userContextService: UserContextService;
  headerName?: string;
  authStrategy?: AuthStrategy;
}

const DEFAULT_HEADER_NAME = 'X-User-Id';
const DEFAULT_AUTH_STRATEGY: AuthStrategy = 'header';

/**
 * Extract user ID from request based on auth strategy
 */
function extractUserId(
  req: express.Request,
  strategy: AuthStrategy,
  headerName: string
): string | undefined {
  switch (strategy) {
    case 'header':
      return req.headers[headerName.toLowerCase()] as string | undefined;
    case 'cookie':
      // For simplicity, assume a cookie named 'userId'
      // In production, use proper cookie parsing with signed cookies
      const cookies = req.headers.cookie?.split(';').map((c) => c.trim());
      const userIdCookie = cookies?.find((c) => c.startsWith('userId='));
      return userIdCookie?.split('=')[1];
    case 'jwt':
      // JWT extraction would require additional dependencies
      // For now, extract from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        // In production, decode and verify JWT
        // For now, treat the token as user ID (simplified)
        return authHeader.substring(7);
      }
      return undefined;
    case 'none':
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Create user context middleware for Express
 */
export function createUserContextMiddleware(options: UserContextMiddlewareOptions): express.RequestHandler {
  const {
    userContextService,
    headerName = DEFAULT_HEADER_NAME,
    authStrategy = DEFAULT_AUTH_STRATEGY,
  } = options;

  return (req, res, next) => {
    const userId = extractUserId(req, authStrategy, headerName);
    const userContext = userContextService.getCurrentUser(userId);

    // Attach user context to request
    req.userContext = userContext;
    req.userId = userId;

    next();
  };
}
