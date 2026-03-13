// Time Reports tools: time_activities_detail_report, payroll_summary_report, employee_details_report
// Time and payroll-related reports in QuickBooks Online
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── time_activities_by_employee ────────────────────────────────────────────
  server.registerTool(
    "time_activities_by_employee",
    {
      title: "Time Activities by Employee Report",
      description:
        "Get a Time Activities by Employee report showing hours worked per employee for a date range, with breakdowns by customer, service item, and billable status. Use for payroll, client billing preparation, workforce utilization analysis, and project cost tracking.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        customerId: z.string().optional().describe("Filter by customer/job ID"),
        itemId: z.string().optional().describe("Filter by service item ID"),
        departmentId: z.string().optional().describe("Filter by department ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.time_activities_by_employee",
        () => client.get(`/reports/TimeActivitiesByEmployeeJobDetail?${params}`),
        { tool: "time_activities_by_employee", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── payroll_summary_report ─────────────────────────────────────────────────
  server.registerTool(
    "payroll_summary_report",
    {
      title: "Payroll Summary Report",
      description:
        "Get a Payroll Summary report showing gross pay, taxes withheld, net pay, and employer contributions for each employee for a payroll period. Use for payroll review, tax preparation, and labor cost analysis. Requires QuickBooks Payroll subscription.",
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
        { tool: "payroll_summary_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── payroll_detail_report ──────────────────────────────────────────────────
  server.registerTool(
    "payroll_detail_report",
    {
      title: "Payroll Detail Report",
      description:
        "Get a detailed Payroll report showing individual paycheck details — earnings by pay type, deductions, taxes, and net pay — for each employee in a period. More granular than payroll_summary_report. Requires QuickBooks Payroll subscription.",
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
        () => client.get(`/reports/PayrollDetails?${params}`),
        { tool: "payroll_detail_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── customer_income_report ─────────────────────────────────────────────────
  server.registerTool(
    "customer_income_report",
    {
      title: "Income by Customer Summary Report",
      description:
        "Get an Income by Customer Summary report showing total income from each customer for a date range. Breaks down invoiced amounts, payments received, and outstanding balances per customer. Excellent for identifying your top revenue sources and customer profitability at a glance.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.customer_income_report",
        () => client.get(`/reports/IncomeSummary?${params}`),
        { tool: "customer_income_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── estimates_report ───────────────────────────────────────────────────────
  server.registerTool(
    "estimates_report",
    {
      title: "Open Estimates / Estimates by Customer Report",
      description:
        "Get an Estimates by Customer report showing all estimates for a date range, grouped by customer. Returns estimate status (Pending, Accepted, Closed, Rejected), amounts, and expiry dates. Use to track your sales pipeline, follow up on pending estimates, and measure estimate-to-invoice conversion rates.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.estimates_report",
        () => client.get(`/reports/EstimatesByCustomer?${params}`),
        { tool: "estimates_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
