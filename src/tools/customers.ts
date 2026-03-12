// Customers tools: list_customers, get_customer, create_customer, update_customer
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_customers ─────────────────────────────────────────────────────────
  server.registerTool(
    "list_customers",
    {
      title: "List QuickBooks Customers",
      description:
        "List QuickBooks Online customers with optional filters. Returns display name, email, phone, balance, and active status. Supports offset pagination (startPosition, maxResults). Use when browsing customers or finding a customer ID.",
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
        "tool.list_customers",
        () => client.query(
          "Customer",
          args.where as string | undefined,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_customers" }
      ) as { QueryResponse: Record<string, unknown>; time: string };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  // ── get_customer ───────────────────────────────────────────────────────────
  server.registerTool(
    "get_customer",
    {
      title: "Get QuickBooks Customer",
      description:
        "Get full details for a QuickBooks customer by ID. Returns all fields including contact info, billing/shipping address, balance, and payment method. Use when you have a customer ID from list_customers.",
      inputSchema: {
        customerId: z.string().describe("QuickBooks customer ID (e.g. '123')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_customer",
        () => client.get(`/customer/${args.customerId}`),
        { tool: "get_customer", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_customer ────────────────────────────────────────────────────────
  server.registerTool(
    "create_customer",
    {
      title: "Create QuickBooks Customer",
      description:
        "Create a new QuickBooks Online customer. Returns the created customer with assigned ID. Required: displayName or a combination of given/family name.",
      inputSchema: {
        displayName: z.string().describe("Customer display name (shown in QBO UI)"),
        companyName: z.string().optional().describe("Company or business name"),
        givenName: z.string().optional().describe("First name"),
        familyName: z.string().optional().describe("Last name"),
        email: z.string().email().optional().describe("Primary email address"),
        phone: z.string().optional().describe("Primary phone number"),
        mobile: z.string().optional().describe("Mobile phone number"),
        fax: z.string().optional().describe("Fax number"),
        website: z.string().optional().describe("Website URL"),
        notes: z.string().optional().describe("Internal notes"),
        billingLine1: z.string().optional().describe("Billing address line 1"),
        billingCity: z.string().optional().describe("Billing city"),
        billingState: z.string().optional().describe("Billing state/province"),
        billingPostalCode: z.string().optional().describe("Billing postal/ZIP code"),
        billingCountry: z.string().optional().describe("Billing country"),
        taxable: z.boolean().optional().describe("Whether customer is taxable"),
        currencyRef: z.string().optional().describe("Currency code (e.g. 'USD', 'CAD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const customer: Record<string, unknown> = {
        DisplayName: args.displayName,
      };
      if (args.companyName) customer.CompanyName = args.companyName;
      if (args.givenName) customer.GivenName = args.givenName;
      if (args.familyName) customer.FamilyName = args.familyName;
      if (args.email) customer.PrimaryEmailAddr = { Address: args.email };
      if (args.phone) customer.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.mobile) customer.Mobile = { FreeFormNumber: args.mobile };
      if (args.fax) customer.Fax = { FreeFormNumber: args.fax };
      if (args.website) customer.WebAddr = { URI: args.website };
      if (args.notes) customer.Notes = args.notes;
      if (args.taxable !== undefined) customer.Taxable = args.taxable;
      if (args.currencyRef) customer.CurrencyRef = { value: args.currencyRef };

      if (args.billingLine1) {
        customer.BillAddr = {
          Line1: args.billingLine1,
          ...(args.billingCity ? { City: args.billingCity } : {}),
          ...(args.billingState ? { CountrySubDivisionCode: args.billingState } : {}),
          ...(args.billingPostalCode ? { PostalCode: args.billingPostalCode } : {}),
          ...(args.billingCountry ? { Country: args.billingCountry } : {}),
        };
      }

      const result = await logger.time(
        "tool.create_customer",
        () => client.post("/customer", customer),
        { tool: "create_customer" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_customer ────────────────────────────────────────────────────────
  server.registerTool(
    "update_customer",
    {
      title: "Update QuickBooks Customer",
      description:
        "Update an existing QuickBooks customer. Requires customerId and syncToken (from get_customer — needed to prevent stale writes). Only provided fields are updated.",
      inputSchema: {
        customerId: z.string().describe("Customer ID (from list_customers or get_customer)"),
        syncToken: z.string().describe("SyncToken from get_customer (required for optimistic locking)"),
        displayName: z.string().optional().describe("New display name"),
        companyName: z.string().optional().describe("New company name"),
        email: z.string().email().optional().describe("New email address"),
        phone: z.string().optional().describe("New phone number"),
        notes: z.string().optional().describe("New internal notes"),
        active: z.boolean().optional().describe("Set to false to deactivate customer"),
        billingLine1: z.string().optional().describe("New billing address line 1"),
        billingCity: z.string().optional().describe("New billing city"),
        billingState: z.string().optional().describe("New billing state"),
        billingPostalCode: z.string().optional().describe("New billing postal code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const customer: Record<string, unknown> = {
        Id: args.customerId,
        SyncToken: args.syncToken,
        sparse: true, // Sparse update — only update provided fields
      };
      if (args.displayName) customer.DisplayName = args.displayName;
      if (args.companyName) customer.CompanyName = args.companyName;
      if (args.email) customer.PrimaryEmailAddr = { Address: args.email };
      if (args.phone) customer.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.notes) customer.Notes = args.notes;
      if (args.active !== undefined) customer.Active = args.active;

      if (args.billingLine1) {
        customer.BillAddr = {
          Line1: args.billingLine1,
          ...(args.billingCity ? { City: args.billingCity } : {}),
          ...(args.billingState ? { CountrySubDivisionCode: args.billingState } : {}),
          ...(args.billingPostalCode ? { PostalCode: args.billingPostalCode } : {}),
        };
      }

      const result = await logger.time(
        "tool.update_customer",
        () => client.post("/customer", customer),
        { tool: "update_customer", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
