// Customer Type tools: list_customer_types, get_customer_type, create_customer_type
// Customer types allow categorizing customers for reporting and targeted pricing
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_customer_types ────────────────────────────────────────────────────
  server.registerTool(
    "list_customer_types",
    {
      title: "List QuickBooks Customer Types",
      description:
        "List QuickBooks Online customer types used to categorize customers (e.g. 'Retail', 'Wholesale', 'Government', 'Enterprise'). Customer types enable segmentation for reporting, price levels, and marketing. Returns type name, parent type, and active status. Supports pagination.",
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
        "tool.list_customer_types",
        () => client.query("CustomerType", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_customer_types" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_customer_type ──────────────────────────────────────────────────────
  server.registerTool(
    "get_customer_type",
    {
      title: "Get QuickBooks Customer Type",
      description:
        "Get full details for a QuickBooks customer type by ID. Returns the type name, parent type reference (for hierarchical types), and active status.",
      inputSchema: {
        customerTypeId: z.string().describe("QuickBooks customer type ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_customer_type",
        () => client.get(`/customertype/${args.customerTypeId}`),
        { tool: "get_customer_type", customerTypeId: args.customerTypeId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_customer_type ───────────────────────────────────────────────────
  server.registerTool(
    "create_customer_type",
    {
      title: "Create QuickBooks Customer Type",
      description:
        "Create a new QuickBooks customer type for categorizing customers. Types can be hierarchical — specify a parentCustomerTypeId to create a sub-type. Example hierarchy: 'Business' → 'Enterprise', 'Business' → 'Small Business'.",
      inputSchema: {
        name: z.string().describe("Customer type name (e.g. 'Retail', 'Wholesale', 'Government')"),
        parentCustomerTypeId: z.string().optional().describe("Parent customer type ID (for hierarchical types)"),
        active: z.boolean().optional().describe("Whether the type is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const customerType: Record<string, unknown> = {
        Name: args.name,
      };
      if (args.parentCustomerTypeId) customerType.ParentRef = { value: args.parentCustomerTypeId };
      if (args.active !== undefined) customerType.Active = args.active;

      const result = await logger.time(
        "tool.create_customer_type",
        () => client.post("/customertype", customerType),
        { tool: "create_customer_type", name: args.name as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
