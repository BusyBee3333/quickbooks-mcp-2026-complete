// Budget Reports: budget vs actuals, budget summary, budget by period
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── budget_vs_actuals ──────────────────────────────────────────────────────
  server.registerTool(
    "budget_vs_actuals",
    {
      title: "Budget vs Actuals Report",
      description:
        "Get a Budget vs Actuals report comparing your budgeted amounts to actual income and expenses for a date range. Shows budget, actual, and variance (dollar and percentage) for each account. Essential for financial control, variance analysis, and management reporting.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        budgetId: z.string().optional().describe("Specific budget ID to compare against (default: active budget)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        summarizeColumnsBy: z.enum(["Total", "Month", "Quarter", "Year"]).optional().describe("Column grouping (default: Total)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.budgetId) params.set("budget_id", args.budgetId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.summarizeColumnsBy) params.set("summarize_column_by", args.summarizeColumnsBy as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.budget_vs_actuals",
        () => client.get(`/reports/BudgetVsActuals?${params}`),
        { tool: "budget_vs_actuals" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── budget_summary ─────────────────────────────────────────────────────────
  server.registerTool(
    "budget_summary",
    {
      title: "Budget Summary Report",
      description:
        "Get a Budget Summary report showing the full budgeted income and expense amounts by account for a specific budget. Use to review what was budgeted for the period, verify budget entry accuracy, and export budget data for planning tools.",
      inputSchema: {
        startDate: z.string().describe("Budget period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Budget period end date (YYYY-MM-DD)"),
        budgetId: z.string().optional().describe("Specific budget ID (default: most recent active budget)"),
        summarizeColumnsBy: z.enum(["Total", "Month", "Quarter"]).optional().describe("Column grouping (default: Month)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.budgetId) params.set("budget_id", args.budgetId as string);
      if (args.summarizeColumnsBy) params.set("summarize_column_by", args.summarizeColumnsBy as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.budget_summary",
        () => client.get(`/reports/BudgetSummary?${params}`),
        { tool: "budget_summary" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── create_budget ──────────────────────────────────────────────────────────
  server.registerTool(
    "create_budget",
    {
      title: "Create Budget",
      description:
        "Create a new budget in QuickBooks for a fiscal year. Budgets can be set by account, department, class, or customer. After creating the budget entity, update it with specific line items for each account and period. Use for annual planning and variance tracking.",
      inputSchema: {
        name: z.string().describe("Budget name (e.g. '2025 Operating Budget', 'Q1 2025 Budget')"),
        budgetType: z.enum(["ProfitAndLoss", "BalanceSheet", "CashFlow"]).describe("Budget type"),
        startDate: z.string().describe("Budget period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Budget period end date (YYYY-MM-DD)"),
        active: z.boolean().optional().describe("Set as active budget (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Name: args.name,
        BudgetType: args.budgetType,
        StartDate: args.startDate,
        EndDate: args.endDate,
        Active: args.active !== false,
      };
      const result = await logger.time(
        "tool.create_budget",
        () => client.post("/budget", body),
        { tool: "create_budget" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
