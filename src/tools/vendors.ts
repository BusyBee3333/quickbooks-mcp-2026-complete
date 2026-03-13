// Vendors tools: list_vendors, get_vendor, create_vendor, update_vendor
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_vendors ────────────────────────────────────────────────────────────
  server.registerTool(
    "list_vendors",
    {
      title: "List QuickBooks Vendors",
      description:
        "List QuickBooks Online vendors with optional filters. Returns display name, email, phone, balance, and active status. Supports offset pagination (startPosition, maxResults). Use when browsing vendors or finding a vendor ID.",
      inputSchema: {
        where: z
          .string()
          .optional()
          .describe("QBO query WHERE clause (e.g. \"Active = true AND Balance > '0.00'\")"),
        startPosition: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Pagination offset — 1-indexed (default 1)"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max results to return (default 100, max 1000)"),
        orderBy: z
          .string()
          .optional()
          .describe("Sort field (e.g. 'DisplayName ASC', 'Balance DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_vendors",
        () => client.query(
          "Vendor",
          args.where as string | undefined,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_vendors" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_vendor ──────────────────────────────────────────────────────────────
  server.registerTool(
    "get_vendor",
    {
      title: "Get QuickBooks Vendor",
      description:
        "Get full details for a QuickBooks vendor by ID. Returns all fields including contact info, billing address, balance, tax ID, and account number. Use when you have a vendor ID from list_vendors.",
      inputSchema: {
        vendorId: z.string().describe("QuickBooks vendor ID (e.g. '123')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_vendor",
        () => client.get(`/vendor/${args.vendorId}`),
        { tool: "get_vendor", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_vendor ────────────────────────────────────────────────────────────
  server.registerTool(
    "create_vendor",
    {
      title: "Create QuickBooks Vendor",
      description:
        "Create a new QuickBooks Online vendor. Returns the created vendor with assigned ID. Required: displayName.",
      inputSchema: {
        displayName: z.string().describe("Vendor display name (shown in QBO UI)"),
        companyName: z.string().optional().describe("Company or business name"),
        givenName: z.string().optional().describe("Contact first name"),
        familyName: z.string().optional().describe("Contact last name"),
        email: z.string().email().optional().describe("Primary email address"),
        phone: z.string().optional().describe("Primary phone number"),
        mobile: z.string().optional().describe("Mobile phone number"),
        fax: z.string().optional().describe("Fax number"),
        website: z.string().optional().describe("Website URL"),
        accountNumber: z.string().optional().describe("Vendor account number"),
        taxIdentifier: z.string().optional().describe("Tax ID / EIN / SSN"),
        term: z.string().optional().describe("Payment terms ID"),
        billLine1: z.string().optional().describe("Billing address line 1"),
        billCity: z.string().optional().describe("Billing city"),
        billState: z.string().optional().describe("Billing state/province"),
        billPostalCode: z.string().optional().describe("Billing postal/ZIP code"),
        billCountry: z.string().optional().describe("Billing country"),
        currencyRef: z.string().optional().describe("Currency code (e.g. 'USD', 'CAD')"),
        vendor1099: z.boolean().optional().describe("Whether vendor receives 1099 form"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const vendor: Record<string, unknown> = {
        DisplayName: args.displayName,
      };
      if (args.companyName) vendor.CompanyName = args.companyName;
      if (args.givenName) vendor.GivenName = args.givenName;
      if (args.familyName) vendor.FamilyName = args.familyName;
      if (args.email) vendor.PrimaryEmailAddr = { Address: args.email };
      if (args.phone) vendor.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.mobile) vendor.Mobile = { FreeFormNumber: args.mobile };
      if (args.fax) vendor.Fax = { FreeFormNumber: args.fax };
      if (args.website) vendor.WebAddr = { URI: args.website };
      if (args.accountNumber) vendor.AcctNum = args.accountNumber;
      if (args.taxIdentifier) vendor.TaxIdentifier = args.taxIdentifier;
      if (args.term) vendor.TermRef = { value: args.term };
      if (args.vendor1099 !== undefined) vendor.Vendor1099 = args.vendor1099;
      if (args.currencyRef) vendor.CurrencyRef = { value: args.currencyRef };

      if (args.billLine1) {
        vendor.BillAddr = {
          Line1: args.billLine1,
          ...(args.billCity ? { City: args.billCity } : {}),
          ...(args.billState ? { CountrySubDivisionCode: args.billState } : {}),
          ...(args.billPostalCode ? { PostalCode: args.billPostalCode } : {}),
          ...(args.billCountry ? { Country: args.billCountry } : {}),
        };
      }

      const result = await logger.time(
        "tool.create_vendor",
        () => client.post("/vendor", vendor),
        { tool: "create_vendor" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_vendor ────────────────────────────────────────────────────────────
  server.registerTool(
    "update_vendor",
    {
      title: "Update QuickBooks Vendor",
      description:
        "Update an existing QuickBooks vendor. Requires vendorId and syncToken (from get_vendor — needed for optimistic locking). Only provided fields are updated (sparse update).",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID (from list_vendors or get_vendor)"),
        syncToken: z.string().describe("SyncToken from get_vendor (required for optimistic locking)"),
        displayName: z.string().optional().describe("New display name"),
        companyName: z.string().optional().describe("New company name"),
        email: z.string().email().optional().describe("New email address"),
        phone: z.string().optional().describe("New phone number"),
        accountNumber: z.string().optional().describe("New account number"),
        taxIdentifier: z.string().optional().describe("New tax ID"),
        active: z.boolean().optional().describe("Set to false to deactivate vendor"),
        vendor1099: z.boolean().optional().describe("Whether vendor receives 1099 form"),
        billLine1: z.string().optional().describe("New billing address line 1"),
        billCity: z.string().optional().describe("New billing city"),
        billState: z.string().optional().describe("New billing state"),
        billPostalCode: z.string().optional().describe("New billing postal code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const vendor: Record<string, unknown> = {
        Id: args.vendorId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.displayName) vendor.DisplayName = args.displayName;
      if (args.companyName) vendor.CompanyName = args.companyName;
      if (args.email) vendor.PrimaryEmailAddr = { Address: args.email };
      if (args.phone) vendor.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.accountNumber) vendor.AcctNum = args.accountNumber;
      if (args.taxIdentifier) vendor.TaxIdentifier = args.taxIdentifier;
      if (args.active !== undefined) vendor.Active = args.active;
      if (args.vendor1099 !== undefined) vendor.Vendor1099 = args.vendor1099;

      if (args.billLine1) {
        vendor.BillAddr = {
          Line1: args.billLine1,
          ...(args.billCity ? { City: args.billCity } : {}),
          ...(args.billState ? { CountrySubDivisionCode: args.billState } : {}),
          ...(args.billPostalCode ? { PostalCode: args.billPostalCode } : {}),
        };
      }

      const result = await logger.time(
        "tool.update_vendor",
        () => client.post("/vendor", vendor),
        { tool: "update_vendor", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
