// Deposits tools: list_deposits, get_deposit, create_deposit
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const DepositLineSchema = z.object({
  amount: z.number().describe("Amount being deposited for this line"),
  accountId: z.string().describe("Account ID for this deposit line (income account, undeposited funds, etc.)"),
  description: z.string().optional().describe("Line description"),
  entityId: z.string().optional().describe("Customer or vendor entity ID (for payment reference)"),
  entityType: z.enum(["Customer", "Vendor"]).optional().describe("Entity type (Customer or Vendor)"),
  classId: z.string().optional().describe("Class ID for classification"),
  checkNumber: z.string().optional().describe("Check number for this deposit line"),
  txnType: z.string().optional().describe("Transaction type (e.g. 'Payment', 'SalesReceipt')"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_deposits ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_deposits",
    {
      title: "List QuickBooks Deposits",
      description:
        "List QuickBooks Online deposits with optional filters by account or date range. Returns deposit ID, account, date, and total. Supports startPosition/maxResults pagination.",
      inputSchema: {
        depositAccountId: z.string().optional().describe("Filter by deposit account ID"),
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
      if (args.depositAccountId) whereParts.push(`DepositToAccountRef = '${args.depositAccountId}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_deposits",
        () => client.query("Deposit", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_deposits" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_deposit ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_deposit",
    {
      title: "Get QuickBooks Deposit",
      description:
        "Get full details for a specific QuickBooks deposit by ID, including all deposit lines, accounts, amounts, and SyncToken.",
      inputSchema: {
        depositId: z.string().describe("QuickBooks deposit ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_deposit",
        () => client.get(`/deposit/${args.depositId}`),
        { tool: "get_deposit", depositId: args.depositId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_deposit ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_deposit",
    {
      title: "Create QuickBooks Deposit",
      description:
        "Create a new QuickBooks Online deposit to record funds received into a bank account. Required: depositToAccountId (destination bank account) and at least one deposit line. Use to move payments from Undeposited Funds into a bank account.",
      inputSchema: {
        depositToAccountId: z.string().describe("Bank account ID where funds are deposited (from list_accounts)"),
        lines: z.array(DepositLineSchema).min(1).describe("Deposit line items (at least one required)"),
        txnDate: z.string().optional().describe("Deposit date (YYYY-MM-DD, default: today)"),
        privateNote: z.string().optional().describe("Internal memo/note"),
        cashBack: z.object({
          amount: z.number().describe("Cash back amount"),
          accountId: z.string().describe("Account to post cash back to"),
          memo: z.string().optional().describe("Cash back memo"),
        }).optional().describe("Cash back from deposit"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lines as Array<{
        amount: number;
        accountId: string;
        description?: string;
        entityId?: string;
        entityType?: string;
        classId?: string;
        checkNumber?: string;
      }>).map((line) => {
        const depositLine: Record<string, unknown> = {
          Amount: line.amount,
          DetailType: "DepositLineDetail",
          DepositLineDetail: {
            AccountRef: { value: line.accountId },
            ...(line.entityId && line.entityType ? {
              Entity: { Type: line.entityType, EntityRef: { value: line.entityId } },
            } : {}),
            ...(line.classId ? { ClassRef: { value: line.classId } } : {}),
            ...(line.checkNumber ? { CheckNum: line.checkNumber } : {}),
          },
        };
        if (line.description) depositLine.Description = line.description;
        return depositLine;
      });

      const deposit: Record<string, unknown> = {
        DepositToAccountRef: { value: args.depositToAccountId },
        Line: lines,
      };

      if (args.txnDate) deposit.TxnDate = args.txnDate;
      if (args.privateNote) deposit.PrivateNote = args.privateNote;

      const cashBack = args.cashBack as { amount: number; accountId: string; memo?: string } | undefined;
      if (cashBack) {
        deposit.CashBack = {
          Amount: cashBack.amount,
          AccountRef: { value: cashBack.accountId },
          ...(cashBack.memo ? { Memo: cashBack.memo } : {}),
        };
      }

      const result = await logger.time(
        "tool.create_deposit",
        () => client.post("/deposit", deposit),
        { tool: "create_deposit", depositToAccountId: args.depositToAccountId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
