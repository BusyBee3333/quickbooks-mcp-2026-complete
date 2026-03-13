// Bill Payment tools: list_bill_payments, get_bill_payment, create_bill_payment, delete_bill_payment
// Bill Payments record vendor bill payments (check, credit card, or vendor credit application)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_bill_payments ─────────────────────────────────────────────────────
  server.registerTool(
    "list_bill_payments",
    {
      title: "List QuickBooks Bill Payments",
      description:
        "List QuickBooks Online bill payments with optional filters. Bill Payments record payments made to vendors for outstanding bills. Distinct from bills themselves — bills record what is owed, bill payments record when you paid them. Returns vendor, date, payment method, amount, and applied bills. Supports pagination.",
      inputSchema: {
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        txnDateAfter: z.string().optional().describe("Filter payments after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter payments before date (YYYY-MM-DD)"),
        payType: z.enum(["Check", "CreditCard"]).optional().describe("Filter by payment type"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.vendorId) whereParts.push(`VendorRef = '${args.vendorId}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      if (args.payType) whereParts.push(`PayType = '${args.payType}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_bill_payments",
        () => client.query("BillPayment", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_bill_payments" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_bill_payment ───────────────────────────────────────────────────────
  server.registerTool(
    "get_bill_payment",
    {
      title: "Get QuickBooks Bill Payment",
      description:
        "Get full details for a QuickBooks bill payment by ID, including the vendor, payment method, bank account or credit card used, check number, and the list of bills that were paid (with amounts applied to each).",
      inputSchema: {
        billPaymentId: z.string().describe("QuickBooks bill payment ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_bill_payment",
        () => client.get(`/billpayment/${args.billPaymentId}`),
        { tool: "get_bill_payment", billPaymentId: args.billPaymentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_bill_payment_check ──────────────────────────────────────────────
  server.registerTool(
    "create_bill_payment_check",
    {
      title: "Create Bill Payment by Check",
      description:
        "Create a QuickBooks bill payment using a check (bank account payment). Required: vendorId, bankAccountId, totalAmount, and at least one bill reference (linkedBills). Each linked bill requires the bill ID and the amount being paid from that bill. The sum of linked bill amounts should equal totalAmount.",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID being paid"),
        bankAccountId: z.string().describe("Bank/checking account ID to pay from"),
        totalAmount: z.number().describe("Total payment amount"),
        txnDate: z.string().optional().describe("Payment date (YYYY-MM-DD, default: today)"),
        checkNumber: z.string().optional().describe("Check number"),
        privateNote: z.string().optional().describe("Internal memo / note"),
        linkedBills: z
          .array(z.object({
            billId: z.string().describe("Bill ID to apply payment to"),
            amount: z.number().describe("Amount applied to this bill"),
          }))
          .min(1)
          .describe("Bills being paid and amounts applied to each"),
        currencyCode: z.string().optional().describe("Currency code (e.g. 'USD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.linkedBills as Array<{ billId: string; amount: number }>).map((lb) => ({
        Amount: lb.amount,
        LinkedTxn: [{ TxnId: lb.billId, TxnType: "Bill" }],
      }));

      const payment: Record<string, unknown> = {
        VendorRef: { value: args.vendorId },
        TotalAmt: args.totalAmount,
        PayType: "Check",
        CheckPayment: {
          BankAccountRef: { value: args.bankAccountId },
          ...(args.checkNumber ? { CheckNum: args.checkNumber } : {}),
        },
        Line: lines,
      };

      if (args.txnDate) payment.TxnDate = args.txnDate;
      if (args.privateNote) payment.PrivateNote = args.privateNote;
      if (args.currencyCode) payment.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.create_bill_payment_check",
        () => client.post("/billpayment", payment),
        { tool: "create_bill_payment_check", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_bill_payment_credit_card ────────────────────────────────────────
  server.registerTool(
    "create_bill_payment_credit_card",
    {
      title: "Create Bill Payment by Credit Card",
      description:
        "Create a QuickBooks bill payment using a credit card. Required: vendorId, creditCardAccountId, totalAmount, and linkedBills. Each linked bill specifies the bill ID and amount paid. Typically used when a vendor allows credit card payments.",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID being paid"),
        creditCardAccountId: z.string().describe("Credit card account ID to charge"),
        totalAmount: z.number().describe("Total payment amount"),
        txnDate: z.string().optional().describe("Payment date (YYYY-MM-DD, default: today)"),
        privateNote: z.string().optional().describe("Internal memo / note"),
        linkedBills: z
          .array(z.object({
            billId: z.string().describe("Bill ID to apply payment to"),
            amount: z.number().describe("Amount applied to this bill"),
          }))
          .min(1)
          .describe("Bills being paid and amounts applied to each"),
        currencyCode: z.string().optional().describe("Currency code (e.g. 'USD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.linkedBills as Array<{ billId: string; amount: number }>).map((lb) => ({
        Amount: lb.amount,
        LinkedTxn: [{ TxnId: lb.billId, TxnType: "Bill" }],
      }));

      const payment: Record<string, unknown> = {
        VendorRef: { value: args.vendorId },
        TotalAmt: args.totalAmount,
        PayType: "CreditCard",
        CreditCardPayment: {
          CCAccountRef: { value: args.creditCardAccountId },
        },
        Line: lines,
      };

      if (args.txnDate) payment.TxnDate = args.txnDate;
      if (args.privateNote) payment.PrivateNote = args.privateNote;
      if (args.currencyCode) payment.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.create_bill_payment_credit_card",
        () => client.post("/billpayment", payment),
        { tool: "create_bill_payment_credit_card", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_bill_payment ────────────────────────────────────────────────────
  server.registerTool(
    "delete_bill_payment",
    {
      title: "Delete QuickBooks Bill Payment",
      description:
        "Delete a QuickBooks bill payment. Requires billPaymentId and syncToken. Deleting a bill payment restores the outstanding balance on the linked bills. Use with caution — prefer voiding if you need to preserve the audit trail.",
      inputSchema: {
        billPaymentId: z.string().describe("Bill payment ID to delete"),
        syncToken: z.string().describe("SyncToken from get_bill_payment (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.delete_bill_payment",
        () => client.post("/billpayment?operation=delete", {
          Id: args.billPaymentId,
          SyncToken: args.syncToken,
        }),
        { tool: "delete_bill_payment", billPaymentId: args.billPaymentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
