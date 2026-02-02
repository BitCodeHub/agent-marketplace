/**
 * Rate Limiting Middleware
 * Prevents API abuse and overload using token bucket algorithm
 */

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

// Simple in-memory store for MVP (replace with Redis in production)
const rateLimitStore = new Map<string, { tokens: number; lastRefill: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

// Default limits
const DEFAULT_LIMITS: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

// Strict limits for expensive operations
const STRICT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/agents/register': { windowMs: 60 * 60 * 1000, maxRequests: 5 }, // 5 per hour
  '/api/tasks': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  '/api/tasks/:id/claim': { windowMs: 5 * 60 * 1000, maxRequests: 3 }, // 3 per 5 min
  '/api/tasks/:id/submit': { windowMs: 10 * 60 * 1000, maxRequests: 3 }, // 3 per 10 min
};

/**
 * Token bucket rate limiter
 */
export function rateLimiter(config: RateLimitConfig = DEFAULT_LIMITS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
    const now = Date.now();
    
    // Get or create bucket
    let bucket = rateLimitStore.get(key);
    if (!bucket) {
      bucket = { tokens: config.maxRequests, lastRefill: now };
    }
    
    // Refill tokens
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / config.windowMs) * config.maxRequests);
    bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if request allowed
    if (bucket.tokens > 0) {
      bucket.tokens--;
      rateLimitStore.set(key, bucket);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', bucket.tokens);
      res.setHeader('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());
      
      next();
    } else {
      // Rate limit exceeded
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    }
  };
}

/**
 * Get client identifier (IP + endpoint)
 */
function getClientKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const endpoint = req.path;
  return `ratelimit:${ip}:${endpoint}`;
}

/**
 * Apply rate limits based on endpoint
 */
export function endpointRateLimiter(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  
  // Find matching limit config
  const config = STRICT_LIMITS[path] || DEFAULT_LIMITS;
  
  return rateLimiter(config)(req, res, next);
}

/**
 * Clean up old entries every hour
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
