// Inventory Adjustment tools: list_inventory_adjustments, get_inventory_adjustment, create_inventory_adjustment
// Inventory adjustments correct inventory quantities and values
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const AdjustmentLineSchema = z.object({
  itemId: z.string().describe("Item (inventory product) ID to adjust"),
  quantityOnHand: z.number().optional().describe("New quantity on hand (adjusted to this value)"),
  quantityDiff: z.number().optional().describe("Quantity change (positive = increase, negative = decrease)"),
  currentValue: z.number().optional().describe("New value of inventory (replaces existing)"),
  description: z.string().optional().describe("Line description / reason for adjustment"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_inventory_adjustments ─────────────────────────────────────────────
  server.registerTool(
    "list_inventory_adjustments",
    {
      title: "List QuickBooks Inventory Adjustments",
      description:
        "List QuickBooks Online inventory adjustments used to correct on-hand quantities or values for inventory items. Returns adjustment date, reference number, adjustment account, and items adjusted. Use for inventory audit trails, cycle count reconciliations, and shrinkage tracking. Supports pagination.",
      inputSchema: {
        txnDateAfter: z.string().optional().describe("Filter adjustments after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter adjustments before date (YYYY-MM-DD)"),
        docNumber: z.string().optional().describe("Filter by document/reference number"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      if (args.docNumber) whereParts.push(`DocNumber = '${args.docNumber}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_inventory_adjustments",
        () => client.query("InventoryAdjustment", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_inventory_adjustments" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_inventory_adjustment ───────────────────────────────────────────────
  server.registerTool(
    "get_inventory_adjustment",
    {
      title: "Get QuickBooks Inventory Adjustment",
      description:
        "Get full details for a QuickBooks inventory adjustment by ID, including all adjusted items, their quantity changes, value changes, and the inventory adjustment account used.",
      inputSchema: {
        inventoryAdjustmentId: z.string().describe("QuickBooks inventory adjustment ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_inventory_adjustment",
        () => client.get(`/inventoryadjustment/${args.inventoryAdjustmentId}`),
        { tool: "get_inventory_adjustment", inventoryAdjustmentId: args.inventoryAdjustmentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_inventory_adjustment ────────────────────────────────────────────
  server.registerTool(
    "create_inventory_adjustment",
    {
      title: "Create QuickBooks Inventory Adjustment",
      description:
        "Create a QuickBooks inventory adjustment to correct on-hand quantities or values for inventory items. Required: adjustmentAccountId (the P&L account to debit/credit for the value change) and at least one line item. Common use cases: cycle count corrections, damaged goods write-offs, theft/shrinkage, opening inventory entry.",
      inputSchema: {
        adjustmentAccountId: z
          .string()
          .describe("Account ID for the adjustment (typically an expense account like 'Inventory Shrinkage')"),
        lineItems: z
          .array(AdjustmentLineSchema)
          .min(1)
          .describe("Items to adjust with quantity/value changes"),
        txnDate: z.string().optional().describe("Adjustment date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Reference/document number"),
        privateNote: z.string().optional().describe("Internal note explaining the adjustment reason"),
        classId: z.string().optional().describe("Class ID for cost tracking"),
        departmentId: z.string().optional().describe("Department/location ID"),
        currencyCode: z.string().optional().describe("Currency code (e.g. 'USD')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lineItems as Array<{
        itemId: string;
        quantityOnHand?: number;
        quantityDiff?: number;
        currentValue?: number;
        description?: string;
      }>).map((item) => {
        const lineDetail: Record<string, unknown> = {
          ItemRef: { value: item.itemId },
        };
        if (item.quantityOnHand !== undefined) lineDetail.QtyOnHand = item.quantityOnHand;
        if (item.quantityDiff !== undefined) lineDetail.QtyDiff = item.quantityDiff;
        if (item.currentValue !== undefined) lineDetail.CurrentValue = item.currentValue;

        return {
          DetailType: "ItemAdjustmentLineDetail",
          ...(item.description ? { Description: item.description } : {}),
          ItemAdjustmentLineDetail: lineDetail,
        };
      });

      const adjustment: Record<string, unknown> = {
        AdjustAccountRef: { value: args.adjustmentAccountId },
        Line: lines,
      };

      if (args.txnDate) adjustment.TxnDate = args.txnDate;
      if (args.docNumber) adjustment.DocNumber = args.docNumber;
      if (args.privateNote) adjustment.PrivateNote = args.privateNote;
      if (args.classId) adjustment.ClassRef = { value: args.classId };
      if (args.departmentId) adjustment.DepartmentRef = { value: args.departmentId };
      if (args.currencyCode) adjustment.CurrencyRef = { value: args.currencyCode };

      const result = await logger.time(
        "tool.create_inventory_adjustment",
        () => client.post("/inventoryadjustment", adjustment),
        { tool: "create_inventory_adjustment" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_inventory_adjustment ────────────────────────────────────────────
  server.registerTool(
    "delete_inventory_adjustment",
    {
      title: "Delete QuickBooks Inventory Adjustment",
      description:
        "Delete a QuickBooks inventory adjustment. Requires the adjustment ID and syncToken (from get_inventory_adjustment). Deleting reverses all quantity and value changes made by the adjustment.",
      inputSchema: {
        inventoryAdjustmentId: z.string().describe("Inventory adjustment ID to delete"),
        syncToken: z.string().describe("SyncToken from get_inventory_adjustment"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.delete_inventory_adjustment",
        () => client.post("/inventoryadjustment?operation=delete", {
          Id: args.inventoryAdjustmentId,
          SyncToken: args.syncToken,
        }),
        { tool: "delete_inventory_adjustment", inventoryAdjustmentId: args.inventoryAdjustmentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
