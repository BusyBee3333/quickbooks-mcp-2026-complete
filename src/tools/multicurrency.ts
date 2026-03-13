// Multicurrency management tools: currencies, exchange rate management
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_currencies ────────────────────────────────────────────────────────
  server.registerTool(
    "list_currencies",
    {
      title: "List Currencies",
      description:
        "List all currencies enabled in the QuickBooks company. Returns each currency's code, name, exchange rate, and active status. Multicurrency must be enabled in QBO settings. Use to get currency codes for multicurrency transactions and exchange rate management.",
      inputSchema: {
        activeOnly: z.boolean().optional().describe("Return only active currencies (default: true)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const where = args.activeOnly !== false ? "Active = true" : undefined;
      const result = await logger.time(
        "tool.list_currencies",
        () => client.query("Currency", where, 1, 1000),
        { tool: "list_currencies" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_currency ───────────────────────────────────────────────────────────
  server.registerTool(
    "get_currency",
    {
      title: "Get Currency",
      description:
        "Get details for a specific currency by its 3-letter ISO currency code (e.g. 'EUR', 'GBP', 'CAD'). Returns the currency name, current exchange rate against home currency, and active status.",
      inputSchema: {
        currencyCode: z.string().length(3).describe("3-letter ISO currency code (e.g. 'EUR', 'GBP', 'CAD', 'AUD')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_currency",
        () => client.get(`/currency/${(args.currencyCode as string).toUpperCase()}`),
        { tool: "get_currency", currencyCode: args.currencyCode as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── enable_currency ────────────────────────────────────────────────────────
  server.registerTool(
    "enable_currency",
    {
      title: "Enable Currency",
      description:
        "Enable a foreign currency for use in QuickBooks transactions. Creates a currency entity with the specified ISO code. After enabling, you can create invoices, bills, and payments in that currency. Use when onboarding new international customers or vendors.",
      inputSchema: {
        currencyCode: z.string().length(3).describe("3-letter ISO currency code to enable (e.g. 'EUR', 'GBP', 'CAD')"),
        active: z.boolean().optional().describe("Set active status (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        code: (args.currencyCode as string).toUpperCase(),
        Active: args.active !== false,
      };
      const result = await logger.time(
        "tool.enable_currency",
        () => client.post("/currency", body),
        { tool: "enable_currency", currencyCode: args.currencyCode as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── currency_exchange_rate_report ──────────────────────────────────────────
  server.registerTool(
    "currency_exchange_rate_report",
    {
      title: "Currency Exchange Rate Report",
      description:
        "Get historical exchange rates for currencies used in the company over a date range. Returns exchange rates per currency per date, as recorded in QuickBooks at the time of transactions. Use for multicurrency gain/loss analysis and financial reporting.",
      inputSchema: {
        currencyCode: z.string().optional().describe("Filter to a specific currency code (e.g. 'EUR')"),
        startDate: z.string().optional().describe("Start date for exchange rate history (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date for exchange rate history (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const conditions: string[] = [];
      if (args.currencyCode) conditions.push(`SourceCurrencyCode = '${args.currencyCode}'`);
      if (args.startDate) conditions.push(`AsOfDate >= '${args.startDate}'`);
      if (args.endDate) conditions.push(`AsOfDate <= '${args.endDate}'`);
      const where = conditions.length ? conditions.join(" AND ") : undefined;
      const result = await logger.time(
        "tool.currency_exchange_rate_report",
        () => client.query("ExchangeRate", where, 1, 1000),
        { tool: "currency_exchange_rate_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
