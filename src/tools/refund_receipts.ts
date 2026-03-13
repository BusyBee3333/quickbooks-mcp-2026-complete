// Refund Receipt tools: list_refund_receipts, get_refund_receipt, create_refund_receipt, void_refund_receipt
// Refund Receipts represent money paid back to customers
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const LineItemSchema = z.object({
  amount: z.number().describe("Line total amount (positive)"),
  description: z.string().optional().describe("Line item description"),
  itemRef: z.string().optional().describe("Product/service item ID"),
  quantity: z.number().optional().describe("Quantity"),
  unitPrice: z.number().optional().describe("Unit price / rate"),
  serviceDate: z.string().optional().describe("Service date (YYYY-MM-DD)"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_refund_receipts ───────────────────────────────────────────────────
  server.registerTool(
    "list_refund_receipts",
    {
      title: "List QuickBooks Refund Receipts",
      description:
        "List QuickBooks Online refund receipts (customer refunds) with optional filters. Refund Receipts represent money returned to customers — they reduce AR and record the outgoing payment. Returns doc number, customer, date, total, and deposit account. Supports pagination.",
      inputSchema: {
        customerId: z.string().optional().describe("Filter by customer ID"),
        txnDateAfter: z.string().optional().describe("Filter refunds after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter refunds before date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("Filter by document number"),
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
      if (args.docNumber) whereParts.push(`DocNumber = '${args.docNumber}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_refund_receipts",
        () => client.query("RefundReceipt", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_refund_receipts" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_refund_receipt ─────────────────────────────────────────────────────
  server.registerTool(
    "get_refund_receipt",
    {
      title: "Get QuickBooks Refund Receipt",
      description:
        "Get full details for a QuickBooks refund receipt by ID, including all line items, customer info, payment method, deposit account, and total refund amount.",
      inputSchema: {
        refundReceiptId: z.string().describe("QuickBooks refund receipt ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_refund_receipt",
        () => client.get(`/refundreceipt/${args.refundReceiptId}`),
        { tool: "get_refund_receipt", refundReceiptId: args.refundReceiptId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_refund_receipt ──────────────────────────────────────────────────
  server.registerTool(
    "create_refund_receipt",
    {
      title: "Create QuickBooks Refund Receipt",
      description:
        "Create a new QuickBooks refund receipt to record a customer refund. A Refund Receipt reduces revenue and records money paid out. Required: customerId, depositToAccountId, paymentMethodId, and at least one line item with the refunded product/service and amount.",
      inputSchema: {
        customerId: z.string().describe("Customer ID being refunded"),
        depositToAccountId: z.string().describe("Bank/checking account the refund is paid from"),
        lineItems: z.array(LineItemSchema).min(1).describe("Items being refunded (at least one required)"),
        txnDate: z.string().optional().describe("Refund date (YYYY-MM-DD, default: today)"),
        paymentMethodId: z.string().optional().describe("Payment method ID (e.g. for cash, check, credit card)"),
        paymentRefNumber: z.string().optional().describe("Check number or payment reference"),
        customerMemo: z.string().optional().describe("Memo visible to customer"),
        privateNote: z.string().optional().describe("Internal note"),
        currencyCode: z.string().optional().describe("Currency code (e.g. 'USD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lineItems as Array<{
        amount: number;
        description?: string;
        itemRef?: string;
        quantity?: number;
        unitPrice?: number;
        serviceDate?: string;
      }>).map((item) => ({
        Amount: item.amount,
        DetailType: "SalesItemLineDetail",
        ...(item.description ? { Description: item.description } : {}),
        SalesItemLineDetail: {
          ...(item.itemRef ? { ItemRef: { value: item.itemRef } } : {}),
          ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
          ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
          ...(item.serviceDate ? { ServiceDate: item.serviceDate } : {}),
        },
      }));

      const refund: Record<string, unknown> = {
        CustomerRef: { value: args.customerId },
        DepositToAccountRef: { value: args.depositToAccountId },
        Line: lines,
      };

      if (args.txnDate) refund.TxnDate = args.txnDate;
      if (args.paymentMethodId) refund.PaymentMethodRef = { value: args.paymentMethodId };
      if (args.paymentRefNumber) refund.PaymentRefNum = args.paymentRefNumber;
      if (args.customerMemo) refund.CustomerMemo = { value: args.customerMemo };
      if (args.privateNote) refund.PrivateNote = args.privateNote;
      if (args.currencyCode) refund.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.create_refund_receipt",
        () => client.post("/refundreceipt", refund),
        { tool: "create_refund_receipt", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── void_refund_receipt ────────────────────────────────────────────────────
  server.registerTool(
    "void_refund_receipt",
    {
      title: "Void QuickBooks Refund Receipt",
      description:
        "Void a QuickBooks refund receipt. Voiding preserves the transaction record with zero amounts rather than deleting it entirely, which is the recommended approach for audit trail compliance. Requires refundReceiptId and syncToken (from get_refund_receipt).",
      inputSchema: {
        refundReceiptId: z.string().describe("Refund receipt ID to void"),
        syncToken: z.string().describe("SyncToken from get_refund_receipt (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.void_refund_receipt",
        () => client.post("/refundreceipt?operation=void", {
          Id: args.refundReceiptId,
          SyncToken: args.syncToken,
        }),
        { tool: "void_refund_receipt", refundReceiptId: args.refundReceiptId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
