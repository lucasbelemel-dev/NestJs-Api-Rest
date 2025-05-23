// src/modules/netsuite/netsuite.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NetSuiteController } from '../../controllers/netsuite/netsuite.controller';
import { NetSuiteService } from '../../services/netsuite/netsuite.service';
import netsuiteConfig from '../../config/netsuite.config';

@Module({
  imports: [
    ConfigModule.forFeature(netsuiteConfig),
  ],
  controllers: [NetSuiteController],
  providers: [NetSuiteService],
  exports: [NetSuiteService], // Export service for use in other modules
})
export class NetSuiteModule {}