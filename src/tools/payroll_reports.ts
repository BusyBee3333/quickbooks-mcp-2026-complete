// Payroll Reports: summary, detail, deductions, liabilities, check detail
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── payroll_summary_report ─────────────────────────────────────────────────
  server.registerTool(
    "payroll_summary_report",
    {
      title: "Payroll Summary Report",
      description:
        "Get a Payroll Summary report showing total gross pay, deductions, and net pay by employee for a date range. Includes employer taxes and benefits. Requires QuickBooks Payroll subscription. Use for payroll cost analysis, budgeting, and HR reporting.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.payroll_summary_report",
        () => client.get(`/reports/PayrollSummary?${params}`),
        { tool: "payroll_summary_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── payroll_detail_report ──────────────────────────────────────────────────
  server.registerTool(
    "payroll_detail_report",
    {
      title: "Payroll Detail Report",
      description:
        "Get a Payroll Detail report showing each individual paycheck with itemized earnings, deductions, and taxes for each employee. More granular than payroll_summary_report. Use for paycheck-level audit, W-2 preparation, and payroll tax filing.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.payroll_detail_report",
        () => client.get(`/reports/PayrollDetail?${params}`),
        { tool: "payroll_detail_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── payroll_tax_and_wage_summary ───────────────────────────────────────────
  server.registerTool(
    "payroll_tax_and_wage_summary",
    {
      title: "Payroll Tax & Wage Summary Report",
      description:
        "Get a Payroll Tax and Wage Summary report showing taxable wages and withheld taxes per employee. Breaks down federal income tax, state income tax, Social Security, Medicare, and other taxes. Essential for 941/940 payroll tax form preparation and compliance.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.payroll_tax_and_wage_summary",
        () => client.get(`/reports/PayrollTaxAndWageSummary?${params}`),
        { tool: "payroll_tax_and_wage_summary" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── payroll_liability_balances ─────────────────────────────────────────────
  server.registerTool(
    "payroll_liability_balances",
    {
      title: "Payroll Liability Balances Report",
      description:
        "Get a Payroll Liability Balances report showing outstanding payroll tax liabilities and benefit deductions owed to tax agencies and benefit providers. Use to see what payroll taxes need to be remitted and when they are due.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.payroll_liability_balances",
        () => client.get(`/reports/PayrollLiabilityBalances?${params}`),
        { tool: "payroll_liability_balances" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
