// Transfers tools: list_transfers, get_transfer, create_transfer
// Transfer entity moves money between two accounts (e.g. checking to savings)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_transfers ─────────────────────────────────────────────────────────
  server.registerTool(
    "list_transfers",
    {
      title: "List QuickBooks Transfers",
      description:
        "List QuickBooks Online transfers (money moved between accounts) with optional filters by date. Returns transfer ID, from account, to account, amount, and date. Supports startPosition/maxResults pagination.",
      inputSchema: {
        txnDateAfter: z.string().optional().describe("Filter after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter before date (YYYY-MM-DD)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_transfers",
        () => client.query("Transfer", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_transfers" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_transfer ───────────────────────────────────────────────────────────
  server.registerTool(
    "get_transfer",
    {
      title: "Get QuickBooks Transfer",
      description:
        "Get full details for a specific QuickBooks transfer by ID, including from/to accounts, amount, date, and SyncToken.",
      inputSchema: {
        transferId: z.string().describe("QuickBooks transfer ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_transfer",
        () => client.get(`/transfer/${args.transferId}`),
        { tool: "get_transfer", transferId: args.transferId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_transfer ────────────────────────────────────────────────────────
  server.registerTool(
    "create_transfer",
    {
      title: "Create QuickBooks Transfer",
      description:
        "Create a new QuickBooks Online transfer to move funds between two accounts (e.g. from checking to savings, from operating to payroll account). Required: fromAccountId, toAccountId, and amount.",
      inputSchema: {
        fromAccountId: z.string().describe("Source account ID (money moves FROM this account)"),
        toAccountId: z.string().describe("Destination account ID (money moves TO this account)"),
        amount: z.number().positive().describe("Amount to transfer"),
        txnDate: z.string().optional().describe("Transfer date (YYYY-MM-DD, default: today)"),
        privateNote: z.string().optional().describe("Internal memo/note"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const transfer: Record<string, unknown> = {
        FromAccountRef: { value: args.fromAccountId },
        ToAccountRef: { value: args.toAccountId },
        Amount: args.amount,
      };

      if (args.txnDate) transfer.TxnDate = args.txnDate;
      if (args.privateNote) transfer.PrivateNote = args.privateNote;

      const result = await logger.time(
        "tool.create_transfer",
        () => client.post("/transfer", transfer),
        { tool: "create_transfer", amount: args.amount }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
