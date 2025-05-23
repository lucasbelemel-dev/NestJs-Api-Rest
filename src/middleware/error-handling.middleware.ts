// src/middleware/error-handling.middleware.ts
import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    try {
      next();
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  private handleError(error: any, req: Request, res: Response): void {
    const { method, originalUrl, ip } = req;
    
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = {};

    if (error instanceof HttpException) {
      statusCode = error.getStatus();
      const response = error.getResponse();
      
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        message = (response as any).message || message;
        details = response;
      }
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = HttpStatus.BAD_GATEWAY;
      message = 'NetSuite service unavailable';
      details = { service: 'NetSuite', issue: 'Connection refused' };
    } else if (error.code === 'ETIMEDOUT') {
      statusCode = HttpStatus.GATEWAY_TIMEOUT;
      message = 'NetSuite request timeout';
      details = { service: 'NetSuite', issue: 'Request timeout' };
    } else if (error.name === 'ValidationError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid request data';
      details = { validationErrors: error.details || error.message };
    }

    // Log error
    this.logger.error(
      `[ERROR] ${method} ${originalUrl} - IP: ${ip} - Status: ${statusCode} - Message: ${message}`,
      error.stack
    );

    // Send error response
    const errorResponse = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: originalUrl,
      method,
      message,
      ...(process.env.NODE_ENV !== 'production' && { details, stack: error.stack }),
    };

    res.status(statusCode).json(errorResponse);
  }
}