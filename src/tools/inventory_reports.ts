// Inventory Reports: valuation detail, reorder point, inventory aging
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── inventory_valuation_detail ─────────────────────────────────────────────
  server.registerTool(
    "inventory_valuation_detail",
    {
      title: "Inventory Valuation Detail Report",
      description:
        "Get an Inventory Valuation Detail report showing each individual inventory transaction (purchase, sale, adjustment) that contributed to the current inventory value. More granular than inventory_valuation_summary — shows every transaction per item. Use for COGS audit and inventory reconciliation.",
      inputSchema: {
        startDate: z.string().optional().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Report end date / as-of date (YYYY-MM-DD)"),
        itemId: z.string().optional().describe("Filter to a specific inventory item ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.startDate) params.set("start_date", args.startDate as string);
      if (args.endDate) params.set("end_date", args.endDate as string);
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.inventory_valuation_detail",
        () => client.get(`/reports/InventoryValuationDetail?${params}`),
        { tool: "inventory_valuation_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── inventory_stock_status ─────────────────────────────────────────────────
  server.registerTool(
    "inventory_stock_status",
    {
      title: "Inventory Stock Status",
      description:
        "Get current inventory stock levels for all inventory items. Returns quantity on hand, reorder point, preferred vendor, and current asset value per item. Use to identify items that need reordering, excess inventory, and overall stock health.",
      inputSchema: {
        itemId: z.string().optional().describe("Filter to a specific item ID"),
        lowStockOnly: z.boolean().optional().describe("Return only items at or below reorder point (default: false)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      let where = "Type = 'Inventory'";
      if (args.itemId) where += ` AND Id = '${args.itemId}'`;
      if (args.lowStockOnly) where += " AND QtyOnHand <= ReorderPoint";
      const result = await logger.time(
        "tool.inventory_stock_status",
        () => client.query("Item", where, 1, 1000),
        { tool: "inventory_stock_status" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── physical_inventory_worksheet ───────────────────────────────────────────
  server.registerTool(
    "physical_inventory_worksheet",
    {
      title: "Physical Inventory Worksheet",
      description:
        "Get a Physical Inventory Worksheet listing all inventory items with their current quantity on hand and space for physical count quantities. Use when conducting a physical inventory count to identify discrepancies and create inventory adjustments.",
      inputSchema: {
        asOfDate: z.string().optional().describe("As-of date for on-hand quantities (YYYY-MM-DD, default: today)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.asOfDate) params.set("report_date", args.asOfDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.physical_inventory_worksheet",
        () => client.get(`/reports/PhysicalInventoryWorksheet?${params}`),
        { tool: "physical_inventory_worksheet" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── list_inventory_items ───────────────────────────────────────────────────
  server.registerTool(
    "list_inventory_items",
    {
      title: "List Inventory Items",
      description:
        "List all inventory items with their current quantity on hand, purchase cost, sales price, and reorder point. Filters to inventory-type items only. Use for stock management, reorder planning, and inventory cost review.",
      inputSchema: {
        where: z.string().optional().describe("Additional QBO WHERE clause (appended to 'Type = Inventory')"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC', 'QtyOnHand ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const baseWhere = "Type = 'Inventory'";
      const where = args.where ? `${baseWhere} AND ${args.where}` : baseWhere;
      const result = await logger.time(
        "tool.list_inventory_items",
        () => client.query("Item", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_inventory_items" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
