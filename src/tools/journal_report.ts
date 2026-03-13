// Journal & Transaction detail reports: journal_report, transaction_list_with_splits, transaction_list_by_tag
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── journal_report ─────────────────────────────────────────────────────────
  server.registerTool(
    "journal_report",
    {
      title: "Journal Report",
      description:
        "Get a Journal Report showing all transactions in journal entry (debit/credit) format for a date range. Every transaction is shown as its underlying debits and credits, regardless of transaction type. Essential for accountants doing full double-entry bookkeeping review.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        accountId: z.string().optional().describe("Filter by account ID"),
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
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.accountId) params.set("account", args.accountId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.journal_report",
        () => client.get(`/reports/JournalReport?${params}`),
        { tool: "journal_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── transaction_list_with_splits ───────────────────────────────────────────
  server.registerTool(
    "transaction_list_with_splits",
    {
      title: "Transaction List with Splits Report",
      description:
        "Get a Transaction List report that includes split lines — showing each split account, amount, and memo for every transaction. More detailed than transaction_list — reveals how transactions are categorized across multiple accounts. Use for expense categorization review.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        transactionType: z.string().optional().describe("Filter by transaction type (e.g. 'Invoice', 'Bill', 'Check')"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        accountId: z.string().optional().describe("Filter by account ID"),
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
      if (args.transactionType) params.set("transaction_type", args.transactionType as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.accountId) params.set("account", args.accountId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.transaction_list_with_splits",
        () => client.get(`/reports/TransactionListWithSplits?${params}`),
        { tool: "transaction_list_with_splits" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── transaction_list_by_tag ────────────────────────────────────────────────
  server.registerTool(
    "transaction_list_by_tag",
    {
      title: "Transaction List by Tag Report",
      description:
        "Get a Transaction List report grouped by Tag. Tags are custom labels you apply to transactions in QBO for flexible categorization outside the account/class/department structure. Use to analyze transactions grouped by campaign, project, or custom category.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        tagId: z.string().optional().describe("Filter to a specific tag ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.tagId) params.set("tag", args.tagId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.transaction_list_by_tag",
        () => client.get(`/reports/TransactionListByTag?${params}`),
        { tool: "transaction_list_by_tag" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
