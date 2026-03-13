// Vendor Credit tools: list_vendor_credits, get_vendor_credit, create_vendor_credit, delete_vendor_credit
// Vendor Credits represent money owed to you by a vendor (e.g. returned goods, overpayments)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const LineItemSchema = z.object({
  amount: z.number().describe("Line total amount"),
  accountId: z.string().optional().describe("Account ID for this expense line"),
  description: z.string().optional().describe("Line description"),
  itemRef: z.string().optional().describe("Item/product reference ID"),
  quantity: z.number().optional().describe("Quantity"),
  unitPrice: z.number().optional().describe("Unit price"),
  classId: z.string().optional().describe("Class ID for tracking"),
  customerId: z.string().optional().describe("Customer/job ID for billable tracking"),
  billable: z.boolean().optional().describe("Whether this line is billable to customer"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_vendor_credits ────────────────────────────────────────────────────
  server.registerTool(
    "list_vendor_credits",
    {
      title: "List QuickBooks Vendor Credits",
      description:
        "List QuickBooks Online vendor credits with optional filters. Vendor Credits record credits your vendors owe you — for returned merchandise, billing corrections, or overpayments. They reduce what you owe on bills. Returns vendor, date, total, and balance. Supports pagination.",
      inputSchema: {
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        txnDateAfter: z.string().optional().describe("Filter credits after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter credits before date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("Filter by document/reference number"),
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
      if (args.docNumber) whereParts.push(`DocNumber = '${args.docNumber}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_vendor_credits",
        () => client.query("VendorCredit", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_vendor_credits" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_vendor_credit ──────────────────────────────────────────────────────
  server.registerTool(
    "get_vendor_credit",
    {
      title: "Get QuickBooks Vendor Credit",
      description:
        "Get full details for a QuickBooks vendor credit by ID, including all line items, account allocations, vendor reference, and remaining balance available to apply to bills.",
      inputSchema: {
        vendorCreditId: z.string().describe("QuickBooks vendor credit ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_vendor_credit",
        () => client.get(`/vendorcredit/${args.vendorCreditId}`),
        { tool: "get_vendor_credit", vendorCreditId: args.vendorCreditId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_vendor_credit ───────────────────────────────────────────────────
  server.registerTool(
    "create_vendor_credit",
    {
      title: "Create QuickBooks Vendor Credit",
      description:
        "Create a new QuickBooks vendor credit to record credits your vendor owes you. Required: vendorId and at least one line item. Each line can use an expense account (for non-inventory credits) or an item reference (for inventory returns). The credit can later be applied against outstanding bills from that vendor.",
      inputSchema: {
        vendorId: z.string().describe("Vendor ID issuing the credit"),
        lineItems: z.array(LineItemSchema).min(1).describe("Credit line items (at least one required)"),
        txnDate: z.string().optional().describe("Credit date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Vendor's credit memo number for reference"),
        privateNote: z.string().optional().describe("Internal note"),
        apAccountId: z.string().optional().describe("Accounts payable account ID (uses default if not specified)"),
        currencyCode: z.string().optional().describe("Currency code (e.g. 'USD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lineItems as Array<{
        amount: number;
        accountId?: string;
        description?: string;
        itemRef?: string;
        quantity?: number;
        unitPrice?: number;
        classId?: string;
        customerId?: string;
        billable?: boolean;
      }>).map((item) => {
        if (item.itemRef) {
          return {
            Amount: item.amount,
            DetailType: "ItemBasedExpenseLineDetail",
            ...(item.description ? { Description: item.description } : {}),
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: item.itemRef },
              ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
              ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
              ...(item.classId ? { ClassRef: { value: item.classId } } : {}),
              ...(item.customerId ? { CustomerRef: { value: item.customerId } } : {}),
              ...(item.billable !== undefined ? { BillableStatus: item.billable ? "Billable" : "NotBillable" } : {}),
            },
          };
        }
        return {
          Amount: item.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          ...(item.description ? { Description: item.description } : {}),
          AccountBasedExpenseLineDetail: {
            ...(item.accountId ? { AccountRef: { value: item.accountId } } : {}),
            ...(item.classId ? { ClassRef: { value: item.classId } } : {}),
            ...(item.customerId ? { CustomerRef: { value: item.customerId } } : {}),
            ...(item.billable !== undefined ? { BillableStatus: item.billable ? "Billable" : "NotBillable" } : {}),
          },
        };
      });

      const credit: Record<string, unknown> = {
        VendorRef: { value: args.vendorId },
        Line: lines,
      };

      if (args.txnDate) credit.TxnDate = args.txnDate;
      if (args.docNumber) credit.DocNumber = args.docNumber;
      if (args.privateNote) credit.PrivateNote = args.privateNote;
      if (args.apAccountId) credit.APAccountRef = { value: args.apAccountId };
      if (args.currencyCode) credit.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.create_vendor_credit",
        () => client.post("/vendorcredit", credit),
        { tool: "create_vendor_credit", vendorId: args.vendorId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_vendor_credit ───────────────────────────────────────────────────
  server.registerTool(
    "delete_vendor_credit",
    {
      title: "Delete QuickBooks Vendor Credit",
      description:
        "Delete a QuickBooks vendor credit. Requires vendorCreditId and syncToken (from get_vendor_credit). Only credits that have not been applied to bills can be deleted. For applied credits, void them instead.",
      inputSchema: {
        vendorCreditId: z.string().describe("Vendor credit ID to delete"),
        syncToken: z.string().describe("SyncToken from get_vendor_credit (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.delete_vendor_credit",
        () => client.post("/vendorcredit?operation=delete", {
          Id: args.vendorCreditId,
          SyncToken: args.syncToken,
        }),
        { tool: "delete_vendor_credit", vendorCreditId: args.vendorCreditId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
