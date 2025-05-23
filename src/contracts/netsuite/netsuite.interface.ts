// src/contracts/netsuite/netsuite.interface.ts
export interface NetSuiteQueryResponse {
    count: number;
    hasMore: boolean;
    items: any[];
    links: any[];
    offset: number;
    totalResults: number;
  }
  
  export interface NetSuiteCustomerCheckRequest {
    companyEmail: string;
  }
  
  export interface NetSuiteCustomerCheckResponse {
    success: boolean;
    message?: string;
    error?: string;
    data?: {
      customerExists: boolean;
      contactExists: boolean;
    };
  }
  
  export interface NetSuiteServiceInterface {
    checkCustomerExists(email: string): Promise<boolean>;
    checkContactExists(email: string): Promise<boolean>;
    validateCustomerAndContact(request: NetSuiteCustomerCheckRequest): Promise<NetSuiteCustomerCheckResponse>;
  }