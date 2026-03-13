// Purchase tools: list_purchases, get_purchase, create_purchase, delete_purchase
// Purchases represent cash/check/credit card transactions for expenses (not billed)
// This covers: expenses, cash purchases, and check payments to vendors/non-vendors
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const PurchaseLineSchema = z.object({
  amount: z.number().describe("Line amount"),
  accountId: z.string().optional().describe("Expense account ID"),
  description: z.string().optional().describe("Line description"),
  itemRef: z.string().optional().describe("Item/product reference ID (for item-based lines)"),
  quantity: z.number().optional().describe("Quantity (for item-based lines)"),
  unitPrice: z.number().optional().describe("Unit price (for item-based lines)"),
  classId: z.string().optional().describe("Class ID for tracking"),
  customerId: z.string().optional().describe("Customer ID (for billable expenses)"),
  billable: z.boolean().optional().describe("Whether this expense is billable to the customer"),
  taxable: z.boolean().optional().describe("Whether this line is taxable"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_purchases ─────────────────────────────────────────────────────────
  server.registerTool(
    "list_purchases",
    {
      title: "List QuickBooks Purchases",
      description:
        "List QuickBooks Online purchases (expenses). Purchases record money spent directly from bank or credit card accounts — not through Bills. Covers cash purchases, checks to non-vendors, and direct credit card charges. Returns payment type (Cash/Check/CreditCard), account, payee, date, and total. Supports pagination.",
      inputSchema: {
        paymentType: z.enum(["Cash", "Check", "CreditCard"]).optional().describe("Filter by payment type"),
        accountId: z.string().optional().describe("Filter by payment account ID (bank or credit card)"),
        txnDateAfter: z.string().optional().describe("Filter purchases after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter purchases before date (YYYY-MM-DD)"),
        entityId: z.string().optional().describe("Filter by payee entity ID (vendor, customer, or employee)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.paymentType) whereParts.push(`PaymentType = '${args.paymentType}'`);
      if (args.accountId) whereParts.push(`AccountRef = '${args.accountId}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      if (args.entityId) whereParts.push(`EntityRef = '${args.entityId}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_purchases",
        () => client.query("Purchase", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_purchases" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_purchase ───────────────────────────────────────────────────────────
  server.registerTool(
    "get_purchase",
    {
      title: "Get QuickBooks Purchase",
      description:
        "Get full details for a QuickBooks purchase (expense) by ID. Returns the payment type, payment account, payee, all expense lines with accounts/items, and any billable tracking.",
      inputSchema: {
        purchaseId: z.string().describe("QuickBooks purchase ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_purchase",
        () => client.get(`/purchase/${args.purchaseId}`),
        { tool: "get_purchase", purchaseId: args.purchaseId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_purchase ────────────────────────────────────────────────────────
  server.registerTool(
    "create_purchase",
    {
      title: "Create QuickBooks Purchase",
      description:
        "Create a QuickBooks purchase (expense) to record direct payments from bank or credit card accounts. Use for expenses not going through the Bills workflow — cash purchases, direct debit transactions, ATM withdrawals, or check payments. Required: paymentType, accountId, and at least one line item.",
      inputSchema: {
        paymentType: z.enum(["Cash", "Check", "CreditCard"]).describe("How the purchase was paid"),
        accountId: z.string().describe("Bank or credit card account ID used to pay"),
        lineItems: z.array(PurchaseLineSchema).min(1).describe("Expense lines (at least one required)"),
        totalAmount: z.number().optional().describe("Total amount (auto-calculated from lines if not provided)"),
        txnDate: z.string().optional().describe("Purchase date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Check number or reference number"),
        vendorId: z.string().optional().describe("Vendor/payee ID (for vendor-tracked expenses)"),
        entityType: z.enum(["Vendor", "Customer", "Employee"]).optional().describe("Type of payee entity (default: Vendor)"),
        memo: z.string().optional().describe("Memo / note"),
        departmentId: z.string().optional().describe("Department/location ID"),
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
        taxable?: boolean;
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
              ...(item.taxable !== undefined ? { TaxCodeRef: { value: item.taxable ? "TAX" : "NON" } } : {}),
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
            ...(item.taxable !== undefined ? { TaxCodeRef: { value: item.taxable ? "TAX" : "NON" } } : {}),
          },
        };
      });

      const purchase: Record<string, unknown> = {
        PaymentType: args.paymentType,
        AccountRef: { value: args.accountId },
        Line: lines,
      };

      if (args.totalAmount !== undefined) purchase.TotalAmt = args.totalAmount;
      if (args.txnDate) purchase.TxnDate = args.txnDate;
      if (args.docNumber) purchase.DocNumber = args.docNumber;
      if (args.vendorId) {
        purchase.EntityRef = {
          value: args.vendorId,
          type: args.entityType ?? "Vendor",
        };
      }
      if (args.memo) purchase.PrivateNote = args.memo;
      if (args.departmentId) purchase.DepartmentRef = { value: args.departmentId };
      if (args.currencyCode) purchase.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.create_purchase",
        () => client.post("/purchase", purchase),
        { tool: "create_purchase", paymentType: args.paymentType as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_purchase ────────────────────────────────────────────────────────
  server.registerTool(
    "delete_purchase",
    {
      title: "Delete QuickBooks Purchase",
      description:
        "Delete a QuickBooks purchase (expense). Requires purchaseId and syncToken (from get_purchase). Deleting reverses the effect on the payment account balance. For credit card purchases linked to statements, consider voiding instead.",
      inputSchema: {
        purchaseId: z.string().describe("Purchase ID to delete"),
        syncToken: z.string().describe("SyncToken from get_purchase (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.delete_purchase",
        () => client.post("/purchase?operation=delete", {
          Id: args.purchaseId,
          SyncToken: args.syncToken,
        }),
        { tool: "delete_purchase", purchaseId: args.purchaseId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
