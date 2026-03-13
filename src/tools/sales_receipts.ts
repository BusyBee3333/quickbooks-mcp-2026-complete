// Sales Receipts tools: list_sales_receipts, get_sales_receipt, create_sales_receipt, void_sales_receipt
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const LineItemSchema = z.object({
  description: z.string().optional().describe("Line item description"),
  quantity: z.number().optional().describe("Quantity"),
  unitPrice: z.number().optional().describe("Unit price / rate"),
  amount: z.number().describe("Line total amount"),
  itemRef: z.string().optional().describe("Product/service item ID"),
  taxable: z.boolean().optional().describe("Whether this line is taxable"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_sales_receipts ────────────────────────────────────────────────────
  server.registerTool(
    "list_sales_receipts",
    {
      title: "List QuickBooks Sales Receipts",
      description:
        "List QuickBooks Online sales receipts (immediate-payment sales) with optional filters by customer, date, or document number. Returns receipt ID, customer, date, and total. Supports startPosition/maxResults pagination.",
      inputSchema: {
        customerId: z.string().optional().describe("Filter by customer ID"),
        docNumber: z.string().optional().describe("Filter by sales receipt number"),
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
      if (args.customerId) whereParts.push(`CustomerRef = '${args.customerId}'`);
      if (args.docNumber) whereParts.push(`DocNumber = '${args.docNumber}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_sales_receipts",
        () => client.query("SalesReceipt", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_sales_receipts" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_sales_receipt ──────────────────────────────────────────────────────
  server.registerTool(
    "get_sales_receipt",
    {
      title: "Get QuickBooks Sales Receipt",
      description:
        "Get full details for a specific QuickBooks sales receipt by ID, including line items, customer, payment method, deposit account, and SyncToken.",
      inputSchema: {
        salesReceiptId: z.string().describe("QuickBooks sales receipt ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_sales_receipt",
        () => client.get(`/salesreceipt/${args.salesReceiptId}`),
        { tool: "get_sales_receipt", salesReceiptId: args.salesReceiptId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_sales_receipt ───────────────────────────────────────────────────
  server.registerTool(
    "create_sales_receipt",
    {
      title: "Create QuickBooks Sales Receipt",
      description:
        "Create a new QuickBooks Online sales receipt for an immediate cash/card sale. Unlike invoices, sales receipts record payment at the time of sale. Required: at least one line item. Customer is optional (for walk-in sales).",
      inputSchema: {
        lineItems: z.array(LineItemSchema).describe("Sales receipt line items (at least one required)"),
        customerId: z.string().optional().describe("Customer ID (optional for anonymous sales)"),
        txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Custom receipt number"),
        paymentMethodRef: z.string().optional().describe("Payment method ID (cash, check, credit card, etc.)"),
        depositToAccountId: z.string().optional().describe("Account ID where funds are deposited"),
        customerMemo: z.string().optional().describe("Memo shown to customer"),
        privateNote: z.string().optional().describe("Internal note (not shown to customer)"),
        billingEmailAddress: z.string().optional().describe("Email address for receipt"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lineItems as Array<{
        description?: string;
        quantity?: number;
        unitPrice?: number;
        amount: number;
        itemRef?: string;
        taxable?: boolean;
      }>).map((item) => {
        const line: Record<string, unknown> = {
          Amount: item.amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ...(item.itemRef ? { ItemRef: { value: item.itemRef } } : {}),
            ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
            ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
            ...(item.taxable !== undefined ? { TaxCodeRef: { value: item.taxable ? "TAX" : "NON" } } : {}),
          },
        };
        if (item.description) line.Description = item.description;
        return line;
      });

      const receipt: Record<string, unknown> = { Line: lines };

      if (args.customerId) receipt.CustomerRef = { value: args.customerId };
      if (args.txnDate) receipt.TxnDate = args.txnDate;
      if (args.docNumber) receipt.DocNumber = args.docNumber;
      if (args.paymentMethodRef) receipt.PaymentMethodRef = { value: args.paymentMethodRef };
      if (args.depositToAccountId) receipt.DepositToAccountRef = { value: args.depositToAccountId };
      if (args.customerMemo) receipt.CustomerMemo = { value: args.customerMemo };
      if (args.privateNote) receipt.PrivateNote = args.privateNote;
      if (args.billingEmailAddress) receipt.BillEmail = { Address: args.billingEmailAddress };

      const result = await logger.time(
        "tool.create_sales_receipt",
        () => client.post("/salesreceipt", receipt),
        { tool: "create_sales_receipt" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── void_sales_receipt ─────────────────────────────────────────────────────
  server.registerTool(
    "void_sales_receipt",
    {
      title: "Void QuickBooks Sales Receipt",
      description:
        "Void an existing QuickBooks sales receipt. Requires salesReceiptId and syncToken (from get_sales_receipt). Voiding zeroes out the amounts while preserving the audit trail.",
      inputSchema: {
        salesReceiptId: z.string().describe("Sales receipt ID to void"),
        syncToken: z.string().describe("SyncToken from get_sales_receipt (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.void_sales_receipt",
        () => client.post("/salesreceipt?operation=void", {
          Id: args.salesReceiptId,
          SyncToken: args.syncToken,
          sparse: true,
        }),
        { tool: "void_sales_receipt", salesReceiptId: args.salesReceiptId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
