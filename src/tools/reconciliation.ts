// Reconciliation tools: reconciliation reports, bank reconciliation detail/history
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── bank_reconciliation_detail ─────────────────────────────────────────────
  server.registerTool(
    "bank_reconciliation_detail",
    {
      title: "Bank Reconciliation Detail Report",
      description:
        "Get a Bank Reconciliation Detail report showing all cleared and uncleared transactions for a bank or credit card account as of the statement date. Lists each transaction with its cleared status, date, number, payee, and amount. Essential for bank statement reconciliation and audit.",
      inputSchema: {
        accountId: z.string().describe("Bank or credit card account ID to reconcile"),
        statementDate: z.string().describe("Bank statement end date (YYYY-MM-DD)"),
        startDate: z.string().optional().describe("Start date for transaction window (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("account", args.accountId as string);
      params.set("report_date", args.statementDate as string);
      if (args.startDate) params.set("start_date", args.startDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.bank_reconciliation_detail",
        () => client.get(`/reports/ReconcileReport?${params}`),
        { tool: "bank_reconciliation_detail", accountId: args.accountId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── bank_reconciliation_summary ────────────────────────────────────────────
  server.registerTool(
    "bank_reconciliation_summary",
    {
      title: "Bank Reconciliation Summary Report",
      description:
        "Get a Bank Reconciliation Summary showing the opening balance, cleared transactions total, uncleared transactions total, and closing balance for a bank account reconciliation. Use for confirming reconciliation status and identifying discrepancies.",
      inputSchema: {
        accountId: z.string().describe("Bank or credit card account ID"),
        statementDate: z.string().describe("Bank statement end date (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("account", args.accountId as string);
      params.set("report_date", args.statementDate as string);
      params.set("summary_only", "true");
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.bank_reconciliation_summary",
        () => client.get(`/reports/ReconcileReport?${params}`),
        { tool: "bank_reconciliation_summary", accountId: args.accountId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── reconciliation_history ─────────────────────────────────────────────────
  server.registerTool(
    "reconciliation_history",
    {
      title: "Reconciliation History Report",
      description:
        "Get the reconciliation history for a bank or credit card account — a log of all past reconciliations with their statement dates, statement balances, and who performed them. Use to audit the reconciliation trail and identify periods that need review.",
      inputSchema: {
        accountId: z.string().describe("Bank or credit card account ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("account", args.accountId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.reconciliation_history",
        () => client.get(`/reports/ReconciliationHistory?${params}`),
        { tool: "reconciliation_history", accountId: args.accountId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── list_reconciliations ───────────────────────────────────────────────────
  server.registerTool(
    "list_reconciliations",
    {
      title: "List Reconciliation Metadata",
      description:
        "List all bank reconciliation records stored in QuickBooks. Returns each reconciliation's account, statement date, beginning balance, ending balance, and reconciliation status. Use to programmatically track which periods have been reconciled.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause (e.g. \"AccountId = '123'\")"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_reconciliations",
        () => client.query("BankReconciliation", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_reconciliations" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
