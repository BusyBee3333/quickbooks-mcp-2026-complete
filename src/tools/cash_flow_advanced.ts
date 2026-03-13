// Cash Flow Advanced: statement of cash flows, cash flow comparison, forecast
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── statement_of_cash_flows ────────────────────────────────────────────────
  server.registerTool(
    "statement_of_cash_flows",
    {
      title: "Statement of Cash Flows",
      description:
        "Get the formal Statement of Cash Flows (GAAP/IFRS format) showing cash movements from operating, investing, and financing activities. Includes beginning/ending cash balance. Required for GAAP financial statements, lender reporting, and investor packages. Use for any formal financial reporting.",
      inputSchema: {
        startDate: z.string().describe("Period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Period end date (YYYY-MM-DD)"),
        summarizeColumnsBy: z.enum(["Total", "Month", "Quarter", "Year"]).optional().describe("Column grouping (default: Total)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.summarizeColumnsBy) params.set("summarize_column_by", args.summarizeColumnsBy as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.statement_of_cash_flows",
        () => client.get(`/reports/CashFlow?${params}`),
        { tool: "statement_of_cash_flows" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── cash_flow_by_month ─────────────────────────────────────────────────────
  server.registerTool(
    "cash_flow_by_month",
    {
      title: "Cash Flow by Month Report",
      description:
        "Get a Cash Flow report with monthly columns for a multi-month or full-year period. Shows operating, investing, and financing cash flows month by month. Ideal for identifying seasonal cash patterns, planning cash reserves, and presenting to investors.",
      inputSchema: {
        startDate: z.string().describe("Period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Period end date (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      params.set("summarize_column_by", "Month");
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.cash_flow_by_month",
        () => client.get(`/reports/CashFlow?${params}`),
        { tool: "cash_flow_by_month" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── cash_flow_comparison ───────────────────────────────────────────────────
  server.registerTool(
    "cash_flow_comparison",
    {
      title: "Cash Flow Comparison Report",
      description:
        "Get a Cash Flow report comparing the current period to a prior period or prior year. Shows cash flow trends and year-over-year changes in operating, investing, and financing activities. Use for board presentations and lender reporting requiring period comparisons.",
      inputSchema: {
        startDate: z.string().describe("Current period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Current period end date (YYYY-MM-DD)"),
        compareStartDate: z.string().describe("Comparison period start date (YYYY-MM-DD)"),
        compareEndDate: z.string().describe("Comparison period end date (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const [current, comparison] = await Promise.all([
        logger.time(
          "tool.cash_flow_comparison.current",
          () => {
            const params = new URLSearchParams();
            params.set("start_date", args.startDate as string);
            params.set("end_date", args.endDate as string);
            if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
            return client.get(`/reports/CashFlow?${params}`);
          },
          { tool: "cash_flow_comparison" }
        ),
        logger.time(
          "tool.cash_flow_comparison.comparison",
          () => {
            const params = new URLSearchParams();
            params.set("start_date", args.compareStartDate as string);
            params.set("end_date", args.compareEndDate as string);
            if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
            return client.get(`/reports/CashFlow?${params}`);
          },
          { tool: "cash_flow_comparison" }
        ),
      ]);
      const result = {
        currentPeriod: { startDate: args.startDate, endDate: args.endDate, report: current },
        comparisonPeriod: { startDate: args.compareStartDate, endDate: args.compareEndDate, report: comparison },
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
    }
  );
}
