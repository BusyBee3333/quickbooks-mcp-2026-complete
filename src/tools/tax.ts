// Tax tools: list_tax_codes, list_tax_rates, get_tax_code
// Tax codes and rates in QuickBooks Online (US companies use automated sales tax)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_tax_codes ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_tax_codes",
    {
      title: "List QuickBooks Tax Codes",
      description:
        "List QuickBooks Online tax codes used to apply sales tax to transactions. Returns code name, description, taxable/non-taxable designation, and associated tax rates. Use to find the right tax code for invoices and items.",
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
        "tool.list_tax_codes",
        () => client.query(
          "TaxCode",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_tax_codes" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── list_tax_rates ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_tax_rates",
    {
      title: "List QuickBooks Tax Rates",
      description:
        "List QuickBooks Online tax rates including rate percentage, agency, and whether it applies to sales or purchases. Use to understand tax rate details associated with tax codes.",
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
        "tool.list_tax_rates",
        () => client.query(
          "TaxRate",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_tax_rates" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_tax_code ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_tax_code",
    {
      title: "Get QuickBooks Tax Code",
      description:
        "Get full details for a QuickBooks tax code by ID. Returns name, description, taxable status, and the list of associated tax rates (both for sales and purchases).",
      inputSchema: {
        taxCodeId: z.string().describe("QuickBooks tax code ID (e.g. 'TAX', 'NON', or a numeric ID)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_tax_code",
        () => client.get(`/taxcode/${args.taxCodeId}`),
        { tool: "get_tax_code", taxCodeId: args.taxCodeId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
