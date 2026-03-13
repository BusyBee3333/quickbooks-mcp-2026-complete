// Employee Reports: employee details, compensation, time tracking summary
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── employee_details_report ────────────────────────────────────────────────
  server.registerTool(
    "employee_details_report",
    {
      title: "Employee Details Report",
      description:
        "Get an Employee Details report listing all employees with their personal details, hire dates, compensation rates, filing status, and withholding allowances. Use for HR audits, onboarding reviews, and compensation analysis.",
      inputSchema: {
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        includeInactive: z.boolean().optional().describe("Include terminated/inactive employees (default: false)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.employee_details_report",
        () => client.get(`/reports/EmployeeDetails?${params}`),
        { tool: "employee_details_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── time_by_employee_report ────────────────────────────────────────────────
  server.registerTool(
    "time_by_employee_report",
    {
      title: "Time by Employee Report",
      description:
        "Get a Time by Employee report showing total hours worked per employee broken down by service item or customer. Includes billable vs non-billable hours and hourly rate. Use for payroll processing, client billing, and employee productivity analysis.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        customerId: z.string().optional().describe("Filter by customer/job ID"),
        classId: z.string().optional().describe("Filter by class ID"),
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
      if (args.classId) params.set("class", args.classId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.time_by_employee_report",
        () => client.get(`/reports/TimeActivitiesByEmployee?${params}`),
        { tool: "time_by_employee_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── time_by_customer_report ────────────────────────────────────────────────
  server.registerTool(
    "time_by_customer_report",
    {
      title: "Time by Customer Report",
      description:
        "Get a Time by Customer report showing total hours and billable amounts per customer, broken down by employee. Use for client invoicing based on time, project profitability, and service delivery analysis.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        employeeId: z.string().optional().describe("Filter by employee ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.time_by_customer_report",
        () => client.get(`/reports/TimeActivitiesByCustomer?${params}`),
        { tool: "time_by_customer_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
