// Payments tools: list_payments, get_payment, create_payment
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_payments ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_payments",
    {
      title: "List QuickBooks Payments",
      description:
        "List payments received in QuickBooks Online. Returns payment date, customer, amount, payment method, and applied invoices. Supports filtering by customer and date range.",
      inputSchema: {
        customerId: z.string().optional().describe("Filter by customer ID"),
        txnDateAfter: z.string().optional().describe("Filter payments after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter payments before date (YYYY-MM-DD)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.customerId) whereParts.push(`CustomerRef = '${args.customerId}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_payments",
        () => client.query(
          "Payment",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_payments" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_payment ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_payment",
    {
      title: "Get QuickBooks Payment",
      description:
        "Get full details for a QuickBooks payment by ID. Returns customer, amount, payment method, deposit account, and the invoices it was applied to.",
      inputSchema: {
        paymentId: z.string().describe("QuickBooks payment ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_payment",
        () => client.get(`/payment/${args.paymentId}`),
        { tool: "get_payment", paymentId: args.paymentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_payment ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_payment",
    {
      title: "Create QuickBooks Payment",
      description:
        "Record a payment received from a customer. Can be applied to one or more invoices. Required: customerId and totalAmount. Optionally specify which invoices to apply the payment to.",
      inputSchema: {
        customerId: z.string().describe("Customer ID who made the payment"),
        totalAmount: z.number().describe("Total payment amount"),
        txnDate: z.string().optional().describe("Payment date (YYYY-MM-DD, default: today)"),
        paymentMethodRef: z.string().optional().describe("Payment method ID (e.g. cash, check, credit card)"),
        depositToAccountRef: z.string().optional().describe("Account ID to deposit into (default: Undeposited Funds)"),
        privateNote: z.string().optional().describe("Internal note"),
        applyToInvoices: z
          .array(
            z.object({
              invoiceId: z.string().describe("Invoice ID to apply payment to"),
              amount: z.number().describe("Amount to apply to this invoice"),
            })
          )
          .optional()
          .describe("Invoices to apply this payment to. If not provided, payment goes to unapplied credits."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const payment: Record<string, unknown> = {
        CustomerRef: { value: args.customerId },
        TotalAmt: args.totalAmount,
      };

      if (args.txnDate) payment.TxnDate = args.txnDate;
      if (args.paymentMethodRef) payment.PaymentMethodRef = { value: args.paymentMethodRef };
      if (args.depositToAccountRef) payment.DepositToAccountRef = { value: args.depositToAccountRef };
      if (args.privateNote) payment.PrivateNote = args.privateNote;

      if (args.applyToInvoices && Array.isArray(args.applyToInvoices) && args.applyToInvoices.length > 0) {
        payment.Line = args.applyToInvoices.map((inv) => ({
          Amount: inv.amount,
          LinkedTxn: [{ TxnId: inv.invoiceId, TxnType: "Invoice" }],
        }));
      }

      const result = await logger.time(
        "tool.create_payment",
        () => client.post("/payment", payment),
        { tool: "create_payment", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
