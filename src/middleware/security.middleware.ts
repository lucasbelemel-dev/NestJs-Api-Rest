// src/middleware/security.middleware.ts
import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);
  private readonly allowedApiKeys = new Set(
    (process.env.ALLOWED_API_KEYS || '').split(',').filter(key => key.trim())
  );

  use(req: Request, res: Response, next: NextFunction) {
    // Add security headers
    this.addSecurityHeaders(res);

    // Validate API key for NetSuite endpoints (if configured)
    if (this.shouldValidateApiKey(req)) {
      this.validateApiKey(req);
    }

    // Basic request validation
    this.validateRequest(req);

    next();
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(res: Response): void {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Powered-By': '', // Remove Express signature
    });
  }

  /**
   * Check if API key validation is required
   */
  private shouldValidateApiKey(req: Request): boolean {
    // Only validate API key for NetSuite endpoints if API keys are configured
    return (
      req.originalUrl.includes('/netsuite') && 
      this.allowedApiKeys.size > 0 &&
      !req.originalUrl.includes('/health') // Skip health check
    );
  }

  /**
   * Validate API key
   */
  private validateApiKey(req: Request): void {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      this.logger.warn(`Missing API key for request: ${req.method} ${req.originalUrl}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'API key required',
          error: 'Unauthorized',
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    if (!this.allowedApiKeys.has(apiKey)) {
      this.logger.warn(`Invalid API key used: ${apiKey.substring(0, 8)}...`);
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Invalid API key',
          error: 'Forbidden',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  /**
   * Basic request validation
   */
  private validateRequest(req: Request): void {
    // Check content length
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBodySize = parseInt(process.env.MAX_BODY_SIZE || '1048576', 10); // 1MB default
    
    if (contentLength > maxBodySize) {
      this.logger.warn(`Request body too large: ${contentLength} bytes`);
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: 'Request body too large',
          maxSize: maxBodySize,
        },
        HttpStatus.PAYLOAD_TOO_LARGE
      );
    }

    // Validate Content-Type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      
      if (contentType && !contentType.includes('application/json')) {
        throw new HttpException(
          {
            statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            message: 'Only application/json content type is supported',
          },
          HttpStatus.UNSUPPORTED_MEDIA_TYPE
        );
      }
    }

    // Basic SQL injection prevention (additional layer)
    const suspiciousPatterns = [
      /(\b(union|select|insert|delete|update|drop|create|alter)\b)/gi,
      /(--|\/\*|\*\/|;)/g,
      /('|\"|`)/g
    ];

    const queryString = JSON.stringify(req.query) + JSON.stringify(req.body);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(queryString)) {
        this.logger.warn(`Suspicious request pattern detected: ${req.method} ${req.originalUrl}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid request format',
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }
  }
}