// Term tools: list_terms, get_term, create_term
// Payment terms define due date and discount rules for invoices and bills
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_terms ─────────────────────────────────────────────────────────────
  server.registerTool(
    "list_terms",
    {
      title: "List QuickBooks Terms",
      description:
        "List QuickBooks Online payment terms used to define due dates and early-payment discounts on invoices and bills (e.g. 'Net 30', 'Net 15', '2/10 Net 30', 'Due on Receipt'). Returns term name, due days, discount percentage, and discount days. Supports pagination.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_terms",
        () => client.query("Term", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_terms" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_term ───────────────────────────────────────────────────────────────
  server.registerTool(
    "get_term",
    {
      title: "Get QuickBooks Term",
      description:
        "Get full details for a QuickBooks payment term by ID. Returns the name, type (STANDARD or DATE_DRIVEN), due days, discount percentage, and discount days. DATE_DRIVEN terms use a specific day-of-month for due dates.",
      inputSchema: {
        termId: z.string().describe("QuickBooks term ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_term",
        () => client.get(`/term/${args.termId}`),
        { tool: "get_term", termId: args.termId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_term ────────────────────────────────────────────────────────────
  server.registerTool(
    "create_term",
    {
      title: "Create QuickBooks Term",
      description:
        "Create a new QuickBooks payment term. Two types: STANDARD (payment due N days after invoice date) and DATE_DRIVEN (payment due on a specific day of month). Optional early-payment discount: specify discountPercent and discountDays. Example: 'Net 30' = STANDARD, dueDays=30. '2/10 Net 30' = STANDARD, dueDays=30, discountPercent=2, discountDays=10.",
      inputSchema: {
        name: z.string().describe("Term name (e.g. 'Net 30', 'Due on Receipt', '2/10 Net 30')"),
        type: z.enum(["STANDARD", "DATE_DRIVEN"]).optional().describe("Term type (default: STANDARD)"),
        dueDays: z.number().int().optional().describe("Days until payment is due from invoice date (STANDARD type)"),
        discountPercent: z.number().optional().describe("Early payment discount percentage (e.g. 2 for 2%)"),
        discountDays: z.number().int().optional().describe("Days within which discount applies"),
        dayOfMonthDue: z.number().int().min(1).max(31).optional().describe("Day of month payment is due (DATE_DRIVEN type)"),
        dueNextMonthDays: z.number().int().optional().describe("If invoice date is within this many days of month end, due next month (DATE_DRIVEN)"),
        discountDayOfMonth: z.number().int().min(1).max(31).optional().describe("Day of month discount expires (DATE_DRIVEN)"),
        active: z.boolean().optional().describe("Whether the term is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const term: Record<string, unknown> = {
        Name: args.name,
        Type: args.type ?? "STANDARD",
      };

      if (args.dueDays !== undefined) term.DueDays = args.dueDays;
      if (args.discountPercent !== undefined) term.DiscountPercent = args.discountPercent;
      if (args.discountDays !== undefined) term.DiscountDays = args.discountDays;
      if (args.dayOfMonthDue !== undefined) term.DayOfMonthDue = args.dayOfMonthDue;
      if (args.dueNextMonthDays !== undefined) term.DueNextMonthDays = args.dueNextMonthDays;
      if (args.discountDayOfMonth !== undefined) term.DiscountDayOfMonth = args.discountDayOfMonth;
      if (args.active !== undefined) term.Active = args.active;

      const result = await logger.time(
        "tool.create_term",
        () => client.post("/term", term),
        { tool: "create_term", name: args.name as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_term ────────────────────────────────────────────────────────────
  server.registerTool(
    "update_term",
    {
      title: "Update QuickBooks Term",
      description:
        "Update an existing QuickBooks payment term. Requires termId and syncToken (from get_term). Supports sparse update — only provided fields are changed. Common use: deactivating obsolete terms or adjusting discount percentages.",
      inputSchema: {
        termId: z.string().describe("Term ID to update"),
        syncToken: z.string().describe("SyncToken from get_term (required for optimistic locking)"),
        name: z.string().optional().describe("New term name"),
        dueDays: z.number().int().optional().describe("New due days count"),
        discountPercent: z.number().optional().describe("New discount percentage"),
        discountDays: z.number().int().optional().describe("New discount days"),
        active: z.boolean().optional().describe("Set to false to deactivate"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const term: Record<string, unknown> = {
        Id: args.termId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.name) term.Name = args.name;
      if (args.dueDays !== undefined) term.DueDays = args.dueDays;
      if (args.discountPercent !== undefined) term.DiscountPercent = args.discountPercent;
      if (args.discountDays !== undefined) term.DiscountDays = args.discountDays;
      if (args.active !== undefined) term.Active = args.active;

      const result = await logger.time(
        "tool.update_term",
        () => client.post("/term", term),
        { tool: "update_term", termId: args.termId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
