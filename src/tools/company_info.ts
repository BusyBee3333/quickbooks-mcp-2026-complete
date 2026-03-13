// Company Info tools: get_company_info, update_company_info
// QBO CompanyInfo entity — company name, address, contact, fiscal year info
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const AddressSchema = z.object({
  line1: z.string().optional().describe("Address line 1"),
  line2: z.string().optional().describe("Address line 2"),
  city: z.string().optional().describe("City"),
  countrySubDivisionCode: z.string().optional().describe("State/province code (e.g. 'CA', 'NY')"),
  postalCode: z.string().optional().describe("ZIP/postal code"),
  country: z.string().optional().describe("Country (e.g. 'US')"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── get_company_info ───────────────────────────────────────────────────────
  server.registerTool(
    "get_company_info",
    {
      title: "Get QuickBooks Company Info",
      description:
        "Get QuickBooks Online company information including company name, legal name, address, phone, email, website, EIN, fiscal year start, industry type, and country. Returns SyncToken needed for updates.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (_args) => {
      // CompanyInfo is accessed by realmId — QBO returns it via /companyinfo/{realmId}
      // The query endpoint also works: SELECT * FROM CompanyInfo
      const result = await logger.time(
        "tool.get_company_info",
        () => client.query("CompanyInfo", undefined, 1, 1),
        { tool: "get_company_info" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_company_info ────────────────────────────────────────────────────
  server.registerTool(
    "update_company_info",
    {
      title: "Update QuickBooks Company Info",
      description:
        "Update QuickBooks Online company information using sparse update (only provided fields are changed). Requires companyInfoId and syncToken from get_company_info. Can update company name, legal name, address, phone, email, website, and EIN.",
      inputSchema: {
        companyInfoId: z.string().describe("CompanyInfo ID (from get_company_info QueryResponse)"),
        syncToken: z
          .string()
          .describe("SyncToken from get_company_info (required for optimistic locking)"),
        companyName: z.string().optional().describe("Company display name"),
        legalName: z.string().optional().describe("Legal name of the company"),
        companyAddr: AddressSchema.optional().describe("Company address"),
        legalAddr: AddressSchema.optional().describe("Legal address (if different from company address)"),
        customerCommunicationAddr: AddressSchema.optional().describe("Customer-facing address"),
        phone: z.string().optional().describe("Primary phone number"),
        fax: z.string().optional().describe("Fax number"),
        email: z.string().optional().describe("Company email address"),
        webAddr: z.string().optional().describe("Company website URL"),
        employerId: z.string().optional().describe("Employer Identification Number (EIN)"),
        fiscalYearStartMonth: z
          .string()
          .optional()
          .describe("Fiscal year start month (e.g. 'January', 'July')"),
        country: z.string().optional().describe("Country (e.g. 'US')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const companyInfo: Record<string, unknown> = {
        Id: args.companyInfoId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.companyName) companyInfo.CompanyName = args.companyName;
      if (args.legalName) companyInfo.LegalName = args.legalName;
      if (args.phone) companyInfo.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.fax) companyInfo.Fax = { FreeFormNumber: args.fax };
      if (args.email) companyInfo.Email = { Address: args.email };
      if (args.webAddr) companyInfo.WebAddr = { URI: args.webAddr };
      if (args.employerId) companyInfo.EmployerId = args.employerId;
      if (args.country) companyInfo.Country = args.country;
      if (args.fiscalYearStartMonth) companyInfo.FiscalYearStartMonth = args.fiscalYearStartMonth;

      const mapAddress = (addr: {
        line1?: string; line2?: string; city?: string;
        countrySubDivisionCode?: string; postalCode?: string; country?: string;
      }) => ({
        ...(addr.line1 ? { Line1: addr.line1 } : {}),
        ...(addr.line2 ? { Line2: addr.line2 } : {}),
        ...(addr.city ? { City: addr.city } : {}),
        ...(addr.countrySubDivisionCode ? { CountrySubDivisionCode: addr.countrySubDivisionCode } : {}),
        ...(addr.postalCode ? { PostalCode: addr.postalCode } : {}),
        ...(addr.country ? { Country: addr.country } : {}),
      });

      const companyAddrArg = args.companyAddr as Parameters<typeof mapAddress>[0] | undefined;
      const legalAddrArg = args.legalAddr as Parameters<typeof mapAddress>[0] | undefined;
      const commAddrArg = args.customerCommunicationAddr as Parameters<typeof mapAddress>[0] | undefined;

      if (companyAddrArg) companyInfo.CompanyAddr = mapAddress(companyAddrArg);
      if (legalAddrArg) companyInfo.LegalAddr = mapAddress(legalAddrArg);
      if (commAddrArg) companyInfo.CustomerCommunicationAddr = mapAddress(commAddrArg);

      const result = await logger.time(
        "tool.update_company_info",
        () => client.post("/companyinfo", companyInfo),
        { tool: "update_company_info", companyInfoId: args.companyInfoId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
