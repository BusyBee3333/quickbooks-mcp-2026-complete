// Credit Card Payment tools: list_credit_card_payments, get_credit_card_payment, create_credit_card_payment
// Credit Card Payments record paying down a credit card balance (transfer from bank to credit card)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_credit_card_payments ──────────────────────────────────────────────
  server.registerTool(
    "list_credit_card_payments",
    {
      title: "List QuickBooks Credit Card Payments",
      description:
        "List QuickBooks Online credit card payment transactions — these record paying down a credit card balance from a bank account (not credit card charges, which are separate). Returns date, amount, bank account, credit card account, and memo. Use to track when and how much was paid toward each credit card balance. Supports pagination.",
      inputSchema: {
        txnDateAfter: z.string().optional().describe("Filter payments after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter payments before date (YYYY-MM-DD)"),
        creditCardAccountId: z.string().optional().describe("Filter by credit card account ID"),
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
      if (args.creditCardAccountId) whereParts.push(`CreditCardAccountRef = '${args.creditCardAccountId}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_credit_card_payments",
        () => client.query("CreditCardPayment", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_credit_card_payments" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_credit_card_payment ────────────────────────────────────────────────
  server.registerTool(
    "get_credit_card_payment",
    {
      title: "Get QuickBooks Credit Card Payment",
      description:
        "Get full details for a QuickBooks credit card payment transaction by ID. Returns the bank account used to pay, the credit card account being paid, the amount, date, and any memo.",
      inputSchema: {
        creditCardPaymentId: z.string().describe("QuickBooks credit card payment transaction ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_credit_card_payment",
        () => client.get(`/creditcardpayment/${args.creditCardPaymentId}`),
        { tool: "get_credit_card_payment", creditCardPaymentId: args.creditCardPaymentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_credit_card_payment ─────────────────────────────────────────────
  server.registerTool(
    "create_credit_card_payment",
    {
      title: "Create QuickBooks Credit Card Payment",
      description:
        "Create a QuickBooks credit card payment to record paying down a credit card balance. This transfers money from a bank account to reduce the credit card liability. Required: bankAccountId (where the payment comes from), creditCardAccountId (the card being paid), and amount.",
      inputSchema: {
        bankAccountId: z.string().describe("Bank/checking account ID the payment is made from"),
        creditCardAccountId: z.string().describe("Credit card account ID being paid down"),
        amount: z.number().describe("Payment amount"),
        txnDate: z.string().optional().describe("Payment date (YYYY-MM-DD, default: today)"),
        memo: z.string().optional().describe("Memo or reference note"),
        checkNumber: z.string().optional().describe("Check or reference number"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const payment: Record<string, unknown> = {
        BankAccountRef: { value: args.bankAccountId },
        CreditCardAccountRef: { value: args.creditCardAccountId },
        Amount: args.amount,
      };

      if (args.txnDate) payment.TxnDate = args.txnDate;
      if (args.memo) payment.PrivateNote = args.memo;
      if (args.checkNumber) payment.CheckNum = args.checkNumber;

      const result = await logger.time(
        "tool.create_credit_card_payment",
        () => client.post("/creditcardpayment", payment),
        { tool: "create_credit_card_payment", amount: args.amount }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
