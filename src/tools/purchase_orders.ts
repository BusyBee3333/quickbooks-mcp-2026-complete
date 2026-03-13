// Purchase Orders tools: list_purchase_orders, get_purchase_order, create_purchase_order, update_purchase_order
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const POLineItemSchema = z.object({
  amount: z.number().describe("Line total amount"),
  description: z.string().optional().describe("Line description"),
  itemId: z.string().optional().describe("Item ID for ItemBasedExpenseLineDetail"),
  accountId: z.string().optional().describe("Account ID for AccountBasedExpenseLineDetail"),
  quantity: z.number().optional().describe("Quantity ordered"),
  unitPrice: z.number().optional().describe("Unit cost / price"),
  customerRef: z.string().optional().describe("Customer to bill (for billable expenses)"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_purchase_orders ────────────────────────────────────────────────────
  server.registerTool(
    "list_purchase_orders",
    {
      title: "List QuickBooks Purchase Orders",
      description:
        "List QuickBooks Online purchase orders with optional filters by vendor, status, or date range. Returns vendor, total, status, and expected date. Supports pagination.",
      inputSchema: {
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        txnDateAfter: z.string().optional().describe("Filter POs after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter POs before date (YYYY-MM-DD)"),
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
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_purchase_orders",
        () => client.query(
          "PurchaseOrder",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_purchase_orders" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_purchase_order ──────────────────────────────────────────────────────
  server.registerTool(
    "get_purchase_order",
    {
      title: "Get QuickBooks Purchase Order",
      description:
        "Get full details for a QuickBooks purchase order by ID. Returns vendor, all line items, expected date, ship-to address, and status.",
      inputSchema: {
        purchaseOrderId: z.string().describe("QuickBooks purchase order ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_purchase_order",
        () => client.get(`/purchaseorder/${args.purchaseOrderId}`),
        { tool: "get_purchase_order", purchaseOrderId: args.purchaseOrderId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_purchase_order ───────────────────────────────────────────────────
  server.registerTool(
    "create_purchase_order",
    {
      title: "Create QuickBooks Purchase Order",
      description:
        "Create a new purchase order in QuickBooks Online. Required: vendorId and at least one line item. Returns the created PO with assigned ID and number.",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID (from list_vendors)"),
        lineItems: z.array(POLineItemSchema).describe("PO line items (at least one required)"),
        apAccountId: z.string().optional().describe("AP account ID (default: standard AP)"),
        txnDate: z.string().optional().describe("PO date (YYYY-MM-DD, default: today)"),
        expectedDate: z.string().optional().describe("Expected delivery date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("PO number (auto-generated if omitted)"),
        memo: z.string().optional().describe("Memo / notes on PO"),
        shipToCustomerId: z.string().optional().describe("Customer ID to ship to (drop-ship)"),
        vendorAddress: z.string().optional().describe("Vendor address override"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lineItems as Array<{
        amount: number;
        description?: string;
        itemId?: string;
        accountId?: string;
        quantity?: number;
        unitPrice?: number;
        customerRef?: string;
      }>).map((item) => {
        if (item.itemId) {
          return {
            Amount: item.amount,
            DetailType: "ItemBasedExpenseLineDetail",
            ...(item.description ? { Description: item.description } : {}),
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: item.itemId },
              ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
              ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
              ...(item.customerRef ? { CustomerRef: { value: item.customerRef }, BillableStatus: "Billable" } : {}),
            },
          };
        }
        return {
          Amount: item.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          ...(item.description ? { Description: item.description } : {}),
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: item.accountId || "" },
            ...(item.customerRef ? { CustomerRef: { value: item.customerRef }, BillableStatus: "Billable" } : {}),
          },
        };
      });

      const po: Record<string, unknown> = {
        VendorRef: { value: args.vendorId },
        Line: lines,
      };

      if (args.apAccountId) po.APAccountRef = { value: args.apAccountId };
      if (args.txnDate) po.TxnDate = args.txnDate;
      if (args.expectedDate) po.DueDate = args.expectedDate;
      if (args.docNumber) po.DocNumber = args.docNumber;
      if (args.memo) po.Memo = args.memo;
      if (args.shipToCustomerId) po.ShipTo = { value: args.shipToCustomerId };

      const result = await logger.time(
        "tool.create_purchase_order",
        () => client.post("/purchaseorder", po),
        { tool: "create_purchase_order", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_purchase_order ───────────────────────────────────────────────────
  server.registerTool(
    "update_purchase_order",
    {
      title: "Update QuickBooks Purchase Order",
      description:
        "Update an existing purchase order. Requires purchaseOrderId and syncToken (from get_purchase_order). Supports sparse update — only provided fields are modified.",
      inputSchema: {
        purchaseOrderId: z.string().describe("Purchase order ID"),
        syncToken: z.string().describe("SyncToken from get_purchase_order (required for optimistic locking)"),
        txnDate: z.string().optional().describe("New PO date (YYYY-MM-DD)"),
        expectedDate: z.string().optional().describe("New expected delivery date (YYYY-MM-DD)"),
        memo: z.string().optional().describe("New memo / notes"),
        lineItems: z.array(POLineItemSchema).optional().describe("Replace all line items"),
        poStatus: z
          .enum(["Open", "Closed"])
          .optional()
          .describe("PO status (Closed to mark as fully received)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const po: Record<string, unknown> = {
        Id: args.purchaseOrderId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.txnDate) po.TxnDate = args.txnDate;
      if (args.expectedDate) po.DueDate = args.expectedDate;
      if (args.memo) po.Memo = args.memo;
      if (args.poStatus) po.POStatus = args.poStatus;

      if (args.lineItems) {
        po.Line = (args.lineItems as Array<{
          amount: number;
          description?: string;
          itemId?: string;
          accountId?: string;
          quantity?: number;
          unitPrice?: number;
        }>).map((item) => ({
          Amount: item.amount,
          DetailType: item.itemId ? "ItemBasedExpenseLineDetail" : "AccountBasedExpenseLineDetail",
          ...(item.description ? { Description: item.description } : {}),
          ...(item.itemId
            ? {
                ItemBasedExpenseLineDetail: {
                  ItemRef: { value: item.itemId },
                  ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
                  ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
                },
              }
            : {
                AccountBasedExpenseLineDetail: {
                  AccountRef: { value: item.accountId || "" },
                },
              }),
        }));
      }

      const result = await logger.time(
        "tool.update_purchase_order",
        () => client.post("/purchaseorder", po),
        { tool: "update_purchase_order", purchaseOrderId: args.purchaseOrderId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
