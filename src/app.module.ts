// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NetSuiteModule } from './modules/netsuite/netsuite.module';

// Middlewares
import { LoggingMiddleware } from './middleware/logging.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    NetSuiteModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        CorrelationIdMiddleware,  // First: Add correlation ID
        SecurityMiddleware,       // Second: Security validation
        RateLimitMiddleware,      // Third: Rate limiting
        LoggingMiddleware,        // Fourth: Request/Response logging
      )
      .forRoutes('*'); // Apply to all routes
  }
}