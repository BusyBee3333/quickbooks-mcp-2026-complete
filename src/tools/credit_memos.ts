// Credit Memos tools: list_credit_memos, get_credit_memo, create_credit_memo, void_credit_memo
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
  // ── list_credit_memos ──────────────────────────────────────────────────────
  server.registerTool(
    "list_credit_memos",
    {
      title: "List QuickBooks Credit Memos",
      description:
        "List QuickBooks Online credit memos with optional filters by customer, date, or document number. Returns credit memo ID, customer, date, and remaining credit. Supports startPosition/maxResults pagination.",
      inputSchema: {
        customerId: z.string().optional().describe("Filter by customer ID"),
        docNumber: z.string().optional().describe("Filter by credit memo number"),
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
        "tool.list_credit_memos",
        () => client.query("CreditMemo", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_credit_memos" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_credit_memo ────────────────────────────────────────────────────────
  server.registerTool(
    "get_credit_memo",
    {
      title: "Get QuickBooks Credit Memo",
      description:
        "Get full details of a specific QuickBooks credit memo by ID, including all line items, customer info, remaining credit, and SyncToken for updates.",
      inputSchema: {
        creditMemoId: z.string().describe("QuickBooks credit memo ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_credit_memo",
        () => client.get(`/creditmemo/${args.creditMemoId}`),
        { tool: "get_credit_memo", creditMemoId: args.creditMemoId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_credit_memo ─────────────────────────────────────────────────────
  server.registerTool(
    "create_credit_memo",
    {
      title: "Create QuickBooks Credit Memo",
      description:
        "Create a new QuickBooks Online credit memo for a customer. Required: customerId and at least one line item. The credit memo reduces the customer's balance or can be applied to future invoices.",
      inputSchema: {
        customerId: z.string().describe("Customer ID (from list_customers)"),
        lineItems: z.array(LineItemSchema).describe("Credit memo line items (at least one required)"),
        txnDate: z.string().optional().describe("Credit memo date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Custom credit memo number"),
        customerMemo: z.string().optional().describe("Memo shown to customer"),
        privateNote: z.string().optional().describe("Internal note (not shown to customer)"),
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

      const creditMemo: Record<string, unknown> = {
        CustomerRef: { value: args.customerId },
        Line: lines,
      };

      if (args.txnDate) creditMemo.TxnDate = args.txnDate;
      if (args.docNumber) creditMemo.DocNumber = args.docNumber;
      if (args.customerMemo) creditMemo.CustomerMemo = { value: args.customerMemo };
      if (args.privateNote) creditMemo.PrivateNote = args.privateNote;

      const result = await logger.time(
        "tool.create_credit_memo",
        () => client.post("/creditmemo", creditMemo),
        { tool: "create_credit_memo", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── void_credit_memo ───────────────────────────────────────────────────────
  server.registerTool(
    "void_credit_memo",
    {
      title: "Void QuickBooks Credit Memo",
      description:
        "Void an existing QuickBooks credit memo. Requires creditMemoId and syncToken (from get_credit_memo). Voiding preserves the audit trail. Only unapplied credit memos can be voided.",
      inputSchema: {
        creditMemoId: z.string().describe("Credit memo ID to void"),
        syncToken: z.string().describe("SyncToken from get_credit_memo (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.void_credit_memo",
        () => client.post("/creditmemo?operation=void", {
          Id: args.creditMemoId,
          SyncToken: args.syncToken,
          sparse: true,
        }),
        { tool: "void_credit_memo", creditMemoId: args.creditMemoId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
