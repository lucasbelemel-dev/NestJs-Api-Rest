// src/controllers/netsuite/netsuite.controller.ts
import { 
    Controller, 
    Post, 
    Body, 
    HttpCode, 
    HttpStatus, 
    Logger,
    UsePipes,
    ValidationPipe,
    Get,
    Param
  } from '@nestjs/common';
  import { 
    ApiTags, 
    ApiOperation, 
    ApiResponse, 
    ApiBody, 
    ApiParam 
  } from '@nestjs/swagger';
  import { NetSuiteService } from '../../services/netsuite/netsuite.service';
  import { 
    CustomerCheckDto, 
    CustomerCheckResponseDto 
  } from '../../dto/netsuite/customer-check.dto';
  
  @ApiTags('NetSuite')
  @Controller('netsuite')
  export class NetSuiteController {
    private readonly logger = new Logger(NetSuiteController.name);
  
    constructor(private readonly netSuiteService: NetSuiteService) {}
  
    @Post('customer/check')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    @ApiOperation({ 
      summary: 'Check if customer or contact exists in NetSuite',
      description: 'Validates if a customer or contact already exists in NetSuite based on email address'
    })
    @ApiBody({ type: CustomerCheckDto })
    @ApiResponse({ 
      status: 200, 
      description: 'Validation completed successfully',
      type: CustomerCheckResponseDto
    })
    @ApiResponse({ 
      status: 400, 
      description: 'Invalid input data' 
    })
    @ApiResponse({ 
      status: 502, 
      description: 'NetSuite API error' 
    })
    async checkCustomer(@Body() customerCheckDto: CustomerCheckDto): Promise<CustomerCheckResponseDto> {
      this.logger.log(`Received customer check request for: ${customerCheckDto.companyEmail}`);
  
      const result = await this.netSuiteService.validateCustomerAndContact({
        companyEmail: customerCheckDto.companyEmail,
      });
  
      this.logger.log(`Customer check result: ${JSON.stringify(result)}`);
  
      return result;
    }
  
    @Get('customer/:email/exists')
    @ApiOperation({ 
      summary: 'Check if customer exists by email',
      description: 'Returns boolean indicating if customer exists in NetSuite'
    })
    @ApiParam({ 
      name: 'email', 
      description: 'Customer email address',
      example: 'customer@example.com'
    })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns customer existence status',
      schema: {
        type: 'object',
        properties: {
          exists: { type: 'boolean' },
          email: { type: 'string' }
        }
      }
    })
    async checkCustomerExists(@Param('email') email: string): Promise<{ exists: boolean; email: string }> {
      this.logger.log(`Checking customer existence for: ${email}`);
  
      const exists = await this.netSuiteService.checkCustomerExists(email);
  
      return { exists, email };
    }
  
    @Get('contact/:email/exists')
    @ApiOperation({ 
      summary: 'Check if contact exists by email',
      description: 'Returns boolean indicating if contact exists in NetSuite'
    })
    @ApiParam({ 
      name: 'email', 
      description: 'Contact email address',
      example: 'contact@example.com'
    })
    @ApiResponse({ 
      status: 200, 
      description: 'Returns contact existence status',
      schema: {
        type: 'object',
        properties: {
          exists: { type: 'boolean' },
          email: { type: 'string' }
        }
      }
    })
    async checkContactExists(@Param('email') email: string): Promise<{ exists: boolean; email: string }> {
      this.logger.log(`Checking contact existence for: ${email}`);
  
      const exists = await this.netSuiteService.checkContactExists(email);
  
      return { exists, email };
    }
  
    @Get('health')
    @ApiOperation({ 
      summary: 'Health check for NetSuite service',
      description: 'Returns the health status of NetSuite integration'
    })
    @ApiResponse({ 
      status: 200, 
      description: 'Service is healthy',
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' }
        }
      }
    })
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
      return {
        status: 'OK',
        timestamp: new Date().toISOString(),
      };
    }
  }