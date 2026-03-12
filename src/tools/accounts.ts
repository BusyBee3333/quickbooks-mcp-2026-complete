// Accounts tools: list_accounts, get_account
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_accounts ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_accounts",
    {
      title: "List QuickBooks Accounts (Chart of Accounts)",
      description:
        "List QuickBooks chart of accounts. Returns account name, type, sub-type, number, balance, and active status. Filter by account type (Income, Expense, Asset, Liability, Equity, Bank, Credit Card, etc.). Use to find account IDs for creating invoices, bills, or expense transactions.",
      inputSchema: {
        accountType: z
          .string()
          .optional()
          .describe(
            "Filter by account type (e.g. Income, Expense, Asset, Liability, Equity, Bank, 'Credit Card', 'Accounts Receivable', 'Accounts Payable')"
          ),
        active: z
          .boolean()
          .optional()
          .describe("Filter by active status (default: all)"),
        where: z
          .string()
          .optional()
          .describe("Additional QBO query WHERE clause"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 200)"),
        orderBy: z
          .string()
          .optional()
          .describe("Sort field (e.g. 'Name ASC', 'AccountType ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.accountType) whereParts.push(`AccountType = '${args.accountType}'`);
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      if (args.where) whereParts.push(args.where as string);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_accounts",
        () => client.query(
          "Account",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 200,
          args.orderBy as string | undefined
        ),
        { tool: "list_accounts" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_account ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_account",
    {
      title: "Get QuickBooks Account",
      description:
        "Get full details for a QuickBooks account by ID. Returns account name, type, sub-type, number, current balance, currency, and active status. Use to verify account details before creating transactions.",
      inputSchema: {
        accountId: z.string().describe("QuickBooks account ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_account",
        () => client.get(`/account/${args.accountId}`),
        { tool: "get_account", accountId: args.accountId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
