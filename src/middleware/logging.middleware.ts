// src/middleware/logging.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    // Log request
    this.logger.log(`[REQUEST] ${method} ${originalUrl} - IP: ${ip} - User Agent: ${userAgent}`);

    // Log request body for NetSuite endpoints (without sensitive data)
    if (originalUrl.includes('/netsuite') && method !== 'GET') {
      const sanitizedBody = this.sanitizeRequestBody(req.body);
      this.logger.debug(`[REQUEST BODY] ${JSON.stringify(sanitizedBody)}`);
    }

    // Override response.end to log response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      
      const logLevel = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'log';
      
      this.logger[logLevel](
        `[RESPONSE] ${method} ${originalUrl} - Status: ${statusCode} - Duration: ${duration}ms`
      );

      originalEnd.call(this, chunk, encoding);
    }.bind(this);

    next();
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***MASKED***';
      }
    }

    return sanitized;
  }
}