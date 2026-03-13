// Period Comparison Reports: multi-period P&L, balance sheet, rolling 12-month
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── multi_period_profit_loss ───────────────────────────────────────────────
  server.registerTool(
    "multi_period_profit_loss",
    {
      title: "Multi-Period Profit & Loss Comparison",
      description:
        "Fetch Profit & Loss reports for multiple periods in parallel and return them combined for side-by-side comparison. Specify up to 4 periods. Returns all periods in a single response for trend analysis, board reporting, and year-over-year comparison. Great for building financial dashboards.",
      inputSchema: {
        periods: z.array(z.object({
          label: z.string().describe("Period label (e.g. 'Q1 2024', 'Jan 2024')"),
          startDate: z.string().describe("Period start date (YYYY-MM-DD)"),
          endDate: z.string().describe("Period end date (YYYY-MM-DD)"),
        })).min(2).max(4).describe("2–4 periods to compare"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const periods = args.periods as Array<{ label: string; startDate: string; endDate: string }>;
      const results = await Promise.all(
        periods.map(async (period) => {
          const params = new URLSearchParams();
          params.set("start_date", period.startDate);
          params.set("end_date", period.endDate);
          if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
          if (args.classId) params.set("class", args.classId as string);
          if (args.departmentId) params.set("department", args.departmentId as string);
          if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
          const report = await logger.time(
            `tool.multi_period_profit_loss.${period.label}`,
            () => client.get(`/reports/ProfitAndLoss?${params}`),
            { tool: "multi_period_profit_loss", period: period.label }
          );
          return { label: period.label, startDate: period.startDate, endDate: period.endDate, report };
        })
      );
      const combined = { periods: results };
      return { content: [{ type: "text" as const, text: JSON.stringify(combined, null, 2) }], structuredContent: combined };
    }
  );

  // ── rolling_12_month_revenue ───────────────────────────────────────────────
  server.registerTool(
    "rolling_12_month_revenue",
    {
      title: "Rolling 12-Month Revenue Report",
      description:
        "Get a Profit & Loss report for the trailing 12 months with monthly columns. Returns revenue, expenses, and net income for each of the last 12 months. Ideal for LTM (Last Twelve Months) financial analysis, investor reporting, and trend visualization.",
      inputSchema: {
        endDate: z.string().describe("Last month end date (YYYY-MM-DD) — the report covers the 12 months ending on this date"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const endDate = new Date(args.endDate as string);
      const startDate = new Date(endDate);
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setDate(1); // First day of month 12 months ago
      const params = new URLSearchParams();
      params.set("start_date", startDate.toISOString().split("T")[0]);
      params.set("end_date", args.endDate as string);
      params.set("summarize_column_by", "Month");
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.rolling_12_month_revenue",
        () => client.get(`/reports/ProfitAndLoss?${params}`),
        { tool: "rolling_12_month_revenue" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── quarterly_balance_sheet ────────────────────────────────────────────────
  server.registerTool(
    "quarterly_balance_sheet",
    {
      title: "Quarterly Balance Sheet Trend",
      description:
        "Get balance sheet snapshots for each quarter in a date range, returned together for trend comparison. Shows how assets, liabilities, and equity have changed quarter over quarter. Use for lender reporting, investor updates, and financial health tracking.",
      inputSchema: {
        year: z.number().int().min(2000).max(2100).describe("Fiscal year (e.g. 2024)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const year = args.year as number;
      const quarters = [
        { label: `Q1 ${year}`, startDate: `${year}-01-01`, endDate: `${year}-03-31` },
        { label: `Q2 ${year}`, startDate: `${year}-04-01`, endDate: `${year}-06-30` },
        { label: `Q3 ${year}`, startDate: `${year}-07-01`, endDate: `${year}-09-30` },
        { label: `Q4 ${year}`, startDate: `${year}-10-01`, endDate: `${year}-12-31` },
      ];
      const results = await Promise.all(
        quarters.map(async (q) => {
          const params = new URLSearchParams();
          params.set("start_date", q.startDate);
          params.set("end_date", q.endDate);
          if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
          if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
          const report = await logger.time(
            `tool.quarterly_balance_sheet.${q.label}`,
            () => client.get(`/reports/BalanceSheet?${params}`),
            { tool: "quarterly_balance_sheet", quarter: q.label }
          );
          return { ...q, report };
        })
      );
      const combined = { year, quarters: results };
      return { content: [{ type: "text" as const, text: JSON.stringify(combined, null, 2) }], structuredContent: combined };
    }
  );
}
