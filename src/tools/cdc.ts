// Change Data Capture (CDC) tool: cdc_query
// QuickBooks CDC API — fetch all changes since a timestamp
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── cdc_query ──────────────────────────────────────────────────────────────
  server.registerTool(
    "cdc_query",
    {
      title: "Change Data Capture Query",
      description:
        "Fetch all QuickBooks entities that have changed since a given timestamp. Essential for incremental sync — instead of re-fetching all records, you get only what changed. Supports monitoring multiple entity types in a single call. Returns created, updated, and deleted records since changedSince. The response includes a 'CDCResponse' with changed entities grouped by type. Use this to keep external systems in sync with QuickBooks efficiently.",
      inputSchema: {
        entities: z
          .array(z.string())
          .min(1)
          .describe(
            "List of entity types to monitor (e.g. ['Invoice', 'Customer', 'Item', 'Bill', 'Payment', 'Vendor', 'Account'])"
          ),
        changedSince: z
          .string()
          .describe(
            "ISO 8601 datetime to fetch changes from (e.g. '2024-01-01T00:00:00-08:00'). Use the lastChangedTimestamp from a previous CDC response."
          ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const entitiesParam = (args.entities as string[]).join(",");
      const changedSince = encodeURIComponent(args.changedSince as string);

      const result = await logger.time(
        "tool.cdc_query",
        () => client.get(`/cdc?entities=${entitiesParam}&changedSince=${changedSince}`),
        { tool: "cdc_query", entities: (args.entities as string[]).join(","), changedSince: args.changedSince }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── cdc_poll ───────────────────────────────────────────────────────────────
  server.registerTool(
    "cdc_poll",
    {
      title: "Poll All Entity Changes Since Timestamp",
      description:
        "Convenience wrapper around Change Data Capture that polls the most common QuickBooks entity types for changes since a given timestamp. Fetches changes for: Invoice, Customer, Vendor, Item, Bill, Payment, Estimate, PurchaseOrder, Account, CreditMemo, JournalEntry, Deposit, Transfer, and more — all in a single request. Returns all changed entities grouped by type. Ideal for nightly sync jobs or webhook alternatives.",
      inputSchema: {
        changedSince: z
          .string()
          .describe(
            "ISO 8601 datetime to fetch changes from (e.g. '2024-01-15T00:00:00-08:00'). On first run, use a date far in the past to get all records."
          ),
        includeDeleted: z
          .boolean()
          .optional()
          .describe("Whether response includes deleted entity stubs (default: true — deleted entities show with Active=false or status=Deleted)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const allEntities = [
        "Invoice",
        "Customer",
        "Vendor",
        "Item",
        "Bill",
        "Payment",
        "Estimate",
        "PurchaseOrder",
        "Account",
        "CreditMemo",
        "JournalEntry",
        "Deposit",
        "Transfer",
        "SalesReceipt",
        "BillPayment",
        "Purchase",
        "RefundReceipt",
        "TimeActivity",
        "Employee",
        "Department",
        "Class",
        "TaxCode",
        "TaxRate",
      ];

      const entitiesParam = allEntities.join(",");
      const changedSince = encodeURIComponent(args.changedSince as string);

      const result = await logger.time(
        "tool.cdc_poll",
        () => client.get(`/cdc?entities=${entitiesParam}&changedSince=${changedSince}`),
        { tool: "cdc_poll", changedSince: args.changedSince }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
