// Budgets tools: list_budgets, get_budget
// QBO Budget entity — read-only (budgets are created in the QBO UI)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_budgets ───────────────────────────────────────────────────────────
  server.registerTool(
    "list_budgets",
    {
      title: "List QuickBooks Budgets",
      description:
        "List QuickBooks Online budgets. Returns budget ID, name, type, start/end date, and associated fiscal year. Budgets are created in the QBO UI; this tool retrieves them for comparison against actuals. Supports startPosition/maxResults pagination.",
      inputSchema: {
        budgetType: z
          .enum(["ProfitAndLoss", "BalanceSheet"])
          .optional()
          .describe("Filter by budget type (ProfitAndLoss or BalanceSheet)"),
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
      const whereParts: string[] = [];
      if (args.budgetType) whereParts.push(`BudgetType = '${args.budgetType}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_budgets",
        () =>
          client.query(
            "Budget",
            where,
            args.startPosition ?? 1,
            args.maxResults ?? 100
          ),
        { tool: "list_budgets" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_budget ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_budget",
    {
      title: "Get QuickBooks Budget",
      description:
        "Get full details for a specific QuickBooks budget by ID, including all budget detail lines broken down by account, class, customer, or department, along with monthly/quarterly/annual amounts.",
      inputSchema: {
        budgetId: z.string().describe("QuickBooks budget ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_budget",
        () => client.get(`/budget/${args.budgetId}`),
        { tool: "get_budget", budgetId: args.budgetId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
