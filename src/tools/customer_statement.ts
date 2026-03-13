// Customer Statement tools: get_customer_statement, send_customer_statement
// Statements summarize all open charges and payments for a customer
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── customer_balance_summary ───────────────────────────────────────────────
  server.registerTool(
    "customer_balance_summary",
    {
      title: "Customer Balance Summary Report",
      description:
        "Get a Customer Balance Summary report showing each customer's total outstanding balance. A condensed view of AR — shows just the total owed per customer without transaction details. Use for a quick snapshot of who owes money and how much. For transaction-level detail, use customer_balance_detail instead.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.customer_balance_summary",
        () => client.get(`/reports/CustomerBalance?${params}`),
        { tool: "customer_balance_summary" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── vendor_balance_summary ─────────────────────────────────────────────────
  server.registerTool(
    "vendor_balance_summary",
    {
      title: "Vendor Balance Summary Report",
      description:
        "Get a Vendor Balance Summary report showing each vendor's total outstanding balance (what you owe them). A condensed AP view — shows just the total owed per vendor without individual bill details. Use for a quick AP snapshot. For transaction-level detail, use vendor_balance_detail instead.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.vendor_balance_summary",
        () => client.get(`/reports/VendorBalance?${params}`),
        { tool: "vendor_balance_summary" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── accounts_receivable_aging_detail ───────────────────────────────────────
  server.registerTool(
    "accounts_receivable_aging_detail",
    {
      title: "AR Aging Detail Report",
      description:
        "Get an Accounts Receivable Aging Detail report showing each individual outstanding invoice bucketed by age (Current, 1-30, 31-60, 61-90, 91+ days overdue). More granular than accounts_receivable_aging — shows each invoice with its due date, customer, and amount in each bucket. Use to identify specific overdue invoices for collection follow-up.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.accounts_receivable_aging_detail",
        () => client.get(`/reports/AgedReceivableDetail?${params}`),
        { tool: "accounts_receivable_aging_detail" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── send_customer_statement ────────────────────────────────────────────────
  server.registerTool(
    "send_customer_statement",
    {
      title: "Send Customer Statement via Email",
      description:
        "Send a QuickBooks customer statement via email. Statements list all open invoices, payments received, and outstanding balance for a customer. Required: customerId. The statement is sent to the customer's email on file, or a custom address can be specified.",
      inputSchema: {
        customerId: z.string().describe("Customer ID to send statement to"),
        emailAddress: z
          .string()
          .email()
          .optional()
          .describe("Override email address (default: customer's email on file)"),
        statementDate: z
          .string()
          .optional()
          .describe("Statement as-of date (YYYY-MM-DD, default: today)"),
        startDueDate: z
          .string()
          .optional()
          .describe("Include invoices due on or after this date (YYYY-MM-DD)"),
        endDueDate: z
          .string()
          .optional()
          .describe("Include invoices due on or before this date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("sendTo", args.emailAddress ? (args.emailAddress as string) : "");
      if (args.statementDate) params.set("statementDate", args.statementDate as string);
      if (args.startDueDate) params.set("startDueDate", args.startDueDate as string);
      if (args.endDueDate) params.set("endDueDate", args.endDueDate as string);

      const queryString = args.emailAddress ? `?sendTo=${encodeURIComponent(args.emailAddress as string)}` : "";

      const result = await logger.time(
        "tool.send_customer_statement",
        () => client.post(`/customer/${args.customerId}/statement${queryString}`, {}),
        { tool: "send_customer_statement", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
