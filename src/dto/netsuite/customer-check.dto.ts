// src/dto/netsuite/customer-check.dto.ts
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CustomerCheckDto {
  @ApiProperty({
    description: 'Company email to check in NetSuite',
    example: 'company@example.com'
  })
  @IsEmail()
  @IsNotEmpty()
  companyEmail: string;
}

export class CustomerCheckResponseDto {
  @ApiProperty({ description: 'Whether the operation was successful' })
  success: boolean;

  @ApiProperty({ description: 'Success message', required: false })
  message?: string;

  @ApiProperty({ description: 'Error message', required: false })
  error?: string;

  @ApiProperty({ 
    description: 'Additional data about the check',
    required: false,
    type: 'object',
    properties: {
      customerExists: { type: 'boolean' },
      contactExists: { type: 'boolean' }
    }
  })
  data?: {
    customerExists: boolean;
    contactExists: boolean;
  };
}