// Payment Application tools: apply_credit_to_invoice, apply_payment_to_invoice, unapply_credit
// Managing payment/credit application to outstanding invoices
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── apply_credit_memo_to_invoice ───────────────────────────────────────────
  server.registerTool(
    "apply_credit_memo_to_invoice",
    {
      title: "Apply Credit Memo to Invoice",
      description:
        "Apply an existing QuickBooks credit memo against one or more open invoices for the same customer. This reduces the invoice balance by the credit amount. If the credit is larger than the invoice, the remaining credit stays on the credit memo balance. Returns the updated payment with linked transactions.",
      inputSchema: {
        customerId: z.string().describe("Customer ID (must match both the credit memo and invoices)"),
        creditMemoId: z.string().describe("Credit memo ID to apply"),
        creditAmount: z.number().describe("Total credit amount to apply"),
        invoices: z
          .array(z.object({
            invoiceId: z.string().describe("Invoice ID to apply credit to"),
            amount: z.number().describe("Amount from the credit memo to apply to this invoice"),
          }))
          .min(1)
          .describe("One or more invoices to receive the credit"),
        txnDate: z.string().optional().describe("Application date (YYYY-MM-DD, default: today)"),
        privateNote: z.string().optional().describe("Internal note"),
        currencyCode: z.string().optional().describe("Currency code (e.g. 'USD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      // In QBO, applying a credit memo to an invoice is done by creating a Payment
      // that links both the credit memo and the invoice(s)
      const linkedTxns: Array<Record<string, unknown>> = [
        // Link the credit memo
        {
          Amount: args.creditAmount,
          LinkedTxn: [{ TxnId: args.creditMemoId, TxnType: "CreditMemo" }],
        },
        // Link each invoice
        ...(args.invoices as Array<{ invoiceId: string; amount: number }>).map((inv) => ({
          Amount: inv.amount,
          LinkedTxn: [{ TxnId: inv.invoiceId, TxnType: "Invoice" }],
        })),
      ];

      const payment: Record<string, unknown> = {
        CustomerRef: { value: args.customerId },
        TotalAmt: 0, // $0 payment — credit memo covers it
        Line: linkedTxns,
      };

      if (args.txnDate) payment.TxnDate = args.txnDate;
      if (args.privateNote) payment.PrivateNote = args.privateNote;
      if (args.currencyCode) payment.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.apply_credit_memo_to_invoice",
        () => client.post("/payment", payment),
        { tool: "apply_credit_memo_to_invoice", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── apply_vendor_credit_to_bill ────────────────────────────────────────────
  server.registerTool(
    "apply_vendor_credit_to_bill",
    {
      title: "Apply Vendor Credit to Bill",
      description:
        "Apply an existing QuickBooks vendor credit against one or more outstanding bills from the same vendor. This reduces the bill balance by the credit amount. Returns a BillPayment transaction linking the credit to the bill(s). The bank account payment amount will be the remaining balance after the credit.",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID (must match both the credit and bills)"),
        vendorCreditId: z.string().describe("Vendor credit ID to apply"),
        creditAmount: z.number().describe("Total credit amount to apply"),
        bills: z
          .array(z.object({
            billId: z.string().describe("Bill ID to apply credit toward"),
            amount: z.number().describe("Amount of credit applied to this bill"),
          }))
          .min(1)
          .describe("Bills to apply the credit toward"),
        bankAccountId: z.string().optional().describe("Bank account ID if there's a remaining cash payment (after credit)"),
        txnDate: z.string().optional().describe("Application date (YYYY-MM-DD, default: today)"),
        privateNote: z.string().optional().describe("Internal note"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines: Array<Record<string, unknown>> = [];

      // Credit line
      lines.push({
        Amount: args.creditAmount,
        LinkedTxn: [{ TxnId: args.vendorCreditId, TxnType: "VendorCredit" }],
      });

      // Bill lines
      for (const bill of (args.bills as Array<{ billId: string; amount: number }>)) {
        lines.push({
          Amount: bill.amount,
          LinkedTxn: [{ TxnId: bill.billId, TxnType: "Bill" }],
        });
      }

      const totalBillAmount = (args.bills as Array<{ billId: string; amount: number }>).reduce((sum, b) => sum + b.amount, 0);
      const cashPaymentAmount = Math.max(0, totalBillAmount - (args.creditAmount as number));

      const payment: Record<string, unknown> = {
        VendorRef: { value: args.vendorId },
        TotalAmt: cashPaymentAmount,
        PayType: args.bankAccountId ? "Check" : "Check",
        Line: lines,
      };

      if (args.bankAccountId) {
        payment.CheckPayment = { BankAccountRef: { value: args.bankAccountId } };
      }
      if (args.txnDate) payment.TxnDate = args.txnDate;
      if (args.privateNote) payment.PrivateNote = args.privateNote;

      const result = await logger.time(
        "tool.apply_vendor_credit_to_bill",
        () => client.post("/billpayment", payment),
        { tool: "apply_vendor_credit_to_bill", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── void_payment ───────────────────────────────────────────────────────────
  server.registerTool(
    "void_payment",
    {
      title: "Void QuickBooks Customer Payment",
      description:
        "Void a QuickBooks customer payment. Voiding zeroes out the payment amount and un-applies it from any linked invoices, restoring their open balance. The payment record is preserved for audit purposes. Requires paymentId and syncToken (from get_payment). Use void instead of delete to maintain a proper audit trail.",
      inputSchema: {
        paymentId: z.string().describe("Payment ID to void"),
        syncToken: z.string().describe("SyncToken from get_payment (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.void_payment",
        () => client.post("/payment?operation=void", {
          Id: args.paymentId,
          SyncToken: args.syncToken,
        }),
        { tool: "void_payment", paymentId: args.paymentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── void_bill ──────────────────────────────────────────────────────────────
  server.registerTool(
    "void_bill",
    {
      title: "Void QuickBooks Bill",
      description:
        "Void a QuickBooks bill. Voiding zeroes out the bill amount while preserving the transaction record for audit purposes. If the bill has associated payments, those links must be removed first. Requires billId and syncToken (from get_bill).",
      inputSchema: {
        billId: z.string().describe("Bill ID to void"),
        syncToken: z.string().describe("SyncToken from get_bill (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.void_bill",
        () => client.post("/bill?operation=void", {
          Id: args.billId,
          SyncToken: args.syncToken,
        }),
        { tool: "void_bill", billId: args.billId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
