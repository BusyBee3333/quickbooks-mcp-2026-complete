// Bills tools: list_bills, get_bill, create_bill, update_bill, delete_bill
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_bills ─────────────────────────────────────────────────────────────
  server.registerTool(
    "list_bills",
    {
      title: "List QuickBooks Bills",
      description:
        "List accounts payable bills in QuickBooks Online. Returns vendor, due date, balance, and total. Supports filtering by vendor and date range. Use to track outstanding payables.",
      inputSchema: {
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        txnDateAfter: z.string().optional().describe("Filter bills after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter bills before date (YYYY-MM-DD)"),
        dueDateAfter: z.string().optional().describe("Filter by due date after (YYYY-MM-DD)"),
        dueDateBefore: z.string().optional().describe("Filter by due date before (YYYY-MM-DD)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC', 'DueDate ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.vendorId) whereParts.push(`VendorRef = '${args.vendorId}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      if (args.dueDateAfter) whereParts.push(`DueDate >= '${args.dueDateAfter}'`);
      if (args.dueDateBefore) whereParts.push(`DueDate <= '${args.dueDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_bills",
        () => client.query(
          "Bill",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_bills" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_bill ───────────────────────────────────────────────────────────────
  server.registerTool(
    "get_bill",
    {
      title: "Get QuickBooks Bill",
      description:
        "Get full details for a QuickBooks bill (accounts payable) by ID. Returns vendor, line items, expense accounts, due date, balance, and payment status.",
      inputSchema: {
        billId: z.string().describe("QuickBooks bill ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_bill",
        () => client.get(`/bill/${args.billId}`),
        { tool: "get_bill", billId: args.billId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_bill ────────────────────────────────────────────────────────────
  server.registerTool(
    "create_bill",
    {
      title: "Create QuickBooks Bill",
      description:
        "Create a new accounts payable bill in QuickBooks Online. Required: vendorId and at least one line item. Line items reference expense accounts or items. Returns the created bill ID.",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID (use list vendors or QBO to find)"),
        lineItems: z
          .array(
            z.object({
              amount: z.number().describe("Line item amount"),
              description: z.string().optional().describe("Line description"),
              accountId: z
                .string()
                .optional()
                .describe("Expense account ID (for AccountBasedExpenseLineDetail)"),
              itemId: z
                .string()
                .optional()
                .describe("Item ID (for ItemBasedExpenseLineDetail)"),
              quantity: z.number().optional().describe("Quantity (for item-based lines)"),
              unitPrice: z.number().optional().describe("Unit price (for item-based lines)"),
            })
          )
          .describe("Bill line items (at least one required)"),
        txnDate: z.string().optional().describe("Bill date (YYYY-MM-DD, default: today)"),
        dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("Vendor's invoice/bill number"),
        privateNote: z.string().optional().describe("Internal note"),
        apRef: z.string().optional().describe("Accounts Payable account ID (default: standard AP)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lineItems as Array<{
        amount: number;
        description?: string;
        accountId?: string;
        itemId?: string;
        quantity?: number;
        unitPrice?: number;
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
            },
          };
        }
        return {
          Amount: item.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          ...(item.description ? { Description: item.description } : {}),
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: item.accountId || "expense_default" },
          },
        };
      });

      const bill: Record<string, unknown> = {
        VendorRef: { value: args.vendorId },
        Line: lines,
      };

      if (args.txnDate) bill.TxnDate = args.txnDate;
      if (args.dueDate) bill.DueDate = args.dueDate;
      if (args.docNumber) bill.DocNumber = args.docNumber;
      if (args.privateNote) bill.PrivateNote = args.privateNote;
      if (args.apRef) bill.APAccountRef = { value: args.apRef };

      const result = await logger.time(
        "tool.create_bill",
        () => client.post("/bill", bill),
        { tool: "create_bill", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_bill ────────────────────────────────────────────────────────────
  server.registerTool(
    "update_bill",
    {
      title: "Update QuickBooks Bill",
      description:
        "Update an existing QuickBooks accounts payable bill. Requires billId and syncToken (from get_bill). Supports sparse update — only provided fields are modified.",
      inputSchema: {
        billId: z.string().describe("Bill ID (from list_bills or get_bill)"),
        syncToken: z.string().describe("SyncToken from get_bill (required for optimistic locking)"),
        txnDate: z.string().optional().describe("New bill date (YYYY-MM-DD)"),
        dueDate: z.string().optional().describe("New due date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("New vendor bill/invoice number"),
        privateNote: z.string().optional().describe("New private note"),
        lineItems: z
          .array(
            z.object({
              amount: z.number().describe("Line item amount"),
              description: z.string().optional().describe("Line description"),
              accountId: z.string().optional().describe("Expense account ID"),
              itemId: z.string().optional().describe("Item ID"),
              quantity: z.number().optional().describe("Quantity"),
              unitPrice: z.number().optional().describe("Unit price"),
            })
          )
          .optional()
          .describe("Replace all line items"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const bill: Record<string, unknown> = {
        Id: args.billId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.txnDate) bill.TxnDate = args.txnDate;
      if (args.dueDate) bill.DueDate = args.dueDate;
      if (args.docNumber) bill.DocNumber = args.docNumber;
      if (args.privateNote) bill.PrivateNote = args.privateNote;

      if (args.lineItems) {
        bill.Line = (args.lineItems as Array<{
          amount: number;
          description?: string;
          accountId?: string;
          itemId?: string;
          quantity?: number;
          unitPrice?: number;
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
              },
            };
          }
          return {
            Amount: item.amount,
            DetailType: "AccountBasedExpenseLineDetail",
            ...(item.description ? { Description: item.description } : {}),
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: item.accountId || "" },
            },
          };
        });
      }

      const result = await logger.time(
        "tool.update_bill",
        () => client.post("/bill", bill),
        { tool: "update_bill", billId: args.billId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_bill ────────────────────────────────────────────────────────────
  server.registerTool(
    "delete_bill",
    {
      title: "Delete QuickBooks Bill",
      description:
        "Delete (void) a QuickBooks accounts payable bill. Requires billId and syncToken (from get_bill). This permanently deletes the bill — it cannot be recovered. Only unpaid bills can be deleted.",
      inputSchema: {
        billId: z.string().describe("Bill ID to delete"),
        syncToken: z.string().describe("SyncToken from get_bill (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.delete_bill",
        () => client.post("/bill?operation=delete", {
          Id: args.billId,
          SyncToken: args.syncToken,
        }),
        { tool: "delete_bill", billId: args.billId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
