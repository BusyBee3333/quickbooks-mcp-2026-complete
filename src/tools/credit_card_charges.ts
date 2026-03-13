// Credit Card Charges tools: list_credit_card_charges, get_credit_card_charge, create_credit_card_charge
// Uses QBO Purchase entity with PaymentType=CreditCard
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const PurchaseLineSchema = z.object({
  amount: z.number().describe("Line amount"),
  description: z.string().optional().describe("Line description"),
  accountId: z.string().optional().describe("Expense account ID to categorize the charge"),
  itemRef: z.string().optional().describe("Item reference ID (alternative to accountId)"),
  classId: z.string().optional().describe("Class ID for classification"),
  departmentId: z.string().optional().describe("Department/location ID"),
  billable: z.boolean().optional().describe("Whether this charge is billable to a customer"),
  customerId: z.string().optional().describe("Customer ID if billable"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_credit_card_charges ───────────────────────────────────────────────
  server.registerTool(
    "list_credit_card_charges",
    {
      title: "List QuickBooks Credit Card Charges",
      description:
        "List QuickBooks Online credit card charges (Purchase entities with PaymentType=CreditCard). Returns charge ID, account, vendor, date, and total. Supports startPosition/maxResults pagination.",
      inputSchema: {
        accountId: z.string().optional().describe("Filter by credit card account ID"),
        txnDateAfter: z.string().optional().describe("Filter after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter before date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("Filter by reference/doc number"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = ["PaymentType = 'CreditCard'"];
      if (args.accountId) whereParts.push(`AccountRef = '${args.accountId}'`);
      if (args.docNumber) whereParts.push(`DocNumber = '${args.docNumber}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.join(" AND ");

      const result = await logger.time(
        "tool.list_credit_card_charges",
        () => client.query("Purchase", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_credit_card_charges" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_credit_card_charge ─────────────────────────────────────────────────
  server.registerTool(
    "get_credit_card_charge",
    {
      title: "Get QuickBooks Credit Card Charge",
      description:
        "Get full details for a specific QuickBooks credit card charge (Purchase) by ID, including line items, expense accounts, vendor, total, and SyncToken.",
      inputSchema: {
        purchaseId: z.string().describe("QuickBooks Purchase (credit card charge) ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_credit_card_charge",
        () => client.get(`/purchase/${args.purchaseId}`),
        { tool: "get_credit_card_charge", purchaseId: args.purchaseId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_credit_card_charge ──────────────────────────────────────────────
  server.registerTool(
    "create_credit_card_charge",
    {
      title: "Create QuickBooks Credit Card Charge",
      description:
        "Create a new QuickBooks Online credit card charge (Purchase with PaymentType=CreditCard). Required: creditCardAccountId (the credit card account) and at least one line item with an expense account. Used to record purchases made with a credit card.",
      inputSchema: {
        creditCardAccountId: z.string().describe("Credit card account ID (from list_accounts, type CreditCard)"),
        totalAmount: z.number().describe("Total charge amount"),
        lines: z.array(PurchaseLineSchema).min(1).describe("Expense line items (at least one required)"),
        txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Reference/doc number"),
        vendorId: z.string().optional().describe("Vendor/payee ID (from list_vendors)"),
        memo: z.string().optional().describe("Memo/description for the charge"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lines as Array<{
        amount: number;
        description?: string;
        accountId?: string;
        itemRef?: string;
        classId?: string;
        departmentId?: string;
        billable?: boolean;
        customerId?: string;
      }>).map((line) => {
        if (line.itemRef) {
          return {
            Amount: line.amount,
            DetailType: "ItemBasedExpenseLineDetail",
            ...(line.description ? { Description: line.description } : {}),
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: line.itemRef },
              ...(line.classId ? { ClassRef: { value: line.classId } } : {}),
              ...(line.departmentId ? { CustomerRef: { value: line.departmentId } } : {}),
              ...(line.billable !== undefined ? { BillableStatus: line.billable ? "Billable" : "NotBillable" } : {}),
              ...(line.customerId ? { CustomerRef: { value: line.customerId } } : {}),
            },
          };
        }
        return {
          Amount: line.amount,
          DetailType: "AccountBasedExpenseLineDetail",
          ...(line.description ? { Description: line.description } : {}),
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: line.accountId },
            ...(line.classId ? { ClassRef: { value: line.classId } } : {}),
            ...(line.billable !== undefined ? { BillableStatus: line.billable ? "Billable" : "NotBillable" } : {}),
            ...(line.customerId ? { CustomerRef: { value: line.customerId } } : {}),
          },
        };
      });

      const charge: Record<string, unknown> = {
        PaymentType: "CreditCard",
        AccountRef: { value: args.creditCardAccountId },
        TotalAmt: args.totalAmount,
        Line: lines,
      };

      if (args.txnDate) charge.TxnDate = args.txnDate;
      if (args.docNumber) charge.DocNumber = args.docNumber;
      if (args.vendorId) charge.EntityRef = { value: args.vendorId, type: "Vendor" };
      if (args.memo) charge.PrivateNote = args.memo;

      const result = await logger.time(
        "tool.create_credit_card_charge",
        () => client.post("/purchase", charge),
        { tool: "create_credit_card_charge" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
