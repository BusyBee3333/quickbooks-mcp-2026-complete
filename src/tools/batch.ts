// Batch tools: batch_create, batch_update, batch_delete
// QuickBooks Batch Write API — up to 30 operations per request
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const BatchItemSchema = z.object({
  bId: z.string().describe("Unique batch item ID for correlating responses (any string)"),
  operation: z.enum(["create", "update", "delete"]).describe("Operation type"),
  entity: z.string().describe("Entity type (e.g. 'Invoice', 'Customer', 'Bill', 'Payment')"),
  data: z.record(z.unknown()).describe("Entity data object — same structure as single-entity create/update/delete"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── batch_write ────────────────────────────────────────────────────────────
  server.registerTool(
    "batch_write",
    {
      title: "Batch Write (Create/Update/Delete)",
      description:
        "Execute up to 30 QuickBooks create, update, or delete operations in a single API call. Significantly more efficient than making individual calls when processing multiple records. Each item specifies the operation, entity type, and data. Returns results keyed by the bId you provide, so you can match responses to requests. Supported entities: Invoice, Customer, Vendor, Bill, Payment, Item, Account, SalesReceipt, CreditMemo, Estimate, PurchaseOrder, JournalEntry, Transfer, Deposit, and more.",
      inputSchema: {
        items: z
          .array(BatchItemSchema)
          .min(1)
          .max(30)
          .describe("Array of 1–30 batch operations to perform"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const BatchItemRequests = (args.items as Array<{
        bId: string;
        operation: string;
        entity: string;
        data: Record<string, unknown>;
      }>).map((item) => ({
        bId: item.bId,
        operation: item.operation,
        [item.entity]: item.data,
      }));

      const result = await logger.time(
        "tool.batch_write",
        () => client.post("/batch", { BatchItemRequests }),
        { tool: "batch_write", itemCount: (args.items as unknown[]).length }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── batch_query ────────────────────────────────────────────────────────────
  server.registerTool(
    "batch_query",
    {
      title: "Batch Query Multiple Entities",
      description:
        "Execute up to 30 QuickBooks query operations in a single API call. Useful for fetching multiple different entity types at once (e.g., customers + vendors + items simultaneously). Each query item specifies the entity type and optional WHERE/ORDER/pagination. Returns a BatchItemResponse array with results keyed by the bId you provide.",
      inputSchema: {
        queries: z
          .array(z.object({
            bId: z.string().describe("Unique batch item ID for correlating responses"),
            entity: z.string().describe("Entity type to query (e.g. 'Customer', 'Invoice', 'Item')"),
            where: z.string().optional().describe("Optional WHERE clause (e.g. \"Active = true\")"),
            startPosition: z.number().int().min(1).optional().describe("Pagination offset (default 1)"),
            maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
            orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
          }))
          .min(1)
          .max(30)
          .describe("Array of 1–30 queries to run in parallel"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const BatchItemRequests = (args.queries as Array<{
        bId: string;
        entity: string;
        where?: string;
        startPosition?: number;
        maxResults?: number;
        orderBy?: string;
      }>).map((q) => {
        let sql = `SELECT * FROM ${q.entity}`;
        if (q.where) sql += ` WHERE ${q.where}`;
        if (q.orderBy) sql += ` ORDERBY ${q.orderBy}`;
        sql += ` STARTPOSITION ${q.startPosition ?? 1} MAXRESULTS ${q.maxResults ?? 100}`;
        return {
          bId: q.bId,
          operation: "query",
          Query: sql,
        };
      });

      const result = await logger.time(
        "tool.batch_query",
        () => client.post("/batch", { BatchItemRequests }),
        { tool: "batch_query", queryCount: (args.queries as unknown[]).length }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
