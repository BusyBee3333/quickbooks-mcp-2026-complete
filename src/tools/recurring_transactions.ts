// Recurring Transactions tools: list_recurring_transactions, get_recurring_transaction
// QBO RecurringTransaction entity — schedules that auto-generate transactions
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_recurring_transactions ────────────────────────────────────────────
  server.registerTool(
    "list_recurring_transactions",
    {
      title: "List QuickBooks Recurring Transactions",
      description:
        "List QuickBooks Online recurring transaction templates (scheduled transactions that auto-generate invoices, bills, expenses, etc.). Returns template name, transaction type, schedule type, and next date. Supports startPosition/maxResults pagination.",
      inputSchema: {
        startPosition: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max results (default 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_recurring_transactions",
        () =>
          client.query(
            "RecurringTransaction",
            undefined,
            args.startPosition ?? 1,
            args.maxResults ?? 100
          ),
        { tool: "list_recurring_transactions" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_recurring_transaction ──────────────────────────────────────────────
  server.registerTool(
    "get_recurring_transaction",
    {
      title: "Get QuickBooks Recurring Transaction",
      description:
        "Get full details for a specific QuickBooks recurring transaction template by ID, including the transaction type, schedule (daily/weekly/monthly/yearly), next scheduled date, and the template transaction details.",
      inputSchema: {
        recurringTransactionId: z
          .string()
          .describe("QuickBooks recurring transaction template ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_recurring_transaction",
        () =>
          client.get(`/recurringtransaction/${args.recurringTransactionId}`),
        {
          tool: "get_recurring_transaction",
          recurringTransactionId: args.recurringTransactionId as string,
        }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
