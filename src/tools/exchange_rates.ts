// Exchange Rate tools: get_exchange_rate, list_exchange_rates, update_exchange_rate
// Exchange rates are used for multi-currency QuickBooks companies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── get_exchange_rate ──────────────────────────────────────────────────────
  server.registerTool(
    "get_exchange_rate",
    {
      title: "Get QuickBooks Exchange Rate",
      description:
        "Get the exchange rate for a specific currency pair as of a given date. QuickBooks uses exchange rates to convert foreign currency transactions to your home currency. Returns the rate, as-of date, and source currency. Requires multi-currency to be enabled in QuickBooks preferences.",
      inputSchema: {
        sourceCurrencyCode: z
          .string()
          .describe("Source (foreign) currency code (e.g. 'CAD', 'EUR', 'GBP', 'JPY')"),
        asOfDate: z
          .string()
          .optional()
          .describe("Date to fetch exchange rate for (YYYY-MM-DD, default: today)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      let path = `/exchangerate?sourcecurrencycode=${encodeURIComponent(args.sourceCurrencyCode as string)}`;
      if (args.asOfDate) path += `&asofdate=${encodeURIComponent(args.asOfDate as string)}`;

      const result = await logger.time(
        "tool.get_exchange_rate",
        () => client.get(path),
        { tool: "get_exchange_rate", sourceCurrencyCode: args.sourceCurrencyCode as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── list_exchange_rates ────────────────────────────────────────────────────
  server.registerTool(
    "list_exchange_rates",
    {
      title: "List QuickBooks Exchange Rates",
      description:
        "List all exchange rates configured in QuickBooks for foreign currency support. Returns the rate for each currency relative to the home currency. Use to see all currencies in use, their current rates, and when they were last updated. Requires multi-currency to be enabled.",
      inputSchema: {
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_exchange_rates",
        () => client.query("ExchangeRate", undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_exchange_rates" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_exchange_rate ───────────────────────────────────────────────────
  server.registerTool(
    "update_exchange_rate",
    {
      title: "Update QuickBooks Exchange Rate",
      description:
        "Set or update the exchange rate for a currency in QuickBooks. Use to manually override auto-fetched rates, or to set rates for currencies not in the auto-fetch list. The rate is expressed as: 1 unit of sourceCurrencyCode = rate units of home currency (e.g. 1 EUR = 1.09 USD).",
      inputSchema: {
        sourceCurrencyCode: z
          .string()
          .describe("Source (foreign) currency code to update (e.g. 'EUR', 'CAD', 'GBP')"),
        rate: z
          .number()
          .describe("Exchange rate: how many home-currency units equal 1 unit of the source currency"),
        asOfDate: z
          .string()
          .optional()
          .describe("Effective date for this rate (YYYY-MM-DD, default: today)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const exchangeRate: Record<string, unknown> = {
        SourceCurrencyCode: args.sourceCurrencyCode,
        Rate: args.rate,
      };
      if (args.asOfDate) exchangeRate.AsOfDate = args.asOfDate;

      const result = await logger.time(
        "tool.update_exchange_rate",
        () => client.post("/exchangerate", exchangeRate),
        { tool: "update_exchange_rate", sourceCurrencyCode: args.sourceCurrencyCode as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
