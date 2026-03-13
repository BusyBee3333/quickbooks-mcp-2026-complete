// Profit & Loss Advanced Reports: by class, by location, comparison
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── profit_loss_by_class ───────────────────────────────────────────────────
  server.registerTool(
    "profit_loss_by_class",
    {
      title: "Profit & Loss by Class Report",
      description:
        "Get a Profit & Loss report segmented by Class (e.g. product lines, business units, cost centers). Each class appears as a column. Requires QBO Plus or Advanced. Use for multi-segment profitability analysis.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter to a specific class ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.profit_loss_by_class",
        () => client.get(`/reports/ProfitAndLossByClass?${params}`),
        { tool: "profit_loss_by_class" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── profit_loss_by_location ────────────────────────────────────────────────
  server.registerTool(
    "profit_loss_by_location",
    {
      title: "Profit & Loss by Location Report",
      description:
        "Get a Profit & Loss report segmented by Location/Department. Each location appears as a column showing income and expenses. Requires QBO Plus or Advanced. Use for multi-location or franchise profitability.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        departmentId: z.string().optional().describe("Filter to a specific department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.profit_loss_by_location",
        () => client.get(`/reports/ProfitAndLossByLocation?${params}`),
        { tool: "profit_loss_by_location" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── profit_loss_comparison ─────────────────────────────────────────────────
  server.registerTool(
    "profit_loss_comparison",
    {
      title: "Profit & Loss Comparison Report",
      description:
        "Get a Profit & Loss Comparison report comparing two periods side by side with dollar and percentage change. Use for year-over-year, quarter-over-quarter analysis, and trend identification.",
      inputSchema: {
        startDate: z.string().describe("Current period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Current period end date (YYYY-MM-DD)"),
        comparePeriod: z.enum(["PreviousPeriod", "PreviousYear", "PreviousQuarter"]).optional().describe("Comparison reference period (default: PreviousPeriod)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.comparePeriod) params.set("compare_period_type", args.comparePeriod as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.profit_loss_comparison",
        () => client.get(`/reports/ProfitAndLossComparison?${params}`),
        { tool: "profit_loss_comparison" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── balance_sheet_comparison ───────────────────────────────────────────────
  server.registerTool(
    "balance_sheet_comparison",
    {
      title: "Balance Sheet Comparison Report",
      description:
        "Get a Balance Sheet Comparison report showing assets, liabilities, and equity for two periods side by side with change amounts. Use for period-end close, board reporting, and trend analysis.",
      inputSchema: {
        startDate: z.string().describe("Current period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Current period end date (YYYY-MM-DD)"),
        comparePeriod: z.enum(["PreviousPeriod", "PreviousYear", "PreviousQuarter"]).optional().describe("Comparison reference period (default: PreviousPeriod)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.comparePeriod) params.set("compare_period_type", args.comparePeriod as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.balance_sheet_comparison",
        () => client.get(`/reports/BalanceSheetComparison?${params}`),
        { tool: "balance_sheet_comparison" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── profit_loss_ytd ────────────────────────────────────────────────────────
  server.registerTool(
    "profit_loss_ytd",
    {
      title: "Profit & Loss Year-to-Date Report",
      description:
        "Get a Profit & Loss report for the current year-to-date period with monthly columns. Shows income and expense trends month by month. Ideal for management reporting, forecasting, and budget reviews.",
      inputSchema: {
        startDate: z.string().describe("YTD start date — typically Jan 1 of current year (YYYY-MM-DD)"),
        endDate: z.string().describe("YTD end date — typically today (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      params.set("summarize_column_by", "Month");
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.profit_loss_ytd",
        () => client.get(`/reports/ProfitAndLoss?${params}`),
        { tool: "profit_loss_ytd" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
