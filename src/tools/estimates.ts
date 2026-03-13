// Estimates tools: list_estimates, get_estimate, create_estimate, convert_estimate_to_invoice
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const EstimateLineItemSchema = z.object({
  description: z.string().optional().describe("Line item description"),
  quantity: z.number().optional().describe("Quantity"),
  unitPrice: z.number().optional().describe("Unit price / rate"),
  amount: z.number().describe("Line total amount"),
  itemRef: z.string().optional().describe("Product/service item ID"),
  serviceDate: z.string().optional().describe("Service date (YYYY-MM-DD)"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_estimates ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_estimates",
    {
      title: "List QuickBooks Estimates",
      description:
        "List QuickBooks Online estimates (quotes) with optional filters by customer, status, or date range. Supports pagination. Use to find estimates before converting them to invoices.",
      inputSchema: {
        customerId: z.string().optional().describe("Filter by customer ID"),
        txnStatus: z
          .enum(["Accepted", "Closed", "Pending", "Rejected"])
          .optional()
          .describe("Filter by estimate status"),
        txnDateAfter: z.string().optional().describe("Filter estimates after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter estimates before date (YYYY-MM-DD)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.customerId) whereParts.push(`CustomerRef = '${args.customerId}'`);
      if (args.txnStatus) whereParts.push(`TxnStatus = '${args.txnStatus}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_estimates",
        () => client.query(
          "Estimate",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_estimates" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_estimate ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_estimate",
    {
      title: "Get QuickBooks Estimate",
      description:
        "Get full details for a QuickBooks estimate by ID, including all line items, customer info, expiration date, and status. Use before converting to an invoice.",
      inputSchema: {
        estimateId: z.string().describe("QuickBooks estimate ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_estimate",
        () => client.get(`/estimate/${args.estimateId}`),
        { tool: "get_estimate", estimateId: args.estimateId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_estimate ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_estimate",
    {
      title: "Create QuickBooks Estimate",
      description:
        "Create a new QuickBooks Online estimate (quote) with line items. Required: customerId and at least one line item with amount. Returns the created estimate with assigned ID.",
      inputSchema: {
        customerId: z.string().describe("Customer ID (from list_customers)"),
        lineItems: z.array(EstimateLineItemSchema).describe("Estimate line items (at least one required)"),
        txnDate: z.string().optional().describe("Estimate date (YYYY-MM-DD, default: today)"),
        expirationDate: z.string().optional().describe("Expiration date (YYYY-MM-DD)"),
        customerMemo: z.string().optional().describe("Memo shown to customer"),
        privateNote: z.string().optional().describe("Internal note (not shown to customer)"),
        txnStatus: z
          .enum(["Accepted", "Closed", "Pending", "Rejected"])
          .optional()
          .describe("Estimate status (default: Pending)"),
        docNumber: z.string().optional().describe("Custom estimate number"),
        billingEmailAddress: z.string().optional().describe("Override billing email address"),
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

      const estimate: Record<string, unknown> = {
        CustomerRef: { value: args.customerId },
        Line: lines,
      };

      if (args.txnDate) estimate.TxnDate = args.txnDate;
      if (args.expirationDate) estimate.ExpirationDate = args.expirationDate;
      if (args.customerMemo) estimate.CustomerMemo = { value: args.customerMemo };
      if (args.privateNote) estimate.PrivateNote = args.privateNote;
      if (args.txnStatus) estimate.TxnStatus = args.txnStatus;
      if (args.docNumber) estimate.DocNumber = args.docNumber;
      if (args.billingEmailAddress) estimate.BillEmail = { Address: args.billingEmailAddress };

      const result = await logger.time(
        "tool.create_estimate",
        () => client.post("/estimate", estimate),
        { tool: "create_estimate", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── convert_estimate_to_invoice ─────────────────────────────────────────────
  server.registerTool(
    "convert_estimate_to_invoice",
    {
      title: "Convert Estimate to Invoice",
      description:
        "Convert an accepted QuickBooks estimate to an invoice. This creates a linked invoice from the estimate's line items. Requires estimateId and syncToken from get_estimate. Returns the new invoice.",
      inputSchema: {
        estimateId: z.string().describe("Estimate ID to convert"),
        syncToken: z.string().describe("SyncToken from get_estimate (required for optimistic locking)"),
        txnDate: z.string().optional().describe("Invoice date (YYYY-MM-DD, default: today)"),
        dueDate: z.string().optional().describe("Invoice due date (YYYY-MM-DD)"),
        privateNote: z.string().optional().describe("Private note on the resulting invoice"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      // Step 1: Get estimate to copy line items and customer
      const estimateData = await logger.time(
        "tool.convert_estimate_to_invoice.get",
        () => client.get(`/estimate/${args.estimateId}`) as Promise<{ Estimate: Record<string, unknown> }>,
        { tool: "convert_estimate_to_invoice", estimateId: args.estimateId as string }
      );

      const est = (estimateData as Record<string, unknown>).Estimate as Record<string, unknown>;

      // Step 2: Mark estimate as Closed
      const closePayload: Record<string, unknown> = {
        Id: args.estimateId,
        SyncToken: args.syncToken,
        sparse: true,
        TxnStatus: "Closed",
      };
      await logger.time(
        "tool.convert_estimate_to_invoice.close",
        () => client.post("/estimate", closePayload),
        { tool: "convert_estimate_to_invoice" }
      );

      // Step 3: Create invoice from estimate data
      const invoice: Record<string, unknown> = {
        CustomerRef: est.CustomerRef,
        Line: est.Line,
      };
      if (args.txnDate) invoice.TxnDate = args.txnDate;
      if (args.dueDate) invoice.DueDate = args.dueDate;
      if (args.privateNote) invoice.PrivateNote = args.privateNote;
      // Link back to estimate
      invoice.LinkedTxn = [{ TxnId: args.estimateId, TxnType: "Estimate" }];

      const result = await logger.time(
        "tool.convert_estimate_to_invoice.create_invoice",
        () => client.post("/invoice", invoice),
        { tool: "convert_estimate_to_invoice" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
