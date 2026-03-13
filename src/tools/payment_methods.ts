// Payment Method tools: list_payment_methods, get_payment_method, create_payment_method
// Payment methods define how customers pay (Cash, Check, Visa, etc.)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_payment_methods ───────────────────────────────────────────────────
  server.registerTool(
    "list_payment_methods",
    {
      title: "List QuickBooks Payment Methods",
      description:
        "List QuickBooks Online payment methods used to record how customers pay (e.g. Cash, Check, Visa, Mastercard, ACH, PayPal). Payment methods are referenced on sales receipts, invoices, and customer payments. Returns name, type, and active status. Supports pagination.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status (default: returns all)"),
        name: z.string().optional().describe("Filter by name (exact match)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      if (args.name) whereParts.push(`Name = '${args.name}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_payment_methods",
        () => client.query("PaymentMethod", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_payment_methods" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_payment_method ─────────────────────────────────────────────────────
  server.registerTool(
    "get_payment_method",
    {
      title: "Get QuickBooks Payment Method",
      description:
        "Get full details for a QuickBooks payment method by ID. Returns the name, type (NonCash or Cash), and active status.",
      inputSchema: {
        paymentMethodId: z.string().describe("QuickBooks payment method ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_payment_method",
        () => client.get(`/paymentmethod/${args.paymentMethodId}`),
        { tool: "get_payment_method", paymentMethodId: args.paymentMethodId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_payment_method ──────────────────────────────────────────────────
  server.registerTool(
    "create_payment_method",
    {
      title: "Create QuickBooks Payment Method",
      description:
        "Create a new QuickBooks payment method. Required: name. Use to add custom payment methods like 'Zelle', 'ACH Transfer', 'Bitcoin', or specific credit card types. The type determines whether it flows through bank feeds (NonCash = card/ACH, Cash = cash).",
      inputSchema: {
        name: z.string().describe("Payment method name (e.g. 'Zelle', 'ACH', 'Amex')"),
        type: z
          .enum(["CREDIT_CARD", "NON_CREDIT_CARD"])
          .optional()
          .describe("Payment method type — CREDIT_CARD for cards, NON_CREDIT_CARD for others"),
        active: z.boolean().optional().describe("Whether the payment method is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const paymentMethod: Record<string, unknown> = {
        Name: args.name,
      };
      if (args.type) paymentMethod.Type = args.type;
      if (args.active !== undefined) paymentMethod.Active = args.active;

      const result = await logger.time(
        "tool.create_payment_method",
        () => client.post("/paymentmethod", paymentMethod),
        { tool: "create_payment_method", name: args.name as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_payment_method ──────────────────────────────────────────────────
  server.registerTool(
    "update_payment_method",
    {
      title: "Update QuickBooks Payment Method",
      description:
        "Update an existing QuickBooks payment method. Requires paymentMethodId and syncToken (from get_payment_method). Supports sparse update — only provided fields are modified. Use to rename or deactivate a payment method.",
      inputSchema: {
        paymentMethodId: z.string().describe("Payment method ID to update"),
        syncToken: z.string().describe("SyncToken from get_payment_method"),
        name: z.string().optional().describe("New name for the payment method"),
        active: z.boolean().optional().describe("Set to false to deactivate"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const paymentMethod: Record<string, unknown> = {
        Id: args.paymentMethodId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.name) paymentMethod.Name = args.name;
      if (args.active !== undefined) paymentMethod.Active = args.active;

      const result = await logger.time(
        "tool.update_payment_method",
        () => client.post("/paymentmethod", paymentMethod),
        { tool: "update_payment_method", paymentMethodId: args.paymentMethodId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
