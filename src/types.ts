/**
 * Shared TypeScript types for the QuickBooks Online MCP Server.
 * These supplement the SDK types with QBO-specific shapes.
 */

/** Reference to a related entity (e.g. CustomerRef, ItemRef). */
export interface QBORef {
  value: string;
  name?: string;
}

/** A QuickBooks Online customer record. */
export interface QBOCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: QBOAddress;
  Balance?: number;
  Active?: boolean;
  Notes?: string;
  MetaData?: QBOMetaData;
}

/** A QuickBooks Online address. */
export interface QBOAddress {
  Line1?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
}

/** A QuickBooks Online invoice. */
export interface QBOInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  CustomerRef: QBORef;
  Line: QBOLineItem[];
  TotalAmt?: number;
  Balance?: number;
  EmailStatus?: string;
  BillEmail?: { Address: string };
  MetaData?: QBOMetaData;
}

/** An invoice / bill line item. */
export interface QBOLineItem {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: string;
  SalesItemLineDetail?: {
    ItemRef?: QBORef;
    Qty?: number;
    UnitPrice?: number;
    TaxCodeRef?: QBORef;
    ServiceDate?: string;
  };
  AccountBasedExpenseLineDetail?: {
    AccountRef?: QBORef;
    BillableStatus?: string;
    CustomerRef?: QBORef;
  };
  DescriptionLineDetail?: { ServiceDate?: string };
  SubTotalLineDetail?: Record<string, unknown>;
  DiscountLineDetail?: { DiscountPercent?: number; PercentBased?: boolean; DiscountAccountRef?: QBORef };
}

/** A QuickBooks Online payment. */
export interface QBOPayment {
  Id: string;
  CustomerRef: QBORef;
  TotalAmt: number;
  TxnDate?: string;
  PaymentMethodRef?: QBORef;
  DepositToAccountRef?: QBORef;
  Line?: Array<{ Amount: number; LinkedTxn: Array<{ TxnId: string; TxnType: string }> }>;
  MetaData?: QBOMetaData;
}

/** A QuickBooks Online bill (accounts payable). */
export interface QBOBill {
  Id: string;
  VendorRef: QBORef;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  Line: QBOLineItem[];
  MetaData?: QBOMetaData;
}

/** A QuickBooks Online chart-of-accounts entry. */
export interface QBOAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  Classification?: string;
  CurrentBalance?: number;
  Active?: boolean;
  Description?: string;
  MetaData?: QBOMetaData;
}

/** Standard QBO metadata on most entities. */
export interface QBOMetaData {
  CreateTime: string;
  LastUpdatedTime: string;
}

/** Generic QBO query response wrapper. */
export interface QBOQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[] | number | undefined;
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
  time: string;
}

/** OAuth token response from Intuit. */
export interface QBOTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
}

/** Standard MCP tool return type. */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
