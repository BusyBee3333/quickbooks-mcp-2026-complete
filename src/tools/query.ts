// Custom Query tool: custom_query
// Execute arbitrary QuickBooks SQL-like queries against any entity
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── custom_query ───────────────────────────────────────────────────────────
  server.registerTool(
    "custom_query",
    {
      title: "Custom QuickBooks Query (SQL-like)",
      description:
        "Execute a custom QuickBooks Online query using the QBO SQL-like syntax. Supports SELECT, WHERE, ORDERBY, STARTPOSITION, and MAXRESULTS clauses. Use when the specialized list_* tools don't provide the exact filter or combination you need. Supports all QuickBooks entity types.\n\nQuery syntax examples:\n- SELECT * FROM Invoice WHERE TxnDate >= '2024-01-01' AND Balance > '0.00' ORDERBY TxnDate DESC STARTPOSITION 1 MAXRESULTS 50\n- SELECT Id, DocNumber, TotalAmt FROM Invoice WHERE CustomerRef = '123'\n- SELECT COUNT(*) FROM Customer WHERE Active = true\n- SELECT * FROM Item WHERE Type = 'Inventory' AND QtyOnHand > '0'\n- SELECT * FROM Account WHERE AccountType = 'Expense'\n\nAll entity types are supported: Invoice, Customer, Vendor, Item, Bill, Payment, Estimate, PurchaseOrder, Account, JournalEntry, Transfer, Deposit, SalesReceipt, CreditMemo, Employee, Department, Class, TaxCode, TaxRate, Term, PaymentMethod, BillPayment, Purchase, RefundReceipt, TimeActivity, Budget, and more.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Full QBO query string (e.g. \"SELECT * FROM Invoice WHERE TxnDate >= '2024-01-01' ORDERBY TxnDate DESC STARTPOSITION 1 MAXRESULTS 100\")"
          ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const encodedQuery = encodeURIComponent(args.query as string);
      const result = await logger.time(
        "tool.custom_query",
        () => client.get(`/query?query=${encodedQuery}`),
        { tool: "custom_query", query: (args.query as string).substring(0, 100) }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── count_query ────────────────────────────────────────────────────────────
  server.registerTool(
    "count_query",
    {
      title: "Count QuickBooks Entity Records",
      description:
        "Count the total number of records for any QuickBooks entity type, optionally filtered by a WHERE clause. Returns the count without fetching record data — efficient for checking totals before paginating. Useful for reporting, dashboard summaries, and validating data integrity.\n\nExamples:\n- entity='Invoice', where=\"Balance > '0.00'\" → count of open invoices\n- entity='Customer', where='Active = true' → active customer count\n- entity='Item', where=\"Type = 'Inventory'\" → inventory item count",
      inputSchema: {
        entity: z
          .string()
          .describe("Entity type to count (e.g. 'Invoice', 'Customer', 'Vendor', 'Item', 'Bill')"),
        where: z
          .string()
          .optional()
          .describe("Optional WHERE clause to filter (e.g. \"Active = true AND Balance > '0.00'\")"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      let sql = `SELECT COUNT(*) FROM ${args.entity}`;
      if (args.where) sql += ` WHERE ${args.where}`;

      const encodedQuery = encodeURIComponent(sql);
      const result = await logger.time(
        "tool.count_query",
        () => client.get(`/query?query=${encodedQuery}`),
        { tool: "count_query", entity: args.entity as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── query_all_pages ────────────────────────────────────────────────────────
  server.registerTool(
    "query_all_pages",
    {
      title: "Query All Pages (Auto-Paginate)",
      description:
        "Execute a QuickBooks query and automatically fetch ALL pages of results. WARNING: For large datasets this can make many API calls. Use maxTotalRecords to cap the number of records. Best for smaller datasets (< 2000 records) where you need complete results. Returns all records in a single response with a totalFetched count.\n\nUse count_query first to know how many records exist before running this.",
      inputSchema: {
        entity: z.string().describe("Entity type to query (e.g. 'Invoice', 'Customer', 'Item')"),
        where: z.string().optional().describe("Optional WHERE clause filter"),
        orderBy: z.string().optional().describe("Sort order (e.g. 'TxnDate DESC')"),
        pageSize: z.number().int().min(1).max(1000).optional().describe("Records per page (default 1000)"),
        maxTotalRecords: z.number().int().min(1).optional().describe("Maximum total records to fetch across all pages (default 5000, max 10000)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const entity = args.entity as string;
      const pageSize = (args.pageSize as number | undefined) ?? 1000;
      const maxTotal = Math.min((args.maxTotalRecords as number | undefined) ?? 5000, 10000);

      const allRecords: unknown[] = [];
      let startPosition = 1;
      let hasMore = true;

      while (hasMore && allRecords.length < maxTotal) {
        const remaining = maxTotal - allRecords.length;
        const fetchSize = Math.min(pageSize, remaining);

        let sql = `SELECT * FROM ${entity}`;
        if (args.where) sql += ` WHERE ${args.where}`;
        if (args.orderBy) sql += ` ORDERBY ${args.orderBy}`;
        sql += ` STARTPOSITION ${startPosition} MAXRESULTS ${fetchSize}`;

        const encodedQuery = encodeURIComponent(sql);
        const page = await logger.time(
          "tool.query_all_pages.page",
          () => client.get<{ QueryResponse: Record<string, unknown>; time: string }>(`/query?query=${encodedQuery}`),
          { tool: "query_all_pages", entity, page: Math.ceil(startPosition / pageSize) }
        );

        const queryResponse = page.QueryResponse as Record<string, unknown>;
        const pageRecords = (queryResponse[entity] as unknown[]) ?? [];

        allRecords.push(...pageRecords);
        startPosition += fetchSize;

        // If we got fewer records than requested, we're done
        hasMore = pageRecords.length >= fetchSize;
      }

      const result = {
        entity,
        totalFetched: allRecords.length,
        records: allRecords,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
