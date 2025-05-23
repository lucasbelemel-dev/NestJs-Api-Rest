// src/services/netsuite/netsuite.service.ts
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { default as addOAuthInterceptor } from 'axios-oauth-1.0a';
import { 
  NetSuiteServiceInterface, 
  NetSuiteQueryResponse, 
  NetSuiteCustomerCheckRequest, 
  NetSuiteCustomerCheckResponse 
} from '../../contracts/netsuite/netsuite.interface';

@Injectable()
export class NetSuiteService implements NetSuiteServiceInterface {
  private readonly logger = new Logger(NetSuiteService.name);
  private readonly axiosClient: AxiosInstance;
  private readonly subsidiaryId: number;

  constructor(private readonly configService: ConfigService) {
    this.subsidiaryId = this.configService.get<number>('netsuite.subsidiaryId');
    this.axiosClient = this.createNetSuiteClient();
  }

  /**
   * Creates and configures the NetSuite API client with OAuth 1.0a authentication
   */
  private createNetSuiteClient(): AxiosInstance {
    const baseURL = this.configService.get<string>('netsuite.baseUrl');
    
    if (!baseURL) {
      throw new Error('NetSuite base URL is not configured');
    }

    const client = axios.create({
      baseURL,
      headers: { 'Prefer': 'transient' },
      timeout: 30000, // 30 seconds timeout
    });

    const oauthOptions = {
      algorithm: 'HMAC-SHA256' as const,
      key: this.configService.get<string>('netsuite.consumerKey'),
      secret: this.configService.get<string>('netsuite.consumerSecret'),
      token: this.configService.get<string>('netsuite.accessToken'),
      tokenSecret: this.configService.get<string>('netsuite.tokenSecret'),
      includeBodyHash: false,
      realm: this.configService.get<string>('netsuite.realm'),
    };

    // Validate required OAuth parameters
    const requiredParams = ['key', 'secret', 'token', 'tokenSecret', 'realm'];
    for (const param of requiredParams) {
      if (!oauthOptions[param]) {
        throw new Error(`NetSuite OAuth parameter '${param}' is not configured`);
      }
    }

    addOAuthInterceptor.default(client, oauthOptions);

    // Add response interceptor for error handling
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('NetSuite API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Executes a SuiteQL query against NetSuite
   */
  private async executeSuiteQLQuery(query: string): Promise<NetSuiteQueryResponse> {
    try {
      this.logger.debug(`Executing SuiteQL query: ${query}`);
      
      const response = await this.axiosClient.post('/suiteql', { q: query });
      
      this.logger.debug(`SuiteQL query result: ${JSON.stringify(response.data)}`);
      
      return response.data;
    } catch (error) {
      this.logger.error(`SuiteQL query failed: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to execute NetSuite query: ${error.message}`,
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  /**
   * Sanitizes email input to prevent SQL injection
   */
  private sanitizeEmail(email: string): string {
    // Basic email validation and escaping
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HttpException('Invalid email format', HttpStatus.BAD_REQUEST);
    }
    
    // Escape single quotes for SQL
    return email.replace(/'/g, "''");
  }

  /**
   * Builds customer existence query
   */
  private buildCustomerQuery(email: string): string {
    const sanitizedEmail = this.sanitizeEmail(email);
    
    return `
      SELECT 
        Customer.entityid 
      FROM 
        Customer 
      INNER JOIN 
        CustomerSubsidiaryRelationship 
      ON 
        Customer.id = CustomerSubsidiaryRelationship.entity 
      WHERE 
        Customer.email = '${sanitizedEmail}'
      AND CustomerSubsidiaryRelationship.subsidiary = ${this.subsidiaryId}
      AND CustomerSubsidiaryRelationship.isprimarysub = 'T'
    `;
  }

  /**
   * Builds contact existence query
   */
  private buildContactQuery(email: string): string {
    const sanitizedEmail = this.sanitizeEmail(email);
    
    return `
      SELECT
        Contact.entityId
      FROM
        Contact
      WHERE
        Contact.email = '${sanitizedEmail}'
    `;
  }

  /**
   * Checks if a customer exists in NetSuite
   */
  async checkCustomerExists(email: string): Promise<boolean> {
    try {
      const query = this.buildCustomerQuery(email);
      const result = await this.executeSuiteQLQuery(query);
      
      return result.count > 0;
    } catch (error) {
      this.logger.error(`Error checking customer existence for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Checks if a contact exists in NetSuite
   */
  async checkContactExists(email: string): Promise<boolean> {
    try {
      const query = this.buildContactQuery(email);
      const result = await this.executeSuiteQLQuery(query);
      
      return result.count > 0;
    } catch (error) {
      this.logger.error(`Error checking contact existence for ${email}:`, error);
      throw error;
    }
  }

  /**
   * Validates both customer and contact existence
   */
  async validateCustomerAndContact(
    request: NetSuiteCustomerCheckRequest
  ): Promise<NetSuiteCustomerCheckResponse> {
    try {
      this.logger.log(`Validating customer and contact for email: ${request.companyEmail}`);

      const [customerExists, contactExists] = await Promise.all([
        this.checkCustomerExists(request.companyEmail),
        this.checkContactExists(request.companyEmail),
      ]);

      if (customerExists) {
        return {
          success: false,
          error: 'Customer already exists in NetSuite',
          data: { customerExists: true, contactExists },
        };
      }

      if (contactExists) {
        return {
          success: false,
          error: 'Contact already exists in NetSuite',
          data: { customerExists: false, contactExists: true },
        };
      }

      return {
        success: true,
        message: 'No existing customer or contact found',
        data: { customerExists: false, contactExists: false },
      };
    } catch (error) {
      this.logger.error(`Error validating customer and contact:`, error);
      
      return {
        success: false,
        error: `An error occurred while querying NetSuite: ${error.message}`,
      };
    }
  }
}