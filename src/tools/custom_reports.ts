// Custom Reports: account list, custom queries, saved report configs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── account_list_report ────────────────────────────────────────────────────
  server.registerTool(
    "account_list_report",
    {
      title: "Account List Report",
      description:
        "Get a formatted Account List report showing all chart of accounts with account type, detail type, description, and current balance. More formatted than list_accounts — returned as a QBO report with totals per account type category. Use for chart of accounts review, audit, and external reporting.",
      inputSchema: {
        accountType: z.string().optional().describe("Filter by account type (e.g. 'Income', 'Expense', 'Bank', 'AccountsReceivable', 'OtherCurrentLiability')"),
        activeOnly: z.boolean().optional().describe("Show only active accounts (default: true)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.accountType) params.set("account_type", args.accountType as string);
      if (args.activeOnly !== false) params.set("account_status", "active");
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.account_list_report",
        () => client.get(`/reports/AccountList?${params}`),
        { tool: "account_list_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── customer_income_report ─────────────────────────────────────────────────
  server.registerTool(
    "customer_income_report",
    {
      title: "Customer Income Report",
      description:
        "Get a Customer Income report showing total income received from each customer for a date range, broken down by income account. Use for customer value analysis, top customer identification, and income source tracking.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
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
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.customer_income_report",
        () => client.get(`/reports/CustomerIncome?${params}`),
        { tool: "customer_income_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── vendor_expenses_report ─────────────────────────────────────────────────
  server.registerTool(
    "vendor_expenses_report",
    {
      title: "Vendor Expenses Summary Report",
      description:
        "Get a Vendor Expenses Summary report showing total expenses per vendor broken down by expense account. Covers all purchase transaction types (bills, checks, credit card charges). Use for vendor spend analysis, budget tracking, and procurement decision-making.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
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
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.vendor_expenses_report",
        () => client.get(`/reports/ExpensesByVendorSummary?${params}`),
        { tool: "vendor_expenses_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── missing_checks_report ──────────────────────────────────────────────────
  server.registerTool(
    "missing_checks_report",
    {
      title: "Missing Checks Report",
      description:
        "Get a Missing Checks report identifying gaps in check number sequences for a bank account. Lists check ranges and flags any missing check numbers that might indicate lost checks, unauthorized payments, or data entry errors. Use for check fraud detection and internal audit.",
      inputSchema: {
        accountId: z.string().describe("Bank account ID to audit for missing checks"),
        startDate: z.string().optional().describe("Start date for check range (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date for check range (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("account", args.accountId as string);
      if (args.startDate) params.set("start_date", args.startDate as string);
      if (args.endDate) params.set("end_date", args.endDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.missing_checks_report",
        () => client.get(`/reports/MissingChecks?${params}`),
        { tool: "missing_checks_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
