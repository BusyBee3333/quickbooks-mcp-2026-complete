// Invoices tools: list_invoices, get_invoice, create_invoice, update_invoice, send_invoice
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

// Invoice line item schema
const LineItemSchema = z.object({
  description: z.string().optional().describe("Line item description"),
  quantity: z.number().optional().describe("Quantity"),
  unitPrice: z.number().optional().describe("Unit price / rate"),
  amount: z.number().describe("Line total amount"),
  itemRef: z.string().optional().describe("Product/service item ID"),
  serviceDate: z.string().optional().describe("Service date (YYYY-MM-DD)"),
  taxable: z.boolean().optional().describe("Whether this line is taxable"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_invoices ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_invoices",
    {
      title: "List QuickBooks Invoices",
      description:
        "List QuickBooks Online invoices with optional filters by customer, status, or date range. Returns invoice number, customer, due date, balance, and total. Supports offset pagination (startPosition, maxResults).",
      inputSchema: {
        customerId: z.string().optional().describe("Filter by customer ID"),
        docNumber: z.string().optional().describe("Filter by invoice number"),
        txnDateAfter: z.string().optional().describe("Filter invoices after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter invoices before date (YYYY-MM-DD)"),
        dueDateAfter: z.string().optional().describe("Filter by due date after (YYYY-MM-DD)"),
        dueDateBefore: z.string().optional().describe("Filter by due date before (YYYY-MM-DD)"),
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
      if (args.dueDateAfter) whereParts.push(`DueDate >= '${args.dueDateAfter}'`);
      if (args.dueDateBefore) whereParts.push(`DueDate <= '${args.dueDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_invoices",
        () => client.query(
          "Invoice",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_invoices" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_invoice ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_invoice",
    {
      title: "Get QuickBooks Invoice",
      description:
        "Get full details for a QuickBooks invoice by ID, including all line items, customer info, tax details, due date, balance, and payment history. Use when referencing a specific invoice.",
      inputSchema: {
        invoiceId: z.string().describe("QuickBooks invoice ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_invoice",
        () => client.get(`/invoice/${args.invoiceId}`),
        { tool: "get_invoice", invoiceId: args.invoiceId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_invoice ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_invoice",
    {
      title: "Create QuickBooks Invoice",
      description:
        "Create a new QuickBooks Online invoice with line items. Required: customerId and at least one line item with amount. Returns the created invoice with assigned ID and invoice number.",
      inputSchema: {
        customerId: z.string().describe("Customer ID (from list_customers)"),
        lineItems: z.array(LineItemSchema).describe("Invoice line items (at least one required)"),
        invoiceNumber: z.string().optional().describe("Custom invoice number (auto-generated if not provided)"),
        txnDate: z.string().optional().describe("Invoice date (YYYY-MM-DD, default: today)"),
        dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
        customerMemo: z.string().optional().describe("Memo shown to customer on invoice"),
        privateNote: z.string().optional().describe("Internal note (not shown to customer)"),
        shipDate: z.string().optional().describe("Shipping date (YYYY-MM-DD)"),
        trackingNum: z.string().optional().describe("Tracking number"),
        billingEmailAddress: z.string().optional().describe("Override billing email address"),
        depositToAccountId: z.string().optional().describe("Account ID for deposit"),
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
        taxable?: boolean;
      }>).map((item) => {
        const line: Record<string, unknown> = {
          Amount: item.amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ...(item.itemRef ? { ItemRef: { value: item.itemRef } } : {}),
            ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
            ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
            ...(item.serviceDate ? { ServiceDate: item.serviceDate } : {}),
            ...(item.taxable !== undefined ? { TaxCodeRef: { value: item.taxable ? "TAX" : "NON" } } : {}),
          },
        };
        if (item.description) line.Description = item.description;
        return line;
      });

      const invoice: Record<string, unknown> = {
        CustomerRef: { value: args.customerId },
        Line: lines,
      };

      if (args.invoiceNumber) invoice.DocNumber = args.invoiceNumber;
      if (args.txnDate) invoice.TxnDate = args.txnDate;
      if (args.dueDate) invoice.DueDate = args.dueDate;
      if (args.customerMemo) invoice.CustomerMemo = { value: args.customerMemo };
      if (args.privateNote) invoice.PrivateNote = args.privateNote;
      if (args.shipDate) invoice.ShipDate = args.shipDate;
      if (args.trackingNum) invoice.TrackingNum = args.trackingNum;
      if (args.billingEmailAddress) invoice.BillEmail = { Address: args.billingEmailAddress };
      if (args.depositToAccountId) invoice.DepositToAccountRef = { value: args.depositToAccountId };

      const result = await logger.time(
        "tool.create_invoice",
        () => client.post("/invoice", invoice),
        { tool: "create_invoice", customerId: args.customerId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_invoice ─────────────────────────────────────────────────────────
  server.registerTool(
    "update_invoice",
    {
      title: "Update QuickBooks Invoice",
      description:
        "Update an existing QuickBooks invoice. Requires invoiceId and syncToken (from get_invoice). Supports sparse update — only provided fields are modified.",
      inputSchema: {
        invoiceId: z.string().describe("Invoice ID"),
        syncToken: z.string().describe("SyncToken from get_invoice (required for optimistic locking)"),
        dueDate: z.string().optional().describe("New due date (YYYY-MM-DD)"),
        txnDate: z.string().optional().describe("New transaction date (YYYY-MM-DD)"),
        customerMemo: z.string().optional().describe("New customer memo"),
        privateNote: z.string().optional().describe("New private note"),
        lineItems: z.array(LineItemSchema).optional().describe("Replace all line items (replaces existing)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const invoice: Record<string, unknown> = {
        Id: args.invoiceId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.dueDate) invoice.DueDate = args.dueDate;
      if (args.txnDate) invoice.TxnDate = args.txnDate;
      if (args.customerMemo) invoice.CustomerMemo = { value: args.customerMemo };
      if (args.privateNote) invoice.PrivateNote = args.privateNote;

      if (args.lineItems) {
        invoice.Line = (args.lineItems as Array<{
          description?: string;
          quantity?: number;
          unitPrice?: number;
          amount: number;
          itemRef?: string;
        }>).map((item) => ({
          Amount: item.amount,
          DetailType: "SalesItemLineDetail",
          ...(item.description ? { Description: item.description } : {}),
          SalesItemLineDetail: {
            ...(item.itemRef ? { ItemRef: { value: item.itemRef } } : {}),
            ...(item.quantity !== undefined ? { Qty: item.quantity } : {}),
            ...(item.unitPrice !== undefined ? { UnitPrice: item.unitPrice } : {}),
          },
        }));
      }

      const result = await logger.time(
        "tool.update_invoice",
        () => client.post("/invoice", invoice),
        { tool: "update_invoice", invoiceId: args.invoiceId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── send_invoice ───────────────────────────────────────────────────────────
  server.registerTool(
    "send_invoice",
    {
      title: "Send Invoice via Email",
      description:
        "Send a QuickBooks invoice to the customer via email. Uses the email address on file for the customer, or a custom address. Returns the invoice with updated email delivery status.",
      inputSchema: {
        invoiceId: z.string().describe("Invoice ID to send"),
        emailAddress: z.string().email().optional().describe("Override email address (default: customer's email on file)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const params = args.emailAddress
        ? `?sendTo=${encodeURIComponent(args.emailAddress as string)}`
        : "";

      const result = await logger.time(
        "tool.send_invoice",
        () => client.post(`/invoice/${args.invoiceId}/send${params}`, {}),
        { tool: "send_invoice", invoiceId: args.invoiceId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
