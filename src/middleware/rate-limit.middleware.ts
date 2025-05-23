// src/middleware/rate-limit.middleware.ts
import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  
  // Rate limit configuration
  private readonly maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  private readonly windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute

  use(req: Request, res: Response, next: NextFunction) {
    // Only apply rate limiting to NetSuite endpoints
    if (!req.originalUrl.includes('/netsuite')) {
      return next();
    }

    const clientId = this.getClientIdentifier(req);
    const now = Date.now();
    
    // Clean expired entries
    this.cleanupExpiredEntries(now);
    
    const rateLimitEntry = this.rateLimitMap.get(clientId);
    
    if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
      // Create new or reset expired entry
      this.rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
    } else {
      // Increment existing entry
      rateLimitEntry.count++;
      
      if (rateLimitEntry.count > this.maxRequests) {
        const retryAfter = Math.ceil((rateLimitEntry.resetTime - now) / 1000);
        
        this.logger.warn(
          `Rate limit exceeded for client ${clientId}. Requests: ${rateLimitEntry.count}/${this.maxRequests}`
        );
        
        res.set({
          'X-RateLimit-Limit': this.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitEntry.resetTime).toISOString(),
          'Retry-After': retryAfter.toString(),
        });
        
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
    
    // Set rate limit headers
    const remaining = Math.max(0, this.maxRequests - (rateLimitEntry?.count || 0));
    res.set({
      'X-RateLimit-Limit': this.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitEntry?.resetTime || now + this.windowMs).toISOString(),
    });
    
    next();
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientIdentifier(req: Request): string {
    // Use API key if present, otherwise fall back to IP
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
    
    if (apiKey && typeof apiKey === 'string') {
      return `api:${apiKey.substring(0, 10)}`;
    }
    
    return `ip:${req.ip}`;
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}