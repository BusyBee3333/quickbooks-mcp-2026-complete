// Company Currency tools: list_company_currencies, get_company_currency, create_company_currency, update_company_currency
// Manage currencies enabled for multi-currency QuickBooks companies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_company_currencies ────────────────────────────────────────────────
  server.registerTool(
    "list_company_currencies",
    {
      title: "List QuickBooks Company Currencies",
      description:
        "List all currencies enabled for your QuickBooks multi-currency company. Returns currency code, name, symbol, exchange rate, and active status. The home currency is always included. Use to see which foreign currencies are configured and their current rates. Requires multi-currency to be enabled in QuickBooks settings.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_company_currencies",
        () => client.query("CompanyCurrency", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_company_currencies" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_company_currency ───────────────────────────────────────────────────
  server.registerTool(
    "get_company_currency",
    {
      title: "Get QuickBooks Company Currency",
      description:
        "Get full details for a specific company currency by ID. Returns the currency code, name, symbol, current exchange rate against the home currency, and whether it's the home currency or active.",
      inputSchema: {
        companyCurrencyId: z.string().describe("QuickBooks company currency ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_company_currency",
        () => client.get(`/companycurrency/${args.companyCurrencyId}`),
        { tool: "get_company_currency", companyCurrencyId: args.companyCurrencyId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_company_currency ────────────────────────────────────────────────
  server.registerTool(
    "create_company_currency",
    {
      title: "Create QuickBooks Company Currency",
      description:
        "Enable a new currency for your QuickBooks multi-currency company. Once created, you can create customers, vendors, invoices, and bills in that currency. The exchange rate will be auto-fetched from Intuit's rate service, or you can set a manual rate.",
      inputSchema: {
        currencyCode: z
          .string()
          .describe("ISO 4217 currency code to enable (e.g. 'CAD', 'EUR', 'GBP', 'JPY', 'AUD', 'MXN')"),
        active: z.boolean().optional().describe("Whether the currency is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const currency: Record<string, unknown> = {
        Code: args.currencyCode,
      };
      if (args.active !== undefined) currency.Active = args.active;

      const result = await logger.time(
        "tool.create_company_currency",
        () => client.post("/companycurrency", currency),
        { tool: "create_company_currency", currencyCode: args.currencyCode as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_company_currency ────────────────────────────────────────────────
  server.registerTool(
    "update_company_currency",
    {
      title: "Update QuickBooks Company Currency",
      description:
        "Update a company currency — typically to activate/deactivate it. Requires companyCurrencyId and syncToken (from get_company_currency). Use to disable unused foreign currencies to keep your currency list clean.",
      inputSchema: {
        companyCurrencyId: z.string().describe("Company currency ID to update"),
        syncToken: z.string().describe("SyncToken from get_company_currency"),
        active: z.boolean().optional().describe("Set to false to deactivate this currency"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const currency: Record<string, unknown> = {
        Id: args.companyCurrencyId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.active !== undefined) currency.Active = args.active;

      const result = await logger.time(
        "tool.update_company_currency",
        () => client.post("/companycurrency", currency),
        { tool: "update_company_currency", companyCurrencyId: args.companyCurrencyId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
